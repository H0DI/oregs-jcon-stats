// Builds and updates the injected UI: an accuracy chip in the site's own
// streak row, plus a stats card with four tabs. Pure rendering — all data
// comes in via update(sessionEvents, allEvents); persistence and DOM
// mounting/visibility are driven by main.js.
(() => {
  globalThis.JCS = globalThis.JCS || {};

  const CLASS_COLOR = {
    u: '#ff7d00',
    ru: '#3d6bff',
    irv: '#9a9a95',
    ira: '#9a9a95',
    i: '#00b4f0',
    na: '#b06a3e',
    '?': '#5a5a55',
  };
  const CLASS_LABEL = { u: 'godan', ru: 'ichidan', irv: 'irregular', ira: 'irregular', i: 'い', na: 'な', '?': '?' };

  function pct(x) {
    return x == null ? '—' : `${Math.round(x * 100)}%`;
  }
  function secs(ms) {
    return ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function barRow(label, bucket) {
    const width = bucket.accuracy == null ? 0 : Math.round(bucket.accuracy * 100);
    return `
      <div class="jcs-bar-row" title="${bucket.n} attempt${bucket.n === 1 ? '' : 's'}">
        <div class="jcs-bar-label">${esc(label)}</div>
        <div class="jcs-bar-track"><div class="jcs-bar-fill" style="width:${width}%"></div></div>
        <div class="jcs-bar-value">${pct(bucket.accuracy)} <span class="jcs-bar-n">(${bucket.n})</span></div>
      </div>`;
  }

  function renderOverview(all) {
    const o = JCS.stats.overall(all);
    const weak = JCS.stats.weakest(all, { minN: 5 }).slice(0, 5);
    const tiles = [
      ['All-time accuracy', pct(o.accuracy)],
      ['Answered', o.total],
      ['Best streak', o.maxStreak],
      ['Current streak', o.currentStreak],
      ['Avg. time', secs(o.avgMs)],
      ['Answered today', o.today],
    ]
      .map(([label, value]) => `<div class="jcs-tile"><div class="jcs-tile-value">${esc(value)}</div><div class="jcs-tile-label">${esc(label)}</div></div>`)
      .join('');

    const weakList = weak.length ? weak.map((b) => barRow(b.key, b)).join('') : `<div class="jcs-empty">Answer at least 5 of a form to see weak areas here.</div>`;

    return `
      <div class="jcs-tiles">${tiles}</div>
      <h4 class="jcs-subhead">Weakest areas</h4>
      <div class="jcs-bars">${weakList}</div>
    `;
  }

  function renderForms(all) {
    const forms = JCS.stats.byForm(all);
    const polarity = JCS.stats.byPolarity(all);
    const politeness = JCS.stats.byPoliteness(all);
    const formsHtml = forms.length ? forms.map((b) => barRow(b.key, b)).join('') : `<div class="jcs-empty">No answers yet.</div>`;
    const polarityHtml = polarity.length ? polarity.map((b) => barRow(b.key, b)).join('') : `<div class="jcs-empty">No answers yet.</div>`;
    const politenessHtml = politeness.length
      ? politeness.map((b) => barRow(b.key === 'polite' ? 'Polite' : 'Plain', b)).join('')
      : `<div class="jcs-empty">No plain/polite answers yet.</div>`;
    return `
      <div class="jcs-bars">${formsHtml}</div>
      <h4 class="jcs-subhead">Affirmative / Negative</h4>
      <div class="jcs-bars">${polarityHtml}</div>
      <h4 class="jcs-subhead">Plain / Polite</h4>
      <div class="jcs-bars">${politenessHtml}</div>
    `;
  }

  function renderWords(all) {
    const words = JCS.stats.byWord(all).filter((w) => w.n >= 2);
    if (!words.length) return `<div class="jcs-empty">Answer a word at least twice to see it here.</div>`;
    const rows = words
      .map((w) => {
        const chip = `<span class="jcs-class-chip" style="background:${CLASS_COLOR[w.cls] || CLASS_COLOR['?']}">${CLASS_LABEL[w.cls] || '?'}</span>`;
        const miss = w.lastWrong
          ? `<div class="jcs-word-miss">last miss: <span class="jcs-wrong">${esc(w.lastWrong.ans || '(blank)')}</span> → <span class="jcs-right">${esc(w.lastWrong.exp)}</span></div>`
          : '';
        return `
        <div class="jcs-word-row">
          <div class="jcs-word-head">
            ${chip}<span class="jcs-word-text" lang="ja">${esc(w.key)}</span>
            <span class="jcs-word-acc">${pct(w.accuracy)} <span class="jcs-bar-n">(${w.n})</span></span>
          </div>
          ${miss}
        </div>`;
      })
      .join('');
    return `<div class="jcs-words">${rows}</div>`;
  }

  function renderHistory(all) {
    const days = JCS.stats.byDay(all, 14);
    const maxN = Math.max(1, ...days.map((d) => d.n));
    const bars = days
      .map((d) => {
        const h = Math.round((d.n / maxN) * 100);
        const color = d.accuracy == null ? '#4a4a45' : `hsl(${Math.round(d.accuracy * 120)}, 55%, 45%)`;
        const label = d.date.slice(5); // MM-DD
        return `<div class="jcs-day" title="${d.date}: ${d.n} answered, ${pct(d.accuracy)} accuracy">
        <div class="jcs-day-bar" style="height:${h}%;background:${color}"></div>
        <div class="jcs-day-label">${label}</div>
      </div>`;
      })
      .join('');
    const avgMs = (() => {
      const withMs = days.filter((d) => d.avgMs != null);
      if (!withMs.length) return null;
      return withMs.reduce((s, d) => s + d.avgMs * d.n, 0) / withMs.reduce((s, d) => s + d.n, 0);
    })();
    return `<div class="jcs-history-summary">avg. ${secs(avgMs)} / answer over the last 14 days</div><div class="jcs-history">${bars}</div>`;
  }

  const TABS = [
    ['overview', 'Overview', renderOverview],
    ['forms', 'Forms', renderForms],
    ['words', 'Words', renderWords],
    ['history', 'History', renderHistory],
  ];

  /**
   * @param {{getUiState: () => {collapsed:boolean, tab:string}, setUiState: (s:object) => void,
   *          onReset: () => void, testUrl?: string}} opts
   */
  function createPanel({ getUiState, setUiState, onReset, testUrl }) {
    let cardEl = null;
    let chipEl = null;
    let mounted = false;
    let lastAll = [];

    function ensureMounted() {
      if (mounted) return;

      const streakContainer = document.getElementById('streak-container');
      chipEl = document.getElementById('jcs-accuracy-chip');
      if (streakContainer && !chipEl) {
        chipEl = document.createElement('div');
        chipEl.id = 'jcs-accuracy-chip';
        chipEl.className = 'streak jcs-accuracy-chip';
        chipEl.innerHTML = `<p>Accuracy</p><p id="jcs-accuracy-text">—</p>`;
        streakContainer.appendChild(chipEl);
      }

      const toppest = document.getElementById('toppest-container');
      const topContainer = document.getElementById('top-container');
      cardEl = document.getElementById('jcs-card');
      if (toppest && topContainer && !cardEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'jcs-card';
        cardEl.className = 'jcs-card';
        cardEl.innerHTML = `
          <div class="jcs-card-header" id="jcs-card-header">
            <span class="jcs-card-title">📊 Practice stats</span>
            <span class="jcs-card-summary" id="jcs-card-summary"></span>
            <button type="button" class="jcs-toggle" id="jcs-toggle" aria-label="Toggle stats panel">▾</button>
          </div>
          <div class="jcs-card-body" id="jcs-card-body">
            <div class="jcs-tabs" id="jcs-tabs">
              ${TABS.map(([key, label]) => `<button type="button" class="jcs-tab" data-tab="${key}">${esc(label)}</button>`).join('')}
            </div>
            <div class="jcs-tab-content" id="jcs-tab-content"></div>
            <div class="jcs-card-footer">
              <button type="button" class="jcs-link-btn" id="jcs-reset">Reset data</button>
              ${testUrl ? `<a class="jcs-link-btn" id="jcs-selftest" href="${esc(testUrl)}" target="_blank" rel="noopener">Run self-tests</a>` : ''}
            </div>
          </div>
        `;
        toppest.insertBefore(cardEl, topContainer.nextSibling);

        cardEl.querySelector('#jcs-card-header').addEventListener('click', (e) => {
          if (e.target.closest('button, .jcs-card-title, .jcs-card-summary')) toggleCollapsed();
        });
        cardEl.querySelectorAll('.jcs-tab').forEach((btn) => {
          btn.addEventListener('click', () => {
            setUiState({ ...getUiState(), tab: btn.dataset.tab });
            renderActiveTab();
            updateTabButtons();
          });
        });
        const resetBtn = cardEl.querySelector('#jcs-reset');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            if (window.confirm('Reset all jconj Stats data? This cannot be undone.')) {
              if (onReset) onReset();
            }
          });
        }
      }

      mounted = !!(chipEl && cardEl);
    }

    function toggleCollapsed() {
      setUiState({ ...getUiState(), collapsed: !getUiState().collapsed });
      applyCollapsed();
    }

    function applyCollapsed() {
      if (!cardEl) return;
      const state = getUiState();
      cardEl.classList.toggle('jcs-collapsed', !!state.collapsed);
      const toggleBtn = cardEl.querySelector('#jcs-toggle');
      if (toggleBtn) toggleBtn.textContent = state.collapsed ? '▸' : '▾';
    }

    function updateTabButtons() {
      if (!cardEl) return;
      const tab = getUiState().tab || 'overview';
      cardEl.querySelectorAll('.jcs-tab').forEach((btn) => {
        btn.classList.toggle('jcs-tab-active', btn.dataset.tab === tab);
      });
    }

    function renderActiveTab() {
      if (!cardEl) return;
      const tabKey = getUiState().tab || 'overview';
      const entry = TABS.find(([key]) => key === tabKey) || TABS[0];
      const content = cardEl.querySelector('#jcs-tab-content');
      if (content) content.innerHTML = entry[2](lastAll);
    }

    function setVisible(visible) {
      if (chipEl) chipEl.style.display = visible ? '' : 'none';
      if (cardEl) cardEl.style.display = visible ? '' : 'none';
    }

    function update(sessionEvents, allEvents) {
      ensureMounted();
      if (!mounted) return;
      lastAll = allEvents;

      const overallAll = JCS.stats.overall(allEvents);
      const overallSession = JCS.stats.overall(sessionEvents);

      const chipText = document.getElementById('jcs-accuracy-text');
      if (chipText) chipText.textContent = pct(overallAll.accuracy);

      const summary = cardEl.querySelector('#jcs-card-summary');
      if (summary) {
        summary.textContent = `session ${overallSession.correct}/${overallSession.total} (${pct(overallSession.accuracy)}) · all-time ${pct(overallAll.accuracy)}`;
      }

      applyCollapsed();
      updateTabButtons();
      renderActiveTab();
    }

    return { update, setVisible, ensureMounted };
  }

  JCS.createPanel = createPanel;
})();
