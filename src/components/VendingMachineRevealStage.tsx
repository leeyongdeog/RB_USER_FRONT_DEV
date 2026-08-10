import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Gift, Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import AlternativeRevealResult, {
  ALTERNATIVE_RESULT_COPY,
  getAlternativeResultKind,
} from './AlternativeRevealResult';
import vendingBackground from '../assets/vending/veding-background.png';
import vendingBody from '../assets/vending/vending-body.png';
import vendingButton from '../assets/vending/vending-button.png';
import vendingDisplayBack from '../assets/vending/vending-display-back.png';
import vendingDropItem from '../assets/vending/vending-drop-item.png';
import vendingExitBack from '../assets/vending/vending-exit-back.png';
import vendingGlass from '../assets/vending/vending-glass.png';
import vendingHighlight from '../assets/vending/vending-highlight.png';
import vendingProducts from '../assets/vending/vending-products.png';
import floorGlow from '../assets/vending/floor_glow.png';
import leftPanel from '../assets/vending/left-pannel.png';
import rightPanel from '../assets/vending/right-pannel.png';
import tablePanel from '../assets/vending/table-pannel.png';
import clickSound from '../assets/click.wav';
import lightSound from '../assets/light.mp4';
import openSound from '../assets/open.wav';
import RevealFxLayer, { type RevealFxHandle } from '../effects/RevealFxLayer';
import {
  AUTO_QUALITY_CHANGE_EVENT, REVEAL_QUALITY_PROFILES, loadAutoQuality,
  type QualityChoice, type ResolvedQuality,
} from '../services/revealQuality';

gsap.registerPlugin(useGSAP);

type VendingMachineRevealStageProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

const VENDING_TIMING = {
  selectionDuration: 2.15,
  firstDropAt: 2.35,
  prizeRevealAt: 3.58,
  resultCardAt: 4.78,
} as const;

