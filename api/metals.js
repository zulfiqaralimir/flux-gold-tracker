// Vercel Serverless Function to fetch metal prices
// This keeps your Metals.dev API key secure on the server

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); // Cache for 60 seconds
    
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
        const METALS_API_KEY = process.env.METALS_DEV_API_KEY;
        
        // Check if API key is configured
        if (!METALS_API_KEY) {
            console.error('METALS_DEV_API_KEY not configured in environment variables');
            res.status(500).json({
                success: false,
                error: 'Metals price service not configured. Please contact administrator.'
            });
            return;
        }
        
        const API_URL = 'https://api.metals.dev/v1/latest';
        
        // Build URL with parameters
        const url = `${API_URL}?api_key=${METALS_API_KEY}&currency=USD&unit=toz`;
        
        console.log('📡 Fetching metal prices from Metals.dev...');
        
        const response = await fetch(url);
        
        // Handle rate limiting
        if (response.status === 429) {
            console.warn('⚠️ Metals.dev rate limit reached');
            res.status(429).json({
                success: false,
                error: 'Price service temporarily unavailable. Please try again later.'
            });
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Metals.dev API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            console.log('✅ Successfully fetched metal prices');
            
            res.status(200).json({
                success: true,
                data: data,
                timestamp: new Date().toISOString()
            });
        } else {
            throw new Error(data.message || 'Unexpected response from Metals.dev');
        }
        
    } catch (error) {
        console.error('❌ Error fetching metal prices:', error);
        
        // Don't expose internal errors to client
        res.status(500).json({
            success: false,
            error: 'Failed to fetch metal prices. Please try again later.'
        });
    }
}
