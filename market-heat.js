// Vercel Serverless Function to calculate Market Heat (RSI) for Gold
// Uses Twelve Data API for historical price data

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
        // Get API key from environment variables
        const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
        
        if (!TWELVE_DATA_API_KEY) {
            console.error('TWELVE_DATA_API_KEY not configured');
            res.status(500).json({
                success: false,
                error: 'Market Heat service not configured.'
            });
            return;
        }
        
        console.log('📊 Fetching historical gold data for Market Heat calculation...');
        
        // Fetch RSI directly from Twelve Data (they calculate it for us!)
        const rsiUrl = `https://api.twelvedata.com/rsi?symbol=XAU/USD&interval=1day&time_period=14&apikey=${TWELVE_DATA_API_KEY}&outputsize=30`;
        
        const rsiResponse = await fetch(rsiUrl);
        
        if (!rsiResponse.ok) {
            throw new Error(`Twelve Data API returned status: ${rsiResponse.status}`);
        }
        
        const rsiData = await rsiResponse.json();
        
        if (rsiData.status === 'error') {
            throw new Error(rsiData.message || 'Error from Twelve Data API');
        }
        
        // Get the latest RSI value
        const latestRSI = rsiData.values && rsiData.values[0] ? parseFloat(rsiData.values[0].rsi) : null;
        
        if (!latestRSI) {
            throw new Error('No RSI data available');
        }
        
        // Analyze RSI history for overbought cycles
        const overboughtThreshold = 70;
        let overboughtCount = 0;
        let consecutiveOverbought = false;
        let alertLevel = 0;
        
        // Count how many times RSI went above 70 recently
        for (let i = 0; i < Math.min(30, rsiData.values.length); i++) {
            const rsi = parseFloat(rsiData.values[i].rsi);
            
            if (rsi > overboughtThreshold) {
                if (!consecutiveOverbought) {
                    overboughtCount++;
                    consecutiveOverbought = true;
                }
            } else if (rsi < 65) { // Reset if RSI drops below 65
                consecutiveOverbought = false;
            }
        }
        
        // Determine alert level
        if (latestRSI > overboughtThreshold) {
            if (overboughtCount >= 3) {
                alertLevel = 3; // DANGER
            } else if (overboughtCount >= 2) {
                alertLevel = 2; // WARNING
            } else {
                alertLevel = 1; // OPPORTUNITY
            }
        }
        
        // Get alert message
        const getAlertMessage = (level) => {
            switch(level) {
                case 1:
                    return {
                        title: 'Strong Momentum - High Gains Probable',
                        color: 'green',
                        icon: '🟢'
                    };
                case 2:
                    return {
                        title: 'Caution - Market Overheating',
                        color: 'yellow',
                        icon: '🟡'
                    };
                case 3:
                    return {
                        title: 'Alert - Extreme Peak Zone',
                        color: 'red',
                        icon: '🔴'
                    };
                default:
                    return {
                        title: 'Normal Market Conditions',
                        color: 'gray',
                        icon: '⚪'
                    };
            }
        };
        
        const alert = getAlertMessage(alertLevel);
        
        console.log(`✅ Market Heat calculated: ${latestRSI.toFixed(1)} (Alert Level: ${alertLevel})`);
        
        res.status(200).json({
            success: true,
            data: {
                currentHeat: latestRSI,
                heatLevel: alertLevel,
                peakCycles: overboughtCount,
                maxCycles: 3,
                alert: alert,
                isOverheated: latestRSI > overboughtThreshold,
                history: rsiData.values.slice(0, 30).map(v => ({
                    date: v.datetime,
                    heat: parseFloat(v.rsi)
                }))
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error calculating Market Heat:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to calculate Market Heat. Please try again later.'
        });
    }
}
