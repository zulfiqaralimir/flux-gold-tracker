// Vercel Serverless Function to calculate Market Heat + Buy/Sell Signals
// Uses Twelve Data API for comprehensive technical analysis
//
// The publicly displayed "Market Heat" value is a blended composite of RSI,
// MACD strength and daily price momentum — not raw RSI — so it won't match
// what a plain RSI(14) lookup on a charting site would show. The raw RSI is
// still kept internally as `baseline` for reference only; it does not drive
// any of the thresholds below.

const RSI_WEIGHT = 0.6;
const MACD_WEIGHT = 1.5;
const PULSE_WEIGHT = 2;
const PULSE_CLAMP = 5;

// Blends RSI + signed MACD strength + signed daily price momentum into one
// 0-100 score for day index i (0 = most recent, matching Twelve Data's
// descending order). Deliberately not a linear function of RSI alone.
function computeCompositeAt(i, rsiValues, macdValues, priceValues) {
    const rsi = parseFloat(rsiValues[i].rsi);
    if (isNaN(rsi)) return null;

    let macdSigned = 0;
    if (macdValues && macdValues[i]) {
        const macd = parseFloat(macdValues[i].macd);
        const signalLine = parseFloat(macdValues[i].macd_signal);
        const histogram = parseFloat(macdValues[i].macd_hist);
        if (!isNaN(macd) && !isNaN(signalLine) && !isNaN(histogram)) {
            const strength = Math.min(Math.abs(histogram) * 2, 10);
            macdSigned = macd > signalLine ? strength : -strength;
        }
    }

    let pulseSigned = 0;
    if (priceValues && priceValues[i] && priceValues[i + 1]) {
        const latestPrice = parseFloat(priceValues[i].close);
        const priorPrice = parseFloat(priceValues[i + 1].close);
        if (!isNaN(latestPrice) && !isNaN(priorPrice) && priorPrice !== 0) {
            pulseSigned = ((latestPrice - priorPrice) / priorPrice) * 100;
            pulseSigned = Math.max(-PULSE_CLAMP, Math.min(PULSE_CLAMP, pulseSigned));
        }
    }

    const composite = 50 + (rsi - 50) * RSI_WEIGHT + macdSigned * MACD_WEIGHT + pulseSigned * PULSE_WEIGHT;
    return Math.max(0, Math.min(100, composite));
}

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

        // Fetch RSI (baseline reference)
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

        // Extract latest raw RSI (baseline reference only)
        const latestRSI = rsiData.values && rsiData.values[0] ? parseFloat(rsiData.values[0].rsi) : null;

        if (!latestRSI) {
            throw new Error('No Market Heat data available');
        }

        // Composite Market Heat (RSI + MACD + Pulse blended into one score)
        const macdValues = macdData && macdData.values ? macdData.values : null;
        const priceValues = priceData && priceData.values ? priceData.values : null;
        const compositeSeries = rsiData.values.map((_, i) =>
            computeCompositeAt(i, rsiData.values, macdValues, priceValues)
        );
        const latestHeat = compositeSeries[0];

        if (latestHeat === null) {
            throw new Error('No Market Heat data available');
        }

        // Calculate Pulse Speed (momentum speed) for display
        let pulseSpeed = 'Steady';
        let pulseIcon = '🚶';
        let pulseValue = 0;
        let priceChangePercent = 0;

        if (priceData && priceData.values && priceData.values.length >= 2) {
            const latestPrice = parseFloat(priceData.values[0].close);
            const previousPrice = parseFloat(priceData.values[1].close);
            const priceChange = ((latestPrice - previousPrice) / previousPrice) * 100;

            priceChangePercent = priceChange;
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

        // Analyze MACD (Trend Force) for display
        let trendForce = 'Neutral';

        if (macdData && macdData.values && macdData.values[0]) {
            const macd = parseFloat(macdData.values[0].macd);
            const signal = parseFloat(macdData.values[0].macd_signal);

            trendForce = macd > signal ? 'Bullish' : 'Bearish';
        }

        // Generate Buy/Sell Signal (driven entirely by the composite Heat score)
        let signalType = 'HOLD';
        let signalColor = 'gray';
        let signalIcon = '⚪';
        let signalStrength = 0;
        let confidence = 0;
        let supportingIndicators = [];

        // BUY Signal Logic
        if (latestHeat < 40) {
            signalType = 'ENTRY';
            signalColor = 'green';
            signalIcon = '🟢';

            // Calculate strength based on how oversold
            if (latestHeat < 10) {
                signalStrength = 10; // VERY STRONG - Extreme opportunity
                supportingIndicators.push('✅ Extreme Low Heat (' + latestHeat.toFixed(1) + '° - CRITICAL BUY ZONE)');
            } else if (latestHeat < 20) {
                signalStrength = 8; // STRONG - Great opportunity
                supportingIndicators.push('✅ Very Low Heat (' + latestHeat.toFixed(1) + '° - STRONG BUY)');
            } else if (latestHeat < 30) {
                signalStrength = 6; // MODERATE - Good opportunity
                supportingIndicators.push('✅ Low Heat Zone (' + latestHeat.toFixed(1) + '° - BUY)');
            } else {
                signalStrength = 4; // WEAK - Minor opportunity
                supportingIndicators.push('✅ Cooling Heat (' + latestHeat.toFixed(1) + '° - CONSIDER BUY)');
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
        else if (latestHeat > 60) {
            signalType = 'EXIT';
            signalColor = 'red';
            signalIcon = '🔴';

            // Calculate strength based on how overbought
            if (latestHeat > 90) {
                signalStrength = 10; // VERY STRONG - Extreme danger
                supportingIndicators.push('✅ Extreme High Heat (' + latestHeat.toFixed(1) + '° - CRITICAL SELL ZONE)');
            } else if (latestHeat > 80) {
                signalStrength = 8; // STRONG - High risk
                supportingIndicators.push('✅ Very High Heat (' + latestHeat.toFixed(1) + '° - STRONG SELL)');
            } else if (latestHeat > 70) {
                signalStrength = 6; // MODERATE - Take profits
                supportingIndicators.push('✅ High Heat Zone (' + latestHeat.toFixed(1) + '° - SELL)');
            } else {
                signalStrength = 4; // WEAK - Consider reducing
                supportingIndicators.push('✅ Rising Heat (' + latestHeat.toFixed(1) + '° - CONSIDER SELL)');
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

            // Scale strength/confidence by how close Heat is to the 40/60 edges,
            // instead of a flat value, so two neutral readings aren't identical
            const distanceFromMid = Math.abs(latestHeat - 50); // 0 (at 50) to 10 (at 40 or 60)
            signalStrength = Math.max(1, Math.min(3, Math.round(1 + distanceFromMid / 5)));
            confidence = Math.round(30 + distanceFromMid * 2);

            supportingIndicators.push('ℹ️ Neutral Heat (' + latestHeat.toFixed(1) + '° - RANGE: 40-60°)');
            supportingIndicators.push('ℹ️ Wait for Market Heat < 40° (BUY) or > 60° (SELL)');
        }

        // Get strength label
        const getStrengthLabel = (strength) => {
            if (strength >= 9) return 'VERY STRONG';
            if (strength >= 7) return 'STRONG';
            if (strength >= 4) return 'MODERATE';
            return 'WEAK';
        };

        // Undisguised reference values: same strength/confidence branching,
        // fed by raw RSI instead of the composite Heat score. Personal
        // reference only, shown dim in the UI - not the driving signal.
        const computeRawSignal = (rsi) => {
            if (rsi < 40) {
                if (rsi < 10) return { strength: 10, confidence: 98 };
                if (rsi < 20) return { strength: 8, confidence: 80 };
                if (rsi < 30) return { strength: 6, confidence: 60 };
                return { strength: 4, confidence: 40 };
            }
            if (rsi > 60) {
                if (rsi > 90) return { strength: 10, confidence: 98 };
                if (rsi > 80) return { strength: 8, confidence: 80 };
                if (rsi > 70) return { strength: 6, confidence: 60 };
                return { strength: 4, confidence: 40 };
            }
            const distanceFromMid = Math.abs(rsi - 50);
            const strength = Math.max(1, Math.min(3, Math.round(1 + distanceFromMid / 5)));
            return { strength, confidence: Math.round(30 + distanceFromMid * 2) };
        };
        const rawSignal = computeRawSignal(latestRSI);

        // Analyze Market Heat for overbought cycles (driven by the composite score)
        const overboughtThreshold = 70;
        let overboughtCount = 0;
        let consecutiveOverbought = false;
        let heatLevel = 0;

        for (let i = 0; i < Math.min(30, compositeSeries.length); i++) {
            const heat = compositeSeries[i];
            if (heat === null) continue;

            if (heat > overboughtThreshold) {
                if (!consecutiveOverbought) {
                    overboughtCount++;
                    consecutiveOverbought = true;
                }
            } else if (heat < 65) {
                consecutiveOverbought = false;
            }
        }

        if (latestHeat > overboughtThreshold) {
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

        console.log(`✅ Signals calculated: ${signalType} (Strength: ${signalStrength}/10, Heat: ${latestHeat.toFixed(1)})`);

        res.status(200).json({
            success: true,
            data: {
                currentHeat: latestHeat,
                price: priceValues && priceValues[0] ? parseFloat(priceValues[0].close) : null,
                priceChangePercent: priceChangePercent,
                baseline: parseFloat(latestRSI.toFixed(1)),
                heatLevel: heatLevel,
                peakCycles: overboughtCount,
                maxCycles: 3,
                alert: heatAlert,
                isOverheated: latestHeat > overboughtThreshold,

                // Buy/Sell Signal data
                signal: {
                    type: signalType,
                    icon: signalIcon,
                    color: signalColor,
                    strength: signalStrength,
                    strengthLabel: getStrengthLabel(signalStrength),
                    confidence: confidence,
                    rawStrength: rawSignal.strength,
                    rawConfidence: rawSignal.confidence,
                    pulseSpeed: pulseSpeed,
                    pulseIcon: pulseIcon,
                    pulseValue: pulseValue.toFixed(2),
                    supportingIndicators: supportingIndicators,
                    trendForce: trendForce
                },

                // History
                history: rsiData.values.slice(0, 30).map((v, i) => ({
                    date: v.datetime,
                    heat: compositeSeries[i]
                })).filter(h => h.heat !== null)
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
