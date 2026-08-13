"use client";

import { useEffect, useState } from 'react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if ((window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setShowInstall(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (!showInstall || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-hairline bg-panel-2/95 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:bottom-4 sm:left-4 sm:right-auto sm:rounded-3xl sm:w-80">
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-ivory">Install WIMPEX</h3>
          <p className="mt-1 text-sm text-slate">Install our app to get instant access, even offline.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-obsidian transition hover:bg-gold-deep"
          >
            Install
          </button>
          <button
            onClick={() => setShowInstall(false)}
            className="flex-1 rounded-2xl border border-hairline bg-panel px-4 py-2 text-sm font-semibold text-slate transition hover:bg-panel-2"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
