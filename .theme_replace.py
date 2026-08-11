from pathlib import Path

replacements = {
    'bg-slate-950/95': 'bg-panel/95',
    'bg-slate-950/90': 'bg-panel/90',
    'bg-slate-950/85': 'bg-panel/85',
    'bg-slate-950/80': 'bg-panel/80',
    'bg-slate-950/75': 'bg-panel/75',
    'bg-slate-950/70': 'bg-panel/70',
    'bg-slate-950': 'bg-panel',
    'bg-slate-900/95': 'bg-panel-2/95',
    'bg-slate-900/90': 'bg-panel-2/90',
    'bg-slate-900/85': 'bg-panel-2/85',
    'bg-slate-900/80': 'bg-panel-2/80',
    'bg-slate-900/75': 'bg-panel-2/75',
    'bg-slate-900/70': 'bg-panel-2/70',
    'bg-slate-900/60': 'bg-panel-2/60',
    'bg-slate-900': 'bg-panel-2',
    'bg-slate-800': 'bg-panel-2',
    'bg-slate-700': 'bg-panel-2',
    'text-white': 'text-ivory',
    'text-slate-100': 'text-ivory',
    'text-slate-200': 'text-ivory',
    'text-slate-300': 'text-slate',
    'text-slate-400': 'text-slate',
    'text-slate-500': 'text-slate',
    'text-slate-600': 'text-slate',
    'border-white/10': 'border-hairline',
    'border-slate-700': 'border-hairline',
    'border-slate-800': 'border-hairline',
    'border-amber-400/40': 'border-hairline-strong',
    'focus:border-amber-400': 'focus:border-hairline-strong',
    'text-amber-300': 'text-gold',
    'text-amber-400': 'text-gold',
    'text-amber-200': 'text-gold',
    'bg-amber-400/10': 'bg-gold/10',
    'bg-amber-400/15': 'bg-gold/15',
    'bg-amber-400/20': 'bg-gold/20',
    'bg-amber-400/5': 'bg-gold/5',
    'bg-amber-400': 'bg-gold',
    'bg-amber-500': 'bg-gold',
    'from-amber-300 via-yellow-400 to-sky-500': 'from-gold to-gold-deep',
    'from-amber-400 to-sky-500': 'from-gold to-gold-deep',
    'from-amber-500 via-orange-400 to-blue-600': 'from-gold to-gold-deep',
    'from-sky-400 via-blue-500 to-amber-300': 'from-gold to-gold-deep',
    'from-fuchsia-500 to-cyan-500': 'from-gold to-gold-deep',
    'shadow-amber-500/25': 'shadow-gold/20',
    'shadow-orange-500/25': 'shadow-gold/20',
    'shadow-sky-500/25': 'shadow-gold/20',
    'bg-white/5': 'bg-ivory/5',
    'bg-white/10': 'bg-ivory/10',
    'hover:bg-white/10': 'hover:bg-ivory/10',
    'bg-white/15': 'bg-ivory/15',
    'bg-emerald-500/90': 'bg-gold/90',
    'bg-emerald-500': 'bg-gold',
    'shadow-slate-950/40': 'shadow-black/40',
    'rounded-[2rem]': 'rounded-md',
    'rounded-[1.5rem]': 'rounded-md',
    'rounded-[1.4rem]': 'rounded-md',
    'rounded-[1.25rem]': 'rounded-md',
    'rounded-[1.2rem]': 'rounded-md',
    'rounded-[1.1rem]': 'rounded-md',
    'rounded-[calc(1.5rem-1px)]': 'rounded-md'
}

files = [
    'app/api/posts/route.ts', 'app/calls/page.tsx', 'app/components/AppShell.tsx', 'app/components/AuthActionPrompt.tsx',
    'app/components/AuthPromptProvider.tsx', 'app/components/BlockButton.tsx', 'app/components/BottomNav.tsx',
    'app/components/FollowButton.tsx', 'app/components/PostCard.tsx', 'app/components/ProfileHeader.tsx',
    'app/components/ProfileTabs.tsx', 'app/connections/page.tsx', 'app/env/page.tsx', 'app/feed/page.tsx',
    'app/login/page.tsx', 'app/messages/page.tsx', 'app/onboarding/page.tsx', 'app/post/page.tsx',
    'app/post/PostDetailClient.tsx', 'app/privacy-policy/page.tsx', 'app/profile/page.tsx', 'app/search/page.tsx',
    'app/settings/page.tsx', 'app/signup/page.tsx', 'app/stories/page.tsx', 'app/terms-of-service/page.tsx',
    'app/user/[id]/FollowButton.tsx', 'app/user/[id]/page.tsx'
]

for path in files:
    p = Path(path)
    if not p.exists():
        print(f'MISSING: {path}')
        continue
    text = p.read_text(encoding='utf-8')
    for old, new in replacements.items():
        text = text.replace(old, new)
    p.write_text(text, encoding='utf-8')
print('done')
