// Vercel Serverless Function to calculate Microsoft Market Heat + Buy/Sell Signals
// Same RSI/MACD/Pulse Speed logic as api/market-heat.js, applied to Microsoft.
// Data source: Yahoo Finance's public chart endpoint (no API key required) —
// it only returns raw price history, so RSI/MACD/EMA are computed here in JS.

function calculateRSISeries(values, period = 14) {
    const rsi = new Array(values.length).fill(null);
    let gainSum = 0, lossSum = 0;

    for (let i = 1; i <= period; i++) {
        const change = values[i] - values[i - 1];
        if (change >= 0) gainSum += change; else lossSum -= change;
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return rsi;
}

function calculateEMASeries(values, period) {
    const ema = new Array(values.length).fill(null);
    const k = 2 / (period + 1);

    let seed = 0;
    for (let i = 0; i < period; i++) seed += values[i];
    ema[period - 1] = seed / period;

    for (let i = period; i < values.length; i++) {
        ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }

    return ema;
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
        console.log('📊 Fetching Microsoft market data from Yahoo Finance...');

        const chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/MSFT?interval=1d&range=6mo';
        const chartResponse = await fetch(chartUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!chartResponse.ok) {
            throw new Error(`Yahoo Finance returned status: ${chartResponse.status}`);
        }

        const chartData = await chartResponse.json();
        const result = chartData.chart && chartData.chart.result && chartData.chart.result[0];

        if (!result) {
            const message = chartData.chart && chartData.chart.error && chartData.chart.error.description;
            throw new Error(message || 'No Microsoft data available');
        }

        const timestamps = result.timestamp || [];
        const closes = result.indicators.quote[0].close || [];

        // Drop any trailing null (in-progress session with no close yet)
        const series = timestamps
            .map((t, i) => ({ time: t, close: closes[i] }))
            .filter(p => p.close !== null && p.close !== undefined);

        if (series.length < 35) {
            throw new Error('Not enough Microsoft history to calculate indicators');
        }

        const closeValues = series.map(p => p.close);
        const lastIdx = closeValues.length - 1;

        // RSI (Market Heat)
        const rsiSeries = calculateRSISeries(closeValues, 14);
        const latestRSI = rsiSeries[lastIdx];

        if (latestRSI === null) {
            throw new Error('No Market Heat data available');
        }

        // MACD (Trend Force): EMA12 - EMA26, signal = EMA9 of the MACD line
        const ema12 = calculateEMASeries(closeValues, 12);
        const ema26 = calculateEMASeries(closeValues, 26);
        const macdLine = closeValues.map((_, i) =>
            (ema12[i] !== null && ema26[i] !== null) ? ema12[i] - ema26[i] : null
        );

        const macdValidStart = macdLine.findIndex(v => v !== null);
        const signalValidSeries = calculateEMASeries(macdLine.slice(macdValidStart), 9);
        const signalLine = new Array(closeValues.length).fill(null);
        signalValidSeries.forEach((v, i) => { signalLine[macdValidStart + i] = v; });

        const latestMacd = macdLine[lastIdx];
        const latestSignal = signalLine[lastIdx];
        const latestHistogram = (latestMacd !== null && latestSignal !== null) ? latestMacd - latestSignal : null;

        // Calculate Pulse Speed (momentum speed)
        let pulseSpeed = 'Steady';
        let pulseIcon = '🚶';
        let pulseValue = 0;

        if (closeValues.length >= 2) {
            const latestPrice = closeValues[lastIdx];
            const previousPrice = closeValues[lastIdx - 1];
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

        if (latestMacd !== null && latestSignal !== null) {
            if (latestMacd > latestSignal) {
                trendForce = 'Bullish';
                trendStrength = Math.min(Math.abs(latestHistogram) * 2, 10);
            } else {
                trendForce = 'Bearish';
                trendStrength = Math.min(Math.abs(latestHistogram) * 2, 10);
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

            if (latestRSI < 10) {
                signalStrength = 10;
                supportingIndicators.push('✅ Extreme Low Heat (' + latestRSI.toFixed(1) + '° - CRITICAL BUY ZONE)');
            } else if (latestRSI < 20) {
                signalStrength = 8;
                supportingIndicators.push('✅ Very Low Heat (' + latestRSI.toFixed(1) + '° - STRONG BUY)');
            } else if (latestRSI < 30) {
                signalStrength = 6;
                supportingIndicators.push('✅ Low Heat Zone (' + latestRSI.toFixed(1) + '° - BUY)');
            } else {
                signalStrength = 4;
                supportingIndicators.push('✅ Cooling Heat (' + latestRSI.toFixed(1) + '° - CONSIDER BUY)');
            }

            if (trendForce === 'Bullish') {
                signalStrength = Math.min(signalStrength + 1, 10);
                supportingIndicators.push('✅ Positive Trend Force');
            }

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

            if (latestRSI > 90) {
                signalStrength = 10;
                supportingIndicators.push('✅ Extreme High Heat (' + latestRSI.toFixed(1) + '° - CRITICAL SELL ZONE)');
            } else if (latestRSI > 80) {
                signalStrength = 8;
                supportingIndicators.push('✅ Very High Heat (' + latestRSI.toFixed(1) + '° - STRONG SELL)');
            } else if (latestRSI > 70) {
                signalStrength = 6;
                supportingIndicators.push('✅ High Heat Zone (' + latestRSI.toFixed(1) + '° - SELL)');
            } else {
                signalStrength = 4;
                supportingIndicators.push('✅ Rising Heat (' + latestRSI.toFixed(1) + '° - CONSIDER SELL)');
            }

            if (trendForce === 'Bearish') {
                signalStrength = Math.min(signalStrength + 1, 10);
                supportingIndicators.push('✅ Negative Trend Force');
            }

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

            // Scale strength/confidence by how close RSI is to the 40/60 edges,
            // instead of a flat value, so two neutral readings aren't identical
            const distanceFromMid = Math.abs(latestRSI - 50); // 0 (at 50) to 10 (at 40 or 60)
            signalStrength = Math.max(1, Math.min(3, Math.round(1 + distanceFromMid / 5)));
            confidence = Math.round(30 + distanceFromMid * 2);

            supportingIndicators.push('ℹ️ Neutral Heat (' + latestRSI.toFixed(1) + '° - RANGE: 40-60°)');
            supportingIndicators.push('ℹ️ Wait for Market Heat < 40° (BUY) or > 60° (SELL)');
        }

        const getStrengthLabel = (strength) => {
            if (strength >= 9) return 'VERY STRONG';
            if (strength >= 7) return 'STRONG';
            if (strength >= 4) return 'MODERATE';
            return 'WEAK';
        };

        // History (most recent first), used for overbought-cycle analysis + chart
        const historyPoints = [];
        for (let i = lastIdx; i >= 0 && historyPoints.length < 30; i--) {
            if (rsiSeries[i] !== null) {
                historyPoints.push({
                    date: new Date(series[i].time * 1000).toISOString().split('T')[0],
                    heat: rsiSeries[i]
                });
            }
        }

        // Analyze Market Heat for overbought cycles (existing logic)
        const overboughtThreshold = 70;
        let overboughtCount = 0;
        let consecutiveOverbought = false;
        let heatLevel = 0;

        for (const point of historyPoints) {
            if (point.heat > overboughtThreshold) {
                if (!consecutiveOverbought) {
                    overboughtCount++;
                    consecutiveOverbought = true;
                }
            } else if (point.heat < 65) {
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
                    return { title: 'Strong Momentum - High Gains Probable', color: 'green', icon: '🟢' };
                case 2:
                    return { title: 'Caution - Market Overheating', color: 'yellow', icon: '🟡' };
                case 3:
                    return { title: 'Alert - Extreme Peak Zone', color: 'red', icon: '🔴' };
                default:
                    return { title: 'Normal Market Conditions', color: 'gray', icon: '⚪' };
            }
        };

        const heatAlert = getHeatAlert(heatLevel);

        console.log(`✅ Microsoft signals calculated: ${signalType} (Strength: ${signalStrength}/10, Heat: ${latestRSI.toFixed(1)})`);

        res.status(200).json({
            success: true,
            data: {
                currentHeat: latestRSI,
                heatLevel: heatLevel,
                peakCycles: overboughtCount,
                maxCycles: 3,
                alert: heatAlert,
                isOverheated: latestRSI > overboughtThreshold,

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

                history: historyPoints
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error calculating Microsoft signals:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to calculate Microsoft market signals. Please try again later.'
        });
    }
}
