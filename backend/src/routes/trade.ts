import { Router, Request, Response } from 'express';
import { getPlatformState, savePlatformState, saveUser, getUserById, getUserByWallet, Transaction, PendingGift, PendingSellApproval, getPriceHistory, PriceCandle, recordPriceCandle } from '../db';
import { authMiddleware } from '../middleware/auth';
import { updatePlatformPrice, calculateCurrentPrice } from '../pricing';
import crypto from 'crypto';

export const EXCHANGE_RATES: Record<string, number> = {
    USD: 1,
    INR: 83,
    EUR: 0.92,
    Dinar: 0.31
};

const router = Router();

router.get('/info', async (req: Request, res: Response): Promise<any> => {
    try {
        const state = await updatePlatformPrice();
        res.json(state);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const chartWindows: Record<string, { intervalMs: number; lookbackMs: number; limit: number }> = {
    '1m': { intervalMs: 60 * 1000, lookbackMs: 2 * 60 * 60 * 1000, limit: 120 },
    '5m': { intervalMs: 5 * 60 * 1000, lookbackMs: 12 * 60 * 60 * 1000, limit: 144 },
    '1h': { intervalMs: 60 * 60 * 1000, lookbackMs: 7 * 24 * 60 * 60 * 1000, limit: 168 },
    '1d': { intervalMs: 24 * 60 * 60 * 1000, lookbackMs: 365 * 24 * 60 * 60 * 1000, limit: 365 },
    'ALL': { intervalMs: 7 * 24 * 60 * 60 * 1000, lookbackMs: 11 * 365 * 24 * 60 * 60 * 1000, limit: 600 }
};

const aggregateCandles = (candles: PriceCandle[], intervalMs: number): PriceCandle[] => {
    const buckets = new Map<number, PriceCandle>();

    for (const candle of candles) {
        const bucketTime = Math.floor(candle.time / intervalMs) * intervalMs;
        const existing = buckets.get(bucketTime);

        if (!existing) {
            buckets.set(bucketTime, { ...candle, time: bucketTime });
        } else {
            existing.high = Math.max(existing.high, candle.high);
            existing.low = Math.min(existing.low, candle.low);
            existing.close = candle.close;
            existing.volumeYard += candle.volumeYard;
            existing.reason = candle.reason;
        }
    }

    return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
};

import fs from 'fs';
import path from 'path';

router.get('/chart', (req: Request, res: Response): any => {
    const timeframe = String(req.query.timeframe || '1D').toUpperCase();
    
    let filePath = '';
    let sliceLength = 0;

    switch (timeframe) {
        case '1D':
            filePath = path.join(process.cwd(), 'src', 'data', 'priceHistory.json');
            break;
        case '1W':
            filePath = path.join(process.cwd(), 'src', 'data', 'history_1D.json');
            sliceLength = 7;
            break;
        case '1M':
            filePath = path.join(process.cwd(), 'src', 'data', 'history_1D.json');
            sliceLength = 30;
            break;
        case '6M':
            filePath = path.join(process.cwd(), 'src', 'data', 'history_1D.json');
            sliceLength = 182;
            break;
        case '1Y':
            filePath = path.join(process.cwd(), 'src', 'data', 'history_1D.json');
            sliceLength = 365;
            break;
        case 'ALL':
        default:
            filePath = path.join(process.cwd(), 'src', 'data', 'history_1W.json');
            break;
    }
    
    try {
        if (!fs.existsSync(filePath)) {
            return res.json([]);
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const slicedData = sliceLength > 0 ? data.slice(-sliceLength) : data;
        
        res.json(slicedData.map((candle: any) => ({
            x: candle.time,
            y: [candle.open, candle.high, candle.low, candle.close],
            volumeYard: candle.volumeYard || 0,
            reason: candle.reason || ''
        })));
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to load chart data' });
    }
});

router.post('/buy-platform', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { amountYard, currency = 'USD' } = req.body;

    if (!amountYard || amountYard <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!EXCHANGE_RATES[currency]) return res.status(400).json({ error: 'Invalid currency' });

    try {
        const user = getUserById(userId);
        if (!user) throw new Error('User not found');

        const state = getPlatformState();
        if (state.circulatingSupply + amountYard > state.totalSupply) {
            throw new Error('Not enough supply in treasury');
        }

        const currentPriceUsd = state.currentPriceUsd;
        const totalCostUsd = currentPriceUsd * amountYard;
        const totalCostCurrency = totalCostUsd * EXCHANGE_RATES[currency];

        if (!user.balances[currency] || user.balances[currency] < totalCostCurrency) {
            throw new Error(`Insufficient ${currency} balance`);
        }

        user.balances[currency] -= totalCostCurrency;
        user.balanceYard += amountYard;

        const newTx: Transaction = {
            id: crypto.randomUUID(),
            type: 'BUY_PLATFORM',
            amountYard,
            priceUsd: currentPriceUsd, // Now correctly priceUsd
            timestamp: new Date().toISOString(),
            senderId: null,
            receiverId: user.id
        };
        user.transactions.push(newTx);
        saveUser(user);

        state.circulatingSupply += amountYard;
        state.currentPriceUsd = calculateCurrentPrice(state.totalSupply, state.circulatingSupply, state.basePriceUsd);
        recordPriceCandle(state.currentPriceUsd, amountYard, 'User bought Yard from treasury.');
        savePlatformState(state);

        res.json({ success: true, newPrice: state.currentPriceUsd, cost: totalCostCurrency });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/sell-platform', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { amountYard, confirm, currency = 'USD' } = req.body;

    if (!amountYard || amountYard <= 0) return res.status(400).json({ error: 'Invalid amount' });

    try {
        const user = getUserById(userId);
        if (!user || user.balanceYard < amountYard) throw new Error('Insufficient Yard balance');

        let giftedTotal = 0;
        if (user.giftedBalances) {
            giftedTotal = user.giftedBalances.reduce((sum, g) => sum + g.amountYard, 0);
        }
        const freeYards = Math.max(0, user.balanceYard - giftedTotal);

        if (amountYard > freeYards && !confirm) {
            let needed = amountYard - freeYards;
            const requiredApprovals = [];
            for (const gb of user.giftedBalances || []) {
                if (needed <= 0) break;
                const take = Math.min(needed, gb.amountYard);
                if (take > 0) {
                    requiredApprovals.push({ senderEmail: gb.senderEmail, amountYard: take });
                    needed -= take;
                }
            }
            return res.json({ requiresApproval: true, freeYards, requiredApprovals });
        }

        const state = getPlatformState();
        const currentPriceUsd = state.currentPriceUsd;
        const instantSellAmount = Math.min(amountYard, freeYards);
        
        let totalEarnedCurrency = 0;
        if (instantSellAmount > 0) {
            const totalEarnedUsd = currentPriceUsd * instantSellAmount;
            totalEarnedCurrency = totalEarnedUsd * (EXCHANGE_RATES[currency] || 1);
            
            user.balanceYard -= instantSellAmount;
            if (!user.balances[currency]) user.balances[currency] = 0;
            user.balances[currency] += totalEarnedCurrency;

            const newTx: Transaction = {
                id: crypto.randomUUID(),
                type: 'SELL_PLATFORM',
                amountYard: instantSellAmount,
                priceUsd: currentPriceUsd,
                timestamp: new Date().toISOString(),
                senderId: user.id,
                receiverId: null
            };
            user.transactions.push(newTx);
            state.circulatingSupply -= instantSellAmount;
        }

        let needed = amountYard - instantSellAmount;
        if (needed > 0) {
            for (const gb of user.giftedBalances || []) {
                if (needed <= 0) break;
                const take = Math.min(needed, gb.amountYard);
                if (take > 0) {
                    const approvalId = crypto.randomUUID();
                    const approval: PendingSellApproval = {
                        id: approvalId,
                        sellerId: user.id,
                        sellerEmail: user.email,
                        approverId: gb.senderId,
                        amountYard: take,
                        timestamp: new Date().toISOString()
                    };
                    if (!user.pendingSellApprovalsAsSeller) user.pendingSellApprovalsAsSeller = [];
                    user.pendingSellApprovalsAsSeller.push(approval);

                    const approver = getUserById(gb.senderId);
                    if (approver) {
                        if (!approver.pendingSellApprovalsAsApprover) approver.pendingSellApprovalsAsApprover = [];
                        approver.pendingSellApprovalsAsApprover.push(approval);
                        saveUser(approver);
                    }
                    needed -= take;
                }
            }
        }

        saveUser(user);
        if (instantSellAmount > 0) {
            state.currentPriceUsd = calculateCurrentPrice(state.totalSupply, state.circulatingSupply, state.basePriceUsd);
            recordPriceCandle(state.currentPriceUsd, instantSellAmount, 'User sold Yard back to treasury.');
            savePlatformState(state);
        }

        res.json({ success: true, newPrice: state.currentPriceUsd, earned: totalEarnedCurrency, queued: amountYard - instantSellAmount });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Create a pending gift request
router.post('/gift', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { receiverAddress, amountYard } = req.body;

    if (!amountYard || amountYard <= 0 || !receiverAddress) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        const sender = getUserById(userId);
        if (!sender || sender.balanceYard < amountYard) throw new Error('Insufficient Yard balance');

        const receiver = getUserByWallet(receiverAddress);
        if (!receiver) throw new Error('Receiver wallet not found');
        
        if (sender.id === receiver.id) throw new Error('Cannot gift to yourself');

        // Deduct from sender immediately (Escrow)
        sender.balanceYard -= amountYard;
        
        // Add pending gift to receiver
        const giftId = crypto.randomUUID();
        const pendingGift: PendingGift = {
            id: giftId,
            senderId: sender.id,
            senderEmail: sender.email,
            amountYard,
            timestamp: new Date().toISOString()
        };
        
        if (!receiver.pendingGifts) receiver.pendingGifts = [];
        receiver.pendingGifts.push(pendingGift);

        const state = getPlatformState();
        // Add pending transaction to sender
        sender.transactions.push({
            id: giftId,
            type: 'GIFT_SENT',
            amountYard,
            priceUsd: state.currentPriceUsd,
            timestamp: pendingGift.timestamp,
            senderId: sender.id,
            receiverId: receiver.id,
            status: 'PENDING'
        } as any);

        // Add pending transaction to receiver
        receiver.transactions.push({
            id: giftId,
            type: 'GIFT_RECEIVED',
            amountYard,
            priceUsd: state.currentPriceUsd,
            timestamp: pendingGift.timestamp,
            senderId: sender.id,
            receiverId: receiver.id,
            status: 'PENDING'
        } as any);

        saveUser(sender);
        saveUser(receiver);

        res.json({ success: true, message: 'Gift request sent! Waiting for receiver to accept.' });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Respond to a pending gift
router.post('/gift/respond', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).userId;
    const { giftId, action } = req.body; // action: 'accept' | 'decline'

    try {
        const receiver = getUserById(userId);
        if (!receiver) throw new Error('User not found');

        const giftIndex = receiver.pendingGifts.findIndex(g => g.id === giftId);
        if (giftIndex === -1) throw new Error('Gift request not found');

        const gift = receiver.pendingGifts[giftIndex];
        const sender = getUserById(gift.senderId);

        // Remove from pending
        receiver.pendingGifts.splice(giftIndex, 1);

        if (action === 'accept') {
            receiver.balanceYard += gift.amountYard;
            
            if (!receiver.giftedBalances) receiver.giftedBalances = [];
            const existing = receiver.giftedBalances.find(g => g.senderId === gift.senderId);
            if (existing) {
                existing.amountYard += gift.amountYard;
            } else {
                receiver.giftedBalances.push({
                    senderId: gift.senderId,
                    senderEmail: sender ? sender.email : 'Unknown',
                    amountYard: gift.amountYard
                });
            }

            // Update existing receiver transaction
            const recvTx = receiver.transactions.find(t => t.id === gift.id);
            if (recvTx) (recvTx as any).status = 'COMPLETED';
            
            if (sender) {
                // Update existing sender transaction
                const sendTx = sender.transactions.find(t => t.id === gift.id);
                if (sendTx) (sendTx as any).status = 'COMPLETED';
                saveUser(sender);
            }
            saveUser(receiver);
            res.json({ success: true, message: 'Gift accepted successfully' });

        } else if (action === 'decline') {
            // Refund to sender
            if (sender) {
                sender.balanceYard += gift.amountYard;
                const sendTx = sender.transactions.find(t => t.id === gift.id);
                if (sendTx) (sendTx as any).status = 'DECLINED';
                saveUser(sender);
            }
            const recvTx = receiver.transactions.find(t => t.id === gift.id);
            if (recvTx) (recvTx as any).status = 'DECLINED';
            saveUser(receiver);
            res.json({ success: true, message: 'Gift declined and refunded to sender' });
        } else {
            throw new Error('Invalid action');
        }

    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Respond to a pending sell approval
router.post('/sell-gifted/respond', authMiddleware, async (req: Request, res: Response): Promise<any> => {
    const approverId = (req as any).userId;
    const { approvalId, action } = req.body; // action: 'accept' | 'decline'

    try {
        const approver = getUserById(approverId);
        if (!approver) throw new Error('User not found');

        if (!approver.pendingSellApprovalsAsApprover) approver.pendingSellApprovalsAsApprover = [];
        const index = approver.pendingSellApprovalsAsApprover.findIndex(a => a.id === approvalId);
        if (index === -1) throw new Error('Approval request not found');

        const approval = approver.pendingSellApprovalsAsApprover[index];
        const seller = getUserById(approval.sellerId);

        // Remove from approver
        approver.pendingSellApprovalsAsApprover.splice(index, 1);
        saveUser(approver);

        if (seller) {
            // Remove from seller
            if (seller.pendingSellApprovalsAsSeller) {
                seller.pendingSellApprovalsAsSeller = seller.pendingSellApprovalsAsSeller.filter(a => a.id !== approvalId);
            }

            if (action === 'accept') {
                // Check if seller still has the gifted yards
                const giftedIndex = seller.giftedBalances?.findIndex(g => g.senderId === approverId) ?? -1;
                if (giftedIndex !== -1 && seller.giftedBalances![giftedIndex].amountYard >= approval.amountYard && seller.balanceYard >= approval.amountYard) {
                    
                    seller.giftedBalances![giftedIndex].amountYard -= approval.amountYard;
                    if (seller.giftedBalances![giftedIndex].amountYard === 0) {
                        seller.giftedBalances!.splice(giftedIndex, 1);
                    }

                    const state = getPlatformState();
                    const currentPriceUsd = state.currentPriceUsd;
                    const totalEarnedUsd = currentPriceUsd * approval.amountYard;

                    seller.balanceYard -= approval.amountYard;
                    if (!seller.balances['USD']) seller.balances['USD'] = 0;
                    seller.balances['USD'] += totalEarnedUsd;

                    const newTx: Transaction = {
                        id: crypto.randomUUID(),
                        type: 'SELL_PLATFORM',
                        amountYard: approval.amountYard,
                        priceUsd: currentPriceUsd,
                        timestamp: new Date().toISOString(),
                        senderId: seller.id,
                        receiverId: null
                    };
                    seller.transactions.push(newTx);
                    
                    state.circulatingSupply -= approval.amountYard;
                    state.currentPriceUsd = calculateCurrentPrice(state.totalSupply, state.circulatingSupply, state.basePriceUsd);
                    recordPriceCandle(state.currentPriceUsd, approval.amountYard, 'Approved gifted Yard sale returned supply to treasury.');
                    savePlatformState(state);
                }
            }
            saveUser(seller);
        }

        res.json({ success: true, message: action === 'accept' ? 'Sell order approved' : 'Sell order declined' });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
