"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function Recover() {
    const [email, setEmail] = useState('');
    const [mnemonic, setMnemonic] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const data = await fetchApi('/auth/recover', {
                method: 'POST',
                body: JSON.stringify({ email, mnemonic, newPassword })
            });
            setSuccess(data.message);
            setTimeout(() => {
                router.push('/auth/login');
            }, 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-black relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black z-0 pointer-events-none"></div>
            
            <div className="z-10 bg-gray-900/80 border border-gray-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl backdrop-blur-md">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-white">Recover Wallet</h2>
                    <p className="text-gray-400 mt-2 text-sm">Enter your 12-word seed phrase to reset your password. This is the only way to regain access.</p>
                </div>

                {error && <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">{error}</div>}
                {success && <div className="bg-green-900/50 border border-green-500/50 text-green-200 p-3 rounded-lg mb-6 text-sm text-center">{success}</div>}
                
                <form onSubmit={handleRecover} className="space-y-5">
                    <div>
                        <label className="block text-gray-400 text-sm font-semibold mb-2">Email Address</label>
                        <input 
                            type="email" 
                            required
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-green-500 transition-colors"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-yellow-500/80 text-sm font-semibold mb-2">12-Word Recovery Phrase</label>
                        <textarea 
                            required
                            rows={3}
                            placeholder="word1 word2 word3..."
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-yellow-500 transition-colors font-mono text-sm resize-none"
                            value={mnemonic}
                            onChange={e => setMnemonic(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm font-semibold mb-2">New Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-green-500 transition-colors"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        disabled={loading || !!success}
                        className="w-full py-4 bg-gray-200 hover:bg-white disabled:opacity-50 text-black font-extrabold rounded-xl transition-all transform hover:scale-[1.02] mt-6 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    >
                        {loading ? 'Verifying Phrase...' : 'Reset Password'}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-gray-800">
                    <p className="text-gray-400 text-sm">
                        Remembered your password? <Link href="/auth/login" className="text-white font-semibold hover:text-green-400 transition-colors">Go to Login</Link>
                    </p>
                </div>
            </div>
            
            <Link href="/" className="z-10 mt-8 text-gray-500 hover:text-white transition-colors text-sm">
                &larr; Back to Home
            </Link>
        </main>
    );
}
