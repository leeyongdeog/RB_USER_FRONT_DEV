import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight, Gift, PackageOpen, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import type { GiftBox3DHandle } from '../effects/GiftBox3DLayer';
import GiftBox3DLayer from '../effects/GiftBox3DLayer';
import RevealFxLayer, { type RevealFxHandle } from '../effects/RevealFxLayer';
import { launchRevealConfetti } from '../effects/revealConfetti';
import cartoonBoxBody from '../assets/bb-l1-cartoon.png';
import cartoonBoxCap from '../assets/bc-l1-cartoon.png';
import clickSound from '../assets/click.wav';
import lightSound from '../assets/light.mp4';
import openSound from '../assets/open.wav';
import {
  AUTO_QUALITY_CHANGE_EVENT, loadAutoQuality,
  type QualityChoice, type ResolvedQuality,
} from '../services/revealQuality';

gsap.registerPlugin(useGSAP);

type GiftBox3DRevealStageProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

const LEVELS = [
  { name: 'NORMAL', color: '#8deeff', glow: '#dffbff' },
  { name: 'RED', color: '#ff496e', glow: '#ffb0bd' },
  { name: 'GOLD', color: '#ffd34f', glow: '#fff3a6' },
] as const;

const CARTOON_ARTWORK = { body: cartoonBoxBody, cap: cartoonBoxCap } as const;
type JewelTone = 'ruby' | 'sapphire' | 'gold';

const clampLevel = (value: number | undefined) => Math.min(3, Math.max(1, Number(value || 1)));

const play = (audio: HTMLAudioElement | null) => {
  if (!audio) return;
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
};

