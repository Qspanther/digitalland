import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'src', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const TOTAL_SUPPLY = 10000000;
const BASE_PRICE = 0.0000084337; // ~0.0007 INR
const MAX_PRICE = 12.048; // ~1000 INR
const DAYS = 3650; // 10 years

const calculateCurrentPrice = (circulatingSupply: number): number => {
    const ratio = circulatingSupply / TOTAL_SUPPLY;
    return BASE_PRICE * Math.pow(MAX_PRICE / BASE_PRICE, ratio);
};

interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volumeYard: number;
}

const generateHistory = () => {
    console.log("Starting 10-year history generation...");
    let circulatingSupply = 0;
    const startTime = Date.now() - (DAYS * 24 * 60 * 60 * 1000);
    
    const dailyCandles: Candle[] = [];
    let currentPrice = BASE_PRICE;

    // We will distribute the buying.
    // We want the final circulating supply to be just enough to reach around 12.04 USD (1000 INR)
    // Actually, to reach 1000 INR, circSupply should reach close to TOTAL_SUPPLY.
    // Let's say over 10 years, they buy 9,900,000 Yards.
    const totalToBuy = 9900000;
    const avgBuyPerDay = totalToBuy / DAYS; // ~2712 Yards per day

    for (let i = 0; i < DAYS; i++) {
        const time = startTime + (i * 24 * 60 * 60 * 1000);
        
        // Randomize the daily buy amount to make it look organic (between 500 and 5000)
        const dailyBuy = Math.max(500, Math.random() * (avgBuyPerDay * 2));
        
        const open = currentPrice;
        
        circulatingSupply += dailyBuy;
        if (circulatingSupply > TOTAL_SUPPLY) circulatingSupply = TOTAL_SUPPLY;

        const newAlgoPrice = calculateCurrentPrice(circulatingSupply);
        
        // Add some noise for high/low
        const noise = newAlgoPrice * 0.05; // 5% daily volatility
        const high = Math.max(open, newAlgoPrice) + (Math.random() * noise);
        const low = Math.max(BASE_PRICE, Math.min(open, newAlgoPrice) - (Math.random() * noise));
        const close = newAlgoPrice;

        dailyCandles.push({
            time,
            open,
            high,
            low,
            close,
            volumeYard: dailyBuy
        });

        currentPrice = close;
    }

    // Save 1D
    fs.writeFileSync(path.join(dataDir, 'history_1D.json'), JSON.stringify(dailyCandles));
    console.log(`Saved 1D candles: ${dailyCandles.length}`);

    // Helper to aggregate
    const aggregate = (candles: Candle[], chunkSize: number): Candle[] => {
        const agg: Candle[] = [];
        for (let i = 0; i < candles.length; i += chunkSize) {
            const chunk = candles.slice(i, i + chunkSize);
            agg.push({
                time: chunk[0].time,
                open: chunk[0].open,
                high: Math.max(...chunk.map(c => c.high)),
                low: Math.min(...chunk.map(c => c.low)),
                close: chunk[chunk.length - 1].close,
                volumeYard: chunk.reduce((sum, c) => sum + c.volumeYard, 0)
            });
        }
        return agg;
    };

    // Save 1W (7 days)
    const weeklyCandles = aggregate(dailyCandles, 7);
    fs.writeFileSync(path.join(dataDir, 'history_1W.json'), JSON.stringify(weeklyCandles));
    console.log(`Saved 1W candles: ${weeklyCandles.length}`);

    // Save 1M (30 days)
    const monthlyCandles = aggregate(dailyCandles, 30);
    fs.writeFileSync(path.join(dataDir, 'history_1M.json'), JSON.stringify(monthlyCandles));
    console.log(`Saved 1M candles: ${monthlyCandles.length}`);

    // Save 6M (182 days)
    const sixMonthCandles = aggregate(dailyCandles, 182);
    fs.writeFileSync(path.join(dataDir, 'history_6M.json'), JSON.stringify(sixMonthCandles));
    console.log(`Saved 6M candles: ${sixMonthCandles.length}`);

    // Save 1Y (365 days)
    const yearlyCandles = aggregate(dailyCandles, 365);
    fs.writeFileSync(path.join(dataDir, 'history_1Y.json'), JSON.stringify(yearlyCandles));
    console.log(`Saved 1Y candles: ${yearlyCandles.length}`);

    // Save ALL (same as 1M or 1Y for wide view)
    fs.writeFileSync(path.join(dataDir, 'history_ALL.json'), JSON.stringify(monthlyCandles));
    console.log(`Saved ALL candles: ${monthlyCandles.length}`);

    // Update PlatformState
    const statePath = path.join(dataDir, 'platformState.json');
    let state: any = {};
    if (fs.existsSync(statePath)) {
        state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
    state.totalSupply = TOTAL_SUPPLY;
    state.circulatingSupply = circulatingSupply;
    state.basePriceUsd = BASE_PRICE;
    state.currentPriceUsd = currentPrice;
    
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log("Updated platformState.json with new supply and price.");

    // Update users
    const usersDir = path.join(dataDir, 'users');
    if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });
    
    const ashishPath = path.join(usersDir, 'ashish@land.com.json');
    if (fs.existsSync(ashishPath)) {
        const ashish = JSON.parse(fs.readFileSync(ashishPath, 'utf-8'));
        ashish.balanceYard += 5000000;
        fs.writeFileSync(ashishPath, JSON.stringify(ashish, null, 2));
    }

    const degitalPath = path.join(usersDir, 'degital@gmail.com.json');
    if (fs.existsSync(degitalPath)) {
        const degital = JSON.parse(fs.readFileSync(degitalPath, 'utf-8'));
        degital.balanceYard += (circulatingSupply - 5000000);
        fs.writeFileSync(degitalPath, JSON.stringify(degital, null, 2));
    }
    
    console.log("Generation complete!");
};

generateHistory();
