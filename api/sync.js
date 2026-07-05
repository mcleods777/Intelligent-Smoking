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

const REST_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL;
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN;

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
