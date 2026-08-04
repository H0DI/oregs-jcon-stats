// Pure DOM readers for the jconj practice page. Never throw into the host
// page: every function returns null on missing/unexpected structure so the
// caller can degrade gracefully instead of breaking the site.
(() => {
  globalThis.JCS = globalThis.JCS || {};

  const MULT_SIGN = /×\s*$/; // U+00D7 MULTIPLICATION SIGN
  const CIRCLE = /○\s*$/; // U+25CB WHITE CIRCLE

  const FORM_ORDER = [
    'Causative-Passive', // must be checked before Causative and Passive
    'Causative',
    'Passive',
    'Potential',
    'Imperative',
    'Volitional',
    'Past',
    'て-form',
    'Adverb',
  ];

  const VERB_TYPE_TEXT_TO_CLASS = {
    'う-verb': 'u',
    'る-verb': 'ru',
    Irregular: 'irv',
    'い-adjective': 'i',
    'な-adjective': 'na',
  };

  /** Strip furigana (<rt>/.rt content) from a verb-text element, returning the base form. */
  function baseFormFromEl(verbTextEl) {
    if (!verbTextEl) return null;
    const clone = verbTextEl.cloneNode(true);
    clone.querySelectorAll('rt, .rt').forEach((n) => n.remove());
    return clone.textContent.trim();
  }

  /** Parse the conjugation-inquery-text container's textContent into the asked form. */
  function parseForm(inqueryText) {
    for (const label of FORM_ORDER) {
      if (inqueryText.includes(label)) return label;
    }
    return 'Present';
  }

  function parsePolarity(inqueryText) {
    return inqueryText.includes('Negative');
  }

  function parsePoliteness(inqueryText) {
    if (inqueryText.includes('Polite')) return 'polite';
    if (inqueryText.includes('Plain')) return 'plain';
    return null;
  }

  /** Resolve word class: prefer the shipped word map, fall back to the
   *  site's own #verb-type text (only populated after a wrong answer). */
  function classify(base, verbTypeText) {
    const known = JCS.WORD_CLASS && JCS.WORD_CLASS[base];
    if (known) return known;
    const revealed = verbTypeText && VERB_TYPE_TEXT_TO_CLASS[verbTypeText.trim()];
    return revealed || '?';
  }

  /**
   * Read the currently displayed question.
   * @param {Document|Element} root
   * @returns {{base:string, translation:string, form:string, neg:boolean, pol:string|null, cls:string}|null}
   */
  function readQuestion(root) {
    const verbTextEl = root.querySelector('#verb-text');
    const inqueryEl = root.querySelector('#conjugation-inquery-text');
    if (!verbTextEl || !inqueryEl) return null;

    const base = baseFormFromEl(verbTextEl);
    if (!base) return null;

    const inqueryText = inqueryEl.textContent || '';
    const translationEl = root.querySelector('#translation');
    const verbTypeEl = root.querySelector('#verb-type');

    return {
      base,
      translation: translationEl ? translationEl.textContent.trim() : '',
      form: parseForm(inqueryText),
      neg: parsePolarity(inqueryText),
      pol: parsePoliteness(inqueryText),
      cls: classify(base, verbTypeEl ? verbTypeEl.textContent : ''),
    };
  }

  /**
   * Read the graded result currently shown in #status-box.
   * Returns null if no result is currently visible (still display-none).
   * @param {Document|Element} root
   * @returns {{ok:boolean, userAnswer:string, expectedAnswer:string}|null}
   */
  function readResult(root) {
    const statusBox = root.querySelector('#status-box');
    const statusText = root.querySelector('#status-text');
    if (!statusBox || !statusText) return null;
    if (statusBox.className.includes('display-none')) return null;

    const bg = (statusBox.style && statusBox.style.background) || '';
    const ok = bg.trim() === 'green';

    const html = statusText.innerHTML || '';
    const parts = html.split(/<br\s*\/?>/i).map((s) => stripTags(s).trim());

    let userAnswer = '';
    let expectedAnswer = '';
    if (parts.length >= 2) {
      if (!ok) {
        const rawUser = parts[0].replace(MULT_SIGN, '').trim();
        userAnswer = rawUser === '_' ? '' : rawUser;
      }
      expectedAnswer = parts[1].replace(CIRCLE, '').trim();
    }

    return { ok, userAnswer, expectedAnswer };
  }

  function stripTags(html) {
    // DOMParser instead of innerHTML: identical result, but never assigns
    // to .innerHTML, which extension linters (rightly) flag on principle.
    return new DOMParser().parseFromString(html, 'text/html').body.textContent;
  }

  /** True while the Options screen (not the question screen) is showing. */
  function isOptionsScreenOpen(root) {
    const mainView = root.querySelector('#main-view');
    return !!mainView && mainView.className.includes('display-none');
  }

  /** True once #status-box has become visible (an answer was just graded). */
  function isResultVisible(root) {
    const statusBox = root.querySelector('#status-box');
    return !!statusBox && !statusBox.className.includes('display-none');
  }

  JCS.parse = {
    baseFormFromEl,
    parseForm,
    parsePolarity,
    parsePoliteness,
    classify,
    readQuestion,
    readResult,
    isOptionsScreenOpen,
    isResultVisible,
  };
})();
