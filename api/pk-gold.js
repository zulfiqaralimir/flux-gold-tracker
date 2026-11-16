// Public endpoint for the Pakistan gold dashboard (/pk-gold.html).
//   GET /api/pk-gold?view=quote
//   GET /api/pk-gold?view=history&range=1D|1W|1M|3M|6M|1Y|ALL
//   add &demo=1 to force clearly-labelled demo data.
//
// Sources (no data is ever invented):
//   * Gold:   GoldAPI.io XAU/USD spot if GOLD_API_KEY is set, else Yahoo Finance GC=F
//             (COMEX gold futures, front month, delayed ~10-15 min).
//   * FX:     Yahoo Finance USDPKR=X (interbank-style quote, delayed).
//   * History: Yahoo Finance GC=F (futures) and USDPKR=X.
// Keys stay on the server. Responses are cached in memory and at the Vercel edge.

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FLUX-gold-tracker)' };

const RANGES = {
    '1D': { interval: '5m', range: '1d', ttl: 120 },
    '1W': { interval: '30m', range: '5d', ttl: 600 },
    '1M': { interval: '1d', range: '1mo', ttl: 1800 },
    '3M': { interval: '1d', range: '3mo', ttl: 1800 },
    '6M': { interval: '1d', range: '6mo', ttl: 3600 },
    '1Y': { interval: '1d', range: '1y', ttl: 3600 },
    'ALL': { interval: '1mo', range: 'max', ttl: 6 * 3600 }
};

// ---- tiny in-memory cache (per warm serverless instance) -------------------
const cache = new Map();
async function cached(key, ttlSec, producer) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlSec * 1000) return hit.value;
    try {
        const value = await producer();
        cache.set(key, { at: Date.now(), value });
        return value;
    } catch (err) {
        // serve stale data (up to 1 day) rather than failing outright
        if (hit && Date.now() - hit.at < 86400000) return { ...hit.value, stale: true };
        throw err;
    }
}

// ---- fetch with timeout + retry --------------------------------------------
async function fetchJson(url, headers = {}, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(8000) });
            if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
            if (!r.ok) { const e = new Error('HTTP ' + r.status); e.noRetry = true; throw e; }
            return await r.json();
        } catch (e) {
            lastErr = e;
            if (e.noRetry) break;
            await new Promise((res) => setTimeout(res, 300 * 2 ** i));
        }
    }
    throw lastErr;
}

async function yahoo(symbol, interval, range) {
    const j = await fetchJson(`${YAHOO}${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`);
    const r = j && j.chart && j.chart.result && j.chart.result[0];
    if (!r || !r.meta) throw new Error('Yahoo: empty result for ' + symbol);
    return r;
}

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// ---- quote -----------------------------------------------------------------
async function goldSpot() {
    const key = process.env.GOLD_API_KEY;
    if (key) {
        try {
            const g = await fetchJson('https://www.goldapi.io/api/XAU/USD', { 'x-access-token': key });
            if (num(g.price) && g.price > 0) {
                return {
                    price: g.price,
                    previousClose: num(g.prev_close_price),
                    high: num(g.high_price),
                    low: num(g.low_price),
                    time: g.timestamp ? g.timestamp * 1000 : Date.now(),
                    source: 'GoldAPI.io XAU/USD spot',
                    delayed: false
                };
            }
        } catch (e) { console.warn('GoldAPI failed, falling back to Yahoo:', e.message); }
    }
    const r = await yahoo('GC=F', '5m', '1d');
    const m = r.meta;
    if (!num(m.regularMarketPrice)) throw new Error('No gold price in Yahoo response');
    return {
        price: m.regularMarketPrice,
        previousClose: num(m.previousClose) ?? num(m.chartPreviousClose),
        high: num(m.regularMarketDayHigh),
        low: num(m.regularMarketDayLow),
        time: (m.regularMarketTime || 0) * 1000,
        source: 'Yahoo Finance GC=F (COMEX gold futures, front month)',
        delayed: true
    };
}

async function usdPkr() {
    const r = await yahoo('USDPKR=X', '1d', '5d');
    const m = r.meta;
    if (!num(m.regularMarketPrice)) throw new Error('No USD/PKR in Yahoo response');
    return {
        rate: m.regularMarketPrice,
        previousClose: num(m.chartPreviousClose),
        time: (m.regularMarketTime || 0) * 1000,
        source: 'Yahoo Finance USDPKR=X (market quote, delayed)'
    };
}

