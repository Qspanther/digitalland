"use client";

import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CURRENCIES: Record<string, { rate: number, symbol: string }> = {
    USD: { rate: 1, symbol: '$' },
    INR: { rate: 83, symbol: '₹' },
    EUR: { rate: 0.92, symbol: '€' },
    Dinar: { rate: 0.31, symbol: 'د.ك' }
};

export default function Dashboard() {
    const { user, loading, refreshUser } = useAuth();
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    
    // Sell Warning State
    const [sellWarning, setSellWarning] = useState<any>(null); // null or { freeYards, requiredApprovals, pendingAmount, currency }
    // Wallet UI state
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [sellAmount, setSellAmount] = useState('');
    const [convertAmount, setConvertAmount] = useState('');
    const [convertTo, setConvertTo] = useState('INR');
    
    // Bank Account UI state
    const [bankCountry, setBankCountry] = useState('INR');
    const [bankAccNumber, setBankAccNumber] = useState('');
    const [bankIfsc, setBankIfsc] = useState('');
    const [bankRouting, setBankRouting] = useState('');
    const [bankIban, setBankIban] = useState('');
    const [bankBic, setBankBic] = useState('');
    
    // Withdraw UI state
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawBankId, setWithdrawBankId] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
        } else if (user) {
            refreshUser();
            fetchApi('/wallet/history').then(setHistory).catch(console.error);
        }
    }, [loading, router]); // Run once mostly

    if (loading || !user) return <div className="min-h-screen bg-black text-white p-8">Loading...</div>;

    const curr = CURRENCIES[selectedCurrency] || CURRENCIES['USD'];
    const currentBalance = user.balances?.[selectedCurrency] || 0;

    const handleDeposit = async () => {
        try {
            await fetchApi('/wallet/deposit', {
                method: 'POST',
                body: JSON.stringify({ amount: 1000, currency: selectedCurrency })
            });
            await refreshUser();
            alert(`1000 ${selectedCurrency} deposited!`);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleConvert = async () => {
        try {
            await fetchApi('/wallet/convert', {
                method: 'POST',
                body: JSON.stringify({
                    fromCurrency: selectedCurrency,
                    toCurrency: convertTo,
                    amount: parseFloat(convertAmount)
                })
            });
            await refreshUser();
            setConvertAmount('');
            alert('Converted successfully (2% fee applied)');
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAddBank = async () => {
        try {
            await fetchApi('/wallet/bank/add', {
                method: 'POST',
                body: JSON.stringify({
                    currency: bankCountry,
                    country: bankCountry,
                    accountNumber: bankAccNumber,
                    ifscCode: bankIfsc,
                    routingNumber: bankRouting,
                    iban: bankIban,
                    bicSwift: bankBic
                })
            });
            await refreshUser();
            setBankAccNumber(''); setBankIfsc(''); setBankRouting(''); setBankIban(''); setBankBic('');
            alert('Bank account added!');
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleWithdraw = async () => {
        try {
            const res = await fetchApi('/wallet/withdraw', {
                method: 'POST',
                body: JSON.stringify({
                    amount: parseFloat(withdrawAmount),
                    currency: selectedCurrency,
                    bankAccountId: withdrawBankId
                })
            });
            await refreshUser();
            const data = await fetchApi('/wallet/history');
            if (data.history) setHistory(data.history);
        } catch (err) {
            console.error('Failed to load history', err);
        }
    };

    const handleSell = async () => {
        if (!sellAmount) return;
        try {
            const res = await fetchApi('/trade/sell-platform', {
                method: 'POST',
                body: JSON.stringify({ amountYard: parseFloat(sellAmount), currency: selectedCurrency })
            });
            
            if (res.requiresApproval) {
                // Show Popup
                setSellWarning({
                    freeYards: res.freeYards,
                    requiredApprovals: res.requiredApprovals,
                    pendingAmount: parseFloat(sellAmount),
                    currency: selectedCurrency
                });
                return;
            }

            await refreshUser();
            setSellAmount('');
            alert(`Sell successful. You earned ${CURRENCIES[selectedCurrency].symbol}${res.earned.toFixed(2)}`);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const confirmSell = async () => {
        if (!sellWarning) return;
        try {
            const res = await fetchApi('/trade/sell-platform', {
                method: 'POST',
                body: JSON.stringify({ 
                    amountYard: sellWarning.pendingAmount, 
                    currency: sellWarning.currency,
                    confirm: true 
                })
            });
            await refreshUser();
            setSellAmount('');
            setSellWarning(null);
            alert(`Sell processed. ${res.earned > 0 ? `Earned ${CURRENCIES[sellWarning.currency].symbol}${res.earned.toFixed(2)} instantly. ` : ''}${res.queued > 0 ? `Permission request sent to sender(s) for ${res.queued} Yard.` : ''}`);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleGiftResponse = async (giftId: string, action: 'accept' | 'decline') => {
        try {
            await fetchApi('/trade/gift/respond', {
                method: 'POST',
                body: JSON.stringify({ giftId, action })
            });
            await refreshUser();
        } catch(err: any) { alert(err.message); }
    };

    const handleSellApprovalResponse = async (approvalId: string, action: 'accept' | 'decline') => {
        try {
            await fetchApi('/trade/sell-gifted/respond', {
                method: 'POST',
                body: JSON.stringify({ approvalId, action })
            });
            await refreshUser();
        } catch(err: any) { alert(err.message); }
    };

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8 pb-32">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Wallet Dashboard</h1>
                    <div className="flex gap-4 items-center">
                        <Link href="/" className="text-gray-400 hover:text-white">&larr; Home</Link>
                        {user.email === 'degital@gmail.com' && (
                        <Link href="/admin" className="text-yellow-500 hover:text-yellow-400 font-bold border border-yellow-500 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                            Admin Panel
                        </Link>
                    )}</div>
                </div>

                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Digital Yard Wallet Address</div>
                        <div className="font-mono text-blue-400 font-bold">{user.walletAddress}</div>
                    </div>
                </div>

                {/* NOTIFICATIONS SECTION */}
                {(user.pendingGifts?.length > 0 || user.pendingSellApprovalsAsApprover?.length > 0) && (
                    <div className="bg-gray-900 border border-yellow-500/50 p-6 rounded-2xl">
                        <h2 className="text-yellow-500 font-bold mb-4">Pending Notifications</h2>
                        <div className="space-y-4">
                            {user.pendingGifts?.map((gift: any) => (
                                <div key={gift.id} className="bg-black border border-gray-800 p-4 rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="text-sm"><strong>{gift.senderEmail}</strong> wants to gift you <strong>{gift.amountYard} Yard</strong>.</div>
                                        <div className="text-xs text-gray-500">{new Date(gift.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleGiftResponse(gift.id, 'accept')} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold text-sm">Accept</button>
                                        <button onClick={() => handleGiftResponse(gift.id, 'decline')} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold text-sm">Deny</button>
                                    </div>
                                </div>
                            ))}
                            {user.pendingSellApprovalsAsApprover?.map((app: any) => (
                                <div key={app.id} className="bg-black border border-gray-800 p-4 rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="text-sm"><strong>{app.sellerEmail}</strong> is asking for permission to sell <strong>{app.amountYard} Yard</strong> that you gifted them.</div>
                                        <div className="text-xs text-gray-500">{new Date(app.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSellApprovalResponse(app.id, 'accept')} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold text-sm">Agree</button>
                                        <button onClick={() => handleSellApprovalResponse(app.id, 'decline')} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold text-sm">Deny</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SELL WARNING MODAL */}
                {sellWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-lg w-full">
                            <h2 className="text-2xl font-bold text-yellow-500 mb-4">Permission Required</h2>
                            
                            <p className="text-gray-300 mb-4">
                                You are attempting to sell <strong>{sellWarning.pendingAmount} Yard</strong>. 
                                However, you only have <strong>{sellWarning.freeYards} sellable Yard</strong> that you bought yourself.
                            </p>
                            
                            <p className="text-gray-300 mb-6">
                                You are attempting to sell gifted yards. You must get permission from the sender(s) to proceed. We will send them a notification.
                            </p>

                            <div className="bg-black p-4 rounded-xl mb-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Senders requiring permission:</h3>
                                {sellWarning.requiredApprovals.map((req: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-blue-400">{req.senderEmail}</span>
                                        <span>{req.amountYard} Yard</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <button onClick={() => setSellWarning(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold transition">Cancel</button>
                                <button onClick={confirmSell} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black py-3 rounded-xl font-bold transition">Proceed</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* FIAT BALANCE CARD */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl md:col-span-2">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-gray-500 text-sm uppercase tracking-wider">Fiat Balance</h2>
                            <select 
                                value={selectedCurrency}
                                onChange={(e) => setSelectedCurrency(e.target.value)}
                                className="bg-black border border-gray-700 text-white rounded px-2 py-1 text-sm outline-none"
                            >
                                {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="text-5xl font-mono mb-6 text-green-400">{curr.symbol}{currentBalance.toFixed(2)}</div>
                        
                        <div className="flex gap-4">
                            <button onClick={handleDeposit} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-sm rounded-xl font-semibold transition">
                                + Deposit {selectedCurrency}
                            </button>
                        </div>
                    </div>

                    {/* YARD BALANCE CARD */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col justify-between">
                        <h2 className="text-gray-500 text-sm uppercase tracking-wider">Yard Balance</h2>
                        <div className="text-5xl font-mono text-yellow-500">{user.balanceYard}</div>
                        <div className="mt-4">
                            <input 
                                type="number"
                                value={sellAmount}
                                onChange={(e) => setSellAmount(e.target.value)}
                                className="w-full bg-black border border-gray-700 text-white rounded p-2 mb-2"
                                placeholder="0.00 Yard"
                            />
                            <button onClick={handleSell} className="w-full bg-red-600 hover:bg-red-500 text-white rounded py-2 font-bold transition mb-3">
                                Sell
                            </button>
                            <Link href="/market" className="block text-center py-2 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold rounded-xl transition">
                                Trade in Market
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* CONVERT CURRENCY */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg mb-4 text-white">Convert Currency</h3>
                        <p className="text-sm text-gray-400 mb-4">A 2% platform fee applies to all fiat conversions.</p>
                        
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">From ({selectedCurrency})</label>
                                    <input 
                                        type="number" value={convertAmount} onChange={e => setConvertAmount(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-3 mt-1 outline-none font-mono" placeholder="Amount"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">To Currency</label>
                                    <select 
                                        value={convertTo} onChange={e => setConvertTo(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-3 mt-1 outline-none"
                                    >
                                        {Object.keys(CURRENCIES).filter(c => c !== selectedCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleConvert} className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl">Convert Funds</button>
                        </div>
                    </div>

                    {/* WITHDRAW FUNDS */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg mb-4 text-white">Withdraw Funds</h3>
                        <p className="text-sm text-gray-400 mb-4">Withdraw {selectedCurrency} to your linked bank account.</p>
                        
                        <div className="space-y-4">
                            <input 
                                type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded p-3 outline-none font-mono" placeholder={`Amount in ${selectedCurrency}`}
                            />
                            <select 
                                value={withdrawBankId} onChange={e => setWithdrawBankId(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded p-3 outline-none"
                            >
                                <option value="">Select Bank Account</option>
                                {user.bankAccounts?.filter((b: any) => b.currency === selectedCurrency).map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.bankName || b.accountNumber || b.iban} ({b.country})</option>
                                ))}
                            </select>
                            <button onClick={handleWithdraw} className="w-full py-3 bg-red-600 hover:bg-red-500 font-bold rounded-xl text-white">Request Withdrawal</button>
                        </div>
                    </div>
                </div>

                {/* MANAGE BANK ACCOUNTS */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-lg mb-4 text-white">Linked Bank Accounts</h3>
                    
                    {user.bankAccounts && user.bankAccounts.length > 0 ? (
                        <div className="space-y-3 mb-6">
                            {user.bankAccounts.map((b: any) => (
                                <div key={b.id} className="flex justify-between items-center p-4 bg-black border border-gray-800 rounded-lg">
                                    <div>
                                        <div className="font-bold text-white">{b.currency} Account ({b.country})</div>
                                        <div className="text-sm text-gray-500 font-mono mt-1">
                                            {b.accountNumber && `Acc: ${b.accountNumber}`} {b.ifscCode && ` | IFSC: ${b.ifscCode}`} {b.iban && ` | IBAN: ${b.iban}`}
                                        </div>
                                    </div>
                                    <div className="text-green-500 text-sm">Verified</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 mb-6">No bank accounts linked yet.</p>
                    )}

                    <div className="p-6 bg-black border border-gray-800 rounded-xl">
                        <h4 className="font-bold mb-4 text-sm text-gray-400">Add New Bank Account</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Country/Currency Format</label>
                                <select 
                                    value={bankCountry} onChange={e => setBankCountry(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none"
                                >
                                    <option value="INR">India (INR)</option>
                                    <option value="USD">United States (USD)</option>
                                    <option value="EUR">Europe (EUR)</option>
                                    <option value="Dinar">Kuwait (Dinar)</option>
                                </select>
                            </div>

                            {bankCountry === 'INR' && (
                                <>
                                    <input type="text" placeholder="Account Number" value={bankAccNumber} onChange={e => setBankAccNumber(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                    <input type="text" placeholder="IFSC Code" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                </>
                            )}

                            {bankCountry === 'USD' && (
                                <>
                                    <input type="text" placeholder="Account Number" value={bankAccNumber} onChange={e => setBankAccNumber(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                    <input type="text" placeholder="Routing Number" value={bankRouting} onChange={e => setBankRouting(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                </>
                            )}

                            {bankCountry === 'EUR' && (
                                <>
                                    <input type="text" placeholder="IBAN" value={bankIban} onChange={e => setBankIban(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                    <input type="text" placeholder="BIC/SWIFT" value={bankBic} onChange={e => setBankBic(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                </>
                            )}

                            {bankCountry === 'Dinar' && (
                                <>
                                    <input type="text" placeholder="Account Number" value={bankAccNumber} onChange={e => setBankAccNumber(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                    <input type="text" placeholder="Bank Name" value={bankRouting} onChange={e => setBankRouting(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-3 outline-none" />
                                </>
                            )}
                        </div>
                        <button onClick={handleAddBank} className="py-2 px-6 bg-green-600 hover:bg-green-500 rounded text-sm font-bold transition">Save Bank Details</button>
                    </div>
                </div>

            </div>
        </main>
    );
}
