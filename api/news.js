// Vercel Serverless Function to fetch gold news
// This bypasses CORS by running on the server-side

export default async function handler(req, res) {
    // Enable CORS for your domain
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
        const NEWS_API_KEY = process.env.NEWS_API_KEY;
        
        // Check if API key is configured
        if (!NEWS_API_KEY) {
            console.error('NEWS_API_KEY not configured in environment variables');
            res.status(500).json({
                success: false,
                error: 'News service not configured. Please contact administrator.'
            });
            return;
        }
        
        const NEWS_API_URL = 'https://newsapi.org/v2/everything';
        
        // Query parameters
        const query = 'gold market OR gold price';
        const sortBy = 'publishedAt';
        const pageSize = 6;
        const language = 'en';
        
        // Build URL with proper encoding
        const url = `${NEWS_API_URL}?q=${encodeURIComponent(query)}&sortBy=${sortBy}&pageSize=${pageSize}&language=${language}&apiKey=${NEWS_API_KEY}`;
        
        console.log('📰 Fetching news from NewsAPI...');
        
        const response = await fetch(url);
        
        // Handle rate limiting (NewsAPI has limits)
        if (response.status === 429) {
            console.warn('⚠️ NewsAPI rate limit reached');
            res.status(429).json({
                success: false,
                error: 'News service temporarily unavailable. Please try again later.'
            });
            return;
        }
        
        if (!response.ok) {
            throw new Error(`NewsAPI returned status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && data.articles) {
            console.log(`✅ Successfully fetched ${data.articles.length} articles`);
            
            // Filter out removed articles and clean data
            const cleanArticles = data.articles
                .filter(article => article.title && article.title !== '[Removed]')
                .map(article => ({
                    source: article.source,
                    title: article.title,
                    description: article.description,
                    url: article.url,
                    publishedAt: article.publishedAt,
                    urlToImage: article.urlToImage
                }));
            
            res.status(200).json({
                success: true,
                articles: cleanArticles,
                totalResults: data.totalResults,
                timestamp: new Date().toISOString()
            });
        } else if (data.status === 'error') {
            // Handle NewsAPI errors
            console.error('NewsAPI Error:', data.code, data.message);
            
            // Provide user-friendly error messages
            let userMessage = 'Unable to fetch news at this time.';
            if (data.code === 'apiKeyInvalid') {
                userMessage = 'News service configuration error.';
            } else if (data.code === 'rateLimited') {
                userMessage = 'Too many requests. Please try again later.';
            }
            
            res.status(500).json({
                success: false,
                error: userMessage
            });
        } else {
            throw new Error(data.message || 'Unexpected response from NewsAPI');
        }
        
    } catch (error) {
        console.error('❌ Error fetching news:', error);
        
        // Don't expose internal errors to client
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news. Please try again later.'
        });
    }
}
