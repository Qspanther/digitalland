"use client";

import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Gift() {
    const { user, loading, refreshUser } = useAuth();
    const router = useRouter();
    const [receiverAddress, setReceiverAddress] = useState('');
    const [amount, setAmount] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        }
    }, [user, loading, router]);

    if (loading) return <div className="min-h-screen bg-black text-white p-8">Loading...</div>;

    if (!user) {
        return null; // Redirecting
    }

    const handleGift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0 || !receiverAddress) return alert('Invalid inputs');
        if (receiverAddress === user.walletAddress) return alert('Cannot gift to yourself');

        setIsSubmitting(true);
        try {
            await fetchApi('/trade/gift', {
                method: 'POST',
                body: JSON.stringify({ receiverAddress, amountYard: Number(amount) })
            });
            alert('Gift request sent successfully! The receiver must accept it.');
            await refreshUser();
            router.push('/dashboard');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-green-500/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <h2 className="text-3xl font-bold text-white mb-2">Gift Yards</h2>
                <p className="text-gray-400 text-sm mb-8">Send land to another wallet. They will receive a notification to Accept or Decline.</p>
                
                <div className="mb-8 p-4 bg-black rounded-lg border border-gray-800 flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Your Available Yard</span>
                    <span className="font-mono text-xl text-green-400">{user.balanceYard}</span>
                </div>

                <form onSubmit={handleGift} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Recipient Wallet Address</label>
                        <input 
                            type="text" 
                            required
                            placeholder="1Yard..."
                            className="w-full bg-black border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-green-500 font-mono"
                            value={receiverAddress}
                            onChange={e => setReceiverAddress(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Amount to Send (Yard)</label>
                        <input 
                            type="number" 
                            min="1"
                            max={user.balanceYard}
                            required
                            className="w-full bg-black border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-green-500 font-mono text-2xl"
                            value={amount}
                            onChange={e => setAmount(Number(e.target.value))}
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={isSubmitting || user.balanceYard < amount}
                        className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 text-black font-bold rounded-lg transition text-lg mt-4 shadow-[0_0_15px_rgba(0,255,136,0.2)]"
                    >
                        {isSubmitting ? 'Sending Request...' : 'Send Gift Request'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/dashboard" className="text-gray-500 hover:text-white transition text-sm">
                        Cancel & Return to Dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
}
