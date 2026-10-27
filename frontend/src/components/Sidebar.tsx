"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Home, Wallet, LineChart, Gift, LogOut, LogIn, UserPlus, ShieldCheck, History } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const navItems = [
        { name: 'Home', href: '/', icon: Home },
        { name: 'Wallet Dashboard', href: '/dashboard', icon: Wallet },
        { name: 'Trade Market', href: '/market', icon: LineChart },
        { name: 'History', href: '/history', icon: History },
        { name: 'Gift Yards', href: '/gift', icon: Gift },
        ...(user?.email === 'degital@gmail.com'
            ? [{ name: 'Admin Panel', href: '/admin', icon: ShieldCheck }]
            : []),
    ];

    return (
        <aside className="w-64 bg-gray-900 border-r border-gray-800 h-screen sticky top-0 flex flex-col z-50">
            <div className="p-6">
                <Link href="/" className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 block mb-2">
                    DIGITAL LAND
                </Link>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Square Yard Protocol</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link 
                            key={item.name} 
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${isActive ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        >
                            <Icon size={20} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-800">
                {user ? (
                    <div className="space-y-4">
                        <div className="px-4 py-3 bg-black rounded-xl border border-gray-800">
                            <p className="text-xs text-gray-500 mb-1">Logged in as</p>
                            <p className="text-sm font-semibold truncate text-white" title={user.email}>{user.email}</p>
                        </div>
                        <button 
                            onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl transition-all font-semibold text-red-400 hover:bg-red-500/10"
                        >
                            <LogOut size={20} />
                            Log Out
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Link href="/auth/login" className="flex items-center justify-center gap-2 px-4 py-3 w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all font-bold">
                            <LogIn size={18} /> Log In
                        </Link>
                        <Link href="/auth/signup" className="flex items-center justify-center gap-2 px-4 py-3 w-full bg-green-500 hover:bg-green-400 text-black rounded-xl transition-all font-bold">
                            <UserPlus size={18} /> Create Wallet
                        </Link>
                    </div>
                )}
            </div>
        </aside>
    );
}
