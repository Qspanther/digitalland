import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateMnemonic, mnemonicToSeedSync } from 'bip39';
import { getUserByEmail, saveUser, User } from '../db';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_digital_yard_jwt_key_2026';

const generateWalletAddress = () => {
    return '1Yard' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

router.post('/signup', async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const existing = getUserByEmail(email);
        if (existing) return res.status(400).json({ error: 'User already exists' });

        const passwordHash = await bcrypt.hash(password, 10);
        const mnemonic = generateMnemonic(128);
        const mnemonicHash = await bcrypt.hash(mnemonic, 10);
        const walletAddress = generateWalletAddress();

        const newUser: User = {
            id: crypto.randomUUID(),
            email,
            passwordHash,
            mnemonicHash,
            walletAddress,
            balanceYard: 0,
            balances: { USD: 0, INR: 0, EUR: 0, Dinar: 0 },
            bankAccounts: [],
            createdAt: new Date().toISOString(),
            transactions: [],
            pendingGifts: []
        };

        saveUser(newUser);

        const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'User created successfully',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                walletAddress: newUser.walletAddress,
                balanceYard: newUser.balanceYard,
                balances: newUser.balances,
                bankAccounts: newUser.bankAccounts
            },
            mnemonic // ONLY returned once
        });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;
    try {
        const user = getUserByEmail(email);
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                walletAddress: user.walletAddress,
                balanceYard: user.balanceYard,
                balances: user.balances,
                bankAccounts: user.bankAccounts
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/recover', async (req: Request, res: Response): Promise<any> => {
    const { email, mnemonic, newPassword } = req.body;
    try {
        const user = getUserByEmail(email);
        if (!user) return res.status(400).json({ error: 'Invalid user or seed phrase' });

        const validMnemonic = await bcrypt.compare(mnemonic, user.mnemonicHash);
        if (!validMnemonic) return res.status(400).json({ error: 'Invalid seed phrase' });

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        saveUser(user);

        res.json({ message: 'Password recovered successfully. You can now login.' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
