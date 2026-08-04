// Minimal, dependency-free test runner + assertions for parse.js and
// stats.js. Loaded by test/test.html after src/*.js and test/fixtures.js.
globalThis.JCS = globalThis.JCS || {};

(() => {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err && err.message ? err.message : String(err) });
    }
  }

  function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error(`${msg || 'assertEqual failed'}: expected ${e}, got ${a}`);
    }
  }

  function assertTrue(cond, msg) {
    if (!cond) throw new Error(msg || 'assertTrue failed');
  }

  function assertClose(actual, expected, tolerance, msg) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`${msg || 'assertClose failed'}: expected ~${expected} (±${tolerance}), got ${actual}`);
    }
  }

  // ---------------------------------------------------------------------
  // parse.js
  // ---------------------------------------------------------------------

  function questionFixtureCases() {
    return [
      'presentAffirmativePolite',
      'pastPlainWrong',
      'teForm',
      'adverb',
      'causativePassive',
      'causative',
      'emptyAnswer',
      'correctWithSubIndicator',
      'unknownWordCorrect',
      'unknownWordWrongRevealsClass',
    ];
  }

  questionFixtureCases().forEach((key) => {
    test(`parse.readQuestion: ${key}`, () => {
      const fx = JCS.FIXTURES[key];
      const dom = JCS.buildFixtureDom(fx);
      const q = JCS.parse.readQuestion(dom);
      const expected = fx.expect.question || fx.expect;
      assertTrue(q !== null, 'readQuestion returned null');
      assertEqual(q.base, expected.base, 'base');
      assertEqual(q.form, expected.form, 'form');
      assertEqual(q.neg, expected.neg, 'neg');
      assertEqual(q.pol, expected.pol, 'pol');
      assertEqual(q.cls, expected.cls, 'cls');
    });
  });

  test('parse.readResult: not yet graded returns null', () => {
    const dom = JCS.buildFixtureDom(JCS.FIXTURES.presentAffirmativePolite);
    assertEqual(JCS.parse.readResult(dom), null);
  });

  ['pastPlainWrong', 'teForm', 'adverb', 'causativePassive', 'emptyAnswer', 'correctWithSubIndicator', 'unknownWordCorrect', 'unknownWordWrongRevealsClass'].forEach((key) => {
    test(`parse.readResult: ${key}`, () => {
      const fx = JCS.FIXTURES[key];
      const dom = JCS.buildFixtureDom(fx);
      const r = JCS.parse.readResult(dom);
      assertTrue(r !== null, 'readResult returned null');
      assertEqual(r.ok, fx.expect.result.ok, 'ok');
      assertEqual(r.userAnswer, fx.expect.result.userAnswer, 'userAnswer');
      assertEqual(r.expectedAnswer, fx.expect.result.expectedAnswer, 'expectedAnswer');
    });
  });

  test('parse.isResultVisible / isOptionsScreenOpen', () => {
    const notGraded = JCS.buildFixtureDom(JCS.FIXTURES.presentAffirmativePolite);
    assertEqual(JCS.parse.isResultVisible(notGraded), false);
    const graded = JCS.buildFixtureDom(JCS.FIXTURES.pastPlainWrong);
    assertEqual(JCS.parse.isResultVisible(graded), true);

    const mainView = notGraded.querySelector('#main-view');
    assertEqual(JCS.parse.isOptionsScreenOpen(notGraded), false);
    mainView.className = 'results-screen display-none';
    assertEqual(JCS.parse.isOptionsScreenOpen(notGraded), true);
  });

  test('parse.classify: known word ignores stale verb-type text', () => {
    // 古い is in WORD_CLASS as "i"; even if verb-type text said something
    // else, the shipped map should win for known words.
    assertEqual(JCS.parse.classify('古い', 'な-adjective'), 'i');
  });

  test('parse.classify: unknown word with no reveal falls back to "?"', () => {
    assertEqual(JCS.parse.classify('存在しない', ' '), '?');
  });

  // ---------------------------------------------------------------------
  // stats.js
  // ---------------------------------------------------------------------

  function mkEvent(overrides) {
    return Object.assign(
      {
        t: Date.now(),
        w: '書く',
        c: 'u',
        f: 'Past',
        neg: false,
        pol: 'plain',
        ok: true,
        ms: 3000,
      },
      overrides
    );
  }

  test('stats.overall: basic accuracy and counts', () => {
    const events = [mkEvent({ ok: true }), mkEvent({ ok: true }), mkEvent({ ok: false })];
    const o = JCS.stats.overall(events);
    assertEqual(o.total, 3);
    assertEqual(o.correct, 2);
    assertClose(o.accuracy, 2 / 3, 1e-9);
  });

  test('stats.overall: empty log', () => {
    const o = JCS.stats.overall([]);
    assertEqual(o.total, 0);
    assertEqual(o.correct, 0);
    assertEqual(o.accuracy, null);
  });

  test('stats.overall: current/max streak from the log', () => {
    const events = [
      mkEvent({ ok: true }),
      mkEvent({ ok: true }),
      mkEvent({ ok: false }),
      mkEvent({ ok: true }),
      mkEvent({ ok: true }),
      mkEvent({ ok: true }),
    ];
    const o = JCS.stats.overall(events);
    assertEqual(o.currentStreak, 3);
    assertEqual(o.maxStreak, 3);
  });

  test('stats.overall: avgMs excludes outliers over 120000ms', () => {
    const events = [mkEvent({ ms: 2000 }), mkEvent({ ms: 4000 }), mkEvent({ ms: 200000 })];
    const o = JCS.stats.overall(events);
    assertClose(o.avgMs, 3000, 1e-9);
  });

  test('stats.byForm: groups and ranks by form', () => {
    const events = [
      mkEvent({ f: 'Past', ok: true }),
      mkEvent({ f: 'Past', ok: false }),
      mkEvent({ f: 'Volitional', ok: true }),
    ];
    const byForm = JCS.stats.byForm(events);
    const past = byForm.find((b) => b.key === 'Past');
    const vol = byForm.find((b) => b.key === 'Volitional');
    assertEqual(past.n, 2);
    assertClose(past.accuracy, 0.5, 1e-9);
    assertEqual(vol.n, 1);
    assertClose(vol.accuracy, 1, 1e-9);
  });

  test('stats.byClass: groups by word class', () => {
    const events = [mkEvent({ c: 'u', ok: true }), mkEvent({ c: 'ru', ok: false }), mkEvent({ c: 'u', ok: true })];
    const byClass = JCS.stats.byClass(events);
    const u = byClass.find((b) => b.key === 'u');
    assertEqual(u.n, 2);
    assertClose(u.accuracy, 1, 1e-9);
  });

  test('stats.byPolarity and byPoliteness', () => {
    const events = [
      mkEvent({ neg: false, pol: 'plain', ok: true }),
      mkEvent({ neg: true, pol: 'polite', ok: false }),
    ];
    const pol = JCS.stats.byPolarity(events);
    const aff = pol.find((b) => b.key === 'Affirmative');
    const neg = pol.find((b) => b.key === 'Negative');
    assertEqual(aff.n, 1);
    assertEqual(neg.n, 1);

    const polite = JCS.stats.byPoliteness(events);
    const p = polite.find((b) => b.key === 'polite');
    assertEqual(p.n, 1);
    assertEqual(p.accuracy, 0);
  });

  test('stats.byWord: per-word accuracy and last wrong answer', () => {
    const events = [
      mkEvent({ w: '書く', ok: false, ans: 'かいた', exp: 'かきた' }),
      mkEvent({ w: '書く', ok: true }),
      mkEvent({ w: '書く', ok: false, ans: 'かた', exp: 'かいた' }),
    ];
    const byWord = JCS.stats.byWord(events);
    const w = byWord.find((b) => b.key === '書く');
    assertEqual(w.n, 3);
    assertClose(w.accuracy, 1 / 3, 1e-9);
    assertEqual(w.lastWrong.ans, 'かた');
    assertEqual(w.lastWrong.exp, 'かいた');
  });

  test('stats.weakest: excludes buckets under minN, sorts ascending by accuracy', () => {
    const events = [
      // Past: 1/4 correct, n=4 -> included
      mkEvent({ f: 'Past', ok: true }),
      mkEvent({ f: 'Past', ok: false }),
      mkEvent({ f: 'Past', ok: false }),
      mkEvent({ f: 'Past', ok: false }),
      // Volitional: 0/1 -> n=1, excluded with default minN=5... use minN:2 to test threshold precisely
      mkEvent({ f: 'Volitional', ok: false }),
    ];
    const weak = JCS.stats.weakest(events, { minN: 2 });
    assertTrue(weak.every((b) => b.n >= 2), 'weakest should exclude buckets under minN');
    assertEqual(weak[0].key.includes('Past'), true);
  });

  test('stats.byDay: buckets events by local calendar day', () => {
    // Relative to "now" so the test passes regardless of the real date.
    const today = Date.now();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const events = [mkEvent({ t: yesterday, ok: true }), mkEvent({ t: yesterday, ok: false }), mkEvent({ t: today, ok: true })];
    const days = JCS.stats.byDay(events, 14);
    assertEqual(days.length, 14, 'expected 14 day buckets');
    const d1 = days.find((d) => d.n === 2);
    const d2 = days.find((d) => d.n === 1);
    assertTrue(!!d1 && !!d2, 'expected both days present');
  });

  JCS.TestRunner = { run: () => results, test, assertEqual, assertTrue, assertClose };
})();
