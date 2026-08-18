import type { CapacitorConfig } from '@capacitor/cli';

// Update this to your real production URL before your first `npx cap add` —
// changing it later just needs `npx cap sync`, no native code changes.
// Falls back to the same default used in app/layout.tsx and app/sitemap.ts.
const PRODUCTION_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://wimpex.vercel.app';
const config: CapacitorConfig = {
  appId: 'com.wimpex.app',
  appName: 'WIMPEX',
  // Required by the Capacitor CLI even though nothing here actually loads —
  // see www/index.html for why.
  webDir: 'www',
  server: {
    // Hosted mode: the native shell just navigates to your real deployed
    // app instead of bundling a static export. This is required here since
    // WIMPEX has live server-side API routes (Supabase auth, WebRTC
    // signaling, uploads) that `next export` can't produce statically.
    url: PRODUCTION_URL,
    cleartext: false,
    androidScheme: 'https'
    // Deliberately NOT whitelisting id.wimpy-corp.com.ng here. Letting it
    // load inside our own WebView replaces the WIMPEX app (and tears down
    // AuthBootstrap's appUrlOpen listener) while WimpyID is on screen, so
    // when login finishes and Android hands auth-callback back to us,
    // there's nothing left listening. Leaving this off makes Capacitor
    // open WimpyID externally (system browser / Custom Tab) instead — our
    // own WebView, and its listener, stay alive the whole time.
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
