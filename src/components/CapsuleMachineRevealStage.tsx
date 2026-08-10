import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import AlternativeRevealResult, {
  ALTERNATIVE_RESULT_COPY,
  getAlternativeResultKind,
} from './AlternativeRevealResult';
import capsuleBottom from '../assets/capsule/capsule-bottom.png';
import capsuleImage from '../assets/capsule/capsule.png';
import capsuleTop from '../assets/capsule/capsule-top.png';
import machineBody from '../assets/capsule/machine-body.png';
import machineExitBack from '../assets/capsule/machine-exit-back.png';
import machineExitFront from '../assets/capsule/machine-exit-front.png';
import machineGlass from '../assets/capsule/machine-glass.png';
import machineInnerBack from '../assets/capsule/machine-inner-back.png';
import machineLever from '../assets/capsule/machine-lever.png';
import clickSound from '../assets/click.wav';
import lightSound from '../assets/light.mp4';
import openSound from '../assets/open.wav';
import RevealFxLayer, { type RevealFxHandle } from '../effects/RevealFxLayer';
import {
  AUTO_QUALITY_CHANGE_EVENT,
  loadAutoQuality,
  type ResolvedQuality,
} from '../services/revealQuality';

gsap.registerPlugin(useGSAP);

type CapsuleMachineRevealStageProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

const CHAMBER_CAPSULES = [
  { radiusX: 76, radiusY: 48, duration: 3.05, phase: .15, direction: 1, spinDuration: .82, spinDirection: 1, scale: .82 },
  { radiusX: 91, radiusY: 63, duration: 4.35, phase: 1.2, direction: -1, spinDuration: 1.18, spinDirection: -1, scale: .7 },
  { radiusX: 61, radiusY: 82, duration: 3.75, phase: 2.35, direction: 1, spinDuration: .68, spinDirection: -1, scale: .76 },
  { radiusX: 103, radiusY: 41, duration: 4.8, phase: 3.45, direction: -1, spinDuration: 1.34, spinDirection: 1, scale: .65 },
  { radiusX: 48, radiusY: 69, duration: 2.85, phase: 4.1, direction: 1, spinDuration: .94, spinDirection: -1, scale: .88 },
  { radiusX: 86, radiusY: 76, duration: 5.1, phase: 5.25, direction: -1, spinDuration: .73, spinDirection: 1, scale: .68 },
  { radiusX: 70, radiusY: 57, duration: 3.45, phase: 5.8, direction: 1, spinDuration: 1.42, spinDirection: 1, scale: .74 },
  { radiusX: 98, radiusY: 88, duration: 5.55, phase: 2.8, direction: -1, spinDuration: 1.05, spinDirection: -1, scale: .62 },
] as const;

