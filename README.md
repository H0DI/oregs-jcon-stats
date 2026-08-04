<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Oreg's jcon stats logo">
</p>

<h1 align="center">Oreg's jcon stats</h1>

<p align="center">
  Accuracy, streaks, and per-word/per-form breakdowns for
  <a href="https://baileysnyder.com/jconj/">baileysnyder.com/jconj</a>
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-4c8bf5">
  <img alt="Chrome / Edge / Firefox" src="https://img.shields.io/badge/browser-chrome%20%7C%20edge%20%7C%20firefox-brightgreen">
  <img alt="No dependencies" src="https://img.shields.io/badge/dependencies-none-lightgrey">
  <img alt="Latest release" src="https://img.shields.io/github/v/release/H0DI/oregs-jcon-stats">
</p>

---

## ✨ What it adds

| | |
|---|---|
| 🎯 **Accuracy chip** | A live accuracy % right next to the site's own Current/Max Streak counters. |
| 📊 **Overview** | All-time accuracy, totals, streaks, average answer time, answered today, and your top-5 weakest areas. |
| 🈴 **Forms** | Accuracy per conjugation form — Past, て-form, Volitional, Passive, Causative, Potential, Imperative, Causative-Passive, Present — plus Affirmative/Negative and Plain/Polite roll-ups. |
| 📝 **Words** | The specific words you keep missing, with word class, accuracy, attempt count, and your most recent wrong answer vs. the correct one. |
| 📈 **History** | Answers-per-day and accuracy over the last 14 days. |

> **Read-only, always.** It only *observes* the page via a `MutationObserver` —
> it never touches the site's own settings, `localStorage`, or question flow.
> Everything is stored locally in `chrome.storage.local` and never leaves
> your machine.

## 📦 Install

**Chrome / Edge**

1. Grab the latest zip from **[Releases](https://github.com/H0DI/oregs-jcon-stats/releases)** and unzip it (or use this `jconj-stats` folder directly).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.
5. Visit [baileysnyder.com/jconj](https://baileysnyder.com/jconj/) — the accuracy chip and stats card appear automatically.

**Firefox**

1. Grab the latest zip, unzip it (or use this `jconj-stats` folder directly).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` inside the folder.
4. Visit [baileysnyder.com/jconj](https://baileysnyder.com/jconj/).

> ⚠️ Firefox only allows unsigned extensions to be loaded **temporarily** —
> it's removed the moment Firefox restarts, and you'll need to repeat step 3
> next time. This is a Firefox restriction on unsigned add-ons, not
> something this extension can work around. For a permanent install you'd
> need to sign the extension through [addons.mozilla.org](https://addons.mozilla.org/developers/)
> (free, and can be done "unlisted" so it stays private) — ask if you want
> help with that.

> ℹ️ The zip built for AMO submission on this branch excludes `test/`
> (Mozilla's linter flags test-only code with warnings that don't apply to
> what actually ships) and the panel's footer has no "Run self-tests" link
> as a result. To self-test, clone the repo and open `test/test.html`
> directly — see below.

## 🔄 Updating without losing your data

**Chrome / Edge**

> Chrome derives an unpacked extension's ID from the **absolute folder path**
> it was loaded from — and that's what your practice history is scoped to.

- ✅ **Do**: unzip the new version **into the same folder**, overwriting the old files, then click the reload icon (⟳) on the extension's card in `chrome://extensions`.
- ❌ **Don't**: unzip into a *different* folder and "Load unpacked" that instead — that's a new ID, meaning empty storage and a duplicate entry in `chrome://extensions`.

**Firefox**

Since a temporary add-on is wiped on every restart anyway, there's no
"preserve data across updates" step here — your stats only ever last for
the current Firefox session. Overwrite the files in the same folder before
re-loading if you want the *current session's* data to survive a reload
(not a restart).

<details>
<summary><h2>🔧 How it works</h2></summary>

- `src/parse.js` reads the current question and the graded result straight
  out of the site's DOM (word, conjugation form, negative/politeness,
  correct/incorrect, your answer vs. the expected answer).
- `src/words.js` is a static map of the site's ~109 vocabulary words to
  their word class (godan / ichidan / irregular verb / い-adjective /
  な-adjective), extracted from the site's own JS bundle — see below. The
  site itself only reveals a word's class after you get it wrong, so
  shipping the map lets every answer be classified.
- `src/watcher.js` watches `#status-box` for the transition that means
  "an answer was just graded" and turns it into one event.
- `src/store.js` persists events to `chrome.storage.local`, chunked per
  page-load session so multiple open tabs never clobber each other.
- `src/stats.js` computes every statistic shown in the UI from the raw
  event log — nothing is stored pre-aggregated.
- `src/panel.js` renders the streak-row chip and the stats card.

</details>

<details>
<summary><h2>🈶 Regenerating <code>src/words.js</code></h2></summary>

If the site adds new vocabulary, the shipped word map will fall behind
(the extension still works — it falls back to "Unknown" class, or the
class revealed on a wrong answer). To regenerate:

1. Open https://baileysnyder.com/jconj/ in a normal tab.
2. Open DevTools → Console.
3. Paste the contents of `tools/extract-words.js` and press Enter.
4. It prints a ready-to-paste `WORD_CLASS` object and warns about any
   duplicate/missing entries. Paste the output into `src/words.js`.

</details>

<details>
<summary><h2>🧪 Running the self-tests</h2></summary>

Open `chrome-extension://<extension-id>/test/test.html` (the id is shown
on `chrome://extensions` once loaded), or open `test/test.html` directly
in a browser tab — it has no dependency on the live site and runs entirely
against captured fixtures.

</details>

<details>
<summary><h2>📁 Project layout</h2></summary>

```
manifest.json          MV3 manifest
src/words.js            static word -> class map
src/parse.js             DOM readers (pure functions)
src/stats.js              aggregation over the event log (pure functions)
src/store.js               chrome.storage.local adapter, session chunking
src/watcher.js               MutationObserver -> answer events
src/panel.js                   builds/updates the injected UI
src/panel.css                   styling, matched to the site
src/main.js                       bootstrap
test/fixtures.js        captured HTML snapshots used by the tests
test/tests.js            assertions for parse.js and stats.js
test/test.html            self-test runner page
tools/extract-words.js  console snippet to regenerate src/words.js
```

</details>

<p align="center"><sub>No build step, no npm dependencies — every file is a plain script loaded directly by the manifest and by the test runner.</sub></p>
