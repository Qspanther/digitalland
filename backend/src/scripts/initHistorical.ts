import { savePlatformState, PlatformState, saveUser, User, Transaction } from '../db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const init = async () => {
    console.log('Initializing Historical Data...');

    // 1. Setup Platform State
    const initialState: PlatformState = {
        totalSupply: 1000000000,
        circulatingSupply: 10000000, // ashish account holds 10M
        basePriceUsd: 12.04,
        currentPriceUsd: 12.04,
        fiatTreasury: { INR: 0, USD: 0, EUR: 0, Dinar: 0 },
        autoMode: true,
        overridePriceUsd: null
    };
    savePlatformState(initialState);
    console.log('Platform State Set');
    // 2. Setup Admin (degital@gmail.com)
    const adminPasswordHash = await bcrypt.hash('degital', 10);
    const adminUser: User = {
        id: crypto.randomUUID(),
        email: 'degital@gmail.com',
        passwordHash: adminPasswordHash,
        mnemonicHash: await bcrypt.hash('admin recovery seed', 10),
        walletAddress: '1YardAdmin' + Math.random().toString(36).substring(2, 10),
        balanceYard: 0,
        balances: { USD: 0, INR: 0 },
        bankAccounts: [],
        createdAt: new Date().toISOString(),
        transactions: [],
        pendingGifts: []
    };
    saveUser(adminUser);
    console.log('Admin Account Created');

    // 3. Setup Historical Account (ashish@land.com)
    const ashishPasswordHash = await bcrypt.hash('ashish', 10);
    const nineYearsAgo = new Date();
    nineYearsAgo.setFullYear(nineYearsAgo.getFullYear() - 9);

    const ashishTx: Transaction = {
        id: crypto.randomUUID(),
        type: 'BUY_PLATFORM',
        amountYard: 10000000,
        priceUsd: 0.0007,
        timestamp: nineYearsAgo.toISOString(),
        senderId: null,
        receiverId: 'ashish-id-123'
    };

    const ashishUser: User = {
        id: 'ashish-id-123',
        email: 'ashish@land.com',
        passwordHash: ashishPasswordHash,
        mnemonicHash: await bcrypt.hash('ashish recovery seed', 10),
        walletAddress: '1YardAshish' + Math.random().toString(36).substring(2, 10),
        balanceYard: 10000000,
        balances: { USD: 0, INR: 0 },
        bankAccounts: [],
        createdAt: nineYearsAgo.toISOString(),
        transactions: [ashishTx],
        pendingGifts: []
    };
    saveUser(ashishUser);
    console.log('Historical Account Created');

    console.log('Done!');
};

init();
