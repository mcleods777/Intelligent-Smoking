// ============ Smoker AI — cross-device sync (client) ============
// One shared "smokehouse" per passphrase. The passphrase is hashed to a
// 64-char key on-device; only the hash and the journal snapshot travel to
// /api/sync. Whole-journal, newest-wins: the device that saved most
// recently is the source of truth. Photos and the API key stay on-device.

import { getDb, Settings, syncSnapshot, adoptRemoteDb, onDbChange } from './store.js';

const API = 'api/sync';
const state = {
  key: null,
  status: 'off',        // off | idle | syncing | error | unconfigured
  detail: '',
  lastSyncTs: null,
  pushTimer: null,
  applying: false,
};
const statusListeners = [];

export function onSyncStatus(cb) { statusListeners.push(cb); }
export function syncStatus() { return { ...state }; }

function setStatus(status, detail = '') {
  state.status = status;
  state.detail = detail;
  statusListeners.forEach(cb => { try { cb(syncStatus()); } catch { /* ignore */ } });
}

async function deriveKey(passphrase) {
  const data = new TextEncoder().encode(`smoker-ai-sync:${passphrase.trim()}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function apiGet() {
  const resp = await fetch(`${API}?key=${state.key}`, { cache: 'no-store' });
  const body = await resp.json().catch(() => ({}));
  if (resp.status === 503) { setStatus('unconfigured', body.error || ''); throw new Error('unconfigured'); }
  if (!resp.ok) throw new Error(body.error || `HTTP ${resp.status}`);
  return body;
}

async function apiPost(payload) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: state.key, payload }),
  });
  const body = await resp.json().catch(() => ({}));
  if (resp.status === 503) { setStatus('unconfigured', body.error || ''); throw new Error('unconfigured'); }
  if (!resp.ok) throw new Error(body.error || `HTTP ${resp.status}`);
  return body;
}

/** Push the local journal to the cloud. */
export async function pushNow() {
  if (!state.key) return;
  setStatus('syncing', 'pushing…');
  try {
    const ts = getDb().meta?.updatedAt || Date.now();
    await apiPost({ ts, db: syncSnapshot() });
    state.lastSyncTs = Date.now();
    setStatus('idle', 'up to date');
  } catch (err) {
    if (err.message !== 'unconfigured') setStatus('error', err.message);
    throw err;
  }
}

/** Pull the cloud journal; adopt it if it's newer than local. Returns 'adopted'|'pushed'|'same'. */
export async function pullNow({ pushIfNewer = true } = {}) {
  if (!state.key) return 'off';
  setStatus('syncing', 'checking cloud…');
  try {
    const remote = await apiGet();
    const localTs = getDb().meta?.updatedAt || 0;
    if (remote.exists && remote.payload.ts > localTs) {
      state.applying = true;
      try { adoptRemoteDb(remote.payload.db); } finally { state.applying = false; }
      state.lastSyncTs = Date.now();
      setStatus('idle', 'updated from cloud');
      return 'adopted';
    }
    if (pushIfNewer && (!remote.exists || localTs > remote.payload.ts)) {
      await pushNow();
      return 'pushed';
    }
    state.lastSyncTs = Date.now();
    setStatus('idle', 'up to date');
    return 'same';
  } catch (err) {
    if (err.message !== 'unconfigured') setStatus('error', err.message);
    throw err;
  }
}

function schedulePush() {
  if (!state.key || state.applying) return;
  clearTimeout(state.pushTimer);
  state.pushTimer = setTimeout(() => pushNow().catch(() => { /* status already set */ }), 3000);
}

/** Enable sync with a passphrase (persists on this device). */
export async function enableSync(passphrase) {
  if (!passphrase?.trim()) throw new Error('Enter a passphrase');
  state.key = await deriveKey(passphrase);
  Settings.updateLocal({ syncPassphrase: passphrase.trim(), syncEnabled: true });
  return pullNow();
}

export function disableSync() {
  state.key = null;
  clearTimeout(state.pushTimer);
  Settings.updateLocal({ syncPassphrase: '', syncEnabled: false });
  setStatus('off');
}

/** Call once at startup: resumes sync if enabled, wires auto push/pull. */
export async function initSync(onRemoteAdopted) {
  onDbChange(schedulePush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.key) {
      pullNow().then(r => { if (r === 'adopted') onRemoteAdopted?.(); }).catch(() => { /* status set */ });
    }
  });
  const s = Settings.get();
  if (s.syncEnabled && s.syncPassphrase) {
    state.key = await deriveKey(s.syncPassphrase);
    try {
      const r = await pullNow();
      if (r === 'adopted') onRemoteAdopted?.();
    } catch { /* status set */ }
  }
}
