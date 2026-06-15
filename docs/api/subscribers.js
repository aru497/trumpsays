// GET /api/subscribers?key=ADMIN_KEY  → list collected emails (token-protected).
// Set ADMIN_KEY in Vercel env. Without it, the endpoint stays locked.
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
  const key = (req.query && req.query.key) || '';
  const admin = process.env.ADMIN_KEY;
  if (!admin || key !== admin) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  const { url, token } = kvCreds();
  if (!(url && token)) {
    res.status(200).json({ ok: true, count: 0, subscribers: [], note: 'KV not configured — connect a Vercel KV store to persist signups.' });
    return;
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['HGETALL', 'subscribers']),
    });
    const data = await r.json();
    const arr = (data && data.result) || [];
    const out = [];
    for (let i = 0; i < arr.length; i += 2) {
      try { out.push(JSON.parse(arr[i + 1])); } catch (_) { out.push({ email: arr[i] }); }
    }
    out.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
    res.status(200).json({ ok: true, count: out.length, subscribers: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message) });
  }
};
