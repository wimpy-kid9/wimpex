'use client';

import { useState } from 'react';
import { usePaidUpgradeFlow } from '@/app/components/PaidUpgradeFlow';

export default function GoldUpgradeHint({
  perk,
  detail,
  compact = false
}: {
  perk: string;
  detail: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const upgrade = usePaidUpgradeFlow({ productName: 'wimpex', planName: 'Wimpex Pro' });

  return (
    <div className={compact ? 'relative inline-block' : 'relative rounded-2xl border border-gold/25 bg-gold/5 p-4'}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={compact ? 'rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20' : 'text-left'}
        aria-expanded={open}
      >
        {compact ? 'Gold unlock' : <><p className="text-sm font-semibold text-ivory">{perk}</p><p className="mt-1 text-xs text-slate">{detail}</p></>}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-gold/30 bg-panel p-4 shadow-2xl shadow-black/30">
          <p className="text-sm font-semibold text-ivory">{perk}</p>
          <p className="mt-1 text-xs leading-5 text-slate">{detail}</p>
          <button type="button" onClick={() => void upgrade.attemptPurchase()} disabled={upgrade.loading} className="mt-3 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-obsidian transition hover:bg-gold-deep disabled:opacity-50">
            {upgrade.loading ? 'Opening Gold…' : 'Unlock with Gold'}
          </button>
          {upgrade.notice ? <p className="mt-2 text-xs text-gold">{upgrade.notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
