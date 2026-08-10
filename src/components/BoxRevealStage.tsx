import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight, Gift, PackageOpen, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import boxBodyL0 from '../assets/bb-l0.png';
import boxBodyL1 from '../assets/bb-l1.png';
import boxBodyL2 from '../assets/bb-l2.png';
import boxBodyL3 from '../assets/bb-l3.png';
import boxCapL0 from '../assets/bc-l0.png';
import boxCapL1 from '../assets/bc-l1.png';
import boxCapL2 from '../assets/bc-l2.png';
import boxCapL3 from '../assets/bc-l3.png';
import clickSound from '../assets/click.wav';
import lightSound from '../assets/light.mp4';
import openSound from '../assets/open.wav';
import {
  AUTO_QUALITY_CHANGE_EVENT, QUALITY_ORDER, REVEAL_QUALITY_PROFILES, loadAutoQuality, saveAutoQuality,
  type QualityChoice, type ResolvedQuality,
} from '../services/revealQuality';

gsap.registerPlugin(useGSAP);

type RevealProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

const LEVELS = [
  { name: 'NORMAL', color: '#ffffff', glow: '#dce9ff' },
  { name: 'RARE', color: '#ff4f69', glow: '#ff264f' },
  { name: 'GOLD', color: '#fff1a6', glow: '#ffbd32' },
] as const;

const BOX_ARTWORK = [
  { body: boxBodyL0, cap: boxCapL0 },
  { body: boxBodyL1, cap: boxCapL1 },
  { body: boxBodyL2, cap: boxCapL2 },
  { body: boxBodyL3, cap: boxCapL3 },
] as const;

