"use client";

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

export default function HistoryPage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchApi('/wallet/history').then(data => {
            if (!data.error && Array.isArray(data)) {
                // data is an array of transactions with senderEmail and receiverEmail
                setUser({ transactions: data });
            } else {
                setUser({ transactions: [] });
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const formatPrice = (priceUsd: number) => {
        // Show in INR since users are more familiar with INR, or show both
        // USD = priceUsd, INR = priceUsd * 83
        const inr = priceUsd * 83;
        if (inr < 0.01) {
            return `₹${inr.toFixed(4)}`;
        }
        return `₹${inr.toFixed(2)}`;
    };

    if (loading) return (
        <div className="flex-1 flex justify-center items-center h-full">Loading history...</div>
    );

    if (!user) return (
        <div className="flex-1 flex justify-center items-center text-red-500 h-full">Please login to view history.</div>
    );

    return (
        <main className="max-w-5xl w-full mx-auto p-4 py-8">
                <h1 className="text-3xl font-bold mb-6 text-green-400">Transaction History</h1>
                
                <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black border-b border-gray-800 text-gray-400 uppercase">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Details</th>
                                    <th className="px-6 py-4">Amount (Yard)</th>
                                    <th className="px-6 py-4">Execution Price</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {user.transactions?.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                                {user.transactions?.map((tx: any) => (
                                    <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-900 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                            {new Date(tx.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {tx.type === 'BUY_PLATFORM' && <span className="text-green-400 font-medium">Market Buy</span>}
                                            {tx.type === 'SELL_PLATFORM' && <span className="text-red-400 font-medium">Market Sell</span>}
                                            {tx.type === 'GIFT_SENT' && <span className="text-orange-400 font-medium">Gift Sent</span>}
                                            {tx.type === 'GIFT_RECEIVED' && <span className="text-blue-400 font-medium">Gift Received</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-xs">
                                            {tx.type === 'GIFT_SENT' && `To: ${tx.receiverEmail}`}
                                            {tx.type === 'GIFT_RECEIVED' && `From: ${tx.senderEmail}`}
                                            {(tx.type === 'BUY_PLATFORM' || tx.type === 'SELL_PLATFORM') && 'Treasury'}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-100">
                                            {tx.type.includes('BUY') || tx.type.includes('RECEIVED') ? '+' : '-'}{tx.amountYard.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-400">
                                            {tx.type.includes('GIFT') ? '-' : formatPrice(tx.priceUsd)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {tx.status === 'PENDING' ? (
                                                <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                    Pending
                                                </span>
                                            ) : tx.status === 'DECLINED' ? (
                                                <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                                    Declined
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                                    Completed
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
    );
}
