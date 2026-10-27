"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { LogOut } from 'lucide-react';

interface ChartApiCandle {
  x: number;
  y: [number, number, number, number];
}

interface ChartPoint {
  time: number;
  price: number;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [platformState, setPlatformState] = useState<{ currentPriceUsd: number, circulatingSupply: number, totalSupply: number } | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [timeframe, setTimeframe] = useState('1d');

  const loadChartData = async (tf: string) => {
      try {
          const data = await fetchApi(`/trade/chart?timeframe=${tf}`);
          setChartData((data as ChartApiCandle[]).map((candle) => ({
            time: candle.x,
            price: candle.y[3]
          })));
      } catch (err) {
          console.error(err);
      }
  };

  useEffect(() => {
    fetchApi('/trade/info').then(setPlatformState).catch(console.error);
    loadChartData(timeframe);

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:5000';
    const socket = io(SOCKET_URL);
    socket.on('price_update', (data) => {
      setPlatformState(data);
      setChartData((prev) => {
        if (prev.length === 0) return prev;
        const candleTime = Math.floor(Date.now() / 60000) * 60000;
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.time < candleTime) {
          next.push({ time: candleTime, price: data.currentPriceUsd });
        } else {
          next[next.length - 1] = { ...last, price: data.currentPriceUsd };
        }
        return next.slice(-180);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [timeframe]);

  return (
    <main className="flex flex-col min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black z-0 pointer-events-none"></div>
      
      <div className="flex-1 flex flex-col items-center pt-16 px-4 z-10 max-w-7xl mx-auto w-full">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-center">
          Own the future of <span className="text-green-400">Digital Land.</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-12 text-center max-w-3xl">
          The world&apos;s first absolutely scarce digital land platform. Mimicking Bitcoin&apos;s mechanics, capped at exactly 10,000,000 Yards.
        </p>

        {!user ? (
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20 w-full max-w-md">
            <Link href="/auth/signup" className="flex-1 text-center py-4 bg-green-500 hover:bg-green-400 text-black font-extrabold rounded-2xl transition-all transform hover:scale-105 text-lg shadow-[0_0_30px_rgba(0,255,136,0.2)]">
              Create Wallet
            </Link>
            <Link href="/auth/login" className="flex-1 text-center py-4 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold rounded-2xl transition-all text-lg">
              Log In
            </Link>
          </div>
        ) : (
          <div className="mb-20 bg-gray-900/50 border border-gray-800 p-6 rounded-3xl backdrop-blur-md w-full max-w-md flex flex-col items-center">
            <p className="text-gray-400 mb-2">Welcome back,</p>
            <p className="text-xl font-bold text-green-400 mb-6">{user.email}</p>
            <div className="flex gap-4 w-full">
              <Link href="/dashboard" className="flex-1 text-center py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all">
                Go to Wallet
              </Link>
              <button onClick={logout} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 font-bold rounded-xl transition-all">
                <LogOut size={18} /> Log Out
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full">
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-3xl backdrop-blur-md">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Live Price (USD)</h3>
            <p className="text-4xl font-mono text-green-400 font-bold">
              ${platformState ? platformState.currentPriceUsd.toFixed(4) : '---'}
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-3xl backdrop-blur-md">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Hard Cap</h3>
            <p className="text-4xl font-mono text-white font-bold">
              {platformState ? platformState.totalSupply.toLocaleString() : '---'} Yard
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-3xl backdrop-blur-md">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Sold / Circulating</h3>
            <p className="text-4xl font-mono text-white font-bold">
              {platformState ? platformState.circulatingSupply.toLocaleString() : '---'} Yard
            </p>
          </div>
        </div>

        <div className="w-full bg-gray-900/40 border border-gray-800 p-6 md:p-10 rounded-3xl backdrop-blur-md mb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-2xl font-bold">Price Action</h2>
                <div className="flex bg-black p-1 rounded-lg border border-gray-800">
                    {['1m', '5m', '1h', '1d', 'ALL'].map(tf => (
                        <button 
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${timeframe === tf ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="h-[400px] w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <XAxis dataKey="time" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={value => new Date(Number(value)).toLocaleDateString()} />
                            <YAxis domain={['auto', 'auto']} stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={value => `$${Number(value).toFixed(2)}`} width={80} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff', borderRadius: '8px' }}
                                itemStyle={{ color: '#00ff88', fontWeight: 'bold' }}
                                labelStyle={{ color: '#888' }}
                                labelFormatter={value => new Date(Number(value)).toLocaleString()}
                                formatter={value => [`$${Number(value).toFixed(4)}`, 'Price']}
                            />
                            <Line type="monotone" dataKey="price" stroke="#00ff88" strokeWidth={3} dot={false} activeDot={{ r: 8, fill: '#00ff88', stroke: '#000', strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">Loading chart data...</div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}
