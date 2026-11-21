// Azimov: official exchange rates of the Central Bank of Uzbekistan (cbu.uz), served with CORS for the app.
// Public, read-only. Cached in memory for 30 min; if the bank is unreachable the last good copy is returned with stale=true.
const SOURCE = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/';
const TTL = 30 * 60 * 1000;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
let cache: { at: number; data: any } | null = null;

// "20.11.2026" -> "2026-11-20"
const isoDate = (s: string) => (/^\d{2}\.\d{2}\.\d{4}$/.test(s) ? `${s.slice(6)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : s);

async function load() {
  const r = await fetch(SOURCE, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('cbu ' + r.status);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('cbu: unexpected payload');
  const rates: Record<string, number> = {};
  const diff: Record<string, number> = {};
  for (const x of arr) {
    const nominal = Number(x.Nominal) || 1;
    const rate = Number(String(x.Rate).replace(',', '.')) / nominal;
    if (x.Ccy && Number.isFinite(rate) && rate > 0) {
      rates[x.Ccy] = Math.round(rate * 100) / 100;
      diff[x.Ccy] = Math.round((Number(String(x.Diff).replace(',', '.')) / nominal) * 100) / 100 || 0;
    }
  }
  return { source: 'cbu.uz', date: isoDate(arr[0].Date), base: 'UZS', rates, diff };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'public, max-age=900' } });
  if (cache && Date.now() - cache.at < TTL) return json({ ...cache.data, stale: false });
  try {
    const data = await load();
    cache = { at: Date.now(), data };
    return json({ ...data, stale: false });
  } catch (e) {
    console.error('rates failed', (e as Error).message);
    if (cache) return json({ ...cache.data, stale: true });
    return json({ error: 'rates unavailable' }, 502);
  }
});
