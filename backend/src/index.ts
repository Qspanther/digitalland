import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallet';
import tradeRoutes from './routes/trade';
import adminRoutes from './routes/admin';
import { updatePlatformPrice } from './pricing';

dotenv.config();

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST']
    }
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io for Real-time Price and Orderbook Updates
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Broadcast price updates every second so the active candle keeps moving smoothly.
setInterval(async () => {
    try {
        const state = await updatePlatformPrice();
        io.emit('price_update', state);
    } catch (err) {
        console.error('Error updating price:', err);
    }
}, 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Initialize Platform State
    try {
        await updatePlatformPrice();
        console.log('Platform state initialized');
    } catch (err) {
        console.error('Error initializing platform state:', err);
    }
});
