// Vercel Serverless Function to fetch OHLC candle data for the price chart
// Uses Twelve Data API (same key already used by market-heat.js)

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
        return;
    }

    try {
        const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

        if (!TWELVE_DATA_API_KEY) {
            console.error('TWELVE_DATA_API_KEY not configured');
            res.status(500).json({
                success: false,
                error: 'Chart data service not configured.'
            });
            return;
        }

        const range = String(req.query.range || 'daily').toLowerCase();

        // Each range maps to a Twelve Data candle interval + how many candles to pull back
        const RANGE_CONFIG = {
            daily: { interval: '1day', outputsize: 90 },    // ~3 months of daily candles
            weekly: { interval: '1week', outputsize: 104 }, // ~2 years of weekly candles
            yearly: { interval: '1month', outputsize: 120 } // ~10 years of monthly candles
        };

        const config = RANGE_CONFIG[range];

        if (!config) {
            res.status(400).json({
                success: false,
                error: 'Invalid range. Use daily, weekly, or yearly.'
            });
            return;
        }

        console.log(`📊 Fetching ${range} candle data (${config.interval})...`);

        const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${config.interval}&outputsize=${config.outputsize}&apikey=${TWELVE_DATA_API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Twelve Data API returned status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message || 'Error from Twelve Data API');
        }

        if (!data.values || !data.values.length) {
            throw new Error('No candle data available');
        }

        // Twelve Data returns newest-first — flip to chronological order for charting
        const candles = data.values
            .map(v => ({
                time: v.datetime,
                open: parseFloat(v.open),
                high: parseFloat(v.high),
                low: parseFloat(v.low),
                close: parseFloat(v.close)
            }))
            .reverse();

        console.log(`✅ Returned ${candles.length} candles (${range})`);

        res.status(200).json({
            success: true,
            range,
            interval: config.interval,
            data: candles,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching candle data:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to fetch candle data. Please try again later.'
        });
    }
}
