import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import AppShell from './components/AppShell';
import AuthBootstrap from './components/AuthBootstrap';
import NativePushBootstrap from './components/NativePushBootstrap';
import AuthPromptProvider from './components/AuthPromptProvider';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wimpex.app';
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Wimpex',
    template: '%s | Wimpex'
  },
  description: 'Wimpex is a social platform for creators, connections, conversations, and live calling.',
  keywords: ['social platform', 'creator community', 'messaging', 'video calls', 'connections'],
  alternates: {
    canonical: siteUrl
  },
  manifest: '/manifest.json',
  themeColor: '#1a1a2e',
  openGraph: {
    title: 'Wimpex',
    description: 'Wimpex is a social platform for creators, connections, conversations, and live calling.',
    url: siteUrl,
    siteName: 'Wimpex',
    type: 'website',
    images: [{ url: '/wimpex-logo.png', width: 512, height: 512, alt: 'Wimpex logo' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wimpex',
    description: 'Wimpex is a social platform for creators, connections, conversations, and live calling.',
    images: ['/wimpex-logo.png']
  },
  icons: {
    icon: '/wimpex-logo.png',
    shortcut: '/wimpex-logo.png',
    apple: '/wimpex-logo.png'
  },
  other: googleSiteVerification ? {
    'google-site-verification': googleSiteVerification
  } : undefined
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {gaMeasurementId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
            <Script id="ga4-setup" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');
              `}
            </Script>
          </>
        ) : null}
        <AuthPromptProvider>
          <AppShell>
            <AuthBootstrap />
            <NativePushBootstrap />
            {children}
          </AppShell>
        </AuthPromptProvider>
      </body>
    </html>
  );
}
