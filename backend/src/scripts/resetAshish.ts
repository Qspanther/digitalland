import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.join(process.cwd(), 'src', 'data', 'users');
const ashishPath = path.join(dataDir, 'ashish@land.com.json');
const degitalPath = path.join(dataDir, 'degital@gmail.com.json');

const TARGET_BALANCE = 10000;

if (fs.existsSync(ashishPath) && fs.existsSync(degitalPath)) {
    const ashish = JSON.parse(fs.readFileSync(ashishPath, 'utf-8'));
    const degital = JSON.parse(fs.readFileSync(degitalPath, 'utf-8'));

    const excess = ashish.balanceYard - TARGET_BALANCE;
    if (excess > 0) {
        degital.balanceYard += excess;
        ashish.balanceYard = TARGET_BALANCE;
    }

    // Reset Ashish's transactions and balances to just show the 10,000 buys
    ashish.transactions = [];
    ashish.balances = { USD: 0, INR: 0 }; 

    // Target INR 0.0014 to 0.005
    // Target USD ~ 0.00001686 to 0.00006024
    
    // Generate 10 transactions of 1000 yards each over the year 2017/2018
    const startYearMs = new Date('2017-01-01').getTime();
    const endYearMs = new Date('2018-01-01').getTime();

    for (let i = 0; i < 10; i++) {
        const fakePriceUsd = 0.00001686 + (Math.random() * (0.00006024 - 0.00001686));
        const fakeTime = new Date(startYearMs + Math.random() * (endYearMs - startYearMs)).toISOString();

        ashish.transactions.push({
            id: crypto.randomUUID(),
            type: 'BUY_PLATFORM',
            amountYard: 1000,
            priceUsd: fakePriceUsd,
            timestamp: fakeTime,
            senderId: null,
            receiverId: ashish.id
        });
    }

    // Sort transactions by time
    ashish.transactions.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    fs.writeFileSync(ashishPath, JSON.stringify(ashish, null, 2));
    fs.writeFileSync(degitalPath, JSON.stringify(degital, null, 2));

    console.log("Successfully reset Ashish's account to 10,000 Yards and transferred excess to Degital.");
    console.log("Injected 10 historical buy transactions.");
} else {
    console.log("Users not found.");
}
