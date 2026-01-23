// Vercel Serverless Function to fetch metal prices from GoldAPI
// This keeps your GoldAPI key secure on the server

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour
    
    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ 
            success: false,
            error: 'Method not allowed' 
        });
        return;
    }
    
    try {
        // Get API key from environment variables (SECURE)
        const GOLD_API_KEY = process.env.GOLD_API_KEY;
        
        // Check if API key is configured
        if (!GOLD_API_KEY) {
            console.error('GOLD_API_KEY not configured in environment variables');
            res.status(500).json({
                success: false,
                error: 'Gold price service not configured. Please contact administrator.'
            });
            return;
        }
        
        const API_URL = 'https://www.goldapi.io/api/XAU/USD';
        
        console.log('📡 Fetching metal prices from GoldAPI...');
        
        const response = await fetch(API_URL, {
            headers: {
                'x-access-token': GOLD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        // Handle rate limiting
        if (response.status === 429) {
            console.warn('⚠️ GoldAPI rate limit reached');
            res.status(429).json({
                success: false,
                error: 'Price service temporarily unavailable. Please try again later.'
            });
            return;
        }
        
        if (!response.ok) {
            throw new Error(`GoldAPI returned status: ${response.status}`);
        }
        
        const goldData = await response.json();
        
        // Fetch Silver price
        const silverResponse = await fetch('https://www.goldapi.io/api/XAG/USD', {
            headers: {
                'x-access-token': GOLD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        const silverData = silverResponse.ok ? await silverResponse.json() : null;
        
        // Fetch Platinum price
        const platinumResponse = await fetch('https://www.goldapi.io/api/XPT/USD', {
            headers: {
                'x-access-token': GOLD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        const platinumData = platinumResponse.ok ? await platinumResponse.json() : null;
        
        console.log('✅ Successfully fetched metal prices');
        
        // Format response to match expected structure
        res.status(200).json({
            success: true,
            data: {
                metals: {
                    gold: goldData.price || 0,
                    silver: silverData?.price || 0,
                    platinum: platinumData?.price || 0,
                    lbma_gold_am: goldData.open_price || goldData.price || 0,
                    lbma_gold_pm: goldData.price || 0
                },
                timestamps: {
                    metal: goldData.price_gram_24k ? new Date().toISOString() : new Date().toISOString()
                }
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching metal prices:', error);
        
        // Don't expose internal errors to client
        res.status(500).json({
            success: false,
            error: 'Failed to fetch metal prices. Please try again later.'
        });
    }
}