// Vercel Serverless Function to calculate Market Heat + Buy/Sell Signals
// Uses Twelve Data API for comprehensive technical analysis

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
                error: 'Signal system not configured.'
            });
            return;
        }
        
        console.log('📊 Fetching comprehensive market data...');
        
        // Fetch RSI (Market Heat)
        const rsiUrl = `https://api.twelvedata.com/rsi?symbol=XAU/USD&interval=1day&time_period=14&apikey=${TWELVE_DATA_API_KEY}&outputsize=30`;
        const rsiResponse = await fetch(rsiUrl);
        
        if (!rsiResponse.ok) {
            throw new Error(`Twelve Data API returned status: ${rsiResponse.status}`);
        }
        
        const rsiData = await rsiResponse.json();
        
        if (rsiData.status === 'error') {
            throw new Error(rsiData.message || 'Error from Twelve Data API');
        }
        
        // Fetch MACD (Trend Force)
        const macdUrl = `https://api.twelvedata.com/macd?symbol=XAU/USD&interval=1day&apikey=${TWELVE_DATA_API_KEY}&outputsize=30`;
        const macdResponse = await fetch(macdUrl);
        const macdData = macdResponse.ok ? await macdResponse.json() : null;
        
        // Fetch Price Data for Pulse Speed calculation
        const priceUrl = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=30&apikey=${TWELVE_DATA_API_KEY}`;
        const priceResponse = await fetch(priceUrl);
        const priceData = priceResponse.ok ? await priceResponse.json() : null;
        
        // Extract latest values
        const latestRSI = rsiData.values && rsiData.values[0] ? parseFloat(rsiData.values[0].rsi) : null;
        
        if (!latestRSI) {
            throw new Error('No Market Heat data available');
        }
        
        // Calculate Pulse Speed (momentum speed)
        let pulseSpeed = 'Steady';
        let pulseIcon = '🚶';
        let pulseValue = 0;
        
        if (priceData && priceData.values && priceData.values.length >= 2) {
            const latestPrice = parseFloat(priceData.values[0].close);
            const previousPrice = parseFloat(priceData.values[1].close);
            const priceChange = ((latestPrice - previousPrice) / previousPrice) * 100;
            
            pulseValue = Math.abs(priceChange);
            
            if (pulseValue < 0.5) {
                pulseSpeed = 'Gradual';
                pulseIcon = '🐌';
            } else if (pulseValue < 1.5) {
                pulseSpeed = 'Steady';
                pulseIcon = '🚶';
            } else if (pulseValue < 3) {
                pulseSpeed = 'Rapid';
                pulseIcon = '🏃';
            } else {
                pulseSpeed = 'Extreme';
                pulseIcon = '🚀';
            }
        }
        
        // Analyze MACD (Trend Force)
        let trendForce = 'Neutral';
        let trendStrength = 0;
        
        if (macdData && macdData.values && macdData.values[0]) {
            const macd = parseFloat(macdData.values[0].macd);
            const signal = parseFloat(macdData.values[0].macd_signal);
            const histogram = parseFloat(macdData.values[0].macd_hist);
            
            if (macd > signal) {
                trendForce = 'Bullish';
                trendStrength = Math.min(Math.abs(histogram) * 2, 10);
            } else {
                trendForce = 'Bearish';
                trendStrength = Math.min(Math.abs(histogram) * 2, 10);
            }
        }
        
        // Generate Buy/Sell Signal
        let signalType = 'HOLD';
        let signalColor = 'gray';
        let signalIcon = '⚪';
        let signalStrength = 0;
        let confidence = 0;
        let supportingIndicators = [];
        
        // BUY Signal Logic
        if (latestRSI < 40) {
            signalType = 'ENTRY';
            signalColor = 'green';
            signalIcon = '🟢';
            
            // Calculate strength based on how oversold
            if (latestRSI < 10) {
                signalStrength = 10; // VERY STRONG - Extreme opportunity
                supportingIndicators.push('✅ Extreme Low Heat (' + latestRSI.toFixed(1) + '° - CRITICAL BUY ZONE)');
            } else if (latestRSI < 20) {
                signalStrength = 8; // STRONG - Great opportunity
                supportingIndicators.push('✅ Very Low Heat (' + latestRSI.toFixed(1) + '° - STRONG BUY)');
            } else if (latestRSI < 30) {
                signalStrength = 6; // MODERATE - Good opportunity
                supportingIndicators.push('✅ Low Heat Zone (' + latestRSI.toFixed(1) + '° - BUY)');
            } else {
                signalStrength = 4; // WEAK - Minor opportunity
                supportingIndicators.push('✅ Cooling Heat (' + latestRSI.toFixed(1) + '° - CONSIDER BUY)');
            }
            
            // Boost strength with trend force
            if (trendForce === 'Bullish') {
                signalStrength = Math.min(signalStrength + 1, 10);
                supportingIndicators.push('✅ Positive Trend Force');
            }
            
            // Boost with pulse speed
            if (pulseSpeed === 'Rapid' || pulseSpeed === 'Extreme') {
                signalStrength = Math.min(signalStrength + 1, 10);
                supportingIndicators.push('✅ Strong Upward Pulse (' + pulseIcon + ' ' + pulseSpeed + ')');
            }
            
            confidence = Math.min(signalStrength * 10, 98);
        }
        
        // SELL Signal Logic
        else if (latestRSI > 60) {
            signalType = 'EXIT';
            signalColor = 'red';
            signalIcon = '🔴';
            
            // Calculate strength based on how overbought
            if (latestRSI > 90) {
                signalStrength = 10; // VERY STRONG - Extreme danger
                supportingIndicators.push('✅ Extreme High Heat (' + latestRSI.toFixed(1) + '° - CRITICAL SELL ZONE)');
            } else if (latestRSI > 80) {
                signalStrength = 8; // STRONG - High risk
                supportingIndicators.push('✅ Very High Heat (' + latestRSI.toFixed(1) + '° - STRONG SELL)');
            } else if (latestRSI > 70) {
                signalStrength = 6; // MODERATE - Take profits
                supportingIndicators.push('✅ High Heat Zone (' + latestRSI.toFixed(1) + '° - SELL)');
            } else {
                signalStrength = 4; // WEAK - Consider reducing
                supportingIndicators.push('✅ Rising Heat (' + latestRSI.toFixed(1) + '° - CONSIDER SELL)');
            }
            
            // Boost strength with trend force
            if (trendForce === 'Bearish') {
                signalStrength = Math.min(signalStrength + 1, 10);
                supportingIndicators.push('✅ Negative Trend Force');
            }
            
            // Boost with pulse speed
            if (pulseSpeed === 'Rapid' || pulseSpeed === 'Extreme') {
                signalStrength = Math.min(signalStrength + 1, 10);
                supportingIndicators.push('✅ Strong Downward Pulse (' + pulseIcon + ' ' + pulseSpeed + ')');
            }
            
            confidence = Math.min(signalStrength * 10, 98);
        }
        
        // HOLD Signal
        else {
            signalType = 'HOLD';
            signalColor = 'gray';
            signalIcon = '⚪';
            signalStrength = 3;
            confidence = 50;
            supportingIndicators.push('ℹ️ Neutral Heat (' + latestRSI.toFixed(1) + '° - RANGE: 40-60°)');
            supportingIndicators.push('ℹ️ Wait for Market Heat < 40° (BUY) or > 60° (SELL)');
        }
        
        // Get strength label
        const getStrengthLabel = (strength) => {
            if (strength >= 9) return 'VERY STRONG';
            if (strength >= 7) return 'STRONG';
            if (strength >= 4) return 'MODERATE';
            return 'WEAK';
        };
        
        // Analyze Market Heat for overbought cycles (existing logic)
        const overboughtThreshold = 70;
        let overboughtCount = 0;
        let consecutiveOverbought = false;
        let heatLevel = 0;
        
        for (let i = 0; i < Math.min(30, rsiData.values.length); i++) {
            const rsi = parseFloat(rsiData.values[i].rsi);
            
            if (rsi > overboughtThreshold) {
                if (!consecutiveOverbought) {
                    overboughtCount++;
                    consecutiveOverbought = true;
                }
            } else if (rsi < 65) {
                consecutiveOverbought = false;
            }
        }
        
        if (latestRSI > overboughtThreshold) {
            if (overboughtCount >= 3) {
                heatLevel = 3;
            } else if (overboughtCount >= 2) {
                heatLevel = 2;
            } else {
                heatLevel = 1;
            }
        }
        
        const getHeatAlert = (level) => {
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
        
        const heatAlert = getHeatAlert(heatLevel);
        
        console.log(`✅ Signals calculated: ${signalType} (Strength: ${signalStrength}/10, Heat: ${latestRSI.toFixed(1)})`);
        
        res.status(200).json({
            success: true,
            data: {
                // Market Heat data (existing)
                currentHeat: latestRSI,
                heatLevel: heatLevel,
                peakCycles: overboughtCount,
                maxCycles: 3,
                alert: heatAlert,
                isOverheated: latestRSI > overboughtThreshold,
                
                // Buy/Sell Signal data (new)
                signal: {
                    type: signalType,
                    icon: signalIcon,
                    color: signalColor,
                    strength: signalStrength,
                    strengthLabel: getStrengthLabel(signalStrength),
                    confidence: confidence,
                    pulseSpeed: pulseSpeed,
                    pulseIcon: pulseIcon,
                    pulseValue: pulseValue.toFixed(2),
                    supportingIndicators: supportingIndicators,
                    trendForce: trendForce
                },
                
                // History
                history: rsiData.values.slice(0, 30).map(v => ({
                    date: v.datetime,
                    heat: parseFloat(v.rsi)
                }))
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error calculating signals:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to calculate market signals. Please try again later.'
        });
    }
}
