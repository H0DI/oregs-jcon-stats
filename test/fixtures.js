// Captured/derived HTML snapshots of the jconj page fragments, used by
// test/tests.js. Formats were verified against the live site and its JS
// bundle on 2026-08-04 (see the plan doc for the exact capture notes).
globalThis.JCS = globalThis.JCS || {};

function inquery(...divs) {
  return divs.map((d) => `<div class="conjugation-inquery"><div class="inquery-emoji">${d.emoji}</div><div class="inquery-text">${d.label}</div></div> `).join('');
}

const EMOJI = {
  Past: '⌚',
  Volitional: '🍻',
  Passive: '🧘',
  Causative: '👩‍🏫',
  Potential: '🏋',
  Imperative: '📢',
  'Causative-Passive': '😒',
  Negative: '🚫',
  Polite: '👔',
  Plain: '👪',
};

function tag(label) {
  return inquery({ label, emoji: EMOJI[label] });
}

JCS.FIXTURES = {
  // Present affirmative, Polite — the site emits NO form tag at all for
  // present affirmative, only the politeness tag.
  presentAffirmativePolite: {
    verbTextHTML: '<ruby>笑<span class="rt">わら</span></ruby>う',
    translation: 'laugh',
    verbType: ' ',
    inqueryHTML: tag('Polite'),
    status: null, // not yet graded
    expect: { base: '笑う', form: 'Present', neg: false, pol: 'polite', cls: 'u' },
  },

  // Past, Plain, wrong answer.
  pastPlainWrong: {
    verbTextHTML: '<ruby>古<span class="rt">ふる</span></ruby>い',
    translation: 'old (thing)',
    verbType: 'い-adjective', // revealed because the answer was wrong
    inqueryHTML: tag('Past') + tag('Plain'),
    status: { ok: false, bg: 'rgb(218, 5, 5)', html: 'ふるくない ×<br>ふるかった ○' },
    expect: {
      question: { base: '古い', form: 'Past', neg: false, pol: 'plain', cls: 'i' },
      result: { ok: false, userAnswer: 'ふるくない', expectedAnswer: 'ふるかった' },
    },
  },

  // て-form: appended as bare text, not wrapped in .conjugation-inquery.
  teForm: {
    verbTextHTML: '<ruby>待<span class="rt">ま</span></ruby>つ',
    translation: 'wait',
    verbType: ' ',
    inqueryHTML: 'て-form',
    status: { ok: true, bg: 'green', html: 'Correct<br>まって ○' },
    expect: {
      question: { base: '待つ', form: 'て-form', neg: false, pol: null, cls: 'u' },
      result: { ok: true, userAnswer: '', expectedAnswer: 'まって' },
    },
  },

  // Adverb form (い-adjective only) — also bare text.
  adverb: {
    verbTextHTML: '<ruby>楽<span class="rt">たの</span></ruby>しい',
    translation: 'fun',
    verbType: ' ',
    inqueryHTML: 'Adverb',
    status: { ok: true, bg: 'green', html: 'Correct<br>たのしく ○' },
    expect: {
      question: { base: '楽しい', form: 'Adverb', neg: false, pol: null, cls: 'i' },
      result: { ok: true, userAnswer: '', expectedAnswer: 'たのしく' },
    },
  },

  // Causative-Passive must not be mis-parsed as plain Causative or Passive.
  causativePassive: {
    verbTextHTML: '<ruby>書<span class="rt">か</span></ruby>く',
    translation: 'write',
    verbType: ' ',
    inqueryHTML: tag('Causative-Passive') + tag('Plain'),
    status: { ok: true, bg: 'green', html: 'Correct<br>かかされた ○' },
    expect: {
      question: { base: '書く', form: 'Causative-Passive', neg: false, pol: 'plain', cls: 'u' },
      result: { ok: true, userAnswer: '', expectedAnswer: 'かかされた' },
    },
  },

  // Plain Causative, to distinguish from Causative-Passive.
  causative: {
    verbTextHTML: '<ruby>書<span class="rt">か</span></ruby>く',
    translation: 'write',
    verbType: ' ',
    inqueryHTML: tag('Causative') + tag('Plain'),
    status: null,
    expect: { base: '書く', form: 'Causative', neg: false, pol: 'plain', cls: 'u' },
  },

  // Negative Past Polite, empty answer (renders as "_").
  emptyAnswer: {
    verbTextHTML: '<ruby>飲<span class="rt">の</span></ruby>む',
    translation: 'drink',
    verbType: 'う-verb',
    inqueryHTML: tag('Past') + tag('Negative') + tag('Polite'),
    status: { ok: false, bg: 'rgb(218, 5, 5)', html: '_ ×<br>のみませんでした ○' },
    expect: {
      question: { base: '飲む', form: 'Past', neg: true, pol: 'polite', cls: 'u' },
      result: { ok: false, userAnswer: '', expectedAnswer: 'のみませんでした' },
    },
  },

  // Correct answer with a sub-conjugation-indicator span in the status text.
  correctWithSubIndicator: {
    verbTextHTML: '<ruby>来<span class="rt">く</span></ruby>る',
    translation: 'come',
    verbType: ' ',
    inqueryHTML: tag('Volitional') + tag('Plain'),
    status: {
      ok: true,
      bg: 'green',
      html: 'Correct<span class="sub-conjugation-indicator">(ら-omitted short form)</span><br>これ ○',
    },
    expect: {
      question: { base: '来る', form: 'Volitional', neg: false, pol: 'plain', cls: 'irv' },
      result: { ok: true, userAnswer: '', expectedAnswer: 'これ' },
    },
  },

  // A word absent from the shipped WORD_CLASS map and never revealed
  // (correct answer) — class should fall back to "?".
  unknownWordCorrect: {
    verbTextHTML: '<ruby>踊<span class="rt">おど</span></ruby>る',
    translation: 'dance',
    verbType: ' ',
    inqueryHTML: tag('Past') + tag('Plain'),
    status: { ok: true, bg: 'green', html: 'Correct<br>おどった ○' },
    expect: {
      question: { base: '踊る', form: 'Past', neg: false, pol: 'plain', cls: '?' },
      result: { ok: true, userAnswer: '', expectedAnswer: 'おどった' },
    },
  },

  // Same unknown word, but wrong answer reveals the class via #verb-type.
  unknownWordWrongRevealsClass: {
    verbTextHTML: '<ruby>踊<span class="rt">おど</span></ruby>る',
    translation: 'dance',
    verbType: 'う-verb',
    inqueryHTML: tag('Past') + tag('Plain'),
    status: { ok: false, bg: 'rgb(218, 5, 5)', html: 'おどいた ×<br>おどった ○' },
    expect: {
      question: { base: '踊る', form: 'Past', neg: false, pol: 'plain', cls: 'u' },
      result: { ok: false, userAnswer: 'おどいた', expectedAnswer: 'おどった' },
    },
  },
};

