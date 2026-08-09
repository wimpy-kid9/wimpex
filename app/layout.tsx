import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppShell from './components/AppShell';
import AuthBootstrap from './components/AuthBootstrap';

export const metadata: Metadata = {
  title: 'Wimpex',
  description: 'Wimpex platform'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          <AuthBootstrap />
          {children}
        </AppShell>
      </body>
    </html>
  );
}
