import { getPlatformState, savePlatformState, PlatformState, recordPriceCandle, getUserByEmail, saveUser } from './db';

export const calculateCurrentPrice = (totalSupply: number, circulatingSupply: number, basePrice: number): number => {
    // basePrice is approx 0.00000843 (0.0007 INR)
    // We want the max price to be approx 12.048 (1000 INR)
    const maxPriceUsd = 12.048;
    const ratio = circulatingSupply / totalSupply;
    return basePrice * Math.pow(maxPriceUsd / basePrice, ratio);
};

const ADMIN_EMAIL = 'degital@gmail.com';
const roundPrice = (price: number): number => {
    if (price < 0.0001) return Number(price.toFixed(8));
    return Math.max(0.00000001, Math.round(price * 100000000) / 100000000);
};
const executeAdminTrade = (state: PlatformState, tradeType: 'BUY' | 'SELL', amountYard: number): number => {
    const admin = getUserByEmail(ADMIN_EMAIL);
    const timestamp = new Date().toISOString();

    if (tradeType === 'BUY' && state.circulatingSupply < state.totalSupply) {
        const buyAmount = Math.min(amountYard, state.totalSupply - state.circulatingSupply);
        state.circulatingSupply += buyAmount;
        if (admin) {
            admin.balanceYard += buyAmount;
            saveUser(admin);
        }
        state.lastMarketMakerAction = {
            type: 'BUY_FROM_TREASURY',
            amountYard: buyAmount,
            reason: 'Admin market-maker bought Yard from treasury.',
            timestamp
        };
        return buyAmount;
    }

    if (tradeType === 'SELL' && state.circulatingSupply > 0) {
        const sellAmount = Math.min(amountYard, state.circulatingSupply, admin?.balanceYard || amountYard);
        state.circulatingSupply -= sellAmount;
        if (admin) {
            admin.balanceYard = Math.max(0, admin.balanceYard - sellAmount);
            saveUser(admin);
        }
        state.lastMarketMakerAction = {
            type: 'SELL_TO_TREASURY',
            amountYard: sellAmount,
            reason: 'Admin market-maker sold Yard back to treasury.',
            timestamp
        };
        return sellAmount;
    }

    state.lastMarketMakerAction = {
        type: 'HOLD',
        amountYard: 0,
        reason: 'No treasury action was needed.',
        timestamp
    };
    return 0;
};

export const updatePlatformPrice = async (): Promise<PlatformState> => {
    const state = getPlatformState();
    let volumeYard = 0;
    
    // --- Phase 1: Determine Supply Adjustment ---
    if (state.autoMode === false && state.targetPriceUsd != null && state.targetDurationMs != null && state.startPriceUsd != null && state.targetStartTime != null) {
        // TARGET MODE
        const elapsed = Date.now() - state.targetStartTime;
        if (elapsed >= state.targetDurationMs) {
            // Target Reached
            const idealPrice = state.targetPriceUsd;
            const requiredSupply = (((idealPrice / state.basePriceUsd) - 1) / 100) * state.totalSupply;
            const delta = requiredSupply - state.circulatingSupply;
            if (delta > 0) volumeYard = executeAdminTrade(state, 'BUY', delta);
            else if (delta < 0) volumeYard = executeAdminTrade(state, 'SELL', Math.abs(delta));
            
            // Unfreeze to AutoMode
            state.autoMode = true;
            state.targetPriceUsd = null;
            state.targetDurationMs = null;
            state.targetStartTime = null;
            state.startPriceUsd = null;
        } else {
            // Progress towards target
            const progress = elapsed / state.targetDurationMs;
            const diff = state.targetPriceUsd - state.startPriceUsd;
            const idealPrice = state.startPriceUsd + (diff * progress);
            
            const requiredSupply = (((idealPrice / state.basePriceUsd) - 1) / 100) * state.totalSupply;
            const delta = requiredSupply - state.circulatingSupply;
            
            // Only trade if difference is meaningful
            if (delta > 5) volumeYard = executeAdminTrade(state, 'BUY', delta);
            else if (delta < -5) volumeYard = executeAdminTrade(state, 'SELL', Math.abs(delta));
        }
    } else if (state.autoMode) {
        // Active Market Bot: Randomly buys/sells small amounts (0-5 Yards) for the Admin account 
        // This organically updates the circulating supply every second, causing the strictly-calculated price to move smoothly.
        const tradeDecision = Math.random();
        const amount = Math.random() * 5; 
        
        if (tradeDecision > 0.55) {
            volumeYard = executeAdminTrade(state, 'BUY', amount);
        } else if (tradeDecision < 0.45) {
            volumeYard = executeAdminTrade(state, 'SELL', amount);
        } else {
            executeAdminTrade(state, 'BUY', 0); // HOLD
        }
    } else if (state.autoMode === false && typeof state.overridePriceUsd === 'number') {
        const requiredSupply = (((state.overridePriceUsd / state.basePriceUsd) - 1) / 100) * state.totalSupply;
        const delta = requiredSupply - state.circulatingSupply;
        if (delta > 0) volumeYard = executeAdminTrade(state, 'BUY', delta);
        else if (delta < 0) volumeYard = executeAdminTrade(state, 'SELL', Math.abs(delta));
    }

    // Calculate New Price Strictly Organically (no random micro-noise)
    const algorithmicPrice = calculateCurrentPrice(state.totalSupply, state.circulatingSupply, state.basePriceUsd);
    
    let newPrice = roundPrice(algorithmicPrice);

    if (newPrice < state.basePriceUsd * 0.5) {
        newPrice = roundPrice(state.basePriceUsd * 0.5);
    }

    state.currentPriceUsd = newPrice;

    recordPriceCandle(
        newPrice,
        volumeYard,
        state.lastMarketMakerAction?.reason || 'Live market tick',
        Date.now()
    );
    
    savePlatformState(state);
    return state;
};
