import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import AlternativeRevealResult, {
  getAlternativeResultKind,
} from './AlternativeRevealResult';
import machineBackground from '../assets/claw/claw-machine-background.png';
import machineFrontPanel from '../assets/claw/claw-machine-front-panel.png';
import clickSound from '../assets/click.wav';
import lightSound from '../assets/light.mp4';
import openSound from '../assets/open.wav';
import {
  AUTO_QUALITY_CHANGE_EVENT,
  loadAutoQuality,
  type ResolvedQuality,
} from '../services/revealQuality';
import type { CapsuleSeamFxEngine } from '../effects/CapsuleSeamFxEngine';

gsap.registerPlugin(useGSAP);

type ClawMachineRevealStageProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

type CapsuleFace = 'smile' | 'curious' | 'angry' | 'sleepy' | 'excited';

const CAPSULE_COLORS = [
  ['#ffe76c', '#ffad2f'], ['#ff8eae', '#ff477b'], ['#75e8ff', '#378cff'],
  ['#9ef2bc', '#36bd78'], ['#b9a0ff', '#7755e8'], ['#ffbb72', '#ff6946'],
] as const;
const FACES: CapsuleFace[] = ['smile', 'curious', 'angry', 'sleepy', 'excited'];
const MOBILE_CAPSULE_POSITIONS = [
  { left: 8, bottom: 1, rotation: -12, scale: .9 },
  { left: 29, bottom: 2, rotation: 9, scale: .96 },
  { left: 50, bottom: 0, rotation: -6, scale: .92 },
  { left: 71, bottom: 2, rotation: 12, scale: .98 },
  { left: 92, bottom: 1, rotation: -9, scale: .88 },
  { left: 17, bottom: 14, rotation: 10, scale: .91 },
  { left: 39, bottom: 13, rotation: -11, scale: .97 },
  { left: 61, bottom: 15, rotation: 7, scale: .9 },
  { left: 83, bottom: 13, rotation: -8, scale: .95 },
  { left: 29, bottom: 27, rotation: -7, scale: .93 },
  { left: 50, bottom: 26, rotation: 8, scale: 1 },
  { left: 71, bottom: 28, rotation: -10, scale: .92 },
] as const;

const capsuleLayout = Array.from({ length: 36 }, (_, index) => {
  const row = Math.floor(index / 9);
  const column = index % 9;
  return {
    id: index,
    left: 8.5 + column * 10.4 + (row % 2 ? 2.7 : -2.7),
    bottom: 4 + row * 11.4 + ((index * 7) % 5),
    rotation: ((index * 37) % 35) - 17,
    scale: .78 + ((index * 13) % 22) / 100,
    color: CAPSULE_COLORS[index % CAPSULE_COLORS.length],
    face: FACES[index % FACES.length],
  };
});