const getDoubleTrigger = (boxId: string) => {
  if (boxId.toLowerCase() === 'chance-1144') return 3;
  let hash = 0;
  for (const character of boxId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 100 < 45 ? 2 + hash % 2 : 0;
};

export default function BoxRevealStage({
  boxId, outcome, onFinished, sequential = false, remainingCount = 0, continuePending = false, onContinue,
}: RevealProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const giftRef = useRef<HTMLDivElement>(null);
  const secondGiftRef = useRef<HTMLDivElement>(null);
  const lidRef = useRef<HTMLSpanElement>(null);
  const secondLidRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const secondBodyRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const burstCanvasRef = useRef<HTMLCanvasElement>(null);
  const celebrationCanvasRef = useRef<HTMLCanvasElement>(null);
  const burstAnimationRef = useRef<number | null>(null);
  const celebrationAnimationRef = useRef<number | null>(null);
  const slowEffectCountRef = useRef(0);
  const downgradedThisOpeningRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const clickRef = useRef(0);
  const busyRef = useRef(false);
  const doubleRef = useRef(false);
  const doubleTriggerRef = useRef(outcome ? (outcome.double ? 2 + Number(outcome.openingId) % 2 : 0) : getDoubleTrigger(boxId));
  const [level, setLevel] = useState(Math.min(3, Math.max(1, outcome?.startLevel || 1)));
  const [clicks, setClicks] = useState(0);
  const [opened, setOpened] = useState(false);
  const [doubled, setDoubled] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [qualityChoice, setQualityChoice] = useState<QualityChoice>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('random-drop-reveal-quality') : null;
    return saved === 'high' || saved === 'balanced' || saved === 'low' || saved === 'ultra' ? saved : 'auto';
  });
  const [autoQuality, setAutoQuality] = useState<ResolvedQuality>(loadAutoQuality);
  const resolvedQuality = qualityChoice === 'auto' ? autoQuality : qualityChoice;
  const qualityProfile = REVEAL_QUALITY_PROFILES[resolvedQuality];
  const qualityClassName = resolvedQuality === 'ultra' ? 'quality-low quality-ultra' : `quality-${resolvedQuality}`;
  const particles = useMemo(() => Array.from({ length: qualityProfile.localParticles }, (_, index) => index), [qualityProfile.localParticles]);
  const current = LEVELS[Math.min(3, Math.max(1, level)) - 1];
  const artworkLevel = doubled ? 0 : Math.min(3, Math.max(1, level));
  const artwork = BOX_ARTWORK[artworkLevel];
  const animatedLevelUpCount = outcome
    ? Math.max(0, Math.min(3, Math.max(1, outcome.level)) - Math.min(3, Math.max(1, outcome.startLevel)))
    : 2;
  const stepClicks = opened ? 3 : clicks % 3;

  useEffect(() => {
    const applyMeasuredQuality = (event: Event) => {
      if (qualityChoice !== 'auto') return;
      setAutoQuality((event as CustomEvent<ResolvedQuality>).detail);
    };
    window.addEventListener(AUTO_QUALITY_CHANGE_EVENT, applyMeasuredQuality);
    return () => window.removeEventListener(AUTO_QUALITY_CHANGE_EVENT, applyMeasuredQuality);
  }, [qualityChoice]);

  useGSAP(() => {
    gsap.set(resultRef.current, { autoAlpha: 0, scale: .7, y: 34 });
    gsap.set(secondGiftRef.current, { autoAlpha: 0, left: 0, scale: .4 });
    gsap.set('.reveal-particle', { autoAlpha: 0, x: 0, y: 0, scale: 0 });
    gsap.fromTo(giftRef.current,
      { autoAlpha: 0, y: 70, scale: .35, rotationZ: -8, ...(resolvedQuality === 'low' || resolvedQuality === 'ultra' ? {} : { filter: 'blur(8px) brightness(2)' }) },
      { autoAlpha: 1, y: 0, scale: 1, rotationZ: 0, ...(resolvedQuality === 'low' || resolvedQuality === 'ultra' ? {} : { filter: 'blur(0px) brightness(1)' }), duration: .9, ease: 'back.out(1.8)' },
    );
    gsap.to(giftRef.current, { y: -9, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: .9 });
  }, { scope: stageRef });

  useEffect(() => () => {
    if (burstAnimationRef.current !== null) window.cancelAnimationFrame(burstAnimationRef.current);
    if (celebrationAnimationRef.current !== null) window.cancelAnimationFrame(celebrationAnimationRef.current);
  }, []);

  const recordEffectPerformance = (fps: number) => {
    if (qualityChoice !== 'auto' || downgradedThisOpeningRef.current) return;
    const targetFps = qualityProfile.fps;
    if (fps >= targetFps * .84) {
      slowEffectCountRef.current = 0;
      return;
    }
    slowEffectCountRef.current += 1;
    if (slowEffectCountRef.current < 3) return;
    slowEffectCountRef.current = 0;
    downgradedThisOpeningRef.current = true;
    setAutoQuality((previous) => {
      const currentIndex = QUALITY_ORDER.indexOf(previous);
      const nextQuality = QUALITY_ORDER[Math.max(0, currentIndex - 1)];
      saveAutoQuality(nextQuality, fps);
      return nextQuality;
    });
  };

  const addParticleBurst = (timeline: gsap.core.Timeline, color: string, distance = 270) => {
    const nodes = gsap.utils.toArray<HTMLElement>('.reveal-particle', stageRef.current);
    timeline.set(nodes, { backgroundColor: color, boxShadow: qualityProfile.glow ? `0 0 18px ${color}` : 'none', autoAlpha: 1, x: 0, y: 0, scale: 0 }, '<')
      .to(nodes, {
        x: (index) => Math.cos((Math.PI * 2 * index) / nodes.length) * (distance * (.65 + (index % 5) * .1)),
        y: (index) => Math.sin((Math.PI * 2 * index) / nodes.length) * (distance * (.65 + (index % 7) * .07)),
        rotation: (index) => index * 31,
        scale: (index) => .5 + (index % 4) * .35,
        autoAlpha: 0,
        duration: .85,
        stagger: { each: .004, from: 'random' },
        ease: 'power3.out',
      }, '<');
  };

  const runCanvasEffect = (
    canvas: HTMLCanvasElement | null,
    animationRef: { current: number | null },
    colors: readonly string[],
    count: number,
    origin: { x: number; y: number },
    celebration = false,
    intensity = 1,
  ) => {
    if (!canvas) return;
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, qualityProfile.dpr);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.visibility = 'visible';
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const distance = Math.hypot(width, height) * .68 * intensity;
    const particlesToDraw = Array.from({ length: count }, (_, index) => {
      const angle = Math.PI * 2 * (index / count) + (index % 7) * .07;
      const speed = distance * (.55 + (index % 9) * .055);
      const distributedX = (((index * 73) % count) + .5) / count * width;
      const distributedY = (((index * 47) % count) + .5) / count * height;
      return {
        x: celebration ? distributedX : origin.x,
        y: celebration ? distributedY : origin.y,
        vx: celebration ? (index % 9 - 4) * 24 : Math.cos(angle) * speed,
        vy: celebration ? -95 - (index % 7) * 18 : Math.sin(angle) * speed,
        size: celebration ? 4 + index % 5 * 1.7 : 3 + index % 6 * 1.8,
        rotation: index * .81,
        spin: (index % 2 ? 1 : -1) * (2.5 + index % 5),
        color: colors[index % colors.length],
        shape: index % 4,
      };
    });
    const duration = celebration ? 1.45 : .82;
    const startedAt = performance.now();
    let lastRenderedAt = 0;
    let renderedFrames = 0;
    const minimumFrameDuration = 1000 / qualityProfile.fps;
    const render = (now: number) => {
      if (now - lastRenderedAt < minimumFrameDuration - 2 && now - startedAt < duration * 1000) {
        animationRef.current = window.requestAnimationFrame(render);
        return;
      }
      lastRenderedAt = now;
      renderedFrames += 1;
      const elapsed = Math.min(duration, (now - startedAt) / 1000);
      const progress = elapsed / duration;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = qualityProfile.glow ? 'lighter' : 'source-over';
      for (const particle of particlesToDraw) {
        const x = particle.x + particle.vx * elapsed;
        const y = particle.y + particle.vy * elapsed + (celebration ? 250 * elapsed * elapsed : 0);
        const alpha = celebration ? Math.sin(Math.min(1, progress) * Math.PI) : Math.pow(1 - progress, 1.3);
        const scale = celebration ? .65 + Math.sin(progress * Math.PI) * .75 : .45 + progress * .85;
        context.save();
        context.globalAlpha = Math.max(0, alpha);
        context.translate(x, y);
        context.rotate(particle.rotation + particle.spin * elapsed);
        context.fillStyle = particle.color;
        context.strokeStyle = particle.color;
        const size = particle.size * scale;
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
      for (let index = 0; index < ringCount; index += 1) {
        context.save();
        context.globalAlpha = Math.max(0, (1 - progress) * .75);
        context.strokeStyle = colors[index % colors.length];
        context.lineWidth = resolvedQuality === 'low' ? 2 : 3 + index;
        context.beginPath();
        context.arc(origin.x, origin.y, 25 + progress * (140 + index * 95) * intensity, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
      if (progress < 1) {
        animationRef.current = window.requestAnimationFrame(render);
      } else {
        context.clearRect(0, 0, width, height);
        canvas.style.visibility = 'hidden';
        animationRef.current = null;
        recordEffectPerformance(renderedFrames / duration);
      }
    };
    animationRef.current = window.requestAnimationFrame(render);
  };

  const addViewportBurst = (
    timeline: gsap.core.Timeline,
    color: string,
    _group: number,
    intensity = 1,
    position = '<',
  ) => {
    timeline.call(() => {
      const gift = giftRef.current;
      if (!gift) return;
      const bounds = gift.getBoundingClientRect();
      runCanvasEffect(
        burstCanvasRef.current,
        burstAnimationRef,
        [color, '#ffffff'],
        qualityProfile.viewportParticles,
        { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 },
        false,
        intensity,
      );
    }, undefined, position);
  };

  const addCelebration = (timeline: gsap.core.Timeline, position: string) => {
    timeline.call(() => runCanvasEffect(
      celebrationCanvasRef.current,
      celebrationAnimationRef,
      ['#fff4a8', '#ffcf38', '#ff5478', '#7fe7ff', '#a98bff', '#ffffff'],
      qualityProfile.celebrationParticles,
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      true,
      1,
    ), undefined, `${position}+=.12`);
  };

  const playSound = (audio: HTMLAudioElement | null) => {
    if (!audio || audio.muted) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const interact = () => {
    if (busyRef.current || opened) return;
    playSound(clickAudioRef.current);
    const nextClick = clickRef.current + 1;
    const startLevel = Math.min(3, Math.max(1, outcome?.startLevel || 1));
    const targetLevel = Math.min(3, Math.max(startLevel, outcome?.level || 3));
    const totalClicks = (targetLevel - startLevel + 1) * 3;
    const activeLevel = Math.min(targetLevel, Math.floor((nextClick - 1) / 3) + startLevel);
    const visualLevel = Math.min(3, Math.max(1, activeLevel));
    const shouldDouble = outcome ? outcome.double : doubleTriggerRef.current > 0;
    const willDouble = shouldDouble && !doubleRef.current && activeLevel === 1 && nextClick === doubleTriggerRef.current;
    const doubleMode = doubleRef.current || willDouble;
    const isMilestone = nextClick % 3 === 0 || willDouble;
    const isFinal = doubleMode ? nextClick === 3 : nextClick === totalClicks;
    const effectLevel = isMilestone && !isFinal && !doubleMode ? Math.min(targetLevel, visualLevel + 1) : visualLevel;
    const color = doubleMode ? '#63f4ff' : LEVELS[effectLevel - 1].color;
    const filterEffect = (value: string) => resolvedQuality === 'low' || resolvedQuality === 'ultra' ? {} : { filter: value };
    const giftTargets = doubleRef.current ? [giftRef.current, secondGiftRef.current] : giftRef.current;
    const lidTargets = doubleRef.current ? [lidRef.current, secondLidRef.current] : lidRef.current;
    const bodyTargets = doubleRef.current ? [bodyRef.current, secondBodyRef.current] : bodyRef.current;
    busyRef.current = isMilestone;
    if (isMilestone) setTransitioning(true);
    clickRef.current = nextClick;
    setClicks(nextClick);

    gsap.killTweensOf([giftRef.current, secondGiftRef.current]);
    const timeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        if (isMilestone) {
          busyRef.current = false;
          setTransitioning(false);
        }
        if (!isFinal && clickRef.current === nextClick && !busyRef.current) {
          const restingTargets = doubleRef.current ? [giftRef.current, secondGiftRef.current] : giftTargets;
          gsap.to(restingTargets, { y: -9, duration: 1.25, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        }
      },
    });

    timeline.to(giftTargets, { scaleX: .82, scaleY: .88, y: 12, ...filterEffect(`brightness(1.9) drop-shadow(0 0 28px ${color})`), duration: .045, ease: 'power4.in' })
      .to(giftTargets, { scaleX: 1.18, scaleY: 1.13, y: -11, rotationZ: nextClick % 2 ? -4 : 4, duration: .085, ease: 'power4.out' })
      .to(giftTargets, { x: -11, duration: .018, repeat: 5, yoyo: true, ease: 'none' })
      .to(giftTargets, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotationZ: 0, ...filterEffect('brightness(1) drop-shadow(0 34px 28px rgba(0,0,0,.38))'), duration: .11, ease: 'back.out(3)' })
      .to('.stage-rays', { rotation: '+=48', scale: 1.16, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out' }, '<-.2')
      .addLabel('impactComplete');
    addViewportBurst(timeline, color, nextClick % 3, isMilestone ? 1.12 : .82);

    if (!isMilestone) {
      timeline.to('.stage-core-glow', { scale: 1.7, autoAlpha: .9, duration: .08, yoyo: true, repeat: 1 }, '<-.12')
        .fromTo('.shockwave', { scale: .15, autoAlpha: .9, borderColor: color }, { scale: 2.2, autoAlpha: 0, duration: .38, stagger: .025, ease: 'power2.out' }, '<');
      addParticleBurst(timeline, color, 190);
      return;
    }

    const flashCore = flashRef.current?.querySelector('.screen-flash-core');
    const flashRing = flashRef.current?.querySelector('.screen-flash-ring');
    const ambientTargets = stageRef.current?.querySelectorAll('.stage-aurora,.stage-rays,.stage-orbit');
    const doublePrism = gsap.utils.toArray<HTMLElement>('.double-flash-prism', flashRef.current);
    const doubleCross = gsap.utils.toArray<HTMLElement>('.double-flash-cross', flashRef.current);
    const doubleBolts = gsap.utils.toArray<HTMLElement>('.double-flash-bolt', flashRef.current);
    timeline.to(giftTargets, { scaleX: .9, scaleY: 1.02, y: 2, ...filterEffect(`brightness(1.2) drop-shadow(0 0 26px ${color})`), duration: .34, ease: 'sine.in' }, 'impactComplete')
      .to(giftTargets, { scaleX: .56, scaleY: .5, y: 10, ...filterEffect(`brightness(1.5) drop-shadow(0 0 42px ${color})`), duration: .12, ease: 'expo.in' }, 'impactComplete+=.34')
      .to(giftTargets, { scaleX: .5, scaleY: .55, y: 7, duration: .07, ease: 'power2.out' }, 'impactComplete+=.46')
      .to([lidTargets, bodyTargets], { borderRadius: '25% 17% 29% 20%', duration: .34, ease: 'sine.inOut' }, 'impactComplete')
      .addLabel('jellySmall', 'impactComplete+=.53')
      .to([lidTargets, bodyTargets], { borderRadius: '13% 30% 17% 29%', duration: .055, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 'jellySmall')
      .to(giftTargets, { x: -8, y: 5, rotationZ: -2.8, scaleX: .46, scaleY: .65, duration: .04, ease: 'none' }, 'jellySmall')
      .to(giftTargets, { x: 8, y: 3, rotationZ: 2.7, scaleX: .64, scaleY: .46, duration: .04, ease: 'none' }, 'jellySmall+=.04')
      .to(giftTargets, { x: -7, y: 6, rotationZ: -2.3, scaleX: .48, scaleY: .62, duration: .04, ease: 'none' }, 'jellySmall+=.08')
      .to(giftTargets, { x: 7, y: 4, rotationZ: 2.1, scaleX: .61, scaleY: .48, duration: .04, ease: 'none' }, 'jellySmall+=.12')
      .to(giftTargets, { x: -5, y: 5, rotationZ: -1.6, scaleX: .5, scaleY: .59, duration: .04, ease: 'none' }, 'jellySmall+=.16')
      .to(giftTargets, { x: 5, y: 4, rotationZ: 1.4, scaleX: .58, scaleY: .5, duration: .04, ease: 'none' }, 'jellySmall+=.2')
      .to(giftTargets, { x: 0, y: 4, rotationZ: 0, scaleX: .52, scaleY: .55, duration: .055, ease: 'power2.in' }, 'jellySmall+=.24')
      .to('.stage-core-glow', { scale: 2.25, autoAlpha: 1, duration: .16, repeat: 2, yoyo: true, ease: 'power2.inOut' }, 'jellySmall')
      .addLabel('detonate', 'jellySmall+=.295')
      .call(() => playSound(lightAudioRef.current), undefined, 'detonate')
      .to(ambientTargets || [], { autoAlpha: 0, duration: .08, ease: 'none' }, 'detonate')
      .set(flashRef.current, { backgroundColor: color, autoAlpha: 0 }, 'detonate')
      .set([flashCore, flashRing], { scale: .2, rotation: -35, autoAlpha: 0 }, '<')
      .to(flashRef.current, { autoAlpha: 1, duration: .08, ease: 'power4.in' })
      .to([flashCore, flashRing], { scale: 2.8, rotation: 65, autoAlpha: .95, duration: 1.05, ease: 'power2.out' }, '<')
      .to(flashRef.current, { autoAlpha: 1, duration: 1 }, '<')
      .fromTo('.shockwave', { scale: .1, autoAlpha: 1, borderColor: color }, { scale: 4.1, autoAlpha: 0, duration: 1.1, stagger: .08, ease: 'power3.out' }, '<')
      .to(flashRef.current, { autoAlpha: 0, duration: .4, ease: 'power2.out' })
      .to(ambientTargets || [], { autoAlpha: 1, duration: .18, ease: 'power1.out' }, '<')
      .addLabel('reveal')
      .addLabel('concealedSwap', 'detonate+=.9');
    if (doubleMode) {
      timeline.set(flashRef.current, { background: 'radial-gradient(circle at center,#ffffff 0 7%,#63f4ff 24%,#8067ff 58%,#160b45 100%)' }, 'detonate')
        .fromTo(doublePrism,
          { scale: .08, rotation: -80, autoAlpha: 0 },
          { scale: 3.5, rotation: 185, autoAlpha: .95, duration: 1.18, ease: 'power3.out' }, 'detonate')
        .fromTo(doubleCross,
          { scale: .2, rotation: 0, autoAlpha: 0 },
          { scale: 2.8, rotation: 48, autoAlpha: .9, duration: .82, ease: 'expo.out' }, 'detonate+=.05')
        .fromTo(doubleBolts,
          { scaleY: .05, autoAlpha: 0 },
          { scaleY: 1.5, autoAlpha: 1, duration: .18, repeat: 4, yoyo: true, stagger: .035, ease: 'power4.in' }, 'detonate+=.08')
        .to([doublePrism, doubleCross, doubleBolts], { autoAlpha: 0, duration: .28 }, 'reveal-=.28');
    } else {
      timeline.set([doublePrism, doubleCross, doubleBolts], { autoAlpha: 0 }, 'detonate');
    }
    addParticleBurst(timeline, color, isFinal ? 510 : 410);
    addViewportBurst(timeline, color, (nextClick + 1) % 3, isFinal ? 1.42 : 1.22, 'detonate+=.1');

    if (willDouble) {
      timeline.call(() => {
        doubleRef.current = true;
        setDoubled(true);
      }, undefined, 'concealedSwap')
        .set([lidRef.current, bodyRef.current, secondLidRef.current, secondBodyRef.current], { clearProps: 'borderRadius' }, 'concealedSwap')
        .set(secondGiftRef.current, { autoAlpha: 1, left: 0, x: 0, y: 4, scaleX: .42, scaleY: .5, rotationZ: 0 }, 'concealedSwap')
        .to(giftRef.current, { left: -102, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: .5, ease: 'back.out(1.8)' }, 'concealedSwap')
        .to(secondGiftRef.current, { left: 102, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: .5, ease: 'back.out(1.8)' }, 'concealedSwap')
        .fromTo('.stage-core-glow', { scale: 1.2, autoAlpha: .6 }, { scale: 2.4, autoAlpha: 1, duration: .22, repeat: 1, yoyo: true }, 'concealedSwap')
        .addLabel('doubleReady', 'reveal');
      if (!isFinal) return;
    }

    if (!isFinal) {
      const nextLevel = Math.min(targetLevel, activeLevel + 1);
      timeline.call(() => setLevel(nextLevel), undefined, 'concealedSwap')
        .set([lidRef.current, bodyRef.current], { clearProps: 'borderRadius' }, 'reveal')
        .fromTo(giftRef.current,
          { scaleX: .42, scaleY: .5, x: 0, y: 4, rotationZ: 0, ...filterEffect(`drop-shadow(0 0 85px ${color}) brightness(3.2)`) },
          { scaleX: 1.4, scaleY: .88, x: 0, y: -5, rotationZ: 0, ...filterEffect('drop-shadow(0 34px 28px rgba(0,0,0,.38)) brightness(1)'), duration: .17, ease: 'expo.out' }, 'reveal')
        .to(giftRef.current, { scaleX: .9, scaleY: 1.28, y: -12, duration: .11, ease: 'sine.inOut' }, 'reveal+=.17')
        .to(giftRef.current, { scaleX: 1.14, scaleY: .93, y: -5, duration: .1, ease: 'sine.inOut' }, 'reveal+=.28')
        .to(giftRef.current, { scaleX: .97, scaleY: 1.07, y: -8, duration: .09, ease: 'sine.inOut' }, 'reveal+=.38')
        .to(giftRef.current, { scaleX: 1, scaleY: 1, y: 0, duration: .12, ease: 'sine.out' }, 'reveal+=.47');
      return;
    }

    const openAt = willDouble ? 'doubleReady' : 'reveal';
    const finalGifts = doubleMode ? [giftRef.current, secondGiftRef.current] : [giftRef.current];
    const finalLids = doubleMode ? [lidRef.current, secondLidRef.current] : [lidRef.current];
    const finalBodies = doubleMode ? [bodyRef.current, secondBodyRef.current] : [bodyRef.current];
    timeline.call(() => setOpened(true), undefined, openAt)
      .set([...finalLids, ...finalBodies], { clearProps: 'borderRadius' }, openAt)
      .to(finalGifts, { scaleX: 1.43, scaleY: .86, x: 0, y: -7, rotationZ: 0, ...filterEffect(`brightness(2.4) drop-shadow(0 0 90px ${color})`), duration: .17, ease: 'expo.out' }, openAt)
      .to(finalGifts, { scaleX: .91, scaleY: 1.27, y: -14, duration: .11, ease: 'sine.inOut' }, `${openAt}+=.17`)
      .to(finalGifts, { scaleX: 1.13, scaleY: .94, y: -7, duration: .1, ease: 'sine.inOut' }, `${openAt}+=.28`)
      .call(() => playSound(openAudioRef.current), undefined, `${openAt}+=.12`)
      .to(finalLids, {
        y: -190,
        x: (index) => doubleMode ? (index === 0 ? -115 : 115) : 58,
        rotationZ: (index) => doubleMode ? (index === 0 ? -38 : 38) : 38,
        scale: 1.22,
        duration: .68,
        ease: 'power4.out',
      }, `${openAt}+=.12`)
      .to(finalBodies, { y: 44, scaleX: 1.16, scaleY: .72, autoAlpha: .45, duration: .5, ease: 'power3.in' }, `${openAt}+=.12`)
      .to(finalGifts, { scale: .78, y: 102, autoAlpha: 0, duration: .46, ease: 'power3.in' }, `${openAt}+=.62`)
      .to(resultRef.current, { autoAlpha: 1, scale: 1, y: 0, duration: .7, ease: 'back.out(1.7)' }, `${openAt}+=.78`)
      .call(() => onFinished?.());
    addCelebration(timeline, openAt);
  };

  return <div ref={stageRef} className={`preview-stage gsap-reveal-stage ${qualityClassName} level-${level} ${doubled ? 'is-double' : ''} ${opened ? 'is-opened' : ''}`}
    style={{ '--level-color': current.color, '--level-glow': current.glow } as React.CSSProperties}
    onClick={interact} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') interact(); }}
    role="button" tabIndex={0} aria-label={opened ? '박스 개봉 결과' : `레벨 ${level} 박스, 화면을 눌러 진행`}>
    <audio ref={clickAudioRef} src={clickSound} preload="auto" muted={muted}/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto" muted={muted}/>
    <audio ref={openAudioRef} src={openSound} preload="auto" muted={muted}/>
    {createPortal(<><canvas ref={burstCanvasRef} className="effects-canvas burst-effects-canvas" aria-hidden="true"/>
      <canvas ref={celebrationCanvasRef} className="effects-canvas celebration-effects-canvas" aria-hidden="true"/>
      <div ref={flashRef} className={`screen-flash ${qualityClassName}`} aria-hidden="true"><i className="screen-flash-core"/><i className="screen-flash-ring"/><i className="screen-flash-cross"/>
        <i className="double-flash-prism"/><i className="double-flash-cross"/>{[0,1,2,3,4,5,6,7].map((bolt) => <i key={bolt} className="double-flash-bolt" style={{ '--bolt-index': bolt } as React.CSSProperties}/>)}</div></>, document.body)}
    <div className="stage-aurora"/><div className="stage-core-glow"/><div className="stage-rays"/>
    <div className="stage-orbit orbit-one"/><div className="stage-orbit orbit-two"/>
    <div className="shockwaves" aria-hidden="true"><i className="shockwave"/><i className="shockwave"/><i className="shockwave"/></div>
    <div className="particle-field" aria-hidden="true">{particles.map((particle) => <i key={particle} className="reveal-particle"/>)}</div>
    <div className="gift-pair" aria-hidden="true">
      <div ref={giftRef} className="mystery-gift primary-gift">
        <span ref={bodyRef} className="gift-bottom"><img className="gift-art gift-body-art" src={artwork.body} alt="" /></span>
        <span ref={lidRef} className="gift-top"><img className="gift-art gift-cap-art" src={artwork.cap} alt="" /></span>
      </div>
      <div ref={secondGiftRef} className="mystery-gift secondary-gift">
        <span ref={secondBodyRef} className="gift-bottom"><img className="gift-art gift-body-art" src={artwork.body} alt="" /></span>
        <span ref={secondLidRef} className="gift-top"><img className="gift-art gift-cap-art" src={artwork.cap} alt="" /></span>
      </div>
    </div>
    <div ref={resultRef} className={`result-card ${doubled ? 'double-result-card' : ''}`}><span>{doubled ? 'DOUBLE DROP' : `${outcome?.grade || 'LEGENDARY'} DROP`}</span>
      <strong>{doubled ? '상품 2개를 획득했습니다!' : '상품을 획득했습니다!'}</strong>
      <div className="result-products">{(outcome?.rewards?.length ? outcome.rewards : [{ assetId:'preview',productId:'preview',name:'프리미엄 리빙 컬렉션',value:124000,consumerPrice:124000,level:1,levelName:'NORMAL',color:'#fff',imageUrl:null }]).map((reward) => <article key={reward.assetId}>
        <div className="result-product-image">{reward.imageUrl ? <img src={reward.imageUrl} alt={reward.name}/> : <Gift size={34}/>}</div>
        <div><b>{reward.name}</b><small>소비자가 {(reward.consumerPrice || reward.value).toLocaleString('ko-KR')}원</small></div>
      </article>)}</div>
      <small className="result-summary">{doubled ? '두 상품이 인벤토리에 안전하게 보관되었습니다.' : `${animatedLevelUpCount}회 연출 레벨업 · 인벤토리에 안전하게 보관되었습니다.`}</small><em>결과 ID · {outcome?.openingId || boxId.toUpperCase()}</em>
      <div className="result-actions" onClick={(event) => event.stopPropagation()}>
        {sequential ? <button className="primary sequential-continue" type="button" onClick={onContinue} disabled={continuePending}>
          {continuePending ? '다음 박스를 준비하고 있습니다' : remainingCount > 0 ? '계속' : '결과 확인'} <ArrowRight size={14}/>
        </button> : <><Link className="primary" to="/inventory"><PackageOpen size={15}/> 인벤토리 보기 <ArrowRight size={14}/></Link>
          <Link to="/shop"><ShoppingBag size={15}/> 랜덤박스 가기</Link></>}
      </div></div>
    {!opened && <div className="reveal-guide"><div className="level-chip"><i/> {doubled ? 'DOUBLE · L0' : `LEVEL ${level} · ${current.name}`}</div>
      {doubled && <b className="double-chip">DOUBLE 확정 · 업그레이드 종료</b>}
      <strong>{transitioning ? (doubled ? '두 상자가 폭발을 준비합니다' : '눈부신 빛 속에서 결과를 확인하는 중') : doubled ? `${3 - stepClicks}번 더 터치하면 두 상자 동시 개봉` : clicks === 0 ? '선물상자를 깨워보세요' : stepClicks < 3 ? `${3 - stepClicks}번 더 터치하면 등급 판정` : '다음 등급으로 진화 중'}</strong>
      <div className="click-meter">{[1,2,3].map((dot) => <i key={dot} className={dot <= stepClicks ? 'active' : ''}/>)}</div>
      <span>화면을 클릭하거나 Enter 키를 누르세요</span></div>}
    <div className="stage-tools" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <label className="quality-control"><span>연출 품질</span><select aria-label="연출 품질" value={qualityChoice} onChange={(event) => {
        const nextQuality = event.target.value as QualityChoice;
        setQualityChoice(nextQuality);
        if (nextQuality === 'auto') {
          window.localStorage.removeItem('random-drop-reveal-quality');
          setAutoQuality(loadAutoQuality());
        }
        else window.localStorage.setItem('random-drop-reveal-quality', nextQuality);
      }}><option value="auto">자동 ({resolvedQuality === 'ultra' ? '초저사양' : resolvedQuality === 'low' ? '저사양' : resolvedQuality === 'balanced' ? '일반' : '고화질'})</option><option value="high">고화질</option><option value="balanced">일반</option><option value="low">저사양</option><option value="ultra">초저사양</option></select></label>
      <button onClick={() => setMuted(!muted)} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
    </div>
    {sequential && !opened && <div className="remaining-box-counter"><span>남은 박스</span><b>{remainingCount}</b></div>}
    <span className="preview-label">GSAP NATIVE WEB REVEAL</span>
  </div>;
}
