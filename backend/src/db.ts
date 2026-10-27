import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'src', 'data');
const usersDir = path.join(dataDir, 'users');
const platformStatePath = path.join(dataDir, 'platformState.json');
const priceHistoryPath = path.join(dataDir, 'priceHistory.json');

// Ensure directories exist
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });

export interface Transaction {
    id: string;
    type: 'BUY_PLATFORM' | 'SELL_PLATFORM' | 'GIFT_SENT' | 'GIFT_RECEIVED';
    amountYard: number;
    priceUsd?: number;
    timestamp: string;
    senderId: string | null;
    receiverId: string | null;
}

export interface PendingGift {
    id: string;
    senderId: string;
    senderEmail: string;
    amountYard: number;
    timestamp: string;
}

export interface GiftedBalance {
    senderId: string;
    senderEmail: string;
    amountYard: number;
}

export interface PendingSellApproval {
    id: string;
    sellerId: string;
    sellerEmail: string;
    approverId: string;
    amountYard: number;
    timestamp: string;
}

export interface BankAccount {
    id: string;
    currency: string;
    country: string;
    accountNumber?: string;
    ifscCode?: string;
    routingNumber?: string;
    iban?: string;
    bicSwift?: string;
    bankName?: string;
    createdAt: string;
}

export interface User {
    id: string;
    email: string; // The filename will be email.json
    passwordHash: string;
    mnemonicHash: string;
    walletAddress: string;
    balanceYard: number;
    balances: Record<string, number>; // e.g. { INR: 0, USD: 0, EUR: 0, Dinar: 0 }
    bankAccounts: BankAccount[];
    createdAt: string;
    transactions: Transaction[];
    pendingGifts: PendingGift[];
    giftedBalances?: GiftedBalance[];
    pendingSellApprovalsAsApprover?: PendingSellApproval[];
    pendingSellApprovalsAsSeller?: PendingSellApproval[];
}

export interface PlatformState {
    totalSupply: number;
    circulatingSupply: number;
    basePriceUsd: number;
    currentPriceUsd: number;
    autoMode?: boolean;
    overridePriceUsd?: number | null;
    targetPriceUsd?: number | null;
    targetDurationMs?: number | null;
    targetStartTime?: number | null;
    startPriceUsd?: number | null;
    fiatTreasury: Record<string, number>; // Collected fees
    lastMarketMakerAction?: {
        type: 'BUY_FROM_TREASURY' | 'SELL_TO_TREASURY' | 'HOLD';
        amountYard: number;
        reason: string;
        timestamp: string;
    };
}

export interface PriceCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volumeYard: number;
    reason: string;
}

// Global state functions
export const getPlatformState = (): PlatformState => {
    try {
        const data = fs.readFileSync(platformStatePath, 'utf-8');
        return JSON.parse(data) as PlatformState;
    } catch {
        // Default
        return {
            totalSupply: 10000000,
            circulatingSupply: 0,
            basePriceUsd: 12.04, // Roughly 1000 INR
            currentPriceUsd: 12.04,
            autoMode: true,
            overridePriceUsd: null,
            targetPriceUsd: null,
            targetDurationMs: null,
            targetStartTime: null,
            startPriceUsd: null,
            fiatTreasury: { INR: 0, USD: 0, EUR: 0, Dinar: 0 }
        };
    }
};

export const savePlatformState = (state: PlatformState): void => {
    fs.writeFileSync(platformStatePath, JSON.stringify(state, null, 2), 'utf-8');
};

export const getPriceHistory = (): PriceCandle[] => {
    try {
        const data = fs.readFileSync(priceHistoryPath, 'utf-8');
        return JSON.parse(data) as PriceCandle[];
    } catch {
        return [];
    }
};

export const savePriceHistory = (candles: PriceCandle[]): void => {
    fs.writeFileSync(priceHistoryPath, JSON.stringify(candles, null, 2), 'utf-8');
};

export const recordPriceCandle = (
    priceUsd: number,
    volumeYard: number,
    reason: string,
    timestamp = Date.now(),
    intervalMs = 60 * 1000
): PriceCandle => {
    const candles = getPriceHistory();
    const bucketTime = Math.floor(timestamp / intervalMs) * intervalMs;
    const last = candles[candles.length - 1];

    if (last && last.time === bucketTime) {
        last.high = Math.max(last.high, priceUsd);
        last.low = Math.min(last.low, priceUsd);
        last.close = priceUsd;
        last.volumeYard += volumeYard;
        last.reason = reason;
        savePriceHistory(candles);
        return last;
    }

    const candle: PriceCandle = {
        time: bucketTime,
        open: last ? last.close : priceUsd,
        high: Math.max(last ? last.close : priceUsd, priceUsd),
        low: Math.min(last ? last.close : priceUsd, priceUsd),
        close: priceUsd,
        volumeYard,
        reason
    };

    candles.push(candle);
    savePriceHistory(candles.slice(-60000));
    return candle;
};

// User functions
export const getUserByEmail = (email: string): User | null => {
    const filePath = path.join(usersDir, `${email}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as User;
};

export const getUserById = (id: string): User | null => {
    const files = fs.readdirSync(usersDir);
    for (const file of files) {
        if (file.endsWith('.json')) {
            const user = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf-8')) as User;
            if (user.id === id) return user;
        }
    }
    return null;
};

export const getUserByWallet = (walletAddress: string): User | null => {
    const files = fs.readdirSync(usersDir);
    for (const file of files) {
        if (file.endsWith('.json')) {
            const user = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf-8')) as User;
            if (user.walletAddress === walletAddress) return user;
        }
    }
    return null;
};

export const saveUser = (user: User): void => {
    const filePath = path.join(usersDir, `${user.email}.json`);
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), 'utf-8');
};
