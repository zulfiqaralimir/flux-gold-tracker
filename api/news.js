// Vercel Serverless Function to fetch gold news
// This bypasses CORS by running on the server-side

export default async function handler(req, res) {
    // Enable CORS for your domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const NEWS_API_KEY = '418c3e435fe54907bd6aa6996c998b82';
        const NEWS_API_URL = 'https://newsapi.org/v2/everything';
        
        const query = 'gold market OR gold price';
        const sortBy = 'publishedAt';
        const pageSize = 6;
        const language = 'en';

        const url = `${NEWS_API_URL}?q=${encodeURIComponent(query)}&sortBy=${sortBy}&pageSize=${pageSize}&language=${language}&apiKey=${NEWS_API_KEY}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`NewsAPI returned status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'ok') {
            res.status(200).json({
                success: true,
                articles: data.articles,
                totalResults: data.totalResults
            });
        } else {
            throw new Error(data.message || 'Unknown error from NewsAPI');
        }

    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch news'
        });
    }
}
