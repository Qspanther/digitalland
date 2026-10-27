"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { refreshUser } = useAuth();
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await fetchApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            sessionStorage.setItem('token', data.token);
            await refreshUser();
            router.push('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-black relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-green-900/10 via-black to-black z-0 pointer-events-none"></div>
            
            <div className="z-10 bg-gray-900/80 border border-gray-800 p-8 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-md">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-white">Access Wallet</h2>
                    <p className="text-gray-400 mt-2 text-sm">Welcome back to DigitalYard</p>
                </div>

                {error && <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">{error}</div>}
                
                <form onSubmit={handleLogin} className="space-y-5">
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
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-gray-400 text-sm font-semibold">Password</label>
                            <Link href="/auth/recover" className="text-xs text-green-400 hover:text-green-300 hover:underline">
                                Forgot Password?
                            </Link>
                        </div>
                        <input 
                            type="password" 
                            required
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-green-500 transition-colors"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        disabled={loading}
                        className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-extrabold rounded-xl transition-all transform hover:scale-[1.02] mt-6 shadow-[0_0_15px_rgba(0,255,136,0.2)]"
                    >
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-gray-800">
                    <p className="text-gray-400 text-sm">
                        Don't have a wallet yet? <Link href="/auth/signup" className="text-white font-semibold hover:text-green-400 transition-colors">Create one</Link>
                    </p>
                </div>
            </div>
            
            <Link href="/" className="z-10 mt-8 text-gray-500 hover:text-white transition-colors text-sm">
                &larr; Back to Home
            </Link>
        </main>
    );
}
