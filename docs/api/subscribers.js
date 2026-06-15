// GET /api/subscribers?key=ADMIN_KEY  → list collected emails (token-protected).
// Set ADMIN_KEY in Vercel env. Without it, the endpoint stays locked.
module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || '';
  const admin = process.env.ADMIN_KEY;
  if (!admin || key !== admin) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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
