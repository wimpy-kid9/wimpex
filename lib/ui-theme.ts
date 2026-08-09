const palette = [
  {
    gradient: 'from-cyan-400 via-sky-500 to-fuchsia-500',
    glow: 'shadow-cyan-500/25',
    line: 'from-cyan-400/90 via-sky-500/70 to-fuchsia-500/90'
  },
  {
    gradient: 'from-emerald-400 via-lime-500 to-cyan-500',
    glow: 'shadow-emerald-500/25',
    line: 'from-emerald-400/90 via-lime-500/70 to-cyan-500/90'
  },
  {
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    glow: 'shadow-amber-500/25',
    line: 'from-amber-400/90 via-orange-500/70 to-rose-500/90'
  },
  {
    gradient: 'from-violet-500 via-fuchsia-500 to-sky-500',
    glow: 'shadow-violet-500/25',
    line: 'from-violet-400/90 via-fuchsia-500/70 to-sky-500/90'
  }
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUserAccent(seed: string) {
  const normalized = (seed || 'wimpex').trim().toLowerCase();
  const index = hashString(normalized) % palette.length;
  return palette[index];
}
