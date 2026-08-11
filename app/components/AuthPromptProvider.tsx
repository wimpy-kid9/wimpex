"use client";

import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthPromptContextValue = {
  showAuthPrompt: () => void;
};

const AuthPromptContext = createContext<AuthPromptContextValue | undefined>(undefined);

export function useAuthPrompt() {
  const context = useContext(AuthPromptContext);
  if (!context) {
    throw new Error('useAuthPrompt must be used within an AuthPromptProvider');
  }
  return context;
}

function AuthPromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel/80 px-4 py-6 text-ivory">
      <div className="w-full max-w-lg rounded-md border border-hairline bg-panel-2/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-gold">Sign in required</p>
            <h2 className="mt-3 text-3xl font-semibold text-ivory">Keep browsing, then return after login</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-hairline bg-ivory/5 px-3 py-2 text-sm text-ivory hover:bg-ivory/10">
            Close
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-slate">
          This action requires a WimpyID session. You can log in or sign up now and then continue exactly where you were.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className="inline-flex grow items-center justify-center rounded-md bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex grow items-center justify-center rounded-md border border-hairline bg-panel/70 px-5 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/10">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthPromptProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleAuthRequired = () => setIsOpen(true);
    window.addEventListener('wimpex-auth-required', handleAuthRequired);
    return () => window.removeEventListener('wimpex-auth-required', handleAuthRequired);
  }, []);

  const value = useMemo(() => ({ showAuthPrompt: () => setIsOpen(true) }), []);

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
      {isOpen ? <AuthPromptModal onClose={() => setIsOpen(false)} /> : null}
    </AuthPromptContext.Provider>
  );
}
