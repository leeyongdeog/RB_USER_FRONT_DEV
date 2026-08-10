import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ResolvedQuality } from '../services/revealQuality';
import type { GiftBox3DEffectOptions, GiftBox3DEngine } from './GiftBox3DEngine';

export type GiftBox3DHandle = {
  impact: (options: GiftBox3DEffectOptions) => void;
  charge: (options: GiftBox3DEffectOptions) => void;
  transition: (options: GiftBox3DEffectOptions) => void;
  split: (color?: string) => void;
  open: (options: GiftBox3DEffectOptions) => void;
  setAmbientColor: (color: string) => void;
};

type GiftBox3DLayerProps = {
  quality: ResolvedQuality;
};

const GiftBox3DLayer = forwardRef<GiftBox3DHandle, GiftBox3DLayerProps>(function GiftBox3DLayer({ quality }, forwardedRef) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GiftBox3DEngine | null>(null);

  useImperativeHandle(forwardedRef, () => ({
    impact: (options) => engineRef.current?.impact(options),
    charge: (options) => engineRef.current?.charge(options),
    transition: (options) => engineRef.current?.transition(options),
    split: (color) => engineRef.current?.split(color),
    open: (options) => engineRef.current?.open(options),
    setAmbientColor: (color) => engineRef.current?.setAmbientColor(color),
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void import('./GiftBox3DEngine').then(({ GiftBox3DEngine: Engine }) => {
      if (!cancelled) engineRef.current = new Engine(canvas, quality);
    }).catch(() => { engineRef.current = null; });
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [quality]);

  return <canvas ref={canvasRef} className="gift3d-webgl" aria-hidden="true"/>;
});

export default GiftBox3DLayer;
