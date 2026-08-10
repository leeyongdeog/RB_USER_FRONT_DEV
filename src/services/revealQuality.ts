export type QualityChoice = 'auto' | 'high' | 'balanced' | 'low' | 'ultra';
export type ResolvedQuality = Exclude<QualityChoice, 'auto'>;

export const AUTO_QUALITY_KEY = 'random-drop-reveal-auto-quality-v6';
export const AUTO_QUALITY_CHANGE_EVENT = 'random-drop-reveal-auto-quality-change';
export const QUALITY_ORDER: ResolvedQuality[] = ['ultra', 'low', 'balanced', 'high'];

export const REVEAL_QUALITY_PROFILES = {
  high: { localParticles: 48, viewportParticles: 140, celebrationParticles: 110, dpr: 1.25, fps: 60, glow: true },
  balanced: { localParticles: 32, viewportParticles: 78, celebrationParticles: 64, dpr: 1, fps: 45, glow: false },
  low: { localParticles: 12, viewportParticles: 24, celebrationParticles: 30, dpr: .75, fps: 30, glow: false },
  ultra: { localParticles: 6, viewportParticles: 12, celebrationParticles: 18, dpr: .5, fps: 20, glow: false },
} as const;

export const detectQuality = (): ResolvedQuality => {
  if (typeof window === 'undefined') return 'high';
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (memory <= 2 || cores <= 2) return 'ultra';
  if (memory <= 4 || cores <= 4) return 'low';
  if (memory <= 6 || cores <= 6) return 'balanced';
  return 'high';
};

export const getStoredAutoQuality = (): ResolvedQuality | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(AUTO_QUALITY_KEY) || 'null') as { quality?: ResolvedQuality } | null;
    if (saved?.quality && QUALITY_ORDER.includes(saved.quality)) return saved.quality;
  } catch {
    window.localStorage.removeItem(AUTO_QUALITY_KEY);
  }
  return null;
};

export const loadAutoQuality = (): ResolvedQuality => getStoredAutoQuality() || detectQuality();

export const saveAutoQuality = (quality: ResolvedQuality, fps: number) => {
  window.localStorage.setItem(AUTO_QUALITY_KEY, JSON.stringify({ quality, measuredAt: Date.now(), fps: Math.round(fps) }));
  window.dispatchEvent(new CustomEvent<ResolvedQuality>(AUTO_QUALITY_CHANGE_EVENT, { detail: quality }));
};

export const clearAutoQuality = () => window.localStorage.removeItem(AUTO_QUALITY_KEY);

export const lowerQuality = (first: ResolvedQuality, second: ResolvedQuality): ResolvedQuality => (
  QUALITY_ORDER[Math.min(QUALITY_ORDER.indexOf(first), QUALITY_ORDER.indexOf(second))]
);