export default function GiftBox3DRevealStage({
  boxId,
  outcome,
  onFinished,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: GiftBox3DRevealStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<GiftBox3DHandle>(null);
  const plasmaFxRef = useRef<RevealFxHandle>(null);
  const plasmaAmbientColorRef = useRef('#45dff5');
  const primaryRef = useRef<HTMLDivElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const primaryLidRef = useRef<HTMLSpanElement>(null);
  const secondaryLidRef = useRef<HTMLSpanElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const clickRef = useRef(0);
  const busyRef = useRef(false);
  const doubledRef = useRef(false);
  const startLevel = clampLevel(outcome?.startLevel);
  const targetLevel = Math.max(startLevel, clampLevel(outcome?.level || 3));
  const [level, setLevel] = useState(startLevel);
  const [clicks, setClicks] = useState(0);
  const [doubled, setDoubled] = useState(false);
  const [jewelTone, setJewelTone] = useState<JewelTone>('ruby');
  const [opened, setOpened] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [plasmaReady, setPlasmaReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [qualityChoice, setQualityChoice] = useState<QualityChoice>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('random-drop-reveal-quality') : null;
    return saved === 'high' || saved === 'balanced' || saved === 'low' || saved === 'ultra' ? saved : 'auto';
  });
  const [autoQuality, setAutoQuality] = useState<ResolvedQuality>(loadAutoQuality);
  const quality = qualityChoice === 'auto' ? autoQuality : qualityChoice;
  const current = LEVELS[level - 1];
  const artwork = CARTOON_ARTWORK;
  const levelUpCount = Math.max(0, Number(outcome?.levelUpCount ?? (targetLevel - startLevel)));
  const jackpotOutcome = levelUpCount >= 2;
  const totalClicks = outcome?.double ? 3 : (targetLevel - startLevel + 1) * 3;
  const doubleTrigger = outcome?.double ? 2 + Number(outcome.openingId || 0) % 2 : 0;
  const stepClicks = opened ? 3 : clicks % 3;
  const anticipatingFinal = !opened && !transitioning && stepClicks === 2;
  const plasmaAmbientActive = !opened && (anticipatingFinal || transitioning);

  useEffect(() => {
    const updateQuality = (event: Event) => {
      if (qualityChoice === 'auto') setAutoQuality((event as CustomEvent<ResolvedQuality>).detail);
    };
    window.addEventListener(AUTO_QUALITY_CHANGE_EVENT, updateQuality);
    return () => window.removeEventListener(AUTO_QUALITY_CHANGE_EVENT, updateQuality);
  }, [qualityChoice]);

  useEffect(() => {
    fxRef.current?.setAmbientColor(current.color);
  }, [current.color, quality]);

  useEffect(() => {
    const intensity = quality === 'high' ? .58 : quality === 'balanced' ? .48 : quality === 'low' ? .36 : .27;
    if (anticipatingFinal) plasmaAmbientColorRef.current = current.color;
    plasmaFxRef.current?.setEnergyAmbient({
      color: plasmaAmbientColorRef.current,
      origin: [.5, .49],
      intensity: plasmaAmbientActive ? intensity : 0,
      radius: quality === 'ultra' ? .39 : .455,
    });
  }, [anticipatingFinal, current.color, plasmaAmbientActive, plasmaReady, quality]);

  useGSAP(() => {
    gsap.set(resultRef.current, { autoAlpha: 0, scale: .78, y: 42 });
    gsap.set(flashRef.current, { autoAlpha: 0 });
    gsap.set(secondaryRef.current, { autoAlpha: 0, x: 0, scale: .45 });
    gsap.fromTo(primaryRef.current,
      { autoAlpha: 0, scale: .28, rotationZ: -8 },
      { autoAlpha: 1, scale: 1, rotationZ: 0, duration: 1.05, ease: 'back.out(1.8)' },
    );
  }, { scope: stageRef });

  const interact = () => {
    if (opened || busyRef.current) return;
    play(clickAudioRef.current);
    const nextClick = clickRef.current + 1;
    const visualLevel = level;
    const willDouble = Boolean(outcome?.double) && !doubledRef.current && visualLevel === startLevel && nextClick === doubleTrigger;
    const doubleMode = doubledRef.current || willDouble;
    const milestone = nextClick % 3 === 0 || willDouble;
    const final = doubleMode ? nextClick === 3 : nextClick === totalClicks;
    const nextLevel = !final && milestone && !doubleMode ? Math.min(targetLevel, visualLevel + 1) : visualLevel;
    const color = doubleMode ? '#63f4ff' : LEVELS[(final ? visualLevel : nextLevel) - 1].color;
    const giftTargets = doubledRef.current ? [primaryRef.current, secondaryRef.current] : [primaryRef.current];
    clickRef.current = nextClick;
    setClicks(nextClick);
    fxRef.current?.impact({ color, intensity: milestone ? 1.25 : .88 });
    gsap.killTweensOf([primaryRef.current, secondaryRef.current]);

    const timeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        busyRef.current = false;
        setTransitioning(false);
      },
    });
    timeline.to(giftTargets, { scaleX: .79, scaleY: .88, duration: .045, ease: 'power4.in' })
      .to(giftTargets, { scaleX: 1.2, scaleY: 1.12, rotationZ: nextClick % 2 ? -4 : 4, duration: .085, ease: 'power4.out' })
      .to(giftTargets, { x: -9, duration: .02, repeat: 4, yoyo: true, ease: 'none' })
      .to(giftTargets, { x: 0, scaleX: 1, scaleY: 1, rotationZ: 0, duration: .12, ease: 'back.out(3)' });

    if (!milestone) return;
    busyRef.current = true;
    setTransitioning(true);
    const plasmaColorProgress = { value: 0 };
    const plasmaColorFrom = plasmaAmbientColorRef.current;
    const plasmaIntensity = quality === 'high' ? .58 : quality === 'balanced' ? .48 : quality === 'low' ? .36 : .27;
    const plasmaRadius = quality === 'ultra' ? .39 : .455;
    timeline.call(() => {
      fxRef.current?.charge({ color, intensity: final ? 1.42 : 1.18 });
      plasmaFxRef.current?.burst({
        color,
        origin: [.5, .46],
        count: quality === 'high' ? 110 : quality === 'balanced' ? 78 : quality === 'low' ? 48 : 24,
        speed: 1.5,
        duration: 1.28,
        size: quality === 'high' ? 13 : 10,
      });
      gsap.to(plasmaColorProgress, {
        value: 1,
        duration: 1.16,
        ease: 'sine.inOut',
        onUpdate: () => {
          const nextColor = gsap.utils.interpolate(plasmaColorFrom, color, plasmaColorProgress.value);
          const revealGrowth = final ? plasmaColorProgress.value : 0;
          plasmaAmbientColorRef.current = nextColor;
          plasmaFxRef.current?.setEnergyAmbient({
            color: nextColor,
            origin: [.5, .49],
            intensity: plasmaIntensity * (1 + revealGrowth * .5),
            radius: plasmaRadius * (1 + revealGrowth * .3),
          });
        },
      });
    })
      .to(giftTargets, { scaleX: .92, scaleY: 1.03, duration: .3, ease: 'sine.in' })
      .to(giftTargets, { scaleX: .53, scaleY: .49, duration: .56, ease: 'expo.in' })
      .to(giftTargets, { x: -7, rotationZ: -2.8, scaleX: .45, scaleY: .62, duration: .04, repeat: 4, yoyo: true, ease: 'none' })
      .to(giftTargets, { x: 0, rotationZ: 0, scaleX: .52, scaleY: .55, duration: .08 })
      .addLabel('detonate')
      .call(() => play(lightAudioRef.current), undefined, 'detonate')
      .call(() => {
        if (willDouble) fxRef.current?.split();
        else fxRef.current?.transition({ color, intensity: final ? 1.55 : 1.28 });
      }, undefined, 'detonate')
      .set(flashRef.current, { backgroundColor: 'rgba(255,255,255,0)', autoAlpha: 1 }, 'detonate')
      .fromTo(flashRef.current?.querySelector('.screen-flash-bloom') || null,
        { scale: .025, autoAlpha: .78 },
        { scale: 3.35, autoAlpha: 1, duration: .86, ease: 'power2.in' },
        'detonate',
      )
      .fromTo(flashRef.current?.querySelector('.screen-flash-core') || null,
        { scale: .035, rotation: -42, autoAlpha: .35 },
        { scale: 2.9, rotation: 72, autoAlpha: 1, duration: .88, ease: 'power2.in' },
        'detonate',
      )
      .fromTo(flashRef.current?.querySelector('.screen-flash-ring') || null,
        { scale: .04, autoAlpha: 0 },
        { scale: 5.4, autoAlpha: .96, duration: .82, ease: 'power2.in' },
        'detonate+=.06',
      )
      .fromTo(flashRef.current?.querySelector('.screen-flash-cross') || null,
        { autoAlpha: 0, scale: .25 },
        { autoAlpha: .58, scale: 1, duration: .34, ease: 'power2.in' },
        'detonate+=.43',
      )
      .to(flashRef.current, { backgroundColor: '#ffffff', duration: .34, ease: 'power2.in' }, 'detonate+=.5')
      .to(flashRef.current, { autoAlpha: 1, duration: .48, ease: 'none' })
      .to(flashRef.current, { autoAlpha: 0, duration: .46, ease: 'power2.out' })
      .addLabel('concealed', `detonate+=${final ? 1.82 : .72}`);

    if (final) {
      timeline.fromTo(giftTargets,
        { x: -6, rotationZ: -2.6, scaleX: .48, scaleY: .6 },
        {
          x: 6,
          rotationZ: 2.6,
          scaleX: .57,
          scaleY: .5,
          duration: .0455,
          repeat: 39,
          yoyo: true,
          ease: 'none',
        },
        'detonate',
      ).set(giftTargets, {
        x: 0,
        rotationZ: 0,
        scaleX: .52,
        scaleY: .55,
      }, 'concealed');
    }

    if (willDouble) {
      timeline.call(() => {
        doubledRef.current = true;
        setDoubled(true);
        setJewelTone('sapphire');
      }, undefined, 'concealed')
        .set(secondaryRef.current, { autoAlpha: 1, x: 0, scaleX: .42, scaleY: .5 }, 'concealed')
        .to(primaryRef.current, { x: -108, scaleX: 1, scaleY: 1, duration: .56, ease: 'back.out(1.9)' }, 'concealed+=.04')
        .to(secondaryRef.current, { x: 108, scaleX: 1, scaleY: 1, duration: .56, ease: 'back.out(1.9)' }, 'concealed+=.04');
      if (!final) return;
    }

    if (!final) {
      timeline.call(() => setLevel(nextLevel), undefined, 'concealed')
        .fromTo(primaryRef.current,
          { scaleX: .42, scaleY: .5 },
          { scaleX: 1.38, scaleY: .87, duration: .18, ease: 'expo.out' },
          'concealed+=.04',
        )
        .to(primaryRef.current, { scaleX: .9, scaleY: 1.26, duration: .12 })
        .to(primaryRef.current, { scaleX: 1.12, scaleY: .94, duration: .11 })
        .to(primaryRef.current, { scaleX: 1, scaleY: 1, duration: .14 });
      return;
    }

    const finalGifts = doubleMode ? [primaryRef.current, secondaryRef.current] : [primaryRef.current];
    const finalLids = doubleMode ? [primaryLidRef.current, secondaryLidRef.current] : [primaryLidRef.current];
    const restorePosition = willDouble ? 'concealed+=.62' : 'concealed';
    const openPosition = willDouble ? 'concealed+=.82' : 'concealed+=.2';
    if (!doubleMode && jackpotOutcome) {
      timeline.call(() => setJewelTone('gold'), undefined, 'concealed');
    }
    timeline.to(finalGifts, {
      x: (index) => doubleMode ? (index === 0 ? -108 : 108) : 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      duration: .18,
      ease: 'back.out(2.2)',
    }, restorePosition)
      .call(() => {
      setOpened(true);
      fxRef.current?.open({ color, intensity: doubleMode ? 1.4 : 1.18 });
      plasmaFxRef.current?.burst({
        color: '#ffffff',
        origin: [.5, .46],
        count: quality === 'high' ? 190 : quality === 'balanced' ? 126 : quality === 'low' ? 70 : 34,
        speed: 2.2,
        duration: 1.55,
        size: quality === 'high' ? 16 : 12,
      });
      play(openAudioRef.current);
      void launchRevealConfetti(quality, color);
    }, undefined, openPosition)
      .to(finalLids, {
        y: -205,
        x: (index) => doubleMode ? (index === 0 ? -125 : 125) : 66,
        rotationZ: (index) => doubleMode ? (index === 0 ? -42 : 42) : 40,
        scale: 1.24,
        duration: .72,
        ease: 'power4.out',
      }, openPosition)
      .to(finalGifts, { scale: .72, autoAlpha: 0, duration: .52, ease: 'power3.in' }, '+=.08')
      .to(resultRef.current, { autoAlpha: 1, scale: 1, y: 0, duration: .72, ease: 'back.out(1.7)' }, '-=.12')
      .call(() => onFinished?.());
  };

  const rewards = outcome?.rewards?.length ? outcome.rewards : [{
    assetId: 'preview-3d', productId: 'preview-3d', name: '프리미엄 3D 컬렉션', value: 124000,
    consumerPrice: 124000, level: 1, levelName: 'NORMAL', color: '#fff', imageUrl: null,
  }];

  return <div
    ref={stageRef}
    className={`preview-stage gift3d-stage quality-${quality} ${doubled ? 'is-double' : ''} ${anticipatingFinal ? 'is-anticipating' : ''} ${opened ? 'is-opened' : ''}`}
    style={{ '--gift3d-color': current.color, '--gift3d-glow': current.glow } as React.CSSProperties}
    onClick={interact}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') interact(); }}
    role="button"
    tabIndex={0}
    aria-label={opened ? '3D 선물상자 개봉 결과' : `3D 레벨 ${level} 선물상자, 화면을 눌러 진행`}
  >
    <audio ref={clickAudioRef} src={clickSound} preload="auto" muted={muted}/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto" muted={muted}/>
    <audio ref={openAudioRef} src={openSound} preload="auto" muted={muted}/>
    {createPortal(<div ref={flashRef} className={`screen-flash gift3d-screen-flash quality-${quality}`} aria-hidden="true">
      <i className="screen-flash-bloom"/><i className="screen-flash-core"/><i className="screen-flash-ring"/><i className="screen-flash-cross"/>
    </div>, document.body)}
    <GiftBox3DLayer ref={fxRef} quality={quality}/>
    <RevealFxLayer ref={plasmaFxRef} quality={quality} onReady={setPlasmaReady}/>
    <div className="gift3d-depth-vignette" aria-hidden="true"/>
    <div className="gift3d-pair" aria-hidden="true">
      <div ref={primaryRef} className="gift3d-box gift3d-primary">
        <span className="gift3d-bottom"><img src={artwork.body} alt=""/></span>
        <span ref={primaryLidRef} className="gift3d-top"><img src={artwork.cap} alt=""/></span>
        <span className={`gift3d-jewel-face jewel-${jewelTone}`}><img src={artwork.body} alt=""/></span>
      </div>
      <div ref={secondaryRef} className="gift3d-box gift3d-secondary">
        <span className="gift3d-bottom"><img src={artwork.body} alt=""/></span>
        <span ref={secondaryLidRef} className="gift3d-top"><img src={artwork.cap} alt=""/></span>
        <span className={`gift3d-jewel-face jewel-${jewelTone}`}><img src={artwork.body} alt=""/></span>
      </div>
    </div>
    <div ref={resultRef} className={`result-card gift3d-result ${doubled ? 'double-result-card' : ''}`}>
      <span>{doubled ? 'DOUBLE 3D DROP' : `${outcome?.grade || 'LEGENDARY'} 3D DROP`}</span>
      <strong>{doubled ? '상품 2개를 획득했습니다!' : '상품을 획득했습니다!'}</strong>
      <div className="result-products">{rewards.map((reward) => <article key={reward.assetId}>
        <div className="result-product-image">{reward.imageUrl ? <img src={reward.imageUrl} alt={reward.name}/> : <Gift size={34}/>}</div>
        <div><b>{reward.name}</b><small>소비자가 {(reward.consumerPrice || reward.value).toLocaleString('ko-KR')}원</small></div>
      </article>)}</div>
      <small className="result-summary">3D 에너지 연출 완료 · 인벤토리에 안전하게 보관되었습니다.</small>
      <em>결과 ID · {outcome?.openingId || boxId.toUpperCase()}</em>
      <div className="result-actions" onClick={(event) => event.stopPropagation()}>
        {sequential ? <button className="primary sequential-continue" type="button" onClick={onContinue} disabled={continuePending}>
          {continuePending ? '다음 박스를 준비하고 있습니다' : remainingCount > 0 ? '계속' : '결과 확인'} <ArrowRight size={14}/>
        </button> : <><Link className="primary" to="/inventory"><PackageOpen size={15}/> 인벤토리 보기 <ArrowRight size={14}/></Link>
          <Link to="/shop"><ShoppingBag size={15}/> 랜덤박스 가기</Link></>}
      </div>
    </div>
    {!opened && <div className="reveal-guide gift3d-guide">
      <div className="level-chip"><i/> {doubled ? 'DOUBLE · L0' : `LEVEL ${level} · ${current.name}`}</div>
      {doubled && <b className="double-chip">DOUBLE 확정 · 업그레이드 종료</b>}
      <strong>{transitioning ? '3D 에너지를 압축하는 중입니다' : doubled ? `${3 - stepClicks}번 더 터치하면 두 상자 동시 개봉` : clicks === 0 ? '3D 선물상자를 깨워보세요' : `${3 - stepClicks}번 더 터치하면 등급 판정`}</strong>
      <div className="click-meter">{[1, 2, 3].map((dot) => <i key={dot} className={dot <= stepClicks ? 'active' : ''}/>)}</div>
      <span>화면을 클릭하거나 Enter 키를 누르세요</span>
    </div>}
    <div className="stage-tools" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <label className="quality-control"><span>연출 품질</span><select aria-label="3D 연출 품질" value={qualityChoice} onChange={(event) => {
        const next = event.target.value as QualityChoice;
        setQualityChoice(next);
        if (next === 'auto') {
          window.localStorage.removeItem('random-drop-reveal-quality');
          setAutoQuality(loadAutoQuality());
        } else window.localStorage.setItem('random-drop-reveal-quality', next);
      }}><option value="auto">자동 ({quality === 'ultra' ? '초저사양' : quality === 'low' ? '저사양' : quality === 'balanced' ? '일반' : '고화질'})</option><option value="high">고화질</option><option value="balanced">일반</option><option value="low">저사양</option><option value="ultra">초저사양</option></select></label>
      <button onClick={() => setMuted(!muted)} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
    </div>
    {sequential && !opened && <div className="remaining-box-counter"><span>남은 박스</span><b>{remainingCount}</b></div>}
  </div>;
}
