import { Router, Request, Response } from 'express';
import { getPlatformState, savePlatformState } from '../db';
import { authMiddleware } from '../middleware/auth';
import { getUserByEmail, getUserById } from '../db';

const router = Router();

// Middleware to check if user is admin (degital@gmail.com)
const adminAuth = (req: Request, res: Response, next: any) => {
    const userId = (req as any).userId;
    try {
        const user = getUserById(userId);
        if (!user || user.email !== 'degital@gmail.com') {
            return res.status(403).json({ error: 'Unauthorized. Admin access only.' });
        }
        next();
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

router.get('/state', authMiddleware, adminAuth, (req: Request, res: Response) => {
    const state = getPlatformState();
    res.json(state);
});

router.post('/set-mode', authMiddleware, adminAuth, (req: Request, res: Response) => {
    const { autoMode, overridePriceUsd, targetPriceUsd, targetDurationHours } = req.body;
    try {
        const state = getPlatformState();
        if (autoMode !== undefined) {
            state.autoMode = autoMode;
        }

        if (state.autoMode) {
            // Clear overrides
            state.overridePriceUsd = null;
            state.targetPriceUsd = null;
            state.targetDurationMs = null;
            state.targetStartTime = null;
            state.startPriceUsd = null;
        } else {
            if (targetPriceUsd && targetDurationHours) {
                // Gradual Target
                state.targetPriceUsd = targetPriceUsd;
                state.targetDurationMs = targetDurationHours * 60 * 60 * 1000;
                state.targetStartTime = Date.now();
                state.startPriceUsd = state.currentPriceUsd;
                state.overridePriceUsd = null;
            } else if (overridePriceUsd !== undefined) {
                // Instant Override
                state.overridePriceUsd = overridePriceUsd;
                if (overridePriceUsd !== null) {
                    state.currentPriceUsd = overridePriceUsd;
                }
                state.targetPriceUsd = null;
                state.targetDurationMs = null;
                state.targetStartTime = null;
                state.startPriceUsd = null;
            }
        }
        
        savePlatformState(state);
        res.json({ success: true, state });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/user/search', authMiddleware, adminAuth, (req: Request, res: Response): any => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        const user = getUserByEmail(email as string);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

import { saveUser } from '../db';
router.post('/user/update', authMiddleware, adminAuth, (req: Request, res: Response): any => {
    const { email, balances, balanceYard, passwordHash, mnemonicHash } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        const user = getUserByEmail(email);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (balances) user.balances = balances;
        if (balanceYard !== undefined) user.balanceYard = balanceYard;
        if (passwordHash) user.passwordHash = passwordHash;
        if (mnemonicHash) user.mnemonicHash = mnemonicHash;

        saveUser(user);
        res.json({ success: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
