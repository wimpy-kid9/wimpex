export const accent = {
  gradient: 'from-gold to-gold-deep',
  glow: 'shadow-gold/20',
  line: 'from-gold/90 via-gold/60 to-gold-deep/90'
};

// Kept for API compatibility with existing call sites.
export function getUserAccent(seed: string) {
  void seed;
  return accent;
}
   