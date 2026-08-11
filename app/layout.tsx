import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppShell from './components/AppShell';
import AuthBootstrap from './components/AuthBootstrap';
import AuthPromptProvider from './components/AuthPromptProvider';
import { Inter, Cormorant_Garamond } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' });

export const metadata: Metadata = {
  title: 'Wimpex',
  description: 'Wimpex platform'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body>
        <AuthPromptProvider>
          <AppShell>
            <AuthBootstrap />
            {children}
          </AppShell>
        </AuthPromptProvider>
      </body>
    </html>
  );
}
