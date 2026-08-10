import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  KernelSize,
  RenderPass,
} from 'postprocessing';
import type { ResolvedQuality } from '../services/revealQuality';

type CapsuleSeamFxOptions = {
  color: string;
  duration?: number;
};

type SeamProfile = {
  dpr: number;
  fps: number;
  rayCount: number;
  bloom: boolean;
};

const SEAM_PROFILES: Record<ResolvedQuality, SeamProfile> = {
  high: { dpr: 1.1, fps: 60, rayCount: 58, bloom: true },
  balanced: { dpr: .9, fps: 45, rayCount: 46, bloom: true },
  low: { dpr: .68, fps: 30, rayCount: 34, bloom: false },
  ultra: { dpr: .5, fps: 24, rayCount: 24, bloom: false },
};

const RAY_VERTEX_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uProgress;
uniform float uAspect;

attribute float aAngle;
attribute float aLength;
attribute float aWidth;
attribute float aSeed;
attribute float aPhase;

varying vec2 vRayUv;
varying float vStrength;

void main() {
  float expansion = smoothstep(.04, .74, uProgress);
  float pulseA = .5 + .5 * sin(uTime * (2.1 + aSeed * 2.7) + aPhase);
  float pulseB = .5 + .5 * sin(uTime * (4.7 + aSeed * 1.9) - aPhase * .63);
  float irregular = clamp(.48 + pulseA * .34 + pulseB * .18, 0.0, 1.0);
  float activeLength = aLength * expansion * mix(.74, 1.0, irregular);
  float startRadius = mix(.11, .18, aSeed);
  float localX = startRadius + position.x * activeLength;
  float taper = mix(1.0, .2, smoothstep(0.0, 1.0, position.x));
  float localY = position.y * aWidth * taper;
  float angle = aAngle + sin(uTime * (.18 + aSeed * .24) + aPhase) * .009;
  float sine = sin(angle);
  float cosine = cos(angle);
  vec2 world = vec2(localX * cosine - localY * sine, localX * sine + localY * cosine);

  vRayUv = uv;
  vStrength = mix(.7, 1.08, pulseA) * mix(.86, 1.14, pulseB);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
}
`;

const RAY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uProgress;
uniform vec3 uColor;

varying vec2 vRayUv;
varying float vStrength;

void main() {
  float side = abs(vRayUv.y - .5) * 2.0;
  float outerGlow = exp(-side * side * .72);
  float middleGlow = exp(-side * side * 3.2);
  float softBody = 1.0 - smoothstep(.08, .68, side);
  float brightCore = 1.0 - smoothstep(0.0, .12, side);
  float headFade = smoothstep(0.0, .075, vRayUv.x);
  float tailFade = 1.0 - smoothstep(.64, 1.0, vRayUv.x);
  float envelope = smoothstep(.02, .18, uProgress) * (1.0 - smoothstep(.88, 1.0, uProgress));
  float glowPulse = .9 + .1 * sin(vRayUv.x * 17.0 + vStrength * 8.0);
  float alpha = (outerGlow * .48 + middleGlow * .38 + softBody * .48 + brightCore * .96)
    * headFade * tailFade * envelope * vStrength * glowPulse;
  if (alpha < .006) discard;
  vec3 color = mix(uColor, vec3(1.0), brightCore * .86);
  gl_FragColor = vec4(color * (1.65 + outerGlow * 1.15 + middleGlow * .7 + brightCore * 2.55), min(alpha, .98));
}
`;

const AURA_VERTEX_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const AURA_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAmbient;
uniform vec3 uColor;
varying vec2 vUv;

