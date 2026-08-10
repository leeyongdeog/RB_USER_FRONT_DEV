import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import AlternativeRevealResult, {
  ALTERNATIVE_RESULT_COPY,
  getAlternativeResultKind,
} from './AlternativeRevealResult';
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

type MagicPortalRevealStageProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

export default function MagicPortalRevealStage({
  boxId,
  outcome,
  onFinished,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: MagicPortalRevealStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const leftCrackRef = useRef<HTMLDivElement>(null);
  const rightCrackRef = useRef<HTMLDivElement>(null);
  const productGroupRef = useRef<HTMLDivElement>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const fxRef = useRef<RevealFxHandle>(null);
  const webglReadyRef = useRef(false);
  const runningRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [quality, setQuality] = useState<ResolvedQuality>(() => loadAutoQuality());
  const kind = getAlternativeResultKind(outcome);
  const copy = ALTERNATIVE_RESULT_COPY[kind];
  const rewards = useMemo(() => outcome?.rewards?.length
    ? outcome.rewards
    : [{
      assetId: 'portal-preview',
      productId: 'portal-preview-product',
      name: kind === 'jackpot' ? '잭팟 프리미엄 상품' : '포털 소환 샘플 상품',
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
    gsap.set([leftCrackRef.current, rightCrackRef.current], { autoAlpha: 0 });
    gsap.set(productGroupRef.current, {
      autoAlpha: 0,
      scale: .15,
      y: 35,
      filter: 'brightness(0) saturate(1.8)',
    });
    gsap.set(resultCardRef.current, { autoAlpha: 0, y: 38, scale: .92 });
    gsap.set('.portal-core', {
      autoAlpha: 0,
      scale: .012,
      filter: 'brightness(.8) saturate(1)',
    });
    gsap.to('.portal-idle-particle', {
      x: 0,
      y: 0,
      scale: (index) => .45 + index % 3 * .3,
      autoAlpha: (index) => .35 + index % 4 * .15,
      duration: (index) => 1.7 + index % 6 * .22,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: .03,
    });
  }, { scope: stageRef });

  useEffect(() => () => {
    gsap.killTweensOf(stageRef.current?.querySelectorAll('*') || []);
  }, []);

  useEffect(() => {
    const handleQualityChange = (event: Event) => {
      setQuality((event as CustomEvent<ResolvedQuality>).detail);
    };
    window.addEventListener(AUTO_QUALITY_CHANGE_EVENT, handleQualityChange);
    return () => window.removeEventListener(AUTO_QUALITY_CHANGE_EVENT, handleQualityChange);
  }, []);

  const openPortal = () => {
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

    const revealStart = kind === 'jackpot' ? 4.65 : kind === 'double' || kind === 'level-up' ? 4.15 : 3.05;

    timeline.call(() => {
      fxRef.current?.energy({
        color: '#66e7ff',
        origin: [.5, .47],
        intensity: quality === 'high' ? 1.48 : quality === 'balanced' ? 1.16 : .72,
        duration: revealStart + .2,
        radius: .3,
      });
      fxRef.current?.pulse({
        color: '#a97cff',
        origin: [.5, .47],
        strength: .72,
        duration: .8,
        radius: .72,
      });
      fxRef.current?.burst({
        color: '#8feaff',
        origin: [.5, .47],
        count: quality === 'high' ? 92 : quality === 'balanced' ? 68 : 38,
        speed: 1.35,
        duration: 1.15,
        size: 11,
      });
    }, undefined, 0);

    timeline
      .to('.portal-idle-particle', {
        left: '50%',
        top: '48%',
        x: 0,
        y: 0,
        autoAlpha: 1,
        scale: .18,
        duration: .85,
        stagger: .012,
        ease: 'power3.in',
      }, .05)
      .to(portalRef.current, {
        scaleX: 1.06,
        scaleY: .94,
        duration: .12,
        repeat: 3,
        yoyo: true,
        ease: 'power2.inOut',
      }, .72);

    timeline.call(() => {
      playSound(lightAudioRef.current);
      fxRef.current?.energy({
        color: copy.color,
        origin: [.5, .47],
        intensity: kind === 'jackpot' ? 3.1 : kind === 'double' || kind === 'level-up' ? 2.42 : 1.95,
        duration: kind === 'jackpot' ? 2.7 : 2.25,
        radius: kind === 'jackpot' ? .34 : .31,
      });
      fxRef.current?.pulse({
        color: copy.color,
        origin: [.5, .47],
        strength: kind === 'jackpot' ? 2.1 : 1.55,
        duration: 1.18,
        radius: 1.18,
      });
      fxRef.current?.burst({
        color: copy.color,
        origin: [.5, .47],
        count: kind === 'jackpot' ? 210 : kind === 'double' ? 150 : 126,
        speed: kind === 'jackpot' ? 2.4 : 2,
        duration: kind === 'jackpot' ? 1.85 : 1.55,
        size: kind === 'jackpot' ? 17 : 14,
        gravity: .34,
      });
    }, undefined, revealStart);

    timeline.to('.alternative-stage-flash', {
        autoAlpha: 1,
        duration: .28,
        ease: 'power4.in',
      }, revealStart - .04)
      .to('.alternative-stage-flash', {
        autoAlpha: 1,
        duration: .18,
      }, revealStart + .24)
      .to('.alternative-stage-flash', {
        autoAlpha: 0,
        duration: .82,
        ease: 'power2.out',
      }, revealStart + .42);

    timeline.fromTo('.portal-core', {
        autoAlpha: 0,
        scale: .012,
        filter: 'brightness(.8) saturate(1)',
      }, {
        autoAlpha: .88,
        scale: .075,
        filter: 'brightness(1.4) saturate(1.2) drop-shadow(0 0 12px var(--alternative-color))',
        duration: .18,
        ease: 'power2.out',
        immediateRender: false,
      }, revealStart + .54)
      .to('.portal-core', {
        autoAlpha: 1,
        scale: 1,
        filter: 'brightness(4.2) saturate(1.55) drop-shadow(0 0 42px #fff) drop-shadow(0 0 72px var(--alternative-color))',
        duration: .72,
        ease: 'power4.in',
      }, revealStart + .72)
      .to('.portal-core', {
        autoAlpha: 0,
        scale: 1.12,
        filter: 'brightness(5.4) saturate(1.7) drop-shadow(0 0 64px #fff) drop-shadow(0 0 96px var(--alternative-color))',
        duration: .34,
        ease: 'power2.out',
      }, revealStart + 1.44)
      .to([leftCrackRef.current, rightCrackRef.current], {
        autoAlpha: 1,
        filter: 'brightness(2.3) drop-shadow(0 0 20px var(--alternative-color))',
        duration: .18,
      }, revealStart + 1.48)
      .call(() => playSound(openAudioRef.current), undefined, revealStart + 1.6)
      .call(() => {
        fxRef.current?.pulse({
          color: copy.color,
          origin: [.5, .46],
          strength: kind === 'jackpot' ? 1.65 : 1.15,
          duration: 1.05,
          radius: 1.05,
        });
        fxRef.current?.burst({
          color: copy.color,
          origin: [.5, .46],
          count: kind === 'jackpot' ? 230 : kind === 'double' ? 172 : 138,
          speed: kind === 'jackpot' ? 2.75 : 2.25,
          duration: kind === 'jackpot' ? 2.05 : 1.7,
          size: kind === 'jackpot' ? 18 : 15,
          gravity: .48,
        });
      }, undefined, revealStart + 1.6)
      .to(leftCrackRef.current, {
        x: -72,
        rotation: -7,
        autoAlpha: .15,
        duration: .72,
        ease: 'power3.out',
      }, revealStart + 1.6)
      .to(rightCrackRef.current, {
        x: 72,
        rotation: 7,
        autoAlpha: .15,
        duration: .72,
        ease: 'power3.out',
      }, revealStart + 1.6)
      .to(productGroupRef.current, {
        autoAlpha: 1,
        scale: .84,
        y: 0,
        filter: 'brightness(0) saturate(1.8)',
        duration: .58,
        ease: 'back.out(1.8)',
      }, revealStart + 1.58)
      .to(productGroupRef.current, {
        scale: 1,
        filter: 'brightness(1) saturate(1)',
        duration: .76,
        ease: 'power2.out',
      }, revealStart + 2.16);

    if (!webglReadyRef.current) {
      timeline.to('.alternative-burst-particle', {
        autoAlpha: 0,
        x: (index) => (index % 2 ? 1 : -1) * (85 + (index * 41) % 310),
        y: (index) => -210 + (index * 59) % 410,
        rotation: (index) => index * 37,
        scale: (index) => .5 + index % 5 * .28,
        duration: 1.2,
        stagger: .01,
        ease: 'power3.out',
      }, revealStart + 1.62);
    }

    timeline.to(resultCardRef.current, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: .5,
        ease: 'back.out(1.5)',
      }, revealStart + 3.2);

    if (kind === 'jackpot') {
      timeline.to('.portal-jackpot-rays', {
        autoAlpha: .95,
        scale: 1.45,
        rotation: '+=120',
        duration: 1.25,
        ease: 'power2.out',
      }, revealStart + .3);
    }
  };

  return <div
    ref={stageRef}
    className={`preview-stage alternative-reveal-stage portal-reveal-stage result-${kind} ${started ? 'is-running' : ''} ${revealed ? 'is-revealed' : ''}`}
    style={{ '--alternative-color': copy.color } as React.CSSProperties}
    onClick={openPortal}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') openPortal();
    }}
    role="button"
    tabIndex={0}
    aria-label={revealed ? '마법 포털 개봉 결과' : '마법 포털을 열려면 화면을 누르세요'}
  >
    <audio ref={clickAudioRef} src={clickSound} preload="auto" muted={muted}/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto" muted={muted}/>
    <audio ref={openAudioRef} src={openSound} preload="auto" muted={muted}/>
    <div className="alternative-stage-ambient" aria-hidden="true"/>
    <RevealFxLayer
      ref={fxRef}
      quality={quality}
      onReady={(ready) => {
        webglReadyRef.current = ready;
        setWebglReady(ready);
        if (ready) {
          fxRef.current?.setEnergyAmbient({
            color: '#67e8ff',
            origin: [.5, .47],
            intensity: quality === 'high' ? .58 : quality === 'balanced' ? .44 : quality === 'low' ? .2 : .1,
            radius: .3,
          });
        }
      }}
    />
    <div className="portal-jackpot-rays" aria-hidden="true"/>
    <div className="alternative-stage-flash" aria-hidden="true"/>
    <div className="portal-particle-field" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => <i
        className="portal-idle-particle"
        key={index}
        style={{
          '--particle-x': `${7 + ((index * 37) % 87)}%`,
          '--particle-y': `${8 + ((index * 53) % 82)}%`,
          '--particle-color': ['#7be9ff', '#d981ff', '#ffe374', '#ffffff'][index % 4],
        } as React.CSSProperties}
      />)}
    </div>
    {!webglReady && <div className="alternative-burst" aria-hidden="true">
      {Array.from({ length: 42 }, (_, index) => <i
        className="alternative-burst-particle"
        key={index}
        style={{ '--particle-color': ['#72eaff', '#d879ff', '#ffe064', '#ffffff'][index % 4] } as React.CSSProperties}
      />)}
    </div>}
    <div ref={portalRef} className="portal-shell" aria-hidden="true">
      <div className="portal-effect-core portal-core"/>
      <div ref={leftCrackRef} className="portal-energy-crack portal-crack-left"/>
      <div ref={rightCrackRef} className="portal-energy-crack portal-crack-right"/>
      <div ref={productGroupRef} className={`portal-products count-${visibleRewards.length}`}>
        {visibleRewards.map((reward) => <div className="portal-product" key={reward.assetId}>
          {reward.imageUrl
            ? <img src={reward.imageUrl} alt=""/>
            : <span>{kind === 'jackpot' ? '★' : kind === 'double' ? '×2' : '◆'}</span>}
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
      <span>ARCANE PORTAL</span>
      <strong>화면을 눌러 상품을 소환하세요!</strong>
      <small>빛이 모이면 포털 안의 결과가 공개됩니다.</small>
    </div>}
    {started && !revealed && <div className="alternative-status"><i/><span>소환 중</span><i/></div>}
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
    <span className="preview-label">GSAP MAGIC PORTAL REVEAL</span>
  </div>;
}
