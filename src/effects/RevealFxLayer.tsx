import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ResolvedQuality } from '../services/revealQuality';
import type {
  RevealFxEngine,
  RevealFxBurstOptions,
  RevealFxEnergyOptions,
  RevealFxPulseOptions,
} from './RevealFxEngine';

export type RevealFxHandle = {
  burst: (options: RevealFxBurstOptions) => void;
  energy: (options: RevealFxEnergyOptions) => void;
  pulse: (options: RevealFxPulseOptions) => void;
  setEnergyAmbient: (options: RevealFxEnergyOptions) => void;
};

type RevealFxLayerProps = {
  quality: ResolvedQuality;
  onReady?: (ready: boolean) => void;
};

const RevealFxLayer = forwardRef<RevealFxHandle, RevealFxLayerProps>(function RevealFxLayer(
  { quality, onReady },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RevealFxEngine | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useImperativeHandle(forwardedRef, () => ({
    burst: (options) => engineRef.current?.burst(options),
    energy: (options) => engineRef.current?.energy(options),
    pulse: (options) => engineRef.current?.pulse(options),
    setEnergyAmbient: (options) => engineRef.current?.setEnergyAmbient(options),
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void import('./RevealFxEngine').then(({ RevealFxEngine: Engine }) => {
      if (cancelled) return;
      try {
        engineRef.current = new Engine(canvas, quality);
        onReadyRef.current?.(true);
      } catch {
        engineRef.current = null;
        onReadyRef.current?.(false);
      }
    }).catch(() => onReadyRef.current?.(false));
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
      onReadyRef.current?.(false);
    };
  }, [quality]);

  return <canvas ref={canvasRef} className="reveal-webgl-fx" aria-hidden="true"/>;
});

export default RevealFxLayer;
