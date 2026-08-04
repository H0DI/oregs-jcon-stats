// MutationObserver-driven state machine that turns page mutations into one
// `onAnswer(event)` call per graded answer. Depends only on parse.js.
(() => {
  globalThis.JCS = globalThis.JCS || {};

  function questionSignature(q) {
    return `${q.base}|${q.form}|${q.neg}|${q.pol}`;
  }

  /**
   * @param {{onAnswer: (event: object) => void, onError?: (err: Error) => void}} handlers
   */
  function createWatcher({ onAnswer, onError } = {}) {
    let pendingQuestion = null; // { base, form, neg, pol, cls, sig }
    let shownAt = null;
    let wasResultVisible = false;
    let observer = null;

    function reportError(err) {
      if (onError) onError(err);
      else console.warn('[jconj-stats] watcher error:', err);
    }

    function safeRun(fn) {
      try {
        fn();
      } catch (err) {
        reportError(err);
      }
    }

    function evaluate() {
      if (JCS.parse.isOptionsScreenOpen(document)) return; // ignore while Options screen is open

      const resultVisible = JCS.parse.isResultVisible(document);

      // Rising edge: a result just appeared -> exactly one answer was graded.
      if (resultVisible && !wasResultVisible) {
        const result = JCS.parse.readResult(document);
        if (result && pendingQuestion) {
          const now = Date.now();
          const ms = typeof shownAt === 'number' ? now - shownAt : null;
          const event = {
            t: now,
            w: pendingQuestion.base,
            c: pendingQuestion.cls,
            f: pendingQuestion.form,
            neg: pendingQuestion.neg,
            pol: pendingQuestion.pol,
            ok: result.ok,
            ms,
          };
          if (!result.ok) {
            event.ans = result.userAnswer;
            event.exp = result.expectedAnswer;
          }
          if (onAnswer) onAnswer(event);
        }
      }
      wasResultVisible = resultVisible;

      // While no result is showing, the verb box reflects the *current*
      // question — detect a change so we know when a new one appears
      // (including the very first question at script start).
      if (!resultVisible) {
        const q = JCS.parse.readQuestion(document);
        if (q) {
          const sig = questionSignature(q);
          if (!pendingQuestion || sig !== pendingQuestion.sig) {
            pendingQuestion = { ...q, sig };
            shownAt = Date.now();
          }
        }
      }
    }

    function start(root) {
      const target = root || document.getElementById('toppest-container') || document.body;
      safeRun(evaluate); // capture whatever question is already on screen
      observer = new MutationObserver(() => safeRun(evaluate));
      observer.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });
    }

    function stop() {
      if (observer) observer.disconnect();
      observer = null;
    }

    return { start, stop };
  }

  JCS.createWatcher = createWatcher;
})();
