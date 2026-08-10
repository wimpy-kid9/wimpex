const palette = [
  {
    gradient: 'from-amber-300 via-yellow-400 to-sky-500',
    glow: 'shadow-amber-500/25',
    line: 'from-amber-400/90 via-yellow-500/70 to-sky-500/90'
  },
  {
    gradient: 'from-slate-100 via-amber-200 to-sky-400',
    glow: 'shadow-slate-400/20',
    line: 'from-slate-100/90 via-amber-300/70 to-sky-400/90'
  },
  {
    gradient: 'from-amber-500 via-orange-400 to-blue-600',
    glow: 'shadow-orange-500/25',
    line: 'from-amber-500/90 via-orange-400/70 to-blue-600/90'
  },
  {
    gradient: 'from-sky-400 via-blue-500 to-amber-300',
    glow: 'shadow-sky-500/25',
    line: 'from-sky-400/90 via-blue-500/70 to-amber-300/90'
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
   