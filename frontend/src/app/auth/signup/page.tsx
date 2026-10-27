"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mnemonic, setMnemonic] = useState('');
    const { refreshUser } = useAuth();
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await fetchApi('/auth/signup', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            sessionStorage.setItem('token', data.token);
            setMnemonic(data.mnemonic);
            await refreshUser();
            // Don't redirect yet, let them copy the mnemonic
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (mnemonic) {
        return (
            <main className="flex flex-col items-center justify-center min-h-screen p-4">
                <div className="bg-gray-900 border border-green-500/50 p-8 rounded-2xl max-w-lg w-full text-center">
                    <h2 className="text-3xl font-bold text-green-400 mb-4">Account Created!</h2>
                    <div className="bg-yellow-900/30 border border-yellow-500/50 p-4 rounded-lg mb-6">
                        <h3 className="text-yellow-400 font-bold mb-2">CRITICAL: Save your Recovery Phrase</h3>
                        <p className="text-gray-300 text-sm mb-4">
                            Write down these 12 words in order. This is the ONLY way to recover your account if you forget your password. We do not store this phrase!
                        </p>
                        <div className="bg-black p-4 rounded-lg font-mono text-green-300 tracking-wider">
                            {mnemonic}
                        </div>
                    </div>
                    <button 
                        onClick={() => router.push('/')}
                        className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition"
                    >
                        I have saved it securely
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
                <h2 className="text-3xl font-bold text-white mb-6 text-center">Create Wallet</h2>
                {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4">{error}</div>}
                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-gray-400 mb-1">Email</label>
                        <input 
                            type="email" 
                            required
                            className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-green-500"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-green-500"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button 
                        disabled={loading}
                        className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-black font-bold rounded-lg transition mt-4"
                    >
                        {loading ? 'Creating...' : 'Sign Up'}
                    </button>
                </form>
                <div className="mt-4 text-center text-gray-400 text-sm">
                    Already have a wallet? <Link href="/auth/login" className="text-green-400 hover:underline">Login here</Link>
                </div>
            </div>
        </main>
    );
}