/**
 * Build a detached DOM fragment for a fixture's question (+ optional status).
 *
 * Important: the real site sets innerHTML directly on #conjugation-inquery-text
 * (a <p>) with a string of <div> content. Because that innerHTML assignment's
 * parsed fragment never contains a literal <p> start tag, the browser doesn't
 * apply its "close an open p before a block-level element" rule and the divs
 * end up as real children of the p. If we instead build one big HTML string
 * with a literal `<p>...<div>...` in it (as this used to do), the parser DOES
 * see the p and div tokens in the same stream and auto-closes the p before
 * the divs, leaving #conjugation-inquery-text empty. So: build the shell
 * first, then set innerHTML on the leaf elements separately, exactly like
 * the site's own code does.
 */
JCS.buildFixtureDom = function buildFixtureDom(fixture) {
  const container = document.createElement('div');
  container.innerHTML = `
    <div id="verb-container">
      <div id="verb-box">
        <p id="verb-text" lang="ja"></p>
        <p id="translation"></p>
        <p id="verb-type"></p>
      </div>
    </div>
    <div id="conjugation-inquery-container">
      <p id="conjugation-inquery-text"></p>
    </div>
    <div id="status-container">
      <div id="status-box" class="${fixture.status ? '' : 'display-none'}"${fixture.status ? ` style="background: ${fixture.status.bg};"` : ''}>
        <p id="status-text"></p>
      </div>
    </div>
    <div id="main-view" class="question-screen"></div>
  `;
  container.querySelector('#verb-text').innerHTML = fixture.verbTextHTML;
  container.querySelector('#translation').textContent = fixture.translation;
  container.querySelector('#verb-type').textContent = fixture.verbType;
  container.querySelector('#conjugation-inquery-text').innerHTML = fixture.inqueryHTML;
  if (fixture.status) {
    container.querySelector('#status-text').innerHTML = fixture.status.html;
  }
  return container;
};
