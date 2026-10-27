import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Digital Land',
    description: 'The world\'s first scarce digital land trading platform.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} bg-black text-gray-100 min-h-screen flex`}>
                <AuthProvider>
                    <Sidebar />
                    <div className="flex-1 overflow-y-auto min-h-screen">
                        {children}
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