function marketStatus(timeMs, delayed) {
    const age = Date.now() - timeMs;
    if (age < 30 * 60 * 1000) return { code: 'open', label: delayed ? 'Trading (delayed ~10-15 min)' : 'Trading (live)' };
    return { code: 'closed', label: 'Market closed or no recent trades' };
}

async function buildQuote() {
    const [gold, fx] = await Promise.all([goldSpot(), usdPkr()]);
    return {
        ok: true, demo: false,
        gold: { usdPerOz: gold.price, previousClose: gold.previousClose, high: gold.high, low: gold.low, time: gold.time, source: gold.source, delayed: gold.delayed },
        fx: { usdPkr: fx.rate, previousClose: fx.previousClose, time: fx.time, source: fx.source },
        status: marketStatus(gold.time, gold.delayed),
        fetchedAt: Date.now()
    };
}

// Fixed sample numbers, clearly flagged. NOT market data.
function demoQuote() {
    return {
        ok: true, demo: true,
        gold: { usdPerOz: 3000, previousClose: 2990, high: 3010, low: 2985, time: Date.now(), source: 'DEMO sample (not market data)', delayed: true },
        fx: { usdPkr: 280, previousClose: 280, time: Date.now(), source: 'DEMO sample (not market data)' },
        status: { code: 'demo', label: 'Demo mode: sample numbers only' },
        fetchedAt: Date.now()
    };
}

// ---- history ---------------------------------------------------------------
function series(r) {
    const ts = r.timestamp || [];
    const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
    const close = q.close || [];
    const out = [];
    for (let i = 0; i < ts.length; i++) if (num(close[i])) out.push([ts[i] * 1000, close[i]]);
    return out;
}

async function buildHistory(rangeKey) {
    const cfg = RANGES[rangeKey];
    const [goldR, fxR] = await Promise.all([
        yahoo('GC=F', cfg.interval, cfg.range),
        yahoo('USDPKR=X', cfg.interval === '5m' || cfg.interval === '30m' ? '1h' : cfg.interval, cfg.range).catch(() => null)
    ]);
    const gold = series(goldR);
    const fx = fxR ? series(fxR) : [];
    const fallbackRate = num(fxR && fxR.meta && fxR.meta.regularMarketPrice);
    // PKR value of each gold point uses the latest FX point at-or-before it.
    let j = 0, last = null;
    const points = gold.map(([t, usd]) => {
        while (j < fx.length && fx[j][0] <= t) { last = fx[j][1]; j++; }
        // No FX point yet at this time => no PKR value (never back-fill with a later rate).
        const rate = fx.length ? last : fallbackRate;
        return [t, usd, rate ? usd * rate : null];
    });
    return {
        ok: true, demo: false, range: rangeKey, points,
        source: 'Yahoo Finance GC=F (COMEX gold futures) x USDPKR=X. Futures, not spot; PKR = USD x FX at the time.',
        fetchedAt: Date.now()
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

    const view = String(req.query.view || 'quote');
    const demo = req.query.demo === '1';

    try {
        if (view === 'quote') {
            if (demo) { res.setHeader('Cache-Control', 'no-store'); res.status(200).json(demoQuote()); return; }
            const data = await cached('quote', 60, buildQuote);
            res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
            res.status(200).json(data);
            return;
        }
        if (view === 'history') {
            const range = String(req.query.range || '1M').toUpperCase();
            if (!RANGES[range]) { res.status(400).json({ ok: false, error: 'Invalid range' }); return; }
            if (demo) {
                res.setHeader('Cache-Control', 'no-store');
                res.status(200).json({ ok: true, demo: true, range, points: [], source: 'Demo mode has no history: charts only show real data.', fetchedAt: Date.now() });
                return;
            }
            const data = await cached('history:' + range, RANGES[range].ttl, () => buildHistory(range));
            res.setHeader('Cache-Control', `s-maxage=${RANGES[range].ttl}, stale-while-revalidate=${RANGES[range].ttl * 5}`);
            res.status(200).json(data);
            return;
        }
        res.status(400).json({ ok: false, error: 'Invalid view' });
    } catch (err) {
        console.error('pk-gold error:', err.message);
        // Live sources failed: tell the client plainly. The page offers demo mode.
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).json({ ok: false, error: 'Market data providers are unavailable right now. Please retry shortly.' });
    }
}
