import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppShell from './components/AppShell';
import AuthBootstrap from './components/AuthBootstrap';
import AuthPromptProvider from './components/AuthPromptProvider';

export const metadata: Metadata = {
  title: 'Wimpex',
  description: 'Wimpex platform'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
