// POST /api/subscribe  { email, ref }
// Stores the email in Vercel KV / Upstash Redis (REST) when configured; otherwise
// logs it (Vercel function logs) so the flow works as a "dummy" until KV is wired.

// Resolve the KV/Upstash REST creds from env, tolerating any store-name prefix
// (e.g. Vercel sets TRUMPSAYS_KV_REST_API_URL when the store is named "trumpsays").
function kvCreds() {
  const e = process.env;
  let url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL;
  let token = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  const uk = Object.keys(e).find(k => /KV_REST_API_URL$|UPSTASH_REDIS_REST_URL$/.test(k));
  if (uk) {
    const p = uk.replace(/KV_REST_API_URL$|UPSTASH_REDIS_REST_URL$/, '');
    url = e[uk];
    token = e[p + 'KV_REST_API_TOKEN'] || e[p + 'UPSTASH_REDIS_REST_TOKEN'] || token;
  }
  return { url, token };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    res.status(400).json({ ok: false, error: 'Please enter a valid email.' });
    return;
  }
  const record = { email, ts: new Date().toISOString(), ref: String(body.ref || '').slice(0, 80) };

  const { url, token } = kvCreds();
  if (url && token) {
    try {
      // HSET subscribers <email> <json>  → dedupes by email, keeps latest record
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['HSET', 'subscribers', email, JSON.stringify(record)]),
      });
      if (!r.ok) throw new Error('KV responded ' + r.status);
      res.status(200).json({ ok: true, stored: true });
      return;
    } catch (e) {
      console.error('[subscribe] KV error:', e && e.message);
      // fall through to dummy logging
    }
  }
  console.log('[subscribe] (KV not configured) NEW SUBSCRIBER:', JSON.stringify(record));
  res.status(200).json({ ok: true, stored: false, dummy: true });
};
