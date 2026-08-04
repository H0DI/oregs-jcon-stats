// Persistence layer: one chrome.storage.local key per page-load "session"
// (ev:<sessionId> -> event array), so two tabs open at once never
// read-modify-write the same key. Aggregates are always computed from the
// merged event log elsewhere (stats.js); this module only stores/retrieves.
(() => {
  globalThis.JCS = globalThis.JCS || {};

  const DEBOUNCE_MS = 1000;
  const MAX_EVENTS = 20000;
  const KEY_PREFIX = 'ev:';

  function makeSessionId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** In-memory fallback backend — used in tests, or in the standalone
   *  end-to-end harness where chrome.storage isn't available. */
  function makeMemoryBackend() {
    const data = {};
    return {
      get(keys) {
        if (keys === null) return Promise.resolve({ ...data });
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        list.forEach((k) => {
          if (k in data) out[k] = data[k];
        });
        return Promise.resolve(out);
      },
      set(obj) {
        Object.assign(data, obj);
        return Promise.resolve();
      },
      remove(keys) {
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete data[k]);
        return Promise.resolve();
      },
    };
  }

  function makeChromeBackend() {
    const area = chrome.storage.local;
    return {
      get(keys) {
        return new Promise((resolve, reject) => {
          area.get(keys, (result) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(result);
          });
        });
      },
      set(obj) {
        return new Promise((resolve, reject) => {
          area.set(obj, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
          });
        });
      },
      remove(keys) {
        return new Promise((resolve, reject) => {
          area.remove(keys, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
          });
        });
      },
    };
  }

  function defaultBackend() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return makeChromeBackend();
    }
    return makeMemoryBackend();
  }

  /**
   * Create a store bound to one page-load session.
   * @param {object} [backend] storage backend; defaults to chrome.storage.local,
   *   falling back to an in-memory shim when unavailable.
   */
  function createStore(backend) {
    const be = backend || defaultBackend();
    const sessionId = makeSessionId();
    const sessionKey = KEY_PREFIX + sessionId;

    let sessionEvents = [];
    let flushTimer = null;
    let pruneChecked = false;

    function scheduleFlush() {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, DEBOUNCE_MS);
    }

    function flush() {
      return be.set({ [sessionKey]: sessionEvents }).catch((err) => {
        console.warn('[jconj-stats] failed to persist events', err);
      });
    }

    function flushNow() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      return flush();
    }

    /** Soft cap: if total stored events exceed MAX_EVENTS, drop whole
     *  oldest sessions (never the current one) until back under the cap. */
    async function pruneIfNeeded() {
      if (pruneChecked) return;
      pruneChecked = true;
      try {
        const all = await be.get(null);
        const sessionKeys = Object.keys(all).filter((k) => k.startsWith(KEY_PREFIX));
        const chunks = sessionKeys.map((k) => ({ key: k, n: Array.isArray(all[k]) ? all[k].length : 0 }));
        let total = chunks.reduce((sum, c) => sum + c.n, 0);
        if (total <= MAX_EVENTS) return;
        chunks.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)); // oldest session id first
        const toRemove = [];
        for (const c of chunks) {
          if (total <= MAX_EVENTS) break;
          if (c.key === sessionKey) continue; // never prune the live session
          toRemove.push(c.key);
          total -= c.n;
        }
        if (toRemove.length) await be.remove(toRemove);
      } catch (err) {
        console.warn('[jconj-stats] pruning failed', err);
      }
    }

    /** All events across all sessions, current session merged in from memory
     *  (not from storage, since a flush may not have happened yet). */
    async function getAllEvents() {
      await pruneIfNeeded();
      try {
        const all = await be.get(null);
        const merged = [];
        Object.keys(all).forEach((k) => {
          if (!k.startsWith(KEY_PREFIX) || k === sessionKey) return;
          if (Array.isArray(all[k])) merged.push(...all[k]);
        });
        merged.push(...sessionEvents);
        merged.sort((a, b) => a.t - b.t);
        return merged;
      } catch (err) {
        console.warn('[jconj-stats] failed to load events', err);
        return sessionEvents.slice();
      }
    }

    function getSessionEvents() {
      return sessionEvents.slice();
    }

    function addEvent(event) {
      sessionEvents.push(event);
      scheduleFlush();
    }

    async function reset() {
      sessionEvents = [];
      try {
        const all = await be.get(null);
        const keys = Object.keys(all).filter((k) => k.startsWith(KEY_PREFIX));
        if (keys.length) await be.remove(keys);
      } catch (err) {
        console.warn('[jconj-stats] reset failed', err);
      }
    }

    return { sessionId, addEvent, getAllEvents, getSessionEvents, reset, flushNow };
  }

  JCS.createStore = createStore;
  JCS.storeInternals = { makeMemoryBackend, makeChromeBackend, makeSessionId, KEY_PREFIX, MAX_EVENTS };
})();