export default function VendingMachineRevealStage({
  boxId,
  outcome,
  onFinished,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: VendingMachineRevealStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLImageElement>(null);
  const clickParticleCanvasRef = useRef<HTMLCanvasElement>(null);
  const clickParticleAnimationRef = useRef<number | null>(null);
  const dropGroupRef = useRef<HTMLDivElement>(null);
  const prizeGroupRef = useRef<HTMLDivElement>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const fxRef = useRef<RevealFxHandle>(null);
  const runningRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [jackpotActive, setJackpotActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [qualityChoice] = useState<QualityChoice>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('random-drop-reveal-quality') : null;
    return saved === 'high' || saved === 'balanced' || saved === 'low' || saved === 'ultra' ? saved : 'auto';
  });
  const [autoQuality, setAutoQuality] = useState<ResolvedQuality>(loadAutoQuality);
  const resolvedQuality = qualityChoice === 'auto' ? autoQuality : qualityChoice;
  const qualityProfile = REVEAL_QUALITY_PROFILES[resolvedQuality];
  const kind = getAlternativeResultKind(outcome);
  const copy = ALTERNATIVE_RESULT_COPY[kind];
  const rewards = useMemo(() => outcome?.rewards?.length
    ? outcome.rewards
    : [{
      assetId: 'vending-preview',
      productId: 'vending-preview-product',
      name: kind === 'jackpot' ? '프리미엄 자판기 상품' : '랜덤 자판기 상품',
      value: kind === 'jackpot' ? 3500000 : 12000,
      consumerPrice: kind === 'jackpot' ? 3500000 : 12000,
      level: kind === 'jackpot' ? 3 : 1,
      levelName: copy.label,
      color: copy.color,
      imageUrl: null,
    }],
  [copy.color, copy.label, kind, outcome]);
  const visibleRewards = kind === 'double' && rewards.length === 1
    ? [rewards[0], { ...rewards[0], assetId: `${rewards[0].assetId}-double` }]
    : rewards.slice(0, kind === 'double' ? 2 : 1);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (!audio || audio.muted) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  useGSAP(() => {
    gsap.set('.vending-drop-unit', {
      autoAlpha: 0,
      y: -330,
      rotation: -18,
      scale: .82,
    });
    gsap.set(prizeGroupRef.current, {
      autoAlpha: 0,
      scale: .18,
      y: 42,
      filter: 'brightness(0) saturate(1.8)',
    });
    gsap.set(resultCardRef.current, { autoAlpha: 0, y: 42, scale: .92 });
    gsap.set('.vending-stage-flash, .vending-color-wash, .vending-exit-charge, .vending-jackpot-rays', {
      autoAlpha: 0,
    });
    gsap.fromTo('.vending-left-panel', {
      filter: 'brightness(.8) saturate(1.05) drop-shadow(0 0 4px #6ee8ff)',
    }, {
      filter: 'brightness(1.5) saturate(1.25) drop-shadow(0 0 14px #6ee8ff)',
      duration: .72,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.fromTo('.vending-right-panel', {
      filter: 'brightness(.8) saturate(1.05) drop-shadow(0 0 4px #ff7bd8)',
    }, {
      filter: 'brightness(1.5) saturate(1.3) drop-shadow(0 0 15px #ff7bd8)',
      duration: .91,
      delay: .18,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.fromTo('.vending-table-panel', {
      filter: 'brightness(.8) saturate(1.05) drop-shadow(0 0 4px #ffe66f)',
    }, {
      filter: 'brightness(1.5) saturate(1.2) drop-shadow(0 0 13px #ffe66f)',
      duration: .64,
      delay: .08,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.fromTo('.vending-floor-glow', {
      autoAlpha: .72,
      filter: 'brightness(.8) saturate(1.05)',
    }, {
      autoAlpha: .95,
      filter: 'brightness(1.5) saturate(1.35)',
      duration: 1.1,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.to('.vending-products', {
      y: -4,
      duration: 1.25,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }, { scope: stageRef });

  useEffect(() => {
    const applyMeasuredQuality = (event: Event) => {
      if (qualityChoice !== 'auto') return;
      setAutoQuality((event as CustomEvent<ResolvedQuality>).detail);
    };
    window.addEventListener(AUTO_QUALITY_CHANGE_EVENT, applyMeasuredQuality);
    return () => window.removeEventListener(AUTO_QUALITY_CHANGE_EVENT, applyMeasuredQuality);
  }, [qualityChoice]);

  useEffect(() => () => {
    gsap.killTweensOf(stageRef.current?.querySelectorAll('*') || []);
    if (clickParticleAnimationRef.current !== null) {
      window.cancelAnimationFrame(clickParticleAnimationRef.current);
    }
  }, []);

  const runClickParticleBurst = () => {
    const canvas = clickParticleCanvasRef.current;
    const body = bodyRef.current;
    if (!canvas || !body) return;
    if (clickParticleAnimationRef.current !== null) {
      window.cancelAnimationFrame(clickParticleAnimationRef.current);
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, qualityProfile.dpr);
    const bounds = body.getBoundingClientRect();
    const origin = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    const colors = [copy.color, '#ffffff'];
    const count = qualityProfile.viewportParticles;
    const distance = Math.hypot(width, height) * .68 * .82;
    const waveCount = resolvedQuality === 'high' ? 5 : resolvedQuality === 'balanced' ? 4 : 3;
    const waveInterval = 2.2 / waveCount;
    const burstDuration = .82;
    const totalDuration = (waveCount - 1) * waveInterval + burstDuration;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.visibility = 'visible';
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = Array.from({ length: count * waveCount }, (_, particleIndex) => {
      const wave = Math.floor(particleIndex / count);
      const index = particleIndex % count;
      const angle = Math.PI * 2 * (index / count) + (index % 7) * .07 + wave * .19;
      const speed = distance * (.55 + (index % 9) * .055);
      return {
        spawnAt: wave * waveInterval,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + index % 6 * 1.8,
        rotation: index * .81 + wave * .43,
        spin: (index % 2 ? 1 : -1) * (2.5 + index % 5),
        color: colors[(index + wave) % colors.length],
        shape: index % 4,
      };
    });
    const startedAt = performance.now();
    let lastRenderedAt = 0;
    const minimumFrameDuration = 1000 / qualityProfile.fps;

    const render = (now: number) => {
      if (now - lastRenderedAt < minimumFrameDuration - 2 && now - startedAt < totalDuration * 1000) {
        clickParticleAnimationRef.current = window.requestAnimationFrame(render);
        return;
      }
      lastRenderedAt = now;
      const elapsed = Math.min(totalDuration, (now - startedAt) / 1000);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = qualityProfile.glow ? 'lighter' : 'source-over';

      for (const particle of particles) {
        const localElapsed = elapsed - particle.spawnAt;
        if (localElapsed < 0 || localElapsed > burstDuration) continue;
        const progress = localElapsed / burstDuration;
        const x = origin.x + particle.vx * localElapsed;
        const y = origin.y + particle.vy * localElapsed;
        const alpha = Math.pow(1 - progress, 1.3);
        const scale = .45 + progress * .85;
        const size = particle.size * scale;
        context.save();
        context.globalAlpha = Math.max(0, alpha);
        context.translate(x, y);
        context.rotate(particle.rotation + particle.spin * localElapsed);
        context.fillStyle = particle.color;
        context.strokeStyle = particle.color;
        if (particle.shape === 0) {
          context.beginPath();
          context.arc(0, 0, size * .65, 0, Math.PI * 2);
          context.fill();
        } else if (particle.shape === 1) {
          context.fillRect(-size * .25, -size, size * .5, size * 2);
        } else if (particle.shape === 2) {
          context.fillRect(-size, -size * .25, size * 2, size * .5);
        } else {
          context.lineWidth = Math.max(1, size * .2);
          context.strokeRect(-size * .65, -size * .65, size * 1.3, size * 1.3);
        }
        context.restore();
      }

      context.globalCompositeOperation = 'source-over';
      const ringCount = resolvedQuality === 'high' ? 3 : resolvedQuality === 'ultra' ? 0 : 1;
      for (let wave = 0; wave < waveCount; wave += 1) {
        const localElapsed = elapsed - wave * waveInterval;
        if (localElapsed < 0 || localElapsed > burstDuration) continue;
        const progress = localElapsed / burstDuration;
        for (let index = 0; index < ringCount; index += 1) {
          context.save();
          context.globalAlpha = Math.max(0, (1 - progress) * .75);
          context.strokeStyle = colors[(index + wave) % colors.length];
          context.lineWidth = resolvedQuality === 'low' ? 2 : 3 + index;
          context.beginPath();
          context.arc(origin.x, origin.y, 25 + progress * (140 + index * 95) * .82, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
      }

      if (elapsed < totalDuration) {
        clickParticleAnimationRef.current = window.requestAnimationFrame(render);
      } else {
        context.clearRect(0, 0, width, height);
        canvas.style.visibility = 'hidden';
        clickParticleAnimationRef.current = null;
      }
    };

    clickParticleAnimationRef.current = window.requestAnimationFrame(render);
  };

  const runVending = () => {
    if (runningRef.current || revealed) return;
    runningRef.current = true;
    setStarted(true);
    playSound(clickAudioRef.current);
    runClickParticleBurst();
    fxRef.current?.energy({
      color: '#63efff',
      origin: [.5, .49],
      intensity: resolvedQuality === 'high' ? 1.65 : resolvedQuality === 'balanced' ? 1.32 : .88,
      duration: VENDING_TIMING.selectionDuration + .35,
      radius: .4,
    });
    fxRef.current?.pulse({
      color: '#8d7cff',
      origin: [.5, .49],
      strength: 1.05,
      duration: .92,
      radius: .88,
    });
    fxRef.current?.burst({
      color: '#7df4ff',
      origin: [.5, .49],
      count: resolvedQuality === 'high' ? 120 : resolvedQuality === 'balanced' ? 84 : 48,
      speed: 1.7,
      duration: 1.35,
      size: 13,
    });
    gsap.killTweensOf([
      '.vending-left-panel',
      '.vending-right-panel',
      '.vending-table-panel',
      '.vending-floor-glow',
      '.vending-products',
    ]);

    const timeline = gsap.timeline({
      onComplete: () => {
        runningRef.current = false;
        setRevealed(true);
        onFinished?.();
      },
    });

    timeline
      .fromTo('.vending-button', {
        scale: 1,
        filter: 'brightness(1)',
      }, {
        scale: .965,
        filter: 'brightness(1.5) saturate(1.5) drop-shadow(0 0 24px #fff06a)',
        duration: .12,
        repeat: 5,
        yoyo: true,
        ease: 'power2.inOut',
      }, 0)
      .to(machineRef.current, {
        x: 4,
        y: -1,
        rotation: .65,
        scaleX: 1.026,
        scaleY: .974,
        skewX: .45,
        transformOrigin: '50% 72%',
        duration: .072,
        repeat: 31,
        yoyo: true,
        ease: 'sine.inOut',
      }, .18)
      .fromTo('.vending-glass', {
        autoAlpha: .2,
        filter: 'brightness(.8) saturate(1.05) drop-shadow(0 0 3px #8eeeff)',
      }, {
        autoAlpha: .64,
        filter: 'brightness(1.5) saturate(1.35) drop-shadow(0 0 19px #d9fbff)',
        duration: .14,
        repeat: 15,
        yoyo: true,
        ease: 'sine.inOut',
      }, .18)
      .fromTo('.vending-color-wash', {
        autoAlpha: 0,
        scale: .7,
      }, {
        autoAlpha: .72,
        scale: 1.25,
        duration: .52,
        repeat: 3,
        yoyo: true,
        ease: 'sine.inOut',
      }, .08)
      .fromTo('.vending-left-panel, .vending-right-panel, .vending-table-panel', {
        filter: 'brightness(.8) saturate(1.05) drop-shadow(0 0 5px #fff)',
      }, {
        filter: 'brightness(1.5) saturate(1.5) drop-shadow(0 0 26px #fff)',
        duration: .16,
        repeat: 9,
        yoyo: true,
        stagger: .055,
        ease: 'sine.inOut',
      }, .15)
      .fromTo('.vending-floor-glow', {
        autoAlpha: .72,
        filter: 'brightness(.8) saturate(1.05) drop-shadow(0 0 6px var(--alternative-color))',
      }, {
        autoAlpha: 1,
        filter: 'brightness(1.5) saturate(1.5) drop-shadow(0 0 28px var(--alternative-color))',
        duration: .22,
        repeat: 7,
        yoyo: true,
        ease: 'sine.inOut',
      }, .18)
      .to('.vending-products', {
        x: 7,
        y: -7,
        rotation: .35,
        duration: .08,
        repeat: 17,
        yoyo: true,
        ease: 'none',
      }, .42)
      .to('.vending-exit-charge', {
        autoAlpha: .96,
        scale: 1.22,
        filter: 'brightness(1.5) drop-shadow(0 0 34px #fff) drop-shadow(0 0 52px var(--alternative-color))',
        duration: .48,
        ease: 'power2.out',
      }, VENDING_TIMING.selectionDuration - .18)
      .call(() => {
        playSound(lightAudioRef.current);
        fxRef.current?.energy({
          color: copy.color,
          origin: [.5, .62],
          intensity: kind === 'jackpot' ? 2.5 : 1.85,
          duration: 1.65,
          radius: .24,
        });
        fxRef.current?.pulse({
          color: copy.color,
          origin: [.5, .66],
          strength: kind === 'jackpot' ? 1.8 : 1.28,
          duration: 1.05,
          radius: .78,
        });
      }, undefined, VENDING_TIMING.selectionDuration);

    gsap.utils.toArray<HTMLElement>('.vending-drop-unit', dropGroupRef.current).forEach((unit, index) => {
      const targetX = visibleRewards.length > 1 ? (index === 0 ? -42 : 42) : 0;
      timeline
        .fromTo(unit, {
          autoAlpha: 0,
          x: targetX,
          y: -330,
          rotation: index % 2 ? 17 : -17,
          scale: .76,
        }, {
          autoAlpha: 1,
          x: targetX,
          y: 0,
          rotation: 0,
          scale: visibleRewards.length > 1 ? .82 : 1,
          duration: .78,
          ease: 'bounce.out',
          immediateRender: false,
        }, VENDING_TIMING.firstDropAt + index * .16)
        .to(unit, {
          y: -37,
          scale: visibleRewards.length > 1 ? 1.02 : 1.3,
          filter: 'brightness(1.5) saturate(1.5) drop-shadow(0 0 28px var(--alternative-color))',
          duration: .48,
          ease: 'back.out(1.7)',
        }, 3.12 + index * .08);
    });

    timeline
      .call(() => {
        playSound(openAudioRef.current);
        fxRef.current?.energy({
          color: copy.color,
          origin: [.5, .54],
          intensity: kind === 'jackpot' ? 3.25 : kind === 'double' || kind === 'level-up' ? 2.65 : 2.2,
          duration: 2.15,
          radius: kind === 'jackpot' ? .46 : .39,
        });
        fxRef.current?.pulse({
          color: copy.color,
          origin: [.5, .54],
          strength: kind === 'jackpot' ? 2.4 : 1.82,
          duration: 1.2,
          radius: 1.18,
        });
        fxRef.current?.burst({
          color: copy.color,
          origin: [.5, .54],
          count: kind === 'jackpot' ? 240 : resolvedQuality === 'high' ? 180 : resolvedQuality === 'balanced' ? 132 : 76,
          speed: kind === 'jackpot' ? 2.85 : 2.3,
          duration: kind === 'jackpot' ? 2.1 : 1.75,
          size: kind === 'jackpot' ? 19 : 16,
          gravity: .42,
        });
      }, undefined, VENDING_TIMING.prizeRevealAt)
      .to('.vending-stage-flash', {
        autoAlpha: .98,
        duration: .2,
        ease: 'power4.in',
      }, VENDING_TIMING.prizeRevealAt)
      .to('.vending-stage-flash', {
        autoAlpha: 0,
        duration: .58,
        ease: 'power2.out',
      }, VENDING_TIMING.prizeRevealAt + .2)
      .to('.vending-drop-unit', {
        autoAlpha: 0,
        scale: 1.75,
        duration: .3,
        ease: 'power2.out',
      }, VENDING_TIMING.prizeRevealAt + .08)
      .to(prizeGroupRef.current, {
        autoAlpha: 1,
        scale: .84,
        y: 0,
        filter: 'brightness(0) saturate(1.8)',
        duration: .5,
        ease: 'back.out(1.8)',
      }, VENDING_TIMING.prizeRevealAt + .18)
      .to(prizeGroupRef.current, {
        scale: 1,
        filter: 'brightness(1) saturate(1)',
        duration: .72,
        ease: 'power2.out',
      }, VENDING_TIMING.prizeRevealAt + .68)
      .to('.vending-burst-particle', {
        autoAlpha: 0,
        x: (index) => (index % 2 ? 1 : -1) * (95 + (index * 47) % 360),
        y: (index) => -250 + (index * 67) % 480,
        rotation: (index) => index * 43,
        scale: (index) => .5 + index % 5 * .3,
        duration: 1.35,
        stagger: .008,
        ease: 'power3.out',
      }, VENDING_TIMING.prizeRevealAt + .12)
      .to(resultCardRef.current, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: .52,
        ease: 'back.out(1.5)',
      }, VENDING_TIMING.resultCardAt);

    if (kind === 'jackpot') {
      timeline
        .call(() => setJackpotActive(true), undefined, VENDING_TIMING.prizeRevealAt - .12)
        .to('.vending-jackpot-rays', {
        autoAlpha: .92,
        rotation: '+=100',
        scale: 1.4,
        duration: 1.4,
        ease: 'power2.out',
      }, VENDING_TIMING.prizeRevealAt - .12);
    }
  };

  return <div
    ref={stageRef}
    className={`preview-stage alternative-reveal-stage vending-reveal-stage result-${kind} ${started ? 'is-running' : ''} ${revealed ? 'is-revealed' : ''} ${jackpotActive ? 'is-jackpot-active' : ''}`}
    style={{ '--alternative-color': copy.color } as React.CSSProperties}
    onClick={runVending}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') runVending();
    }}
    role="button"
    tabIndex={0}
    aria-label={revealed ? '자판기 개봉 결과' : '자판기를 작동하려면 화면을 누르세요'}
  >
    <audio ref={clickAudioRef} src={clickSound} preload="auto" muted={muted}/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto" muted={muted}/>
    <audio ref={openAudioRef} src={openSound} preload="auto" muted={muted}/>
    {createPortal(
      <canvas ref={clickParticleCanvasRef} className="effects-canvas burst-effects-canvas" aria-hidden="true"/>,
      document.body,
    )}
    <div className="vending-stage-ambient" aria-hidden="true"/>
    <RevealFxLayer
      ref={fxRef}
      quality={resolvedQuality}
      onReady={(ready) => {
        if (!ready) return;
        fxRef.current?.setEnergyAmbient({
          color: '#62eaff',
          origin: [.5, .49],
          intensity: resolvedQuality === 'high' ? .22 : resolvedQuality === 'balanced' ? .16 : .09,
          radius: .39,
        });
      }}
    />
    <div className="vending-color-wash" aria-hidden="true"/>
    <div className="vending-jackpot-rays" aria-hidden="true"/>
    <div className="vending-stage-flash" aria-hidden="true"/>
    <div className="vending-burst" aria-hidden="true">
      {Array.from({ length: 54 }, (_, index) => <i
        className="vending-burst-particle"
        key={index}
        style={{ '--particle-color': ['#7cf4ff', '#ff72cf', '#ffe567', '#9f82ff', '#fff'][index % 5] } as React.CSSProperties}
      />)}
    </div>
    <div className="vending-scene-shell" aria-hidden="true">
      <img className="vending-art vending-background" src={vendingBackground} alt=""/>
      <img className="vending-art vending-floor-glow" src={floorGlow} alt=""/>
      <img className="vending-art vending-left-panel" src={leftPanel} alt=""/>
      <img className="vending-art vending-right-panel" src={rightPanel} alt=""/>
      <img className="vending-art vending-table-panel" src={tablePanel} alt=""/>
    </div>
    <div ref={machineRef} className="vending-machine-shell" aria-hidden="true">
      <img className="vending-art vending-display-back" src={vendingDisplayBack} alt=""/>
      <img className="vending-art vending-products" src={vendingProducts} alt=""/>
      <img className="vending-art vending-glass" src={vendingGlass} alt=""/>
      <img className="vending-art vending-exit-back" src={vendingExitBack} alt=""/>
      <div ref={dropGroupRef} className={`vending-drop-group count-${visibleRewards.length}`}>
        {visibleRewards.map((reward) => <img
          className="vending-art vending-drop-unit"
          src={vendingDropItem}
          alt=""
          key={reward.assetId}
        />)}
      </div>
      <img ref={bodyRef} className="vending-art vending-body" src={vendingBody} alt=""/>
      <img className="vending-art vending-highlight" src={vendingHighlight} alt=""/>
      <div className="vending-exit-charge"><i/><i/><i/></div>
      <img className="vending-art vending-button" src={vendingButton} alt=""/>
      <div ref={prizeGroupRef} className={`vending-prize-group count-${visibleRewards.length}`}>
        {visibleRewards.map((reward) => <div className="vending-prize" key={reward.assetId}>
          {reward.imageUrl
            ? <img src={reward.imageUrl} alt=""/>
            : <span><Gift size={48}/></span>}
        </div>)}
      </div>
    </div>
    <div ref={resultCardRef} className="alternative-reward-card" onClick={(event) => event.stopPropagation()}>
      <AlternativeRevealResult
        outcome={outcome}
        boxId={boxId}
        kind={kind}
        sequential={sequential}
        remainingCount={remainingCount}
        continuePending={continuePending}
        onContinue={onContinue}
      />
    </div>
    {!started && <div className="alternative-guide">
      <span>LUCKY VENDING</span>
      <strong>화면을 눌러 상품을 뽑아보세요!</strong>
      <small>진열대가 선택한 행운의 상품을 배출합니다.</small>
    </div>}
    {started && !revealed && <div className="alternative-status"><i/><span>상품 선택 중</span><i/></div>}
    <button
      className="alternative-sound-button"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setMuted(value => !value);
      }}
      aria-label={muted ? '소리 켜기' : '소리 끄기'}
    >
      {muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}
    </button>
  </div>;
}
