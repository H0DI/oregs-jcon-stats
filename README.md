# Oreg's jcon stats

A Chrome/Edge extension that adds practice statistics to
[baileysnyder.com/jconj](https://baileysnyder.com/jconj/) — a Japanese
conjugation drill site that otherwise tracks only current/max streak.

It adds:

- A live **accuracy %** figure next to the site's own streak counters.
- An expandable **stats card** below the practice box with four tabs:
  - **Overview** — all-time accuracy, totals, streaks, average answer time,
    answered today, and your top-5 weakest areas.
  - **Forms** — accuracy broken down by conjugation form (Past, て-form,
    Volitional, Passive, Causative, Potential, Imperative,
    Causative-Passive, Present), plus Affirmative/Negative and
    Plain/Polite roll-ups.
  - **Words** — the specific words you miss most, with word class, accuracy,
    attempt count, and your most recent wrong answer vs. the expected one.
  - **History** — answers-per-day and accuracy over the last 14 days.

The extension is **read-only** with respect to the site: it only observes
the page via a `MutationObserver` and never changes the site's own
settings, `localStorage`, or question flow. All data is stored locally via
`chrome.storage.local` and never leaves your machine.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `jconj-stats` folder.
4. Visit https://baileysnyder.com/jconj/ — the accuracy figure and stats
   card should appear automatically.

## Updating without losing your data

Chrome derives an unpacked extension's ID from the **absolute folder path**
it was loaded from, and your practice history lives in `chrome.storage.local`,
which is scoped to that ID. So:

- **Extract the new release into the same folder** you originally used for
  "Load unpacked" (overwriting the old files), then click the reload icon
  (⟳) on the extension's card in `chrome://extensions`. Your data is
  untouched — a code reload doesn't touch stored data.
- **Don't** extract the new version into a different folder and "Load
  unpacked" that instead — a new path means a new extension ID, which means
  empty storage (a fresh start), and you'd end up with two separate entries
  in `chrome://extensions`. If that happens by accident, remove the old
  entry and go back to using the original folder.

## How it works

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

## Regenerating `src/words.js`

If the site adds new vocabulary, the shipped word map will fall behind
(the extension still works — it falls back to "Unknown" class, or the
class revealed on a wrong answer). To regenerate:

1. Open https://baileysnyder.com/jconj/ in a normal tab.
2. Open DevTools → Console.
3. Paste the contents of `tools/extract-words.js` and press Enter.
4. It prints a ready-to-paste `WORD_CLASS` object and warns about any
   duplicate/missing entries. Paste the output into `src/words.js`.

## Running the self-tests

Open `chrome-extension://<extension-id>/test/test.html` (the id is shown
on `chrome://extensions` once loaded), or open `test/test.html` directly
in a browser tab — it has no dependency on the live site and runs entirely
against captured fixtures.

## Project layout

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

No build step, no npm dependencies — every file is a plain script loaded
directly by the manifest and by the test runner.
