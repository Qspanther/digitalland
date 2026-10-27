import { Router, Request, Response } from 'express';
import { getUserById, saveUser, getPlatformState, savePlatformState, BankAccount, Transaction } from '../db';
import { authMiddleware } from '../middleware/auth';
import { EXCHANGE_RATES } from './trade';
import crypto from 'crypto';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    try {
        const user = getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({
            id: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
            balanceYard: user.balanceYard,
            balances: user.balances || { INR: 0, USD: 0, EUR: 0, Dinar: 0 },
            bankAccounts: user.bankAccounts || [],
            pendingGifts: user.pendingGifts || [],
            pendingSellApprovalsAsApprover: user.pendingSellApprovalsAsApprover || [],
            pendingSellApprovalsAsSeller: user.pendingSellApprovalsAsSeller || []
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/history', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    try {
        const user = getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const sortedTx = user.transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // Inject sender and receiver emails
        const txWithEmails = sortedTx.map(tx => {
            const sender = tx.senderId ? getUserById(tx.senderId) : null;
            const receiver = tx.receiverId ? getUserById(tx.receiverId) : null;
            return {
                ...tx,
                senderEmail: sender ? sender.email : 'Treasury',
                receiverEmail: receiver ? receiver.email : 'Treasury'
            };
        });

        res.json(txWithEmails);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Mock deposit
router.post('/deposit', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { amount, currency } = req.body;
    
    if (!amount || amount <= 0 || !EXCHANGE_RATES[currency]) return res.status(400).json({ error: 'Invalid deposit' });

    try {
        const user = getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.balances) user.balances = {};
        if (!user.balances[currency]) user.balances[currency] = 0;
        
        user.balances[currency] += amount;
        saveUser(user);

        res.json({ message: 'Deposited successfully', balances: user.balances });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Convert Currency
router.post('/convert', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { fromCurrency, toCurrency, amount } = req.body;

    if (!amount || amount <= 0 || !EXCHANGE_RATES[fromCurrency] || !EXCHANGE_RATES[toCurrency]) {
        return res.status(400).json({ error: 'Invalid conversion params' });
    }

    try {
        const user = getUserById(userId);
        if (!user || !user.balances[fromCurrency] || user.balances[fromCurrency] < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Convert to USD first
        const amountUsd = amount / EXCHANGE_RATES[fromCurrency];
        // Convert USD to target currency
        let targetAmount = amountUsd * EXCHANGE_RATES[toCurrency];
        
        // Deduct 2% fee
        const fee = targetAmount * 0.02;
        targetAmount -= fee;

        user.balances[fromCurrency] -= amount;
        if (!user.balances[toCurrency]) user.balances[toCurrency] = 0;
        user.balances[toCurrency] += targetAmount;
        saveUser(user);

        // Add fee to Treasury
        const state = getPlatformState();
        if (!state.fiatTreasury) state.fiatTreasury = {};
        if (!state.fiatTreasury[toCurrency]) state.fiatTreasury[toCurrency] = 0;
        state.fiatTreasury[toCurrency] += fee;
        savePlatformState(state);

        res.json({ message: 'Converted successfully', balances: user.balances });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Bank Accounts
router.post('/bank/add', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const accountDetails = req.body; // currency, country, accountNumber, ifscCode, routingNumber, iban, etc.

    if (!accountDetails.currency || !accountDetails.country) return res.status(400).json({ error: 'Invalid bank details' });

    try {
        const user = getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newBank: BankAccount = {
            id: crypto.randomUUID(),
            ...accountDetails,
            createdAt: new Date().toISOString()
        };

        if (!user.bankAccounts) user.bankAccounts = [];
        user.bankAccounts.push(newBank);
        saveUser(user);

        res.json({ message: 'Bank account added', bankAccounts: user.bankAccounts });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Withdraw
router.post('/withdraw', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { amount, currency, bankAccountId } = req.body;

    if (!amount || amount <= 0 || !currency || !bankAccountId) return res.status(400).json({ error: 'Invalid withdrawal params' });

    try {
        const user = getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.balances[currency] || user.balances[currency] < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        const bank = user.bankAccounts?.find(b => b.id === bankAccountId);
        if (!bank || bank.currency !== currency) {
            return res.status(400).json({ error: 'Invalid bank account for this currency' });
        }

        user.balances[currency] -= amount;
        saveUser(user);

        res.json({ message: `Successfully requested withdrawal of ${amount} ${currency} to ${bank.bankName || bank.accountNumber || bank.iban}` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
