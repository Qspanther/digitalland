"use client";

import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import dynamic from 'next/dynamic';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const CURRENCIES: Record<string, { rate: number, symbol: string }> = {
    USD: { rate: 1, symbol: '$' },
    INR: { rate: 83, symbol: '₹' },
    EUR: { rate: 0.92, symbol: '€' },
    Dinar: { rate: 0.31, symbol: 'د.ك' }
};

export default function Market() {
    const { user, refreshUser } = useAuth();
    const [platformState, setPlatformState] = useState<any>(null);
    const [amount, setAmount] = useState<number>(1);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);
    const [showPopup, setShowPopup] = useState(false);
    const [approvalData, setApprovalData] = useState<any>(null);
    
    const [timeframe, setTimeframe] = useState('1D');
    const [currency, setCurrency] = useState('USD');
    const chartType = 'line';

    const curr = CURRENCIES[currency] || CURRENCIES['USD'];
    const currentPriceInCurrency = platformState ? platformState.currentPriceUsd * curr.rate : 0;

    // Initial Fetch
    useEffect(() => {
        fetchApi('/trade/info').then(data => {
            setPlatformState(data);
        }).catch(console.error);
    }, []);

    // Socket Connection for live price updates
    useEffect(() => {
        const socket = io('http://127.0.0.1:5000');
        socket.on('price_update', (data) => {
            setPlatformState(data);
            
            // Live update the chart's last candle/point
            const livePriceConverted = data.currentPriceUsd * CURRENCIES[currency].rate;
            const now = new Date().getTime();
            const candleTime = Math.floor(now / 60000) * 60000;

            setChartData((prev) => {
                if (!prev || prev.length === 0 || !prev[0].data || prev[0].data.length === 0) return prev;
                const series = [...prev];
                const dataPoints = [...series[0].data];
                const lastPoint = dataPoints[dataPoints.length - 1];

                if (chartType === 'candlestick') {
                    if (lastPoint.x < candleTime) {
                        dataPoints.push({
                            x: candleTime,
                            y: [livePriceConverted, livePriceConverted, livePriceConverted, livePriceConverted]
                        });
                    } else {
                        const yArr = Array.isArray(lastPoint.y) ? lastPoint.y : [lastPoint.y, lastPoint.y, lastPoint.y, lastPoint.y];
                        const newHigh = Math.max(yArr[1], livePriceConverted);
                        const newLow = Math.min(yArr[2], livePriceConverted);
                        dataPoints[dataPoints.length - 1] = {
                            x: lastPoint.x,
                            y: [yArr[0], newHigh, newLow, livePriceConverted]
                        };
                    }
                } else {
                    if (lastPoint.x < candleTime) {
                        dataPoints.push({ x: candleTime, y: livePriceConverted });
                    } else {
                        dataPoints[dataPoints.length - 1] = {
                            x: lastPoint.x,
                            y: livePriceConverted
                        };
                    }
                }

                // Keep up to 500 points for performance
                series[0].data = dataPoints.slice(-500);
                return series;
            });
        });

        return () => { socket.disconnect(); };
    }, [currency, chartType]);

    // Fetch historical data on timeframe or currency or type change
    useEffect(() => {
        fetchApi(`/trade/chart?timeframe=${timeframe}`).then(data => {
            const converted = data.map((d: any) => {
                if (chartType === 'candlestick') {
                    return {
                        x: d.x,
                        y: d.y.map((price: number) => price * curr.rate)
                    };
                } else {
                    return {
                        x: d.x,
                        y: d.y[3] * curr.rate // Just use the Close price for the Line chart
                    };
                }
            });
            setChartData([{ name: 'Price', data: converted }]);
        });
    }, [timeframe, currency, chartType]);

    const handleTrade = async (type: 'buy' | 'sell') => {
        if (!user) return alert('Please login to trade');
        if (amount <= 0) return alert('Amount must be positive');

        setLoading(true);
        try {
            const endpoint = type === 'buy' ? '/trade/buy-platform' : '/trade/sell-platform';
            const res = await fetchApi(endpoint, {
                method: 'POST',
                body: JSON.stringify({ amountYard: Number(amount), currency })
            });
            
            if (res.requiresApproval) {
                setApprovalData(res);
                setShowPopup(true);
                setLoading(false);
                return;
            }

            alert(`${type === 'buy' ? 'Bought' : 'Sold'} successfully!`);
            await refreshUser();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmTrade = async () => {
        setLoading(true);
        setShowPopup(false);
        try {
            const res = await fetchApi('/trade/sell-platform', {
                method: 'POST',
                body: JSON.stringify({ amountYard: Number(amount), confirm: true, currency })
            });
            alert(`Trade confirmed! ${res.earned > 0 ? `Earned ${curr.symbol}${res.earned.toFixed(2)}. ` : ''}${res.queued > 0 ? `${res.queued} Yards queued for sender approval.` : ''}`);
            await refreshUser();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!platformState) return <div className="min-h-screen bg-black text-white p-8">Loading Market Data...</div>;

    const totalCost = (amount * currentPriceInCurrency).toFixed(2);

    const chartOptions: any = {
        chart: {
            type: chartType,
            background: 'transparent',
            toolbar: {
                show: true,
                tools: {
                    download: false,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            animations: {
                enabled: true,
                easing: 'linear',
                speed: 1000,
                dynamicAnimation: { enabled: true, speed: 1000 }
            },
        },
        theme: { mode: 'dark' },
        xaxis: {
            type: 'datetime',
            crosshairs: { show: true },
            labels: { style: { colors: '#9ca3af' } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            crosshairs: { show: true },
            tooltip: { enabled: true },
            labels: { 
                style: { colors: '#9ca3af' },
                formatter: (val: number) => `${curr.symbol}${val.toFixed(2)}`
            }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            intersect: false,
            shared: true,
            x: { format: 'dd MMM yyyy HH:mm:ss' },
            y: {
                formatter: (val: number) => `${curr.symbol}${val.toFixed(4)}`
            }
        },
        grid: { borderColor: '#374151', strokeDashArray: 3 },
        plotOptions: {
            candlestick: {
                colors: { upward: '#00ff88', downward: '#ff4444' }
            }
        },
        stroke: {
            curve: 'smooth',
            width: chartType === 'line' ? 2 : 1,
            colors: chartType === 'line' ? ['#00ff88'] : undefined
        },
        annotations: {
            yaxis: [
                {
                    y: currentPriceInCurrency,
                    borderColor: '#00ff88',
                    label: {
                        borderColor: '#00ff88',
                        style: {
                            color: '#000',
                            background: '#00ff88',
                            fontSize: '12px',
                            fontWeight: 'bold',
                        },
                        text: `Live: ${curr.symbol}${currentPriceInCurrency.toFixed(2)}`,
                        position: 'right',
                        offsetX: 0,
                    }
                }
            ]
        }
    };

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8">
            {/* Approval Popup Modal */}
            {showPopup && approvalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4 text-yellow-400">Approval Required</h2>
                        <p className="text-gray-300 mb-6 leading-relaxed">
                            You have purchased <strong className="text-white">{approvalData.freeYards} yards</strong> yourself, which you can sell freely. To sell the remaining <strong className="text-white">{amount - approvalData.freeYards} yards</strong>, you need approval from the user who gifted them to you.
                        </p>
                        
                        <div className="bg-black/50 p-4 rounded-lg mb-6 border border-gray-800">
                            <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Approvals Needed From:</h4>
                            <ul className="space-y-3">
                                {approvalData.requiredApprovals.map((req: any, idx: number) => (
                                    <li key={idx} className="flex justify-between items-center text-sm border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                                        <span className="text-gray-400 truncate pr-4">{req.senderEmail}</span>
                                        <span className="font-mono font-bold text-yellow-500">{req.amountYard} Yards</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="text-sm text-gray-400 mb-8">What would you like to do?<br/>(Your free yards will be sold immediately, and an approval request will be sent for the remaining yards.)</p>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setShowPopup(false)}
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmTrade}
                                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl transition"
                            >
                                Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Col: Chart & Stats */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-2xl font-bold">Yard / {currency}</h1>
                                <p className="text-gray-400 text-sm">Digital Land Protocol</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex gap-2">
                                    {Object.keys(CURRENCIES).map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setCurrency(c)}
                                            className={`px-3 py-1 text-xs rounded-full border ${currency === c ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-3xl font-mono text-green-400">{curr.symbol}{currentPriceInCurrency.toFixed(2)}</div>
                                <p className="text-xs text-gray-500 mt-1">Live USD-based Pricing</p>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
                            {/* Timeframe Selector */}
                            <div className="flex gap-2">
                                {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map(tf => (
                                    <button 
                                        key={tf}
                                        onClick={() => setTimeframe(tf)}
                                        className={`px-4 py-1.5 text-sm rounded transition ${timeframe === tf ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'}`}
                                    >
                                        {tf.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-[400px] w-full text-black">
                            {chartData.length > 0 && (
                                <ReactApexChart 
                                    options={chartOptions} 
                                    series={chartData} 
                                    type={chartType} 
                                    height="100%" 
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                            <div className="text-gray-500 text-sm uppercase tracking-wider mb-2">Total Supply</div>
                            <div className="text-2xl font-mono">{platformState.totalSupply.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                            <div className="text-gray-500 text-sm uppercase tracking-wider mb-2">Remaining in Treasury</div>
                            <div className="text-2xl font-mono">{(platformState.totalSupply - platformState.circulatingSupply).toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* Right Col: Trade Panel */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col h-fit">
                    <h2 className="text-xl font-bold mb-6">Trade from Treasury</h2>

                    {user ? (
                        <div className="mb-6 p-4 bg-black rounded-lg border border-gray-800">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-500">Available {currency} Balance</span>
                                <span className="font-mono">{curr.symbol}{(user.balances?.[currency] || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Available Yard</span>
                                <span className="font-mono">{user.balanceYard} Yard</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 p-4 bg-red-900/20 text-red-400 rounded border border-red-900/50 text-sm text-center">
                            Please login to trade.
                        </div>
                    )}

                    <div className="space-y-4 flex-1">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Amount (Yard)</label>
                            <input 
                                type="number" 
                                min="1"
                                className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-green-500 font-mono text-xl"
                                value={amount}
                                onChange={e => setAmount(Number(e.target.value))}
                            />
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Total Cost/Earned</span>
                            <span className="font-mono text-xl">{curr.symbol}{totalCost}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <button 
                            onClick={() => handleTrade('buy')}
                            disabled={loading || !user}
                            className="py-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 text-black font-bold rounded-lg transition"
                        >
                            Buy Yard
                        </button>
                        <button 
                            onClick={() => handleTrade('sell')}
                            disabled={loading || !user}
                            className="py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white font-bold rounded-lg transition"
                        >
                            Sell Yard
                        </button>
                    </div>
                </div>

            </div>
        </main>
    );
}
