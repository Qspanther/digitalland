"use client";

import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [platformState, setPlatformState] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    
    // Market Controls State
    const [targetPrice, setTargetPrice] = useState<string>('');
    const [targetHours, setTargetHours] = useState<string>('24');
    
    // User Management State
    const [searchEmail, setSearchEmail] = useState('');
    const [searchedUser, setSearchedUser] = useState<any>(null);
    const [editingUser, setEditingUser] = useState<boolean>(false);
    
    const [editUsd, setEditUsd] = useState('');
    const [editInr, setEditInr] = useState('');
    const [editYard, setEditYard] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editMnemonic, setEditMnemonic] = useState('');

    useEffect(() => {
        if (!user || user.email !== 'degital@gmail.com') return;
        
        const loadState = () => {
            fetchApi('/admin/state').then(data => {
                setPlatformState(data);
                if (data.targetPriceUsd && !targetPrice) {
                    setTargetPrice(data.targetPriceUsd.toString());
                    setTargetHours((data.targetDurationMs / (60 * 60 * 1000)).toString());
                }
            }).catch(err => {
                console.error('Failed to load admin state', err);
            });
        };

        loadState();
        const interval = setInterval(loadState, 5000);
        return () => clearInterval(interval);
    }, [user]);

    const handleDeployGradual = async () => {
        if (!targetPrice || !targetHours) return alert("Target Price and Target Time are required.");
        setLoading(true);
        try {
            const body = {
                autoMode: false,
                targetPriceUsd: parseFloat(targetPrice),
                targetDurationHours: parseFloat(targetHours)
            };

            const res = await fetchApi('/admin/set-mode', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            
            setPlatformState(res.state);
            alert('Price Target activated successfully! Engine is tracking smoothly.');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchUser = async () => {
        if (!searchEmail) return;
        setLoading(true);
        try {
            const res = await fetchApi(`/admin/user/search?email=${encodeURIComponent(searchEmail)}`);
            setSearchedUser(res.user);
            setEditUsd(res.user.balances?.USD?.toString() || '0');
            setEditInr(res.user.balances?.INR?.toString() || '0');
            setEditYard(res.user.balanceYard?.toString() || '0');
            setEditPassword(res.user.passwordHash);
            setEditMnemonic(res.user.mnemonicHash);
            setEditingUser(false);
        } catch (err: any) {
            alert(err.message);
            setSearchedUser(null);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async () => {
        setLoading(true);
        try {
            const res = await fetchApi('/admin/user/update', {
                method: 'POST',
                body: JSON.stringify({
                    email: searchedUser.email,
                    balances: {
                        ...searchedUser.balances,
                        USD: parseFloat(editUsd),
                        INR: parseFloat(editInr)
                    },
                    balanceYard: parseFloat(editYard),
                    passwordHash: editPassword,
                    mnemonicHash: editMnemonic
                })
            });
            setSearchedUser(res.user);
            setEditingUser(false);
            alert('User updated successfully!');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div className="min-h-screen bg-black text-white p-8">Please login.</div>;
    if (user.email !== 'degital@gmail.com') return <div className="min-h-screen bg-black text-white p-8 text-red-500 font-bold">UNAUTHORIZED: ADMIN ACCESS ONLY</div>;
    if (!platformState) return <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">Loading Secure Panel...</div>;

    const isGradualActive = platformState.targetPriceUsd != null;
    const gradualProgress = isGradualActive ? Math.min(100, ((Date.now() - platformState.targetStartTime) / platformState.targetDurationMs) * 100) : 0;

    return (
        <main className="min-h-screen bg-[#050505] text-white p-4 md:p-12 font-sans flex flex-col">
            <div className="max-w-4xl mx-auto w-full space-y-12">
                
                {/* Header */}
                <div className="flex justify-between items-end border-b border-gray-800 pb-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-white mb-2">Master Control</h1>
                        <p className="text-gray-500 text-sm">Restricted administrative interface</p>
                    </div>
                    <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition">Back to User Dashboard</Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    
                    {/* Section 1: User Management */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <div className="w-2 h-6 bg-blue-500 rounded-sm" /> User Lookup
                            </h2>
                            <div className="flex bg-gray-900 rounded-xl overflow-hidden border border-gray-800 focus-within:border-blue-500 transition">
                                <input 
                                    type="email" value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
                                    className="flex-1 bg-transparent p-4 outline-none text-sm" placeholder="Enter user email..."
                                    onKeyDown={e => e.key === 'Enter' && handleSearchUser()}
                                />
                                <button onClick={handleSearchUser} disabled={loading} className="px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold transition">Search</button>
                            </div>
                        </div>

                        {searchedUser && (
                            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{searchedUser.email}</h3>
                                        <p className="text-xs text-gray-500 font-mono mt-1">Wallet: {searchedUser.walletAddress}</p>
                                    </div>
                                    <button onClick={() => setEditingUser(!editingUser)} className="text-xs font-bold bg-gray-800 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition">
                                        {editingUser ? 'Cancel Edit' : 'Edit User'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-black rounded-lg border border-gray-800">
                                        <div className="text-xs text-gray-500 mb-1">USD Balance</div>
                                        {editingUser ? <input type="number" value={editUsd} onChange={e=>setEditUsd(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm outline-none" /> : <div className="font-mono">${searchedUser.balances?.USD?.toFixed(2) || '0.00'}</div>}
                                    </div>
                                    <div className="p-3 bg-black rounded-lg border border-gray-800">
                                        <div className="text-xs text-gray-500 mb-1">INR Balance</div>
                                        {editingUser ? <input type="number" value={editInr} onChange={e=>setEditInr(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm outline-none" /> : <div className="font-mono">₹{searchedUser.balances?.INR?.toFixed(2) || '0.00'}</div>}
                                    </div>
                                    <div className="col-span-2 p-3 bg-black rounded-lg border border-gray-800">
                                        <div className="text-xs text-gray-500 mb-1">Yard Balance</div>
                                        {editingUser ? <input type="number" value={editYard} onChange={e=>setEditYard(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm outline-none" /> : <div className="font-mono text-yellow-500">{searchedUser.balanceYard} Yard</div>}
                                    </div>
                                </div>

                                {editingUser && (
                                    <div className="space-y-3 p-4 border border-red-900/50 bg-red-900/10 rounded-xl">
                                        <h4 className="text-xs font-bold text-red-500 uppercase">Hashes (Encrypted)</h4>
                                        <div>
                                            <label className="text-xs text-gray-500">Password</label>
                                            <input type="text" value={editPassword} onChange={e=>setEditPassword(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-xs font-mono mt-1 text-gray-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Mnemonic</label>
                                            <input type="text" value={editMnemonic} onChange={e=>setEditMnemonic(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-xs font-mono mt-1 text-gray-400 outline-none" />
                                        </div>
                                    </div>
                                )}

                                {editingUser && (
                                    <button onClick={handleUpdateUser} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition">Save Changes</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Price Control */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <div className="w-2 h-6 bg-yellow-500 rounded-sm" /> Price Controller
                            </h2>
                            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl">
                                
                                {isGradualActive && (
                                    <div className="mb-8">
                                        <div className="flex justify-between text-xs text-green-400 font-bold uppercase tracking-wider mb-2">
                                            <span>Tracking Active</span>
                                            <span>{gradualProgress.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                                            <div className="bg-green-500 h-full" style={{ width: `${gradualProgress}%` }} />
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 font-mono mt-2">
                                            <span>Current: ${platformState.currentPriceUsd.toFixed(4)}</span>
                                            <span>Target: ${platformState.targetPriceUsd?.toFixed(4)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2 font-medium">Target Price (USD)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                            <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl p-4 pl-8 outline-none focus:border-yellow-500 transition text-lg" placeholder="0.00" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2 font-medium">Target Time (Hours)</label>
                                        <input type="number" value={targetHours} onChange={e => setTargetHours(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl p-4 outline-none focus:border-yellow-500 transition text-lg" placeholder="24" />
                                    </div>
                                    
                                    <p className="text-xs text-gray-500 leading-relaxed pt-2">
                                        The engine will smoothly track towards the target price. It will not jump instantly. To stop tracking, you can simply set a new target.
                                    </p>

                                    <button onClick={handleDeployGradual} disabled={loading} className="w-full py-4 mt-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-wider rounded-xl transition disabled:opacity-50">
                                        Deploy Target Strategy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
