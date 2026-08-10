import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AUTH_SESSION_STARTED_EVENT } from '../services/api';
import { REVEAL_QUALITY_PROFILES, detectQuality, getStoredAutoQuality, lowerQuality, saveAutoQuality, type ResolvedQuality } from '../services/revealQuality';

type Particle = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  color: string;
  phase: number;
  rotation: number;
  spin: number;
  shape: number;
};

const COLORS = ['#ffffff', '#ffe45c', '#ff6f91', '#66e4ff', '#9a7cff'];
const WARMUP_DURATION = 700;
const MEASUREMENT_DURATION = 3600;
const QUALITY_LABELS: Record<ResolvedQuality, string> = { high: '고화질', balanced: '일반', low: '저사양', ultra: '초저사양' };

export default function WelcomePerformanceCalibration({ authenticated }: { authenticated: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(() => authenticated && !getStoredAutoQuality());
  const [closing, setClosing] = useState(false);
  const [resultLabel, setResultLabel] = useState('');

  useEffect(() => {
    const startCalibration = () => {
      if (getStoredAutoQuality()) return;
      setClosing(false);
      setResultLabel('');
      setVisible(true);
    };
    window.addEventListener(AUTH_SESSION_STARTED_EVENT, startCalibration);
    return () => window.removeEventListener(AUTH_SESSION_STARTED_EVENT, startCalibration);
  }, []);

  useEffect(() => {
    if (!authenticated || getStoredAutoQuality()) return;
    setVisible(true);
  }, [authenticated]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, REVEAL_QUALITY_PROFILES.high.dpr);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    const particles: Particle[] = Array.from({ length: 360 }, (_, index) => ({
      x: Math.random() * width,
      y: height * (.42 + Math.random() * .16),
      radius: 2 + Math.random() * 5,
      speed: 90 + Math.random() * 260,
      angle: -Math.PI * (.16 + Math.random() * .68),
      color: COLORS[index % COLORS.length],
      phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      spin: (index % 2 ? 1 : -1) * (1.8 + index % 5),
      shape: index % 4,
    }));
    const flashGradient = context.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height) * .72);
    flashGradient.addColorStop(0, 'rgba(255,255,255,.48)');
    flashGradient.addColorStop(.38, 'rgba(255,111,145,.16)');
    flashGradient.addColorStop(1, 'rgba(102,228,255,0)');

    let animationId = 0;
    let start = 0;
    let previous = 0;
    let frames = 0;
    let closeTimer = 0;
    let hideTimer = 0;
    const frameDurations: number[] = [];
    const render = (now: number) => {
      if (!start) {
        start = now;
        previous = now;
      }
      const frameDuration = now - previous;
      const delta = Math.min(.04, frameDuration / 1000);
      previous = now;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      const elapsed = now - start;
      if (elapsed >= WARMUP_DURATION) {
        frames += 1;
        if (frameDuration < 100) frameDurations.push(frameDuration);
      }
      const activeParticleCount = elapsed < 1100 ? 210 : elapsed < 2300 ? 300 : 360;
      for (let index = 0; index < activeParticleCount; index += 1) {
        const particle = particles[index];
        particle.phase += delta * (2 + index % 4);
        particle.x += Math.cos(particle.angle) * particle.speed * delta + Math.sin(particle.phase) * 1.8;
        particle.y += Math.sin(particle.angle) * particle.speed * delta + 150 * delta;
        if (particle.y > height + 20 || particle.x < -20 || particle.x > width + 20) {
          particle.x = Math.random() * width;
          particle.y = height * (.48 + Math.random() * .08);
        }
        context.globalAlpha = .45 + Math.sin(particle.phase) * .3;
        context.fillStyle = particle.color;
        context.strokeStyle = particle.color;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation + particle.spin * elapsed / 1000);
        if (particle.shape === 0) {
          context.beginPath();
          context.arc(0, 0, particle.radius, 0, Math.PI * 2);
          context.fill();
        } else if (particle.shape === 1) {
          context.fillRect(-particle.radius * .35, -particle.radius * 1.4, particle.radius * .7, particle.radius * 2.8);
        } else if (particle.shape === 2) {
          context.fillRect(-particle.radius * 1.4, -particle.radius * .3, particle.radius * 2.8, particle.radius * .6);
        } else {
          context.lineWidth = 1.5;
          context.strokeRect(-particle.radius, -particle.radius, particle.radius * 2, particle.radius * 2);
        }
        context.restore();
      }
      context.globalAlpha = .12 + Math.sin(elapsed / 145) * .06;
      context.fillStyle = flashGradient;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = .18;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      for (let ring = 0; ring < 4; ring += 1) {
        const radius = ((elapsed * .22 + ring * 130) % Math.max(width, height)) + 20;
        context.beginPath();
        context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        context.stroke();
      }
      if (elapsed < WARMUP_DURATION + MEASUREMENT_DURATION) {
        animationId = window.requestAnimationFrame(render);
        return;
      }
      const fps = frames / (MEASUREMENT_DURATION / 1000);
      const sortedDurations = [...frameDurations].sort((first, second) => first - second);
      const slowFrameDuration = sortedDurations[Math.min(sortedDurations.length - 1, Math.floor(sortedDurations.length * .9))] || 1000 / fps;
      const measured: ResolvedQuality = fps >= 55 && slowFrameDuration <= 21.5
        ? 'high'
        : fps >= 42 && slowFrameDuration <= 32
          ? 'balanced'
          : fps >= 28 && slowFrameDuration <= 48
            ? 'low'
            : 'ultra';
      const quality = lowerQuality(measured, detectQuality());
      saveAutoQuality(quality, fps);
      setResultLabel(`연출 품질을 ${QUALITY_LABELS[quality]}로 설정했어요`);
      closeTimer = window.setTimeout(() => setClosing(true), 500);
      hideTimer = window.setTimeout(() => setVisible(false), 820);
    };

    animationId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationId);
      window.clearTimeout(closeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;
  return <div className={`welcome-calibration ${closing ? 'is-closing' : ''}`} role="status" aria-live="polite">
    <canvas ref={canvasRef} aria-hidden="true"/>
    <i className="welcome-benchmark-flash" aria-hidden="true"/>
    <div className="welcome-calibration-copy"><span><Sparkles size={21}/></span><h2>환영합니다!</h2><p>{resultLabel || '기기에 맞는 최적의 박스 연출을 준비하고 있어요'}</p></div>
  </div>;
}
