import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight, Gift, PackageOpen, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import type { OpenBoxResult } from '../services/api';
import bodyImage from '../assets/body.png';
import buttonImage from '../assets/button.png';
import jackpotImage from '../assets/jackpot.png';
import resultPanelImage from '../assets/result_pannel.png';
import sirenImage from '../assets/siren.png';
import starsImage from '../assets/stars.png';
import wheelLayerImage from '../assets/wheel_layer.png';
import clickSound from '../assets/click.wav';
import lightSound from '../assets/light.mp4';
import openSound from '../assets/open.wav';

gsap.registerPlugin(useGSAP);

type SlotMachineRevealStageProps = {
  boxId: string;
  outcome?: OpenBoxResult | null;
  onFinished?: () => void;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

type SlotResultKind = 'single' | 'double' | 'level-up' | 'jackpot';

const REEL_SYMBOL_SET = ['7', '★', '◆', 'BAR', '🎁'] as const;
const REEL_SYMBOLS = Array.from(
  { length: 80 },
  (_, index) => REEL_SYMBOL_SET[index % REEL_SYMBOL_SET.length],
);

const getResultKind = (outcome?: OpenBoxResult | null): SlotResultKind => {
  if ((outcome?.levelUpCount || 0) >= 2) return 'jackpot';
  if (outcome?.double) return 'double';
  if ((outcome?.levelUpCount || 0) === 1) return 'level-up';
  return 'single';
};

const RESULT_COPY: Record<SlotResultKind, { label: string; detail: string; color: string }> = {
  single: { label: 'SINGLE', detail: '상품 1개 당첨', color: '#fff5a8' },
  double: { label: 'DOUBLE', detail: '상품 2개 동시 당첨', color: '#66f4ff' },
  'level-up': { label: 'LEVEL UP', detail: '한 단계 높은 상품 당첨', color: '#ff85cc' },
  jackpot: { label: 'JACKPOT', detail: '두 단계 레벨업 당첨', color: '#ffe166' },
};

export default function SlotMachineRevealStage({
  boxId,
  outcome,
  onFinished,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: SlotMachineRevealStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLImageElement>(null);
  const resultTextRef = useRef<HTMLDivElement>(null);
  const rewardCardRef = useRef<HTMLDivElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clickAudioRef = useRef<HTMLAudioElement>(null);
  const lightAudioRef = useRef<HTMLAudioElement>(null);
  const openAudioRef = useRef<HTMLAudioElement>(null);
  const runningRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(false);
  const resultKind = getResultKind(outcome);
  const resultCopy = RESULT_COPY[resultKind];
  const reelStops = useMemo(() => {
    if (resultKind === 'jackpot') return [0, 0, 0];
    if (resultKind === 'double') return [1, 4, 1];
    if (resultKind === 'level-up') return [2, 0, 2];
    return [4, 1, 3];
  }, [resultKind]);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (!audio || audio.muted) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const runParticles = (jackpot = false) => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    const context = canvas.getContext('2d');
    if (!context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.visibility = 'visible';
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    const count = isMobile ? (jackpot ? 72 : 38) : (jackpot ? 140 : 64);
    const colors = ['#ffe55c', '#ff3e70', '#61f7ff', '#ffffff', '#9f75ff', '#ff9f2e'];
    const particles = Array.from({ length: count }, (_, index) => ({
      x: jackpot ? ((index * 83) % count) / count * width : width / 2,
      y: jackpot ? ((index * 47) % count) / count * height : height * .54,
      vx: jackpot ? (index % 11 - 5) * 32 : Math.cos((Math.PI * 2 * index) / count) * (180 + index % 8 * 35),
      vy: jackpot ? -140 - index % 9 * 22 : Math.sin((Math.PI * 2 * index) / count) * (180 + index % 7 * 32),
      size: 4 + index % 6 * 1.5,
      spin: (index % 2 ? 1 : -1) * (2 + index % 5),
      color: colors[index % colors.length],
    }));
    const duration = jackpot ? 1.8 : .82;
    const startedAt = performance.now();
    const render = (now: number) => {
      const elapsed = Math.min(duration, (now - startedAt) / 1000);
      const progress = elapsed / duration;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      particles.forEach((particle, index) => {
        const x = particle.x + particle.vx * elapsed;
        const y = particle.y + particle.vy * elapsed + (jackpot ? 260 * elapsed * elapsed : 80 * elapsed * elapsed);
        const alpha = Math.max(0, Math.sin(Math.min(1, progress) * Math.PI));
        context.save();
        context.globalAlpha = alpha;
        context.translate(x, y);
        context.rotate(particle.spin * elapsed);
        context.fillStyle = particle.color;
        context.shadowColor = particle.color;
        context.shadowBlur = jackpot ? 12 : 7;
        const size = particle.size * (.6 + progress);
        if (index % 3 === 0) {
          context.beginPath();
          context.arc(0, 0, size * .65, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-size * .3, -size, size * .6, size * 2);
        }
        context.restore();
      });
      context.globalCompositeOperation = 'source-over';
      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(render);
      } else {
        context.clearRect(0, 0, width, height);
        canvas.style.visibility = 'hidden';
        animationFrameRef.current = null;
      }
    };
    animationFrameRef.current = window.requestAnimationFrame(render);
  };

  useGSAP(() => {
    gsap.set(resultTextRef.current, { autoAlpha: 0, scale: .72 });
    gsap.set(rewardCardRef.current, { autoAlpha: 0, x: 45, scale: .9 });
    gsap.set('.slot-reel-strip', { y: -64 * 70 });
    gsap.to('.slot-stars-layer', { autoAlpha: .4, filter: 'brightness(1.8) drop-shadow(0 0 16px #ffe65c)', duration: .42, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.slot-wheel-layer', { filter: 'brightness(1.55) drop-shadow(0 0 15px #fff36b)', duration: .34, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }, { scope: stageRef });

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const startMachine = () => {
    if (runningRef.current || revealed) return;
    runningRef.current = true;
    setStarted(true);
    playSound(clickAudioRef.current);
    runParticles(false);
    const reels = gsap.utils.toArray<HTMLElement>('.slot-reel-strip', stageRef.current);
    const siren = stageRef.current?.querySelector('.slot-siren');
    const layers = stageRef.current?.querySelectorAll('.slot-art-layer');
    const timeline = gsap.timeline({
      onComplete: () => {
        runningRef.current = false;
        setRevealed(true);
        onFinished?.();
      },
    });
    timeline.to(buttonRef.current, { scale: .78, filter: 'brightness(2.3) drop-shadow(0 0 28px #fff36b)', duration: .07, ease: 'power3.in' })
      .to(buttonRef.current, { scale: 1.2, duration: .12, ease: 'back.out(4)' })
      .to(buttonRef.current, { scale: 1, filter: 'brightness(1.2) drop-shadow(0 0 12px #ffcf32)', duration: .16 })
      .to(machineRef.current, { scaleX: 1.012, scaleY: .988, duration: .045, repeat: 3, yoyo: true, ease: 'power1.inOut' }, '<')
      .addLabel('reelSpinStart')
      .to(reels, {
        y: -64 * 60,
        duration: .45,
        ease: 'power3.in',
      }, 'reelSpinStart')
      .addLabel('reelBrakeStart', 'reelSpinStart+=.45');

    const reelStopTimes = [1, 2, 5];

    reels.forEach((reel, index) => {
      const stopTime = reelStopTimes[index] ?? 5;
      const stopDuration = stopTime - .45;
      const finalY = -64 * reelStops[index];

      timeline
        .to(reel, {
          y: finalY,
          duration: stopDuration,
          ease: 'power2.out',
        }, 'reelBrakeStart')
        .to(machineRef.current, {
          scaleX: 1.008,
          scaleY: .992,
          duration: .045,
          repeat: 1,
          yoyo: true,
          ease: 'power1.inOut',
        }, `reelBrakeStart+=${stopDuration - .06}`);
    });

    timeline
      .addLabel('reelsStopped', 'reelSpinStart+=5.12')
      .call(() => playSound(lightAudioRef.current), undefined, 'reelsStopped-=.46')
      .to('.slot-stage-flash', { autoAlpha: .92, duration: .12, ease: 'power3.in' }, 'reelsStopped-=.18')
      .to('.slot-stage-flash', { autoAlpha: 0, duration: .34, ease: 'power2.out' }, 'reelsStopped-=.06')
      .to(machineRef.current, { scaleX: 1.035, scaleY: .965, duration: .09, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 'reelsStopped-=.02')
      .call(() => playSound(openAudioRef.current), undefined, 'reelsStopped+=.12')
      .to(resultTextRef.current, { autoAlpha: 1, scale: 1, duration: .45, ease: 'back.out(2.4)' })
      .to(resultTextRef.current, {
        textShadow: `0 0 8px #fff, 0 0 22px ${resultCopy.color}, 0 0 42px ${resultCopy.color}`,
        scale: 1.08,
        duration: .25,
        repeat: 3,
        yoyo: true,
        ease: 'sine.inOut',
      })
      .to(siren ? [siren] : [], { autoAlpha: 1, filter: 'brightness(2.3) drop-shadow(0 0 25px #ff334d)', duration: .16, repeat: 5, yoyo: true }, '<-.55');

    if (resultKind === 'jackpot') {
      timeline.call(() => runParticles(true), undefined, '<-.7')
        .to('.slot-jackpot-sign', { autoAlpha: 1, scale: 1.16, filter: 'brightness(2.6) drop-shadow(0 0 38px #ffe65c)', duration: .22, repeat: 5, yoyo: true, ease: 'sine.inOut' }, '<')
        .to(layers || [], { filter: 'brightness(2.05) saturate(1.35)', duration: .16, repeat: 5, yoyo: true, stagger: .025 }, '<')
        .to('.slot-stage-jackpot-rays', { autoAlpha: .9, rotation: '+=80', scale: 1.3, duration: 1.05, ease: 'power2.out' }, '<');
    } else {
      timeline.call(() => runParticles(false), undefined, '<-.35');
    }
    timeline.to(rewardCardRef.current, { autoAlpha: 1, x: 0, scale: 1, duration: .5, ease: 'back.out(1.6)' }, '>-0.04');
  };

  const fallbackRewards = [{
    assetId: 'slot-preview',
    productId: 'slot-preview-product',
    name: resultKind === 'jackpot' ? '잭팟 프리미엄 상품' : '랜덤 드롭 샘플 상품',
    value: resultKind === 'jackpot' ? 3500000 : 12000,
    consumerPrice: resultKind === 'jackpot' ? 3500000 : 12000,
    level: resultKind === 'jackpot' ? 3 : 1,
    levelName: resultCopy.label,
    color: resultCopy.color,
    imageUrl: null,
  }];
  const rewards = outcome?.rewards?.length ? outcome.rewards : fallbackRewards;

  return <div
    ref={stageRef}
    className={`preview-stage slot-reveal-stage result-${resultKind} ${started ? 'is-running' : ''} ${revealed ? 'is-revealed' : ''}`}
    onClick={startMachine}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') startMachine(); }}
    role="button"
    tabIndex={0}
    aria-label={revealed ? '슬롯머신 개봉 결과' : '슬롯머신을 시작하려면 화면을 누르세요'}
    style={{ '--slot-result-color': resultCopy.color } as React.CSSProperties}
  >
    <audio ref={clickAudioRef} src={clickSound} preload="auto" muted={muted}/>
    <audio ref={lightAudioRef} src={lightSound} preload="auto" muted={muted}/>
    <audio ref={openAudioRef} src={openSound} preload="auto" muted={muted}/>
    {createPortal(<canvas ref={particleCanvasRef} className="effects-canvas slot-particle-canvas" aria-hidden="true"/>, document.body)}
    <div className="slot-stage-ambient" aria-hidden="true"/>
    <div className="slot-stage-jackpot-rays" aria-hidden="true"/>
    <div className="slot-stage-flash" aria-hidden="true"/>
    <div className="slot-click-waves" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => <i key={index}/>)}
    </div>
    <div className="slot-win-aura" aria-hidden="true"><i/><i/><i/></div>
    <div className="slot-celebration-rings" aria-hidden="true"><i/><i/><i/></div>
    <div className="slot-persistent-sparks" aria-hidden="true">
      {Array.from({ length: 30 }, (_, index) => <i key={index} style={{
        '--spark-x': `${6 + ((index * 37) % 89)}%`,
        '--spark-y': `${8 + ((index * 53) % 82)}%`,
        '--spark-delay': `${(index % 10) * -.17}s`,
        '--spark-scale': `${.65 + (index % 5) * .22}`,
        '--spark-color': ['#ffe366', '#ff4d7a', '#65f5ff', '#ffffff', '#ad78ff'][index % 5],
      } as React.CSSProperties}/>)}
    </div>
    <div ref={machineRef} className="slot-machine-shell" aria-hidden="true">
      <div className="slot-reels">
        {[0, 1, 2].map((reelIndex) => <div className="slot-reel" key={reelIndex}>
          <div className="slot-reel-strip">{REEL_SYMBOLS.map((symbol, index) => <i className={`symbol-${index % 5}`} key={`${reelIndex}-${index}`}>{symbol}</i>)}</div>
        </div>)}
      </div>
      <img className="slot-art-layer slot-body-layer" src={bodyImage} alt=""/>
      <img className="slot-art-layer slot-wheel-layer" src={wheelLayerImage} alt=""/>
      <img className="slot-art-layer slot-stars-layer" src={starsImage} alt=""/>
      <img className="slot-art-layer slot-result-panel" src={resultPanelImage} alt=""/>
      <img className="slot-art-layer slot-jackpot-sign" src={jackpotImage} alt=""/>
      <img className="slot-art-layer slot-siren" src={sirenImage} alt=""/>
      <img ref={buttonRef} className="slot-art-layer slot-start-button" src={buttonImage} alt=""/>
      <div ref={resultTextRef} className="slot-result-text"><strong>{resultCopy.label}</strong><span>{resultCopy.detail}</span></div>
    </div>
    <div ref={rewardCardRef} className="slot-reward-card" onClick={(event) => event.stopPropagation()}>
      <span>{resultCopy.label} DROP</span>
      <h2>{rewards.length > 1 ? `상품 ${rewards.length}개를 획득했습니다!` : '상품을 획득했습니다!'}</h2>
      <div className="slot-reward-list">{rewards.map((reward) => <article key={reward.assetId}>
        <div>{reward.imageUrl ? <img src={reward.imageUrl} alt={reward.name}/> : <Gift size={30}/>}</div>
        <p><b>{reward.name}</b><small>소비자가 {(reward.consumerPrice || reward.value).toLocaleString('ko-KR')}원</small></p>
      </article>)}</div>
      <em>결과 ID · {outcome?.openingId || boxId.toUpperCase()}</em>
      <div className="result-actions">
        {sequential ? <button className="primary sequential-continue" type="button" onClick={onContinue} disabled={continuePending}>
          {continuePending ? '다음 박스를 준비하고 있습니다' : remainingCount > 0 ? '계속' : '결과 확인'} <ArrowRight size={14}/>
        </button> : <><Link className="primary" to="/inventory"><PackageOpen size={15}/> 인벤토리 보기 <ArrowRight size={14}/></Link>
          <Link to="/shop"><ShoppingBag size={15}/> 랜투샵 가기</Link></>}
      </div>
    </div>
    {!started && <div className="slot-guide"><span>NEW SLOT REVEAL</span><strong>화면을 눌러 행운을 돌려보세요!</strong><small>버튼과 화면 어디를 눌러도 시작됩니다.</small></div>}
    {started && !revealed && <div className="slot-spin-status"><i/><span>결과 확인 중</span><i/></div>}
    <button className="slot-sound-button" type="button" onClick={(event) => { event.stopPropagation(); setMuted(value => !value); }} aria-label={muted ? '소리 켜기' : '소리 끄기'}>
      {muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}
    </button>
    {sequential && !revealed && <div className="remaining-box-counter"><span>남은 박스</span><b>{remainingCount}</b></div>}
    <span className="preview-label">GSAP SLOT MACHINE REVEAL</span>
  </div>;
}
