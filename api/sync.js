// Smoker AI — cross-device sync endpoint (Vercel serverless function).
//
// Storage: a Redis database connected to the Vercel project (Storage tab →
// Create Database → Redis/Upstash). Vercel injects the REST credentials as
// env vars automatically; no npm dependencies needed.
//
// Model: one JSON snapshot per sync key. The key is a SHA-256 hash of the
// household passphrase, derived client-side — the passphrase itself never
// leaves the device, and without it neither the key nor the data URL is
// guessable.

// The integration's env var names depend on how it was connected (and any
// custom prefix chosen), so try the common names first, then fall back to
// scanning for any <PREFIX>..._URL/_TOKEN REST pair pointing at Upstash.
function findCredentials() {
  const env = process.env;
  const pairs = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ['REDIS_REST_API_URL', 'REDIS_REST_API_TOKEN'],
  ];
  for (const [u, t] of pairs) {
    if (env[u] && env[t]) return { url: env[u], token: env[t] };
  }
  for (const name of Object.keys(env)) {
    const m = name.match(/^(.*)(_REST_API_URL|_REST_URL)$/);
    if (!m || !/^https:\/\//.test(env[name])) continue;
    const token = env[`${m[1]}${m[2].replace('_URL', '_TOKEN')}`] || env[`${m[1]}_REST_API_TOKEN`];
    if (token) return { url: env[name], token };
  }
  // Some connection flows inject only a redis(s):// connection string
  // (e.g. REDIS_URL). For Upstash, the REST endpoint is https://<host>
  // and the REST token is the connection password.
  for (const name of Object.keys(env)) {
    if (!/^rediss?:\/\//.test(env[name] || '')) continue;
    try {
      const u = new URL(env[name]);
      if (!/^rediss?:$/.test(u.protocol) || !u.hostname || !u.password) continue;
      if (!/\.upstash\.io$/.test(u.hostname)) continue;
      return { url: `https://${u.hostname}`, token: u.password };
    } catch { /* not a URL — keep scanning */ }
  }
  return { url: null, token: null };
}
const { url: REST_URL, token: REST_TOKEN } = findCredentials();

const KEY_RE = /^[a-f0-9]{64}$/;
const MAX_BYTES = 3.5 * 1024 * 1024; // stay under serverless body limits

async function redis(path, body) {
  const resp = await fetch(`${REST_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    body,
  });
  if (!resp.ok) throw new Error(`storage error ${resp.status}`);
  return resp.json();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!REST_URL || !REST_TOKEN) {
    res.status(503).json({
      error: 'Sync storage is not configured. In the Vercel dashboard: project → Storage → Create Database → Redis (Upstash), connect it to this project, then redeploy.',
      // Shape only (never secrets) of storage-looking env vars, to diagnose
      // integrations that inject credentials under unexpected names/formats.
      envHint: Object.keys(process.env)
        .filter(k => /REDIS|UPSTASH|KV_|STORAGE/i.test(k))
        .map(k => {
          const v = process.env[k] || '';
          try {
            const u = new URL(v);
            return `${k}: ${u.protocol}//${u.username ? '<user>' : ''}${u.password ? ':<pw>' : ''}@${u.hostname}:${u.port}`;
          } catch {
            return `${k}: unparseable (${v.length} chars, starts "${v.slice(0, 3)}")`;
          }
        }),
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const key = req.query.key || '';
      if (!KEY_RE.test(key)) { res.status(400).json({ error: 'bad key' }); return; }
      const out = await redis(`/get/smokerai:${key}`);
      if (out.result == null) { res.status(200).json({ exists: false }); return; }
      res.status(200).json({ exists: true, payload: JSON.parse(out.result) });
      return;
    }

    if (req.method === 'POST') {
      const { key, payload } = req.body || {};
      if (!KEY_RE.test(key || '')) { res.status(400).json({ error: 'bad key' }); return; }
      if (!payload || typeof payload.ts !== 'number' || !payload.db) {
        res.status(400).json({ error: 'bad payload' });
        return;
      }
      const value = JSON.stringify(payload);
      if (value.length > MAX_BYTES) { res.status(413).json({ error: 'journal too large to sync' }); return; }
      await redis(`/set/smokerai:${key}`, value);
      res.status(200).json({ ok: true, ts: payload.ts });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(502).json({ error: `sync backend error: ${err.message}` });
  }
};