export default function CapsuleMachineRevealStage({
  boxId,
  outcome,
  onFinished,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: CapsuleMachineRevealStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const leverRef = useRef<HTMLImageElement>(null);
  const whiteoutRef = useRef<HTMLDivElement>(null);
  const leverParticleLayerRef = useRef<HTMLDivElement>(null);
  const openParticleLayerRef = useRef<HTMLDivElement>(null);
  const chamberOrbitTweensRef = useRef<gsap.core.Tween[]>([]);
  const chamberSpinTweensRef = useRef<gsap.core.Tween[]>([]);
  const prizeGroupRef = useRef<HTMLDivElement>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const fxRef = useRef<RevealFxHandle>(null);
  const runningRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState<ResolvedQuality>(() => loadAutoQuality());
  const kind = getAlternativeResultKind(outcome);
  const copy = ALTERNATIVE_RESULT_COPY[kind];
  const rewards = useMemo(() => outcome?.rewards?.length
    ? outcome.rewards
    : [{
      assetId: 'capsule-preview',
      productId: 'capsule-preview-product',
      name: kind === 'jackpot' ? '잭팟 프리미엄 상품' : '캡슐 샘플 상품',
      value: kind === 'jackpot' ? 3500000 : 12000,
      consumerPrice: kind === 'jackpot' ? 3500000 : 12000,
      level: kind === 'jackpot' ? 3 : 1,
      levelName: copy.label,
      color: copy.color,
      imageUrl: null,
    }],
  [copy.color, copy.label, kind, outcome]);
  const prizeRewards = kind === 'double' && rewards.length === 1
    ? [rewards[0], { ...rewards[0], assetId: `${rewards[0].assetId}-double` }]
    : rewards.slice(0, kind === 'double' ? 2 : 1);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (!audio || audio.muted) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  useEffect(() => {
    const handleQualityChange = (event: Event) => {
      setQuality((event as CustomEvent<ResolvedQuality>).detail);
    };
    window.addEventListener(AUTO_QUALITY_CHANGE_EVENT, handleQualityChange);
    return () => window.removeEventListener(AUTO_QUALITY_CHANGE_EVENT, handleQualityChange);
  }, []);

  useGSAP(() => {
    stageRef.current?.classList.remove('is-result-charging');
    gsap.set(prizeGroupRef.current, { autoAlpha: 0, top: '76%', y: 0, scale: .28 });
    gsap.set(resultCardRef.current, { autoAlpha: 0, y: 34, scale: .92 });
    gsap.set('.capsule-prize-top', { y: 0, rotation: 0 });
    gsap.set('.capsule-prize-bottom', { y: 0 });
    gsap.set('.capsule-prize-aura, .capsule-prize-seam, .capsule-seam-electric, .capsule-seam-electric i, .capsule-lever-colorwash, .capsule-open-wave, .capsule-open-spark, .capsule-mix-particle, .capsule-reveal-flare, .capsule-chamber-strobe', {
      autoAlpha: 0,
    });
    gsap.set('.capsule-seam-electric i', { scaleX: .12, transformOrigin: '0 50%' });
    gsap.set('.capsule-prize-unit', { filter: 'brightness(1)' });
    gsap.set(whiteoutRef.current, { autoAlpha: 0 });
    gsap.set(leverParticleLayerRef.current?.querySelectorAll('i') || [], { autoAlpha: 0, scale: .15 });
    gsap.set(openParticleLayerRef.current?.querySelectorAll('i') || [], { autoAlpha: 0, scale: .15 });
    gsap.set('.capsule-open-wave', { scale: .15 });
    gsap.set('.capsule-open-spark', { scale: .2 });
    gsap.set('.capsule-prize-product', {
      autoAlpha: 0,
      scale: .22,
      filter: 'brightness(0) saturate(1.6)',
    });
    gsap.set(leverRef.current, {
      transformOrigin: '51.5% 60.5%',
    });
    const orbitTargets = gsap.utils.toArray<HTMLElement>('.chamber-capsule-orbit');
    chamberOrbitTweensRef.current = orbitTargets.map((element, index) => {
      const config = CHAMBER_CAPSULES[index];
      const points = Array.from({ length: 17 }, (_, step) => {
        const progress = step / 16;
        const angle = config.phase + progress * Math.PI * 2 * config.direction;
        return {
          x: Math.cos(angle) * config.radiusX + Math.sin(angle * 2 + index) * 6,
          y: Math.sin(angle) * config.radiusY + Math.cos(angle * 3 + index * .7) * 5,
        };
      });
      gsap.set(element, {
        xPercent: -50,
        yPercent: -50,
        x: points[0].x,
        y: points[0].y,
        scale: config.scale,
      });
      return gsap.to(element, {
        keyframes: points.slice(1).map(point => ({
          x: point.x,
          y: point.y,
          ease: 'none',
        })),
        duration: config.duration,
        repeat: -1,
        ease: 'none',
      });
    });
    chamberSpinTweensRef.current = gsap.utils
      .toArray<HTMLElement>('.chamber-capsule-image')
      .map((image, index) => {
        const config = CHAMBER_CAPSULES[index];
        gsap.set(image, {
          rotation: (index % 5 - 2) * 8,
        });
        return gsap.to(image, {
          rotation: `${config.spinDirection > 0 ? '+=' : '-='}${34 + index % 4 * 7}`,
          duration: config.spinDuration,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });
    gsap.to('.capsule-machine-glass', {
      filter: 'brightness(1.45) drop-shadow(0 0 16px rgba(92,224,255,.7))',
      duration: 1.15,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }, { scope: stageRef });

  useEffect(() => () => {
    gsap.killTweensOf(stageRef.current?.querySelectorAll('*') || []);
    gsap.killTweensOf(whiteoutRef.current);
    gsap.killTweensOf(leverParticleLayerRef.current?.querySelectorAll('i') || []);
    gsap.killTweensOf(openParticleLayerRef.current?.querySelectorAll('i') || []);
  }, []);

  const startMachine = () => {
    if (runningRef.current || revealed) return;
    runningRef.current = true;
    setStarted(true);
    playSound(clickAudioRef.current);
    const timeline = gsap.timeline({
      onComplete: () => {
        runningRef.current = false;
        setRevealed(true);
        onFinished?.();
      },
    });
    const leverParticles = leverParticleLayerRef.current?.querySelectorAll('i') || [];
    const openParticles = openParticleLayerRef.current?.querySelectorAll('i') || [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    timeline
      .fromTo(leverParticles, {
        autoAlpha: 0,
        x: 0,
        y: 0,
        scale: .15,
      }, {
        keyframes: [
          { autoAlpha: 1, duration: .1 },
          { autoAlpha: .92, duration: .42 },
          { autoAlpha: 0, duration: .56 },
        ],
        x: (index) => ((((index * 47) % 101) / 100) - .5) * viewportWidth * 1.12,
        y: (index) => ((((index * 73) % 101) / 100) - .5) * viewportHeight * 1.12,
        rotation: (index) => index * 83,
        scale: (index) => .7 + index % 5 * .24,
        duration: 1.08,
        stagger: .004,
        ease: 'power3.out',
      }, .04)
      .to('.capsule-click-ring', {
        autoAlpha: 0,
        scale: 4.2,
        duration: .72,
        stagger: .08,
        ease: 'power2.out',
      }, 0)
      .fromTo('.capsule-mix-particle', {
        autoAlpha: 0,
        x: 0,
        y: 0,
        scale: .15,
      }, {
        autoAlpha: 0,
        x: (index) => Math.cos(index * 2.17) * (62 + index % 6 * 12),
        y: (index) => Math.sin(index * 2.17) * (54 + index % 5 * 11),
        rotation: (index) => index * 67,
        scale: (index) => .65 + index % 4 * .28,
        duration: .92,
        stagger: .018,
        ease: 'power3.out',
        keyframes: [
          { autoAlpha: 1, duration: .12 },
          { autoAlpha: .9, duration: .35 },
          { autoAlpha: 0, duration: .45 },
        ],
      }, .12)
      .to(leverRef.current, {
        rotation: 76,
        duration: .22,
        transformOrigin: '51.5% 60.5%',
        ease: 'power3.in',
      }, 0)
      .to(leverRef.current, {
        rotation: 0,
        duration: .48,
        ease: 'elastic.out(1,.42)',
      })
      .fromTo('.capsule-lever-colorwash', {
        autoAlpha: 0,
        scale: 1.28,
        rotation: -12,
        filter: 'hue-rotate(0deg) brightness(1.25) saturate(1.2)',
      }, {
        autoAlpha: .86,
        scale: 1.28,
        rotation: 32,
        filter: 'hue-rotate(165deg) brightness(2.05) saturate(1.55)',
        duration: .24,
        repeat: 11,
        yoyo: true,
        ease: 'sine.inOut',
      }, .16)
      .to('.capsule-lever-colorwash', {
        autoAlpha: 0,
        scale: 1.28,
        filter: 'hue-rotate(280deg) brightness(1.55) saturate(1.35)',
        duration: .58,
        ease: 'power2.out',
      }, 3.08)
      .to(machineRef.current, {
        rotation: .9,
        scaleX: 1.025,
        scaleY: .975,
        duration: .07,
        repeat: 20,
        yoyo: true,
        ease: 'power1.inOut',
      }, .62)
      .call(() => {
        chamberOrbitTweensRef.current.forEach(tween => {
          gsap.to(tween, { timeScale: 6.2, duration: 2.05, ease: 'power3.in' });
        });
        chamberSpinTweensRef.current.forEach(tween => {
          gsap.to(tween, { timeScale: 7.1, duration: 2.05, ease: 'power3.in' });
        });
      }, undefined, .42)
      .fromTo('.capsule-chamber-strobe', {
        autoAlpha: 0,
        scale: .72,
      }, {
        autoAlpha: .92,
        scale: 1.15,
        duration: .16,
        repeat: 23,
        yoyo: true,
        ease: 'power2.inOut',
      }, .78)
      .to('.chamber-capsule-image', {
        scale: 1.1,
        filter: 'brightness(1.72) saturate(1.5) drop-shadow(0 0 15px rgba(106,241,255,1))',
        duration: .2,
        repeat: 15,
        yoyo: true,
        stagger: .018,
        ease: 'power2.inOut',
      }, .86)
      .call(() => {
        chamberOrbitTweensRef.current.forEach(tween => {
          gsap.to(tween, { timeScale: .08, duration: 2.35, ease: 'power4.out' });
        });
        chamberSpinTweensRef.current.forEach(tween => {
          gsap.to(tween, { timeScale: .08, duration: 2.35, ease: 'power4.out' });
        });
      }, undefined, 3.05)
      .fromTo('.capsule-machine-exit-front', {
        filter: 'brightness(1) saturate(1)',
      }, {
        filter: 'brightness(2.35) saturate(1.5) drop-shadow(0 0 16px #fff) drop-shadow(0 0 34px #72f3ff)',
        duration: .3,
        repeat: 3,
        yoyo: true,
        ease: 'sine.inOut',
      }, 4.18)
      .to('.capsule-machine-exit-front', {
        filter: 'brightness(1) saturate(1)',
        duration: .28,
        ease: 'power2.out',
      }, 5.4)
      .call(() => {
        chamberOrbitTweensRef.current.forEach(tween => tween.timeScale(0));
        chamberSpinTweensRef.current.forEach(tween => tween.timeScale(0));
      }, undefined, 5.38)
      .to('.capsule-chamber-strobe', {
        autoAlpha: 0,
        scale: 1.35,
        duration: .72,
        ease: 'power2.out',
      }, 5.02)
      .to(prizeGroupRef.current, {
        autoAlpha: 1,
        top: '72%',
        y: 0,
        scale: .76,
        duration: .62,
        ease: 'back.out(1.65)',
      }, 5.4)
      .to(prizeGroupRef.current, {
        top: '50%',
        y: 0,
        scale: prizeRewards.length > 1 ? 1.76 : 2.08,
        duration: 1.08,
        ease: 'power3.out',
      }, 5.95)
      .to('.capsule-prize-aura', {
        autoAlpha: .52,
        scale: 1.18,
        rotation: '+=38',
        duration: 1.35,
        ease: 'power2.out',
      }, 6.18)
      .call(() => stageRef.current?.classList.add('is-result-charging'), undefined, 6.38)
      .to(prizeGroupRef.current, {
        x: 5,
        rotation: 1.25,
        scaleX: prizeRewards.length > 1 ? 1.82 : 2.16,
        scaleY: prizeRewards.length > 1 ? 1.7 : 2,
        duration: .055,
        repeat: 22,
        yoyo: true,
        ease: 'none',
      }, 6.82)
      .to('.capsule-prize-unit', {
        filter: 'brightness(1.52) saturate(1.18) drop-shadow(0 0 14px #fff) drop-shadow(0 0 34px var(--alternative-color))',
        duration: 1.78,
        ease: 'power2.in',
      }, 6.42)
      .fromTo('.capsule-prize-seam', {
        autoAlpha: 0,
        scaleX: .12,
        scaleY: .72,
        filter: 'brightness(1.2) blur(1.2px)',
      }, {
        autoAlpha: 1,
        scaleX: 1.36,
        scaleY: 1,
        filter: 'brightness(2.2) blur(.35px)',
        duration: 1.5,
        ease: 'power3.in',
      }, 6.55)
      .fromTo('.capsule-seam-electric', {
        autoAlpha: 0,
        scale: .58,
      }, {
        autoAlpha: 1,
        scale: 1,
        duration: .24,
        ease: 'power3.out',
      }, 6.58)
      .fromTo('.capsule-seam-electric i', {
        autoAlpha: 0,
        scaleX: .08,
      }, {
        keyframes: [
          { autoAlpha: 1, scaleX: .55, duration: .09 },
          { autoAlpha: .24, scaleX: .82, duration: .08 },
          { autoAlpha: 1, scaleX: 1.08, duration: .11 },
          { autoAlpha: .34, scaleX: .78, duration: .08 },
          { autoAlpha: 1, scaleX: 1.22, duration: .12 },
        ],
        stagger: { each: .035, from: 'random' },
        repeat: 3,
        repeatRefresh: true,
        ease: 'none',
      }, 6.62)
      .call(() => {
        fxRef.current?.burst({
          color: copy.color,
          origin: [.5, .5],
          count: quality === 'high' ? 78 : quality === 'balanced' ? 54 : 30,
          speed: quality === 'high' ? 1.35 : .95,
          spread: 1,
          duration: 1.15,
        });
      }, undefined, 7.46)
      .to('.capsule-seam-electric', {
        autoAlpha: 0,
        scale: 1.36,
        duration: .56,
        ease: 'power3.in',
      }, 8.02)
      .call(() => playSound(lightAudioRef.current), undefined, 8.45)
      .to(whiteoutRef.current, {
        autoAlpha: 1,
        duration: .58,
        ease: 'power4.in',
      }, 8.45)
      .to(whiteoutRef.current, {
        autoAlpha: 1,
        duration: .82,
      }, 9.03)
      .to('.capsule-open-wave', {
        autoAlpha: 0,
        scale: 4.4,
        duration: .9,
        stagger: .09,
        ease: 'power3.out',
      }, 9.34)
      .fromTo(openParticles, {
        autoAlpha: 0,
        x: 0,
        y: 0,
        scale: .18,
      }, {
        keyframes: [
          { autoAlpha: 1, duration: .1 },
          { autoAlpha: 1, duration: .48 },
          { autoAlpha: 0, duration: .78 },
        ],
        x: (index) => ((((index * 71) % 149) / 148) - .5) * viewportWidth * 1.18,
        y: (index) => ((((index * 43) % 151) / 150) - .5) * viewportHeight * 1.16,
        rotation: (index) => index * 101,
        scale: (index) => .76 + index % 6 * .27,
        duration: 1.36,
        stagger: .003,
        ease: 'power3.out',
      }, 9.28)
      .call(() => playSound(openAudioRef.current), undefined, 9.06)
      .to('.capsule-prize-seam, .capsule-prize-aura', {
        autoAlpha: 0,
        duration: .16,
        ease: 'power2.out',
      }, 9.06)
      .to('.capsule-prize-top', {
        y: -98,
        x: (index) => index % 2 ? 22 : -22,
        rotation: (index) => index % 2 ? 22 : -22,
        duration: .52,
        ease: 'back.out(1.75)',
      }, 9.06)
      .to('.capsule-prize-bottom', {
        y: 38,
        scaleX: 1.08,
        duration: .46,
        ease: 'back.out(1.55)',
      }, 9.06)
      .to('.capsule-prize-product', {
        autoAlpha: 1,
        scale: 1,
        filter: 'brightness(0) saturate(1.6)',
        duration: .42,
        ease: 'back.out(2.1)',
      }, 9.1)
      .to('.capsule-reveal-flare', {
        autoAlpha: 1,
        scale: 1.45,
        duration: .45,
        ease: 'power3.out',
      }, 9.18)
      .to(whiteoutRef.current, {
        autoAlpha: 0,
        duration: .86,
        ease: 'power2.out',
      }, 9.62)
      .to('.capsule-prize-product', {
        filter: 'brightness(1) saturate(1)',
        scale: 1.08,
        duration: .62,
        ease: 'power2.out',
      }, 9.72)
      .fromTo('.capsule-open-spark', {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: .25,
      }, {
        autoAlpha: 0,
        x: (index) => Math.cos(index * 1.87) * (120 + index % 7 * 32),
        y: (index) => Math.sin(index * 1.87) * (105 + index % 5 * 31),
        rotation: (index) => index * 79,
        scale: (index) => .8 + index % 4 * .42,
        duration: 1.15,
        stagger: .012,
        ease: 'power3.out',
      }, 9.34)
      .to('.capsule-reveal-flare', {
        autoAlpha: 0,
        scale: 2,
        duration: .78,
        ease: 'power2.out',
      }, 9.82)
      .to(resultCardRef.current, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: .48,
        ease: 'back.out(1.5)',
      }, 10.72);
  };

  return <>
  {createPortal(<>
    <div
      ref={whiteoutRef}
      className="capsule-whiteout"
      style={{ '--capsule-result-color': copy.color } as React.CSSProperties}
      aria-hidden="true"
    />
    <div ref={leverParticleLayerRef} className="capsule-screen-particles capsule-lever-particles" aria-hidden="true">
      {Array.from({ length: 72 }, (_, index) => <i
        key={index}
        style={{ '--particle-color': ['#ffffff', '#70f4ff', '#ffe56c', '#ff77c8'][index % 4] } as React.CSSProperties}
      />)}
    </div>
    <div ref={openParticleLayerRef} className="capsule-screen-particles capsule-open-fireworks" aria-hidden="true">
      {Array.from({ length: 150 }, (_, index) => <i
        key={index}
        style={{ '--particle-color': [copy.color, '#ffffff', '#ffe55e', '#6ff4ff', '#ff75c8'][index % 5] } as React.CSSProperties}
      />)}
    </div>
  </>, document.body)}
  <div
    ref={stageRef}
    className={`preview-stage alternative-reveal-stage capsule-reveal-stage result-${kind} ${started ? 'is-running' : ''} ${revealed ? 'is-revealed' : ''}`}
    style={{ '--capsule-result-color': copy.color } as React.CSSProperties}
    onClick={startMachine}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') startMachine();
    }}
    role="button"
    tabIndex={0}
    aria-label={revealed ? '캡슐 머신 개봉 결과' : '캡슐 머신을 작동하려면 화면을 누르세요'}
  >
    <audio ref={clickAudioRef} src={clickSound} preload="auto" muted={muted}/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto" muted={muted}/>
    <audio ref={openAudioRef} src={openSound} preload="auto" muted={muted}/>
    <div className="alternative-stage-ambient" aria-hidden="true"/>
    <RevealFxLayer ref={fxRef} quality={quality}/>
    <div className="capsule-lever-colorwash" aria-hidden="true"/>
    <div className="alternative-stage-flash" aria-hidden="true"/>
    <div className="capsule-open-effects" aria-hidden="true">
      <i className="capsule-reveal-flare"/>
      {Array.from({ length: 5 }, (_, index) => <i className="capsule-open-wave" key={`wave-${index}`}/>)}
      {Array.from({ length: 28 }, (_, index) => <i
        className="capsule-open-spark"
        key={`spark-${index}`}
        style={{ '--spark-color': ['#ffffff', '#72f6ff', '#ffe36a', '#ff70bd'][index % 4] } as React.CSSProperties}
      />)}
    </div>
    <div className="capsule-click-rings" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <i className="capsule-click-ring" key={index}/>)}
    </div>
    <div ref={machineRef} className="capsule-machine-shell" aria-hidden="true">
      <img className="capsule-art capsule-machine-inner" src={machineInnerBack} alt=""/>
      <div className="capsule-chamber">
        <div className="capsule-chamber-strobe" aria-hidden="true"/>
        <div className="capsule-chamber-energy" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => <i key={index}/>)}
        </div>
        <div className="capsule-chamber-sparkles" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => <i
            key={index}
            style={{
              '--spark-x': `${11 + (index * 31) % 78}%`,
              '--spark-y': `${9 + (index * 47) % 80}%`,
              '--spark-delay': `${-(index % 8) * .21}s`,
              '--spark-duration': `${.72 + index % 5 * .17}s`,
            } as React.CSSProperties}
          />)}
        </div>
        <div className="capsule-mix-particles" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => <i
            className="capsule-mix-particle"
            key={index}
            style={{ '--mix-color': ['#ffffff', '#75f2ff', '#ffe36d', '#ff7fca'][index % 4] } as React.CSSProperties}
          />)}
        </div>
        {CHAMBER_CAPSULES.map((_, index) => <span
          className="chamber-capsule-orbit"
          key={index}
          style={{
            zIndex: index % 3 + 1,
          } as React.CSSProperties}
        >
          <img
            className="chamber-capsule-image"
            src={capsuleImage}
            alt=""
          />
        </span>)}
      </div>
      <img className="capsule-art capsule-machine-glass" src={machineGlass} alt=""/>
      <img className="capsule-art capsule-machine-body" src={machineBody} alt=""/>
      <img className="capsule-art capsule-machine-exit-back" src={machineExitBack} alt=""/>
      <img className="capsule-art capsule-machine-exit-front" src={machineExitFront} alt=""/>
      <img ref={leverRef} className="capsule-art capsule-machine-lever" src={machineLever} alt=""/>
    </div>
    <div ref={prizeGroupRef} className={`capsule-prize-group count-${prizeRewards.length}`} aria-hidden="true">
      {prizeRewards.map((reward, index) => <div className="capsule-prize-unit" key={reward.assetId}>
        <i className="capsule-prize-aura"/>
        <span className="capsule-seam-electric">
          {Array.from({ length: 14 }, (_, arcIndex) => <i
            key={arcIndex}
            style={{
              '--arc-angle': `${arcIndex * 25.7 + (arcIndex % 2 ? 8 : -6)}deg`,
              '--arc-length': `${92 + arcIndex % 5 * 22}px`,
              '--arc-bend': `${arcIndex % 2 ? 1 : -1}`,
            } as React.CSSProperties}
          />)}
        </span>
        <i className="capsule-prize-seam"/>
        <img className="capsule-prize-part capsule-prize-bottom" src={capsuleBottom} alt=""/>
        <div className="capsule-prize-product">
          {reward.imageUrl
            ? <img src={reward.imageUrl} alt=""/>
            : <span>{kind === 'jackpot' ? '★' : kind === 'double' ? '×2' : '◆'}</span>}
        </div>
        <img className="capsule-prize-part capsule-prize-top" src={capsuleTop} alt=""/>
        {index === 0 && kind !== 'single' && <b>{copy.label}</b>}
      </div>)}
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
      <span>CAPSULE MACHINE</span>
      <strong>화면을 눌러 캡슐을 뽑아보세요!</strong>
      <small>한 번의 터치로 결과가 공개됩니다.</small>
    </div>}
    {started && !revealed && <div className="alternative-status"><i/><span>캡슐 추첨 중</span><i/></div>}
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
    {sequential && !revealed && <div className="remaining-box-counter"><span>남은 박스</span><b>{remainingCount}</b></div>}
    <span className="preview-label">GSAP CAPSULE MACHINE REVEAL</span>
  </div>
  </>;
}