void main() {
  vec2 p = (vUv - .5) * 2.0;
  float radius = length(p);
  float pulse = .88 + .08 * sin(uTime * 2.3) + .04 * sin(uTime * 3.9 + 1.2);
  float body = exp(-radius * radius * 3.8);
  float ring = exp(-pow((radius - .44) * 14.0, 2.0));
  float cutoff = 1.0 - smoothstep(.72, 1.0, radius);
  float alpha = (body * .26 + ring * .34) * cutoff * pulse * uAmbient;
  if (alpha < .004) discard;
  vec3 auraColor = uColor * (1.08 + body * .34 + ring * .48);
  gl_FragColor = vec4(auraColor, min(alpha, .68));
}
`;

function seededRandom(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function createRayGeometry(rayCount: number) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -.5, 0,
    1, -.5, 0,
    1, .5, 0,
    0, -.5, 0,
    1, .5, 0,
    0, .5, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 0,
    1, 1,
    0, 1,
  ], 2));

  const angles = new Float32Array(rayCount);
  const lengths = new Float32Array(rayCount);
  const widths = new Float32Array(rayCount);
  const seeds = new Float32Array(rayCount);
  const phases = new Float32Array(rayCount);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < rayCount; index += 1) {
    const seed = seededRandom(index, 1);
    const widthSeed = seededRandom(index, 4);
    const hero = widthSeed > .86;
    angles[index] = index * goldenAngle + (seededRandom(index, 2) - .5) * .13;
    lengths[index] = 1.34 + seededRandom(index, 3) * .82;
    const irregularWidth = Math.pow(seededRandom(index, 6), 2.1);
    widths[index] = hero
      ? .09 + seededRandom(index, 5) * .10
      : .018 + irregularWidth * .054;
    seeds[index] = seed;
    phases[index] = seededRandom(index, 7) * Math.PI * 2;
  }

  geometry.setAttribute('aAngle', new THREE.InstancedBufferAttribute(angles, 1));
  geometry.setAttribute('aLength', new THREE.InstancedBufferAttribute(lengths, 1));
  geometry.setAttribute('aWidth', new THREE.InstancedBufferAttribute(widths, 1));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.instanceCount = rayCount;
  return geometry;
}

export class CapsuleSeamFxEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  private readonly rayMaterial: THREE.ShaderMaterial;
  private readonly auraMaterial: THREE.ShaderMaterial;
  private readonly profile: SeamProfile;
  private readonly composer: EffectComposer | null;
  private readonly resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private startedAt = performance.now();
  private effectStartedAt = -1;
  private effectDuration = 1.8;
  private lastFrameAt = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, quality: ResolvedQuality) {
    this.canvas = canvas;
    this.profile = SEAM_PROFILES[quality];
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dpr));
    this.camera.position.z = 1;

    this.rayMaterial = new THREE.ShaderMaterial({
      vertexShader: RAY_VERTEX_SHADER,
      fragmentShader: RAY_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uAspect: { value: 1 },
        uColor: { value: new THREE.Color('#7df6ff') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.scene.add(new THREE.Mesh(createRayGeometry(this.profile.rayCount), this.rayMaterial));

    this.auraMaterial = new THREE.ShaderMaterial({
      vertexShader: AURA_VERTEX_SHADER,
      fragmentShader: AURA_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAmbient: { value: 0 },
        uColor: { value: new THREE.Color('#7df6ff') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
    const aura = new THREE.Mesh(new THREE.PlaneGeometry(.86, .86), this.auraMaterial);
    aura.position.z = -.1;
    this.scene.add(aura);

    if (this.profile.bloom) {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new BloomEffect({
        blendFunction: BlendFunction.ADD,
        intensity: quality === 'high' ? 1.8 : 1.35,
        luminanceThreshold: .09,
        luminanceSmoothing: .58,
        mipmapBlur: true,
        kernelSize: KernelSize.MEDIUM,
      });
      composer.addPass(new EffectPass(this.camera, bloom));
      this.composer = composer;
    } else {
      this.composer = null;
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  charge({ color, duration = 1.8 }: CapsuleSeamFxOptions) {
    this.rayMaterial.uniforms.uColor.value.set(color);
    this.auraMaterial.uniforms.uColor.value.set(color);
    this.effectDuration = duration;
    this.effectStartedAt = this.now();
    this.rayMaterial.uniforms.uProgress.value = 0;
    if (!this.animationFrame) this.animationFrame = requestAnimationFrame(this.render);
  }

  setAmbient(active: boolean, color?: string) {
    if (color) {
      this.rayMaterial.uniforms.uColor.value.set(color);
      this.auraMaterial.uniforms.uColor.value.set(color);
    }
    this.auraMaterial.uniforms.uAmbient.value = active ? 1 : 0;
    if (active && !this.animationFrame) this.animationFrame = requestAnimationFrame(this.render);
    if (!active && this.effectStartedAt < 0) this.renderer.clear();
  }

  clear() {
    this.effectStartedAt = -1;
    this.rayMaterial.uniforms.uProgress.value = 0;
    this.renderer.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (object.material instanceof THREE.Material) object.material.dispose();
    });
    this.composer?.dispose();
    this.renderer.dispose();
  }

  private readonly render = (time: number) => {
    this.animationFrame = 0;
    if (this.disposed) return;
    const minimumFrameDuration = 1000 / this.profile.fps;
    if (time - this.lastFrameAt >= minimumFrameDuration - .5) {
      this.lastFrameAt = time;
      const now = this.now();
      this.rayMaterial.uniforms.uTime.value = now;
      this.auraMaterial.uniforms.uTime.value = now;
      if (this.effectStartedAt >= 0) {
        const progress = Math.min(1, (now - this.effectStartedAt) / this.effectDuration);
        this.rayMaterial.uniforms.uProgress.value = progress;
        if (progress >= 1) this.effectStartedAt = -1;
      }
      this.composer ? this.composer.render() : this.renderer.render(this.scene, this.camera);
    }
    if (this.effectStartedAt >= 0 || this.auraMaterial.uniforms.uAmbient.value > 0) {
      this.animationFrame = requestAnimationFrame(this.render);
    }
  };

  private resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const aspect = width / height;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.rayMaterial.uniforms.uAspect.value = aspect;
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
  }

  private now() {
    return (performance.now() - this.startedAt) / 1000;
  }
}
