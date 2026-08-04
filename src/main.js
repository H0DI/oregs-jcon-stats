// Bootstrap: wires watcher -> store -> panel together, persists small UI
// prefs (collapsed/active tab), and keeps the panel hidden while the site's
// own Options screen is open. Never lets an error here break the host page.
(() => {
  const JCS = globalThis.JCS;
  if (!JCS) return;

  const UI_KEY = 'jcs-ui';
  const DEFAULT_UI_STATE = { collapsed: true, tab: 'overview' };

  let uiState = { ...DEFAULT_UI_STATE };
  let uiBackend = null;

  function getUiBackend() {
    if (!uiBackend) {
      uiBackend =
        typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
          ? JCS.storeInternals.makeChromeBackend()
          : JCS.storeInternals.makeMemoryBackend();
    }
    return uiBackend;
  }

  function loadUiState() {
    return getUiBackend()
      .get(UI_KEY)
      .then((res) => {
        if (res && res[UI_KEY]) uiState = { ...DEFAULT_UI_STATE, ...res[UI_KEY] };
      })
      .catch(() => {});
  }

  function saveUiState(next) {
    uiState = next;
    getUiBackend()
      .set({ [UI_KEY]: next })
      .catch(() => {});
  }

  function getTestUrl() {
    // test/ isn't bundled in this (Firefox) build — it's excluded so the
    // AMO submission has no test-only lint warnings — so there's no
    // in-extension self-test link here. Run the self-tests from the repo
    // source (test/test.html) instead.
    return null;
  }

  function showUnavailable(reason) {
    console.warn('[jconj-stats] disabled:', reason);
    try {
      const toppest = document.getElementById('toppest-container');
      if (toppest) {
        const note = document.createElement('div');
        note.className = 'jcs-card';
        note.style.padding = '0.6rem 0.7rem';
        note.style.fontSize = '0.8rem';
        note.textContent = 'jconj Stats: unavailable — the page structure changed.';
        toppest.appendChild(note);
      }
    } catch (err) {
      /* nothing more we can do */
    }
  }

  function boot() {
    if (!document.getElementById('top-container') || !document.getElementById('verb-text')) {
      showUnavailable('expected page elements not found');
      return;
    }

    const store = JCS.createStore();
    const panel = JCS.createPanel({
      getUiState: () => uiState,
      setUiState: saveUiState,
      onReset: () => {
        store
          .reset()
          .then(refresh)
          .catch((err) => console.warn('[jconj-stats] reset failed', err));
      },
      testUrl: getTestUrl(),
    });

    let refreshQueued = false;
    function refresh() {
      if (refreshQueued) return;
      refreshQueued = true;
      Promise.resolve().then(async () => {
        refreshQueued = false;
        try {
          const all = await store.getAllEvents();
          panel.update(store.getSessionEvents(), all);
        } catch (err) {
          console.warn('[jconj-stats] failed to refresh stats', err);
        }
      });
    }

    JCS.createWatcher({
      onAnswer: (event) => {
        try {
          store.addEvent(event);
          refresh();
        } catch (err) {
          console.warn('[jconj-stats] failed to record answer', err);
        }
      },
      onError: (err) => console.warn('[jconj-stats] watcher error', err),
    }).start();

    function syncVisibility() {
      try {
        panel.setVisible(!JCS.parse.isOptionsScreenOpen(document));
      } catch (err) {
        /* ignore */
      }
    }
    const mainView = document.getElementById('main-view');
    if (mainView) {
      new MutationObserver(syncVisibility).observe(mainView, { attributes: true, attributeFilter: ['class'] });
    }

    refresh();
    syncVisibility();

    window.addEventListener('pagehide', () => store.flushNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') store.flushNow();
    });
  }

  loadUiState().finally(() => {
    try {
      boot();
    } catch (err) {
      console.warn('[jconj-stats] failed to initialize', err);
    }
  });
})();
