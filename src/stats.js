// Pure aggregation over an event log. Nothing here touches storage or the
// DOM — every function takes an events array and returns plain data, which
// keeps the event log the single source of truth (no separately stored,
// possibly-stale, pre-aggregated numbers).
(() => {
  globalThis.JCS = globalThis.JCS || {};

  const MS_OUTLIER_CAP = 120000; // exclude answers that took >2min (idle tab)

  function groupBy(events, keyFn) {
    const map = new Map();
    events.forEach((e) => {
      const key = keyFn(e);
      if (key == null) return;
      if (!map.has(key)) map.set(key, { key, n: 0, correct: 0 });
      const bucket = map.get(key);
      bucket.n++;
      if (e.ok) bucket.correct++;
    });
    return [...map.values()].map((b) => ({ ...b, accuracy: b.n ? b.correct / b.n : null }));
  }

  /** Worst-accuracy-first, ties broken by most-attempts-first. */
  function sortWorstFirst(buckets) {
    return buckets.slice().sort((a, b) => {
      if (a.accuracy === null && b.accuracy === null) return b.n - a.n;
      if (a.accuracy === null) return 1;
      if (b.accuracy === null) return -1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.n - a.n;
    });
  }

  function isSameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Overall totals, accuracy, streaks (recomputed from the log — not
   *  trusted from the site, which resets its own streak display on reload),
   *  average answer time, and today's count. */
  function overall(events) {
    const sorted = events.slice().sort((a, b) => a.t - b.t);
    const total = sorted.length;
    const correct = sorted.reduce((n, e) => n + (e.ok ? 1 : 0), 0);
    const accuracy = total ? correct / total : null;

    let currentStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].ok) currentStreak++;
      else break;
    }
    let maxStreak = 0;
    let run = 0;
    sorted.forEach((e) => {
      if (e.ok) {
        run++;
        if (run > maxStreak) maxStreak = run;
      } else {
        run = 0;
      }
    });

    const validMs = sorted.filter((e) => typeof e.ms === 'number' && e.ms >= 0 && e.ms <= MS_OUTLIER_CAP).map((e) => e.ms);
    const avgMs = validMs.length ? validMs.reduce((a, b) => a + b, 0) / validMs.length : null;

    const now = new Date();
    const today = sorted.reduce((n, e) => n + (isSameLocalDay(new Date(e.t), now) ? 1 : 0), 0);

    return { total, correct, accuracy, currentStreak, maxStreak, avgMs, today };
  }

  function byForm(events) {
    return sortWorstFirst(groupBy(events, (e) => e.f));
  }

  function byClass(events) {
    return sortWorstFirst(groupBy(events, (e) => e.c));
  }

  function byPolarity(events) {
    return sortWorstFirst(groupBy(events, (e) => (e.neg ? 'Negative' : 'Affirmative')));
  }

  /** Politeness only applies to forms that distinguish plain/polite;
   *  events with pol === null (て-form, Adverb) are excluded. */
  function byPoliteness(events) {
    return sortWorstFirst(groupBy(events.filter((e) => e.pol), (e) => e.pol));
  }

  function bucketKey(e) {
    let key = e.f;
    if (e.neg) key += ' Negative';
    if (e.pol) key += e.pol === 'polite' ? ' Polite' : ' Plain';
    return key;
  }

  /** Finer-grained than byForm: form + polarity + politeness combined. */
  function byBucket(events) {
    return sortWorstFirst(groupBy(events, bucketKey));
  }

  /** Per-word accuracy plus the most recent wrong answer for that word. */
  function byWord(events) {
    const sorted = events.slice().sort((a, b) => a.t - b.t);
    const map = new Map();
    sorted.forEach((e) => {
      if (!map.has(e.w)) map.set(e.w, { key: e.w, n: 0, correct: 0, cls: e.c, lastWrong: null });
      const b = map.get(e.w);
      b.n++;
      b.cls = e.c;
      if (e.ok) {
        b.correct++;
      } else {
        b.lastWrong = { ans: e.ans, exp: e.exp, t: e.t };
      }
    });
    return sortWorstFirst([...map.values()].map((b) => ({ ...b, accuracy: b.n ? b.correct / b.n : null })));
  }

  /** Last `days` local calendar days (including today), oldest first,
   *  with zero-count days included so gaps are visible in a trend chart. */
  function byDay(events, days = 14) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      buckets.push({ date: dateKey(d), n: 0, correct: 0, msSum: 0, msCount: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.date, b]));
    events.forEach((e) => {
      const d = new Date(e.t);
      const key = dateKey(d);
      const b = byKey.get(key);
      if (!b) return; // outside the window
      b.n++;
      if (e.ok) b.correct++;
      if (typeof e.ms === 'number' && e.ms >= 0 && e.ms <= MS_OUTLIER_CAP) {
        b.msSum += e.ms;
        b.msCount++;
      }
    });
    return buckets.map((b) => ({
      date: b.date,
      n: b.n,
      correct: b.correct,
      accuracy: b.n ? b.correct / b.n : null,
      avgMs: b.msCount ? b.msSum / b.msCount : null,
    }));
  }

  /** The lowest-accuracy form/polarity/politeness buckets, excluding
   *  buckets with too few attempts to be meaningful. */
  function weakest(events, { minN = 5 } = {}) {
    return byBucket(events).filter((b) => b.n >= minN);
  }

  JCS.stats = {
    overall,
    byForm,
    byClass,
    byPolarity,
    byPoliteness,
    byBucket,
    byWord,
    byDay,
    weakest,
  };
})();
