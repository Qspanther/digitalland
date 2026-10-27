import { getPlatformState, getUserByEmail, savePlatformState, savePriceHistory, saveUser, PriceCandle } from '../db';

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const minuteMs = 60 * 1000;
const tenYearsAgo = now - (10 * 365 * dayMs);

const roundPrice = (price: number) => Math.max(0.0001, Math.round(price * 10000) / 10000);

const buildCandle = (time: number, open: number, close: number, volumeYard: number, reason: string): PriceCandle => {
    const wick = Math.max(0.0001, Math.abs(close - open) * 0.45);
    return {
        time,
        open: roundPrice(open),
        high: roundPrice(Math.max(open, close) + wick),
        low: roundPrice(Math.max(0.0001, Math.min(open, close) - wick)),
        close: roundPrice(close),
        volumeYard,
        reason
    };
};

const seed = () => {
    const state = getPlatformState();
    const ashish = getUserByEmail('ashish@land.com');

    state.totalSupply = 1000000000;
    state.circulatingSupply = 10000;
    state.basePriceUsd = state.basePriceUsd || 12.04;
    state.currentPriceUsd = state.currentPriceUsd || 12.04;
    state.fiatTreasury = state.fiatTreasury || { INR: 0, USD: 0, EUR: 0, Dinar: 0 };

    if (ashish) {
        ashish.balanceYard = 10000;
        ashish.transactions = [
            {
                id: ashish.transactions[0]?.id || 'ashish-historical-allocation',
                type: 'BUY_PLATFORM',
                amountYard: 10000,
                priceUsd: 0.0007,
                timestamp: new Date(tenYearsAgo).toISOString(),
                senderId: null,
                receiverId: ashish.id
            }
        ];
        saveUser(ashish);
    }

    const candles: PriceCandle[] = [];
    let price = 0.0007;
    const target = Math.max(state.currentPriceUsd, state.targetPriceUsd || state.currentPriceUsd || 12.04);
    const days = 10 * 365;

    for (let i = 0; i < days; i++) {
        const time = Math.floor((tenYearsAgo + i * dayMs) / dayMs) * dayMs;
        const progress = i / Math.max(1, days - 1);
        const trend = 0.0007 * Math.pow(target / 0.0007, progress);
        const cycle = Math.sin(progress * Math.PI * 18) * trend * 0.035;
        const adminPulse = Math.sin(progress * Math.PI * 51) * trend * 0.012;
        const close = roundPrice(Math.max(0.0007, trend + cycle + adminPulse));
        const volume = 40 + Math.round(300 * progress) + Math.round(Math.abs(Math.sin(progress * 31)) * 120);

        candles.push(buildCandle(
            time,
            price,
            close,
            volume,
            'Historical treasury demand and user adoption.'
        ));
        price = close;
    }

    for (let i = 120; i >= 1; i--) {
        const time = Math.floor((now - i * minuteMs) / minuteMs) * minuteMs;
        const wave = Math.sin(i / 6) * price * 0.0015;
        const close = roundPrice(Math.max(0.0001, price + wave));
        candles.push(buildCandle(
            time,
            price,
            close,
            5 + Math.round(Math.abs(wave / Math.max(price, 0.0001)) * 10000),
            'Recent saved live market movement.'
        ));
        price = close;
    }

    savePriceHistory(candles);
    savePlatformState(state);
    console.log(`Seeded ${candles.length} candles and set ashish@land.com to 10000 Yard.`);
};

seed();
