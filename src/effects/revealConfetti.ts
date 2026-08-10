import type { ResolvedQuality } from '../services/revealQuality';

const CONFETTI_COUNT: Record<ResolvedQuality, number> = {
  high: 92,
  balanced: 60,
  low: 28,
  ultra: 0,
};

export async function launchRevealConfetti(quality: ResolvedQuality, accent: string) {
  const count = CONFETTI_COUNT[quality];
  if (!count || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { confetti } = await import('@tsparticles/confetti');
  const colors = ['#ffffff', accent, '#ffd75e', '#67f5ff'];
  const common = {
    colors,
    decay: .91,
    disableForReducedMotion: true,
    gravity: .72,
    scalar: quality === 'high' ? 1.05 : .82,
    spread: 68,
    startVelocity: quality === 'high' ? 48 : 38,
    ticks: quality === 'high' ? 260 : 190,
    zIndex: 1400,
  };
  await Promise.all([
    confetti({ ...common, particleCount: count, angle: 58, origin: { x: .12, y: .72 } }),
    confetti({ ...common, particleCount: count, angle: 122, origin: { x: .88, y: .72 } }),
    confetti({
      ...common,
      particleCount: Math.round(count * .72),
      angle: 90,
      spread: 110,
      origin: { x: .5, y: .54 },
      startVelocity: quality === 'high' ? 58 : 44,
    }),
  ]);
}