export default function ClawMachineRevealStage({
  boxId,
  outcome,
  onFinished,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: ClawMachineRevealStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const carriageRef = useRef<HTMLDivElement>(null);
  const cableRef = useRef<HTMLDivElement>(null);
  const clawHeadRef = useRef<HTMLDivElement>(null);
  const capturedRef = useRef<HTMLDivElement>(null);
  const prizeRef = useRef<HTMLDivElement>(null);
  const seamCanvasRef = useRef<HTMLCanvasElement>(null);
  const seamFxRef = useRef<CapsuleSeamFxEngine | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const leverTrackRef = useRef<HTMLDivElement>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const runningRef = useRef(false);
  const [clawPosition, setClawPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [started, setStarted] = useState(false);
  const [readyToOpen, setReadyToOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState<ResolvedQuality>(() => loadAutoQuality());
  const [compactViewport, setCompactViewport] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  const kind = getAlternativeResultKind(outcome);
  const visibleCapsules = compactViewport
    ? quality === 'high' ? 12 : quality === 'balanced' ? 11 : quality === 'low' ? 10 : 8
    : quality === 'high' ? 36 : quality === 'balanced' ? 29 : quality === 'low' ? 23 : 18;
  const particles = compactViewport
    ? quality === 'high' ? 24 : quality === 'balanced' ? 18 : quality === 'low' ? 12 : 8
    : quality === 'high' ? 52 : quality === 'balanced' ? 36 : quality === 'low' ? 24 : 14;
  const resultColor = kind === 'jackpot' ? '#ffd45a' : kind === 'level-up' ? '#ff4f63' : '#6cf2ff';
  const capsulePalette = kind === 'jackpot'
    ? { top: '#fff0a0', bottom: '#c77b08' }
    : kind === 'level-up'
      ? { top: '#ff8990', bottom: '#d12647' }
      : { top: '#8ae8ff', bottom: '#478dff' };
  const seamQuality: ResolvedQuality = compactViewport && (quality === 'high' || quality === 'balanced') ? 'low' : quality;
  const capsules = useMemo(
    () => compactViewport
      ? MOBILE_CAPSULE_POSITIONS.slice(0, visibleCapsules).map((position, index) => ({
        ...capsuleLayout[index],
        ...position,
      }))
      : capsuleLayout.slice(0, visibleCapsules),
    [compactViewport, visibleCapsules],
  );

  const playSound = (audio: HTMLAudioElement | null) => {
    if (!audio || muted) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  useEffect(() => {
    const handleQuality = (event: Event) => setQuality((event as CustomEvent<ResolvedQuality>).detail);
    window.addEventListener(AUTO_QUALITY_CHANGE_EVENT, handleQuality);
    return () => window.removeEventListener(AUTO_QUALITY_CHANGE_EVENT, handleQuality);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const handleViewport = (event: MediaQueryListEvent) => setCompactViewport(event.matches);
    media.addEventListener('change', handleViewport);
    return () => media.removeEventListener('change', handleViewport);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let engine: CapsuleSeamFxEngine | null = null;
    const canvas = seamCanvasRef.current;
    if (!canvas) return undefined;
    void import('../effects/CapsuleSeamFxEngine').then(({ CapsuleSeamFxEngine: Engine }) => {
      if (cancelled) return;
      engine = new Engine(canvas, seamQuality);
      seamFxRef.current = engine;
    });
    return () => {
      cancelled = true;
      engine?.dispose();
      if (seamFxRef.current === engine) seamFxRef.current = null;
    };
  }, [seamQuality]);

  useEffect(() => {
    seamFxRef.current?.setAmbient(false, resultColor);
  }, [kind, opening, readyToOpen, resultColor]);

  useGSAP(() => {
    gsap.set(cableRef.current, { height: 48 });
    gsap.set(clawHeadRef.current, { y: 0 });
    gsap.set(capturedRef.current, { autoAlpha: 0, scale: .62, y: 12 });
    gsap.set(prizeRef.current, { autoAlpha: 0, scale: .2, y: 40 });
    gsap.set(resultRef.current, { autoAlpha: 0, y: 30, scale: .94 });
    gsap.set(flashRef.current, { autoAlpha: 0, scale: .1 });
    gsap.set('.claw-result-rays, .claw-burst-particle, .claw-capsule-charge-glow', { autoAlpha: 0 });
    if (!compactViewport) {
      gsap.fromTo('.claw-scan-light', { xPercent: 0 }, {
        xPercent: 500,
        duration: 6.8,
        repeat: -1,
        repeatDelay: .25,
        ease: 'none',
      });
    }
    const animatedCapsules = gsap.utils.toArray<HTMLElement>('.claw-machine-capsule').slice(0, compactViewport ? 10 : visibleCapsules);
    gsap.to(animatedCapsules, {
      y: (index) => index % 2 ? -4 : 4,
      rotation: (index) => `+=${index % 2 ? 3 : -3}`,
      duration: (index) => 1.05 + index % 5 * .14,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: { each: .025, from: 'random' },
    });
    animatedCapsules.forEach((capsule) => {
      const eyes = capsule.querySelectorAll('.eye');
      gsap.to(eyes, {
        keyframes: [
          { scaleY: .08, duration: .07, ease: 'power2.in' },
          { scaleY: 1, duration: .09, delay: .045, ease: 'power2.out' },
        ],
        delay: gsap.utils.random(.15, 3.8),
        repeat: -1,
        repeatDelay: gsap.utils.random(1.25, 4.6),
        transformOrigin: '50% 50%',
      });
    });
    if (!compactViewport) {
      gsap.to('.claw-cabinet-glow', { opacity: .84, duration: 1.35, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }
  }, { scope: stageRef, dependencies: [compactViewport, visibleCapsules], revertOnUpdate: true });

  useEffect(() => () => {
    gsap.killTweensOf(stageRef.current?.querySelectorAll('*') || []);
  }, []);

  const updateLever = (clientX: number) => {
    if (!leverTrackRef.current || runningRef.current) return;
    const rect = leverTrackRef.current.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const next = 18 + progress * 64;
    setClawPosition(next);
  };

  const startReveal = () => {
    if (runningRef.current || revealed) return;
    runningRef.current = true;
    setStarted(true);
    playSound(clickAudioRef.current);
    const capsuleTargets = Array.from(stageRef.current?.querySelectorAll('.claw-machine-capsule') || [])
      .slice(0, compactViewport ? 12 : visibleCapsules);
    const stageHeight = stageRef.current?.clientHeight || window.innerHeight;
    const clawRect = clawHeadRef.current?.getBoundingClientRect();
    const carriageRect = carriageRef.current?.getBoundingClientRect();
    const targetRects = capsuleTargets
      .map((capsule) => capsule.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .sort((a, b) => {
        const carriageX = carriageRect ? carriageRect.left + carriageRect.width / 2 : window.innerWidth / 2;
        const aDistance = Math.abs(a.left + a.width / 2 - carriageX);
        const bDistance = Math.abs(b.left + b.width / 2 - carriageX);
        return aDistance - bDistance;
      })
      .slice(0, compactViewport ? 5 : 4);
    const targetRect = targetRects.sort((a, b) => b.top - a.top)[0];
    const measuredDrop = clawRect && targetRect
      ? targetRect.top + targetRect.height * (compactViewport ? 1.42 : .82) - clawRect.bottom
      : stageHeight * (compactViewport ? .5 : .46);
    const maximumDrop = compactViewport ? Math.min(330, stageHeight * .64) : 310;
    const dropDistance = Math.min(maximumDrop, Math.max(compactViewport ? 225 : 225, measuredDrop));
    const timeline = gsap.timeline({
      onComplete: () => {
        runningRef.current = false;
        setReadyToOpen(true);
      },
    });

    timeline
      .to('.claw-draw-button', { scale: .88, y: 5, filter: 'brightness(2)', duration: .12, ease: 'power2.in' }, 0)
      .to('.claw-draw-button', { scale: 1, y: 0, duration: .38, ease: 'back.out(2.4)' }, .12)
      .to(compactViewport ? carriageRef.current : '.claw-machine-frame', {
        x: compactViewport ? 2 : 3,
        duration: compactViewport ? .06 : .045,
        repeat: compactViewport ? 8 : 13,
        yoyo: true,
        ease: 'none',
      }, .08)
      .to('.claw-prong.left', { rotation: 38, duration: .42, ease: 'back.out(1.55)' }, .18)
      .to('.claw-prong.right', { rotation: -38, duration: .42, ease: 'back.out(1.55)' }, .18)
      .to('.claw-prong.center', { scaleY: 1.08, y: 5, duration: .42, ease: 'back.out(1.55)' }, .18)
      .to(cableRef.current, { height: 48 + dropDistance, duration: 2.05, ease: 'power1.inOut' }, .62)
      .to(clawHeadRef.current, { y: dropDistance, duration: 2.05, ease: 'power1.inOut' }, .62)
      .to(capsuleTargets, {
        x: (index) => (index % 3 - 1) * (8 + index % 5 * 2),
        y: (index) => 8 + index % 4 * 3,
        rotation: (index) => `+=${(index % 2 ? 1 : -1) * (8 + index % 7)}`,
        duration: .34,
        repeat: compactViewport ? 2 : 3,
        yoyo: true,
        stagger: { each: .006, from: 'center' },
        ease: 'power1.inOut',
      }, 2.16)
      .to('.claw-prong.left', { rotation: 13, duration: .58, ease: 'power3.in' }, 2.68)
      .to('.claw-prong.right', { rotation: -13, duration: .58, ease: 'power3.in' }, 2.68)
      .to('.claw-prong.center', { scaleY: .88, y: -1, duration: .58, ease: 'power3.in' }, 2.68)
      .to(capturedRef.current, { autoAlpha: 1, scale: .7, y: 1, duration: .32, ease: 'back.out(2)' }, 3.02)
      .to({}, { duration: .55 })
      .to(cableRef.current, { height: 48, duration: 1.65, ease: 'power2.inOut' }, 3.58)
      .to(clawHeadRef.current, { y: 0, duration: 1.65, ease: 'power2.inOut' }, 3.58)
      .to(carriageRef.current, { left: '50%', duration: .82, ease: 'power2.inOut' }, 5.23)
      .to(capturedRef.current, { autoAlpha: 0, scale: .4, duration: .18 }, 5.98)
      .to(prizeRef.current, { autoAlpha: 1, scale: 1, y: 0, duration: .72, ease: 'back.out(1.75)' }, 5.96);
  };

  const openPrize = () => {
    if (!readyToOpen || runningRef.current || revealed) return;
    runningRef.current = true;
    setReadyToOpen(false);
    setOpening(true);
    prizeRef.current?.blur();
    playSound(clickAudioRef.current);
    playSound(lightAudioRef.current);
    const burstTargets = stageRef.current?.querySelectorAll('.claw-burst-particle') || [];
    const stageWidth = stageRef.current?.clientWidth || window.innerWidth;
    const stageHeight = stageRef.current?.clientHeight || window.innerHeight;
    const timeline = gsap.timeline({
      onComplete: () => {
        runningRef.current = false;
        setOpening(false);
        setRevealed(true);
        onFinished?.();
      },
    });

    seamFxRef.current?.charge({ color: resultColor, duration: 2.04 });

    timeline
      .to('.claw-prize-capsule > .mouth', { scaleX: 1.22, scaleY: .82, duration: .22, ease: 'back.out(2)' }, 0)
      .to(prizeRef.current, { scale: .94, duration: .34, ease: 'power1.in' }, .08)
      .to(prizeRef.current, { scale: .79, duration: .64, ease: 'power3.in' }, .42)
      .to(prizeRef.current, { x: 3, rotation: .8, duration: .052, repeat: 29, yoyo: true, ease: 'none' }, .58)
      .to(prizeRef.current, {
        keyframes: [
          { scaleX: .84, scaleY: .75, duration: .12 },
          { scaleX: .75, scaleY: .84, duration: .1 },
          { scaleX: .86, scaleY: .73, duration: .09 },
          { scaleX: .76, scaleY: .83, duration: .08 },
          { scaleX: .84, scaleY: .76, duration: .07 },
        ],
        repeat: 2,
        yoyo: true,
        ease: 'sine.inOut',
      }, .88)
      .fromTo('.claw-capsule-charge-glow', { autoAlpha: 0, scale: .88 }, {
        autoAlpha: .94,
        scale: 1.12,
        duration: 1.9,
        ease: 'power2.in',
      }, .16)
      .fromTo('.claw-prize-seam', { opacity: .06, scaleX: .3, filter: 'brightness(1)' }, {
        opacity: .3, scaleX: 1, filter: 'brightness(1.45)', duration: 1.46, ease: 'power3.in',
      }, .28)
      .to(flashRef.current, { autoAlpha: 1, scale: 8, duration: .72, ease: 'power4.in' }, 1.42)
      .call(() => playSound(openAudioRef.current), undefined, 2.08)
      .to(prizeRef.current, { x: 0, rotation: 0, scaleX: 1.16, scaleY: .9, duration: .1, ease: 'power4.out' }, 2.03)
      .to(prizeRef.current, { scaleX: 1, scaleY: 1, duration: .3, ease: 'elastic.out(1.1,.5)' }, 2.13)
      .to('.claw-prize-top', { y: -136, x: -38, rotation: -31, scale: 1.06, duration: .56, ease: 'back.out(2.35)' }, 2.07)
      .to('.claw-prize-bottom', { y: 46, scaleX: 1.09, scaleY: .9, duration: .5, ease: 'back.out(2)' }, 2.07)
      .fromTo(burstTargets, { autoAlpha: 0, x: 0, y: 0, scale: .2 }, {
        keyframes: [{ autoAlpha: 1, duration: .1 }, { autoAlpha: .9, duration: .32 }, { autoAlpha: 0, duration: .7 }],
        x: (index) => ((((index * 53) % 101) / 100) - .5) * stageWidth * 1.06,
        y: (index) => ((((index * 71) % 103) / 102) - .5) * stageHeight * 1.05,
        rotation: (index) => index * 91,
        scale: (index) => .7 + index % 5 * .24,
        duration: 1.12,
        stagger: .004,
        ease: 'power3.out',
      }, 2.09)
      .to('.claw-capsule-charge-glow', { autoAlpha: 0, scale: 1.24, duration: .28, ease: 'power2.out' }, 2.09)
      .to(flashRef.current, { autoAlpha: 0, duration: .7, ease: 'power2.out' }, 2.48)
      .to(prizeRef.current, { autoAlpha: .18, scale: 1.12, duration: .38 }, 2.72)
      .to(resultRef.current, { autoAlpha: 1, y: 0, scale: 1, duration: .56, ease: 'back.out(1.6)' }, 2.7);
  };

  const resultClass = kind === 'level-up' ? 'level-up' : kind;

  return <div
    ref={stageRef}
    className={`preview-stage alternative-reveal-stage claw-reveal-stage quality-${quality} result-${resultClass}${started ? ' is-started' : ''}${readyToOpen ? ' is-awaiting-open' : ''}${opening ? ' is-opening' : ''}${revealed ? ' is-revealed' : ''}`}
    style={{
      '--claw-result-color': resultColor,
      '--claw-capsule-top': capsulePalette.top,
      '--claw-capsule-bottom': capsulePalette.bottom,
    } as React.CSSProperties}
  >
    <div className="claw-machine-frame">
      <img className="claw-machine-background" src={machineBackground} alt="네온 캡슐 뽑기 기계"/>
      <div className="claw-cabinet-glow"/>
      <div className="claw-scan-light"/>
      <div className="claw-capsule-pile" aria-hidden="true">
        {capsules.map((capsule) => <div
          key={capsule.id}
          className={`claw-machine-capsule face-${capsule.face}`}
          style={{
            left: `${capsule.left}%`, bottom: `${capsule.bottom}%`,
            rotate: `${capsule.rotation}deg`, scale: capsule.scale,
            '--capsule-top': capsule.color[0], '--capsule-bottom': capsule.color[1],
          } as React.CSSProperties}
        >
          <i className="capsule-shine"/><span className="eye left"/><span className="eye right"/><span className="mouth"/>
        </div>)}
      </div>
      <img className="claw-machine-foreground" src={machineFrontPanel} alt="" aria-hidden="true"/>
      <div ref={carriageRef} className="claw-carriage" style={{ left: `${clawPosition}%` }} aria-hidden="true">
        <div className="claw-carriage-light"/>
        <div ref={cableRef} className="claw-cable"/>
        <div ref={clawHeadRef} className="claw-head">
          <div className="claw-joint"/><i className="claw-prong left"/><i className="claw-prong center"/><i className="claw-prong right"/>
          <div ref={capturedRef} className="claw-captured-capsule"><span className="eye left"/><span className="eye right"/><span className="mouth"/></div>
        </div>
      </div>
      <div className="claw-glass-reflection"/>
    </div>

    <div className="claw-focus-dimmer" aria-hidden="true"/>
    <canvas ref={seamCanvasRef} className="claw-seam-webgl" aria-hidden="true"/>

    <div className="claw-control-deck">
      <div
        ref={leverTrackRef}
        className={`claw-lever-track${dragging ? ' is-dragging' : ''}`}
        onPointerDown={(event) => { setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); updateLever(event.clientX); }}
        onPointerMove={(event) => { if (dragging) updateLever(event.clientX); }}
        onPointerUp={(event) => { setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => setDragging(false)}
        role="slider" aria-label="집게 좌우 이동" aria-valuemin={18} aria-valuemax={82} aria-valuenow={Math.round(clawPosition)} tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setClawPosition(value => Math.max(18, value - 5));
          if (event.key === 'ArrowRight') setClawPosition(value => Math.min(82, value + 5));
        }}
      >
        <div className="claw-joystick-base"/><div className="claw-lever-stick" style={{ '--joystick-tilt': `${(clawPosition - 50) / 32 * 20}deg` } as React.CSSProperties}><i/></div>
        <small>레버를 좌우로 움직이세요</small>
      </div>
      <button className="claw-draw-button" type="button" onClick={startReveal} disabled={started} aria-label="캡슐 뽑기 시작"><span>뽑기</span></button>
    </div>

    <div
      ref={prizeRef}
      className={`claw-prize-capsule${readyToOpen ? ' is-awaiting-open' : ''}${opening ? ' is-opening' : ''}`}
      role={readyToOpen ? 'button' : undefined}
      tabIndex={readyToOpen ? 0 : -1}
      aria-label={readyToOpen ? '당첨 캡슐 열기' : undefined}
      aria-hidden={!readyToOpen && !opening}
      onClick={openPrize}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openPrize(); }}
    >
      <div className="claw-result-rays"/>
      <div className="claw-capsule-charge-glow" aria-hidden="true"/>
      <div className="claw-prize-part claw-prize-top"><i/></div>
      <div className="claw-prize-part claw-prize-bottom"/>
      <div className="claw-prize-seam"/>
      <span className="eye left"/><span className="eye right"/><span className="mouth"/>
    </div>
    <div className="claw-burst-layer" aria-hidden="true">{Array.from({ length: particles }, (_, index) => <i key={index} className="claw-burst-particle"/>)}</div>
    <div ref={flashRef} className="claw-reveal-flash"/>

    <div ref={resultRef} className="alternative-reward-card claw-result-card" onClick={(event) => event.stopPropagation()}>
      <AlternativeRevealResult outcome={outcome} boxId={boxId} kind={kind} sequential={sequential} remainingCount={remainingCount} continuePending={continuePending} onContinue={onContinue}/>
    </div>
    {!started && <div className="claw-instruction"><b>집게를 옮기고 뽑기 버튼을 눌러보세요</b><span>귀여운 캡슐 하나가 선택됩니다.</span></div>}
    {readyToOpen && <div className="claw-instruction claw-open-instruction"><b>캡슐을 한 번 더 눌러보세요</b><span>캡슐 안의 상품이 곧 공개됩니다.</span></div>}
    <button className="alternative-sound-button" type="button" onClick={() => setMuted(value => !value)} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
    <audio ref={clickAudioRef} src={clickSound} preload="auto"/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto"/>
    <audio ref={openAudioRef} src={openSound} preload="auto"/>
  </div>;
}
