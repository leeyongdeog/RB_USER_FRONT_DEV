import * as THREE from 'three';
import {
  Alpha, Color, Emitter, Life, Mass, PointZone, Position, RadialVelocity,
  Radius, Rate, RandomDrift, Scale, Span, SpriteRenderer, System, Vector3D,
} from 'three-nebula';
import {
  BloomEffect, ChromaticAberrationEffect, EffectComposer, EffectPass,
  NoiseEffect, RenderPass,
} from 'postprocessing';
import type { ResolvedQuality } from '../services/revealQuality';

export type GiftBox3DOrigin = readonly [number, number];

export type GiftBox3DEffectOptions = {
  color: string;
  origin?: GiftBox3DOrigin;
  intensity?: number;
};

type QualityProfile = {
  dpr: number;
  fps: number;
  capacity: number;
  ambient: number;
  arcs: number;
};

type AnimatedObject = {
  object: THREE.Object3D;
  material: THREE.Material & { opacity: number };
  startedAt: number;
  duration: number;
  update: (age: number, object: THREE.Object3D, material: THREE.Material & { opacity: number }) => void;
};

const QUALITY: Record<ResolvedQuality, QualityProfile> = {
  high: { dpr: 1.25, fps: 60, capacity: 360, ambient: 130, arcs: 9 },
  balanced: { dpr: 1, fps: 45, capacity: 220, ambient: 82, arcs: 6 },
  low: { dpr: .78, fps: 30, capacity: 110, ambient: 42, arcs: 3 },
  ultra: { dpr: .58, fps: 24, capacity: 58, ambient: 22, arcs: 1 },
};

const PARTICLE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 aVelocity;
attribute vec2 aLife;
attribute float aSeed;
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

void main() {
  float elapsed = uTime - aLife.x;
  float age = elapsed / max(aLife.y, 0.001);
  if (elapsed < 0.0 || age >= 1.0) {
    vAlpha = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(4.0, 4.0, 4.0, 1.0);
    return;
  }
  float drag = 1.55;
  float travel = (1.0 - exp(-drag * elapsed)) / drag;
  vec3 p = position + aVelocity * travel;
  p.y -= max(0.0, aSeed - 0.68) * elapsed * elapsed * 1.3;
  p += vec3(
    sin(elapsed * (8.0 + aSeed * 5.0) + aSeed * 21.0),
    cos(elapsed * (7.0 + aSeed * 4.0) + aSeed * 13.0),
    sin(elapsed * 6.0 + aSeed * 31.0)
  ) * 0.035 * smoothstep(0.0, 0.3, age);
  vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  float perspective = 8.0 / max(2.0, -viewPosition.z);
  gl_PointSize = aSize * uPixelRatio * perspective * mix(1.0, .34, age);
  vColor = aColor;
  vAlpha = smoothstep(0.0, .055, age) * (1.0 - smoothstep(.48, 1.0, age));
  vSeed = aSeed;
}
`;

const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 p = gl_PointCoord - .5;
  float d = length(p);
  float halo = 1.0 - smoothstep(.06, .5, d);
  float core = 1.0 - smoothstep(0.0, .13, d);
  float cross = exp(-abs(p.x) * 34.0) + exp(-abs(p.y) * 34.0);
  float shape = mix(halo, max(halo, cross * (1.0 - d)), step(.58, vSeed));
  float alpha = shape * vAlpha;
  if (alpha < .008) discard;
  vec3 color = vColor * (.82 + core * 3.3 + cross * .34);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

const AMBIENT_VERTEX = /* glsl */ `
precision highp float;
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  vec3 p = position;
  float angle = uTime * (.08 + aSeed * .11) + aSeed * 16.0;
  mat2 spin = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  p.xz = spin * p.xz;
  p.y += sin(uTime * (.7 + aSeed) + aSeed * 29.0) * .18;
  vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = aSize * uPixelRatio * 7.0 / max(2.0, -viewPosition.z);
  vAlpha = .18 + .5 * pow(.5 + .5 * sin(uTime * 1.6 + aSeed * 44.0), 4.0);
}
`;

const AMBIENT_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - .5);
  float alpha = (1.0 - smoothstep(.05, .5, d)) * vAlpha;
  if (alpha < .006) discard;
  gl_FragColor = vec4(uColor * (1.35 + (1.0 - d) * 1.7) * alpha, alpha);
}
`;

const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInOut = (value: number) => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

export class GiftBox3DEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly profile: QualityProfile;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer | null;
  private readonly bloomEffect: BloomEffect | null;
  private readonly chromaticEffect: ChromaticAberrationEffect | null;
  private readonly noiseEffect: NoiseEffect | null;
  private readonly nebulaSystem: System | null;
  private readonly nebulaEmitter: Emitter | null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 50);
  private readonly world = new THREE.Group();
  private readonly orbitGroup = new THREE.Group();
  private readonly ambientGroup = new THREE.Group();
  private readonly particleGeometry = new THREE.BufferGeometry();
  private readonly particleMaterial: THREE.ShaderMaterial;
  private readonly ambientMaterial: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly lives: Float32Array;
  private readonly seeds: Float32Array;
  private readonly sizes: Float32Array;
  private readonly colors: Float32Array;
  private readonly animated: AnimatedObject[] = [];
  private readonly resizeObserver: ResizeObserver;
  private cursor = 0;
  private animationFrame = 0;
  private startedAt = performance.now();
  private lastFrameAt = 0;
  private disposed = false;
  private suspended = false;
  private seed = 0x7f4a7c15;
  private ambientColor = new THREE.Color('#8deeff');
  private postFxEnergy = 0;

  constructor(canvas: HTMLCanvasElement, quality: ResolvedQuality) {
    this.canvas = canvas;
    this.profile = QUALITY[quality];
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dpr));
    this.camera.position.set(0, .05, 7.3);
    this.scene.add(this.world);
    this.world.add(this.ambientGroup, this.orbitGroup);

    const postProcessingEnabled = quality === 'high' || quality === 'balanced';
    if (postProcessingEnabled) {
      this.bloomEffect = new BloomEffect({
        intensity: quality === 'high' ? 1.72 : 1.28,
        luminanceThreshold: .05,
        luminanceSmoothing: .34,
        mipmapBlur: true,
        radius: quality === 'high' ? .72 : .6,
        levels: quality === 'high' ? 6 : 4,
      });
      this.chromaticEffect = new ChromaticAberrationEffect({
        offset: new THREE.Vector2(0, 0),
        radialModulation: true,
        modulationOffset: .2,
      });
      this.noiseEffect = new NoiseEffect({ premultiply: true });
      this.noiseEffect.blendMode.opacity.value = quality === 'high' ? .035 : .022;
      this.composer = new EffectComposer(this.renderer, { multisampling: 0 });
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new EffectPass(this.camera, this.bloomEffect, this.chromaticEffect, this.noiseEffect));
    } else {
      this.bloomEffect = null;
      this.chromaticEffect = null;
      this.noiseEffect = null;
      this.composer = null;
    }

    if (quality === 'high' || quality === 'balanced') {
      this.nebulaSystem = new System(quality === 'high' ? 180 : 100);
      this.nebulaEmitter = new Emitter()
        .setRate(new Rate(new Span(quality === 'high' ? 5 : 3, quality === 'high' ? 9 : 6), new Span(.07, .15)))
        .setInitializers([
          new Position(new PointZone(0, 0, .1)),
          new Mass(1),
          new Radius(quality === 'high' ? .045 : .035, quality === 'high' ? .11 : .08),
          new Life(.7, 1.4),
          new RadialVelocity(1.2, new Vector3D(0, 1, 0), 180),
        ])
        .setBehaviours([
          new Alpha(.78, 0),
          new Scale(.15, 1.35),
          new Color('#ffffff', `#${this.ambientColor.getHexString()}`),
          new RandomDrift(.18, .18, .12, .08),
        ])
        .emit();
      this.nebulaSystem
        .addRenderer(new SpriteRenderer(this.world, THREE))
        .addEmitter(this.nebulaEmitter);
    } else {
      this.nebulaSystem = null;
      this.nebulaEmitter = null;
    }

    const capacity = this.profile.capacity;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.lives = new Float32Array(capacity * 2);
    this.seeds = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 3);
    this.lives.fill(-1000);
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particleGeometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
    this.particleGeometry.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 2));
    this.particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1));
    this.particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.particleGeometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.world.add(new THREE.Points(this.particleGeometry, this.particleMaterial));

    const ambientGeometry = new THREE.BufferGeometry();
    const ambientPositions = new Float32Array(this.profile.ambient * 3);
    const ambientSizes = new Float32Array(this.profile.ambient);
    const ambientSeeds = new Float32Array(this.profile.ambient);
    for (let index = 0; index < this.profile.ambient; index += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = 1.25 + this.random() * 3.15;
      ambientPositions[index * 3] = Math.cos(angle) * radius;
      ambientPositions[index * 3 + 1] = (this.random() - .5) * 4.6;
      ambientPositions[index * 3 + 2] = Math.sin(angle) * radius - 1.1;
      ambientSizes[index] = 5 + this.random() * 10;
      ambientSeeds[index] = this.random();
    }
    ambientGeometry.setAttribute('position', new THREE.BufferAttribute(ambientPositions, 3));
    ambientGeometry.setAttribute('aSize', new THREE.BufferAttribute(ambientSizes, 1));
    ambientGeometry.setAttribute('aSeed', new THREE.BufferAttribute(ambientSeeds, 1));
    this.ambientMaterial = new THREE.ShaderMaterial({
      vertexShader: AMBIENT_VERTEX,
      fragmentShader: AMBIENT_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uColor: { value: this.ambientColor },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ambientGroup.add(new THREE.Points(ambientGeometry, this.ambientMaterial));
    this.createAmbientRings();

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.render);
  }

  setAmbientColor(color: string) {
    this.ambientColor.set(color);
    this.ambientMaterial.uniforms.uColor.value.copy(this.ambientColor);
    if (this.nebulaEmitter) {
      const colorBehaviour = this.nebulaEmitter.behaviours.find((behaviour) => behaviour instanceof Color) as Color | undefined;
      colorBehaviour?.reset('#ffffff', `#${this.ambientColor.getHexString()}`);
    }
  }

  impact({ color, origin = [0, 0], intensity = 1 }: GiftBox3DEffectOptions) {
    this.kickPostFx(.72 * intensity);
    this.setAmbientColor(color);
    this.spawnBurst(color, Math.round(this.profile.capacity * .34 * intensity), origin, 3.35 * intensity, .82);
    this.createLaserBurst(color, origin, intensity, 0);
    this.createLaserBurst('#ffffff', origin, intensity * .72, .075);
    this.createShockwave('#ffffff', origin, .58, 1.3 * intensity);
    this.createShockwave(color, origin, .82, intensity, .055);
    this.createArcs(color, origin, Math.max(2, Math.round(this.profile.arcs * .72 * intensity)), .66, 1.75);
    this.createFlash('#ffffff', .25, .2 * intensity);
    this.impulseCamera(.115 * intensity);
  }

  charge({ color, origin = [0, 0], intensity = 1 }: GiftBox3DEffectOptions) {
    this.kickPostFx(.92 * intensity);
    this.setAmbientColor(color);
    this.spawnAttractor(color, Math.round(this.profile.capacity * .55 * intensity), origin);
    this.createOrbitCharge(color, intensity * 1.2);
    this.createShockwave(color, origin, 1.32, 1.72 * intensity);
    this.createShockwave('#ffffff', origin, 1.04, 1.15 * intensity, .12);
    this.createArcs(color, origin, Math.max(2, this.profile.arcs), 1.36, 3.6);
    this.impulseCamera(.08 * intensity);
  }

  transition({ color, origin = [0, 0], intensity = 1 }: GiftBox3DEffectOptions) {
    this.kickPostFx(1.35 * intensity);
    this.setAmbientColor(color);
    this.spawnBurst(color, Math.round(this.profile.capacity * .62 * intensity), origin, 4.2 * intensity, 1.2);
    this.createShockwave(color, origin, 1.55, 1.45 * intensity);
    this.createShockwave('#ffffff', origin, 1.15, intensity, .12);
    this.createFlash(color, 1.2, .88 * intensity);
    this.createArcs(color, origin, this.profile.arcs + 1, 1.04, 4.2);
    this.impulseCamera(.16 * intensity);
  }

  split(color = '#63f4ff') {
    this.kickPostFx(1.48);
    this.setAmbientColor(color);
    this.spawnBurst(color, Math.round(this.profile.capacity * .72), [-.04, 0], 4.6, 1.15);
    this.createShockwave(color, [-.28, 0], 1.4, 1.5);
    this.createShockwave('#a76dff', [.28, 0], 1.4, 1.5, .1);
    this.createArcs(color, [-.18, 0], this.profile.arcs, 1.15, 3.2);
    this.createArcs('#a76dff', [.18, 0], this.profile.arcs, 1.15, 3.2);
    this.createFlash('#7df8ff', 1.15, .9);
  }

  open({ color, origin = [0, 0], intensity = 1 }: GiftBox3DEffectOptions) {
    this.kickPostFx(1.75 * intensity);
    this.setAmbientColor(color);
    this.spawnBurst(color, Math.round(this.profile.capacity * .95 * intensity), origin, 6.1 * intensity, 1.65);
    this.createShockwave('#ffffff', origin, 1.45, 2.2 * intensity);
    this.createShockwave(color, origin, 1.8, 1.8 * intensity, .1);
    this.createShockwave(color, origin, 2.05, 1.35 * intensity, .22);
    this.createArcs(color, origin, this.profile.arcs + 2, 1.4, 5.1);
    this.createLaserBurst(color, origin, intensity * 1.18, .03);
    this.createLaserBurst('#ffffff', origin, intensity * .75, .1);
    this.createFlash(color, 1.45, 1.08);
    this.createLightRays(color, origin, intensity);
    this.impulseCamera(.23 * intensity);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.nebulaSystem?.destroy();
    this.composer?.dispose();
    this.renderer.dispose();
  }

  private kickPostFx(strength: number) {
    this.postFxEnergy = Math.max(this.postFxEnergy, Math.min(2.2, strength));
    if (this.nebulaEmitter) {
      this.nebulaEmitter.setRate(new Rate(new Span(10, 20), new Span(.025, .06))).emit(.72);
    }
  }

  private random() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }

  private createAmbientRings() {
    const ringCount = this.profile === QUALITY.ultra ? 1 : 3;
    for (let index = 0; index < ringCount; index += 1) {
      const geometry = new THREE.TorusGeometry(1.65 + index * .48, .012 + index * .004, 5, 80);
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? '#9b75ff' : '#6eeeff',
        transparent: true,
        opacity: .16 - index * .025,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.set(.25 + index * .48, index * .6, index * .4);
      ring.userData.speed = (index % 2 ? -1 : 1) * (.1 + index * .035);
      ring.userData.baseOpacity = material.opacity;
      this.orbitGroup.add(ring);
    }
    const floorGeometry = new THREE.RingGeometry(1.25, 1.35, 96);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: '#76ecff', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, -1.38, -.3);
    floor.rotation.x = 1.25;
    floor.userData.baseOpacity = floorMaterial.opacity;
    this.orbitGroup.add(floor);
  }

  private spawnBurst(colorValue: string, count: number, origin: GiftBox3DOrigin, speed: number, duration: number) {
    const color = new THREE.Color(colorValue);
    const now = (performance.now() - this.startedAt) / 1000;
    for (let index = 0; index < Math.min(count, this.profile.capacity); index += 1) {
      const slot = this.cursor++ % this.profile.capacity;
      const angle = this.random() * Math.PI * 2;
      const elevation = (this.random() - .5) * Math.PI * .95;
      const velocity = speed * (.4 + this.random() * .86);
      this.positions[slot * 3] = origin[0] * 3.2 + (this.random() - .5) * .18;
      this.positions[slot * 3 + 1] = origin[1] * 2.4 + (this.random() - .5) * .18;
      this.positions[slot * 3 + 2] = (this.random() - .5) * .25;
      this.velocities[slot * 3] = Math.cos(angle) * Math.cos(elevation) * velocity;
      this.velocities[slot * 3 + 1] = Math.sin(angle) * Math.cos(elevation) * velocity;
      this.velocities[slot * 3 + 2] = Math.sin(elevation) * velocity + this.random() * 2.1;
      this.lives[slot * 2] = now + this.random() * .08;
      this.lives[slot * 2 + 1] = duration * (.72 + this.random() * .52);
      this.seeds[slot] = this.random();
      this.sizes[slot] = 7 + this.random() * 15;
      const white = this.random() > .68 ? .72 : 0;
      this.colors[slot * 3] = THREE.MathUtils.lerp(color.r, 1, white);
      this.colors[slot * 3 + 1] = THREE.MathUtils.lerp(color.g, 1, white);
      this.colors[slot * 3 + 2] = THREE.MathUtils.lerp(color.b, 1, white);
    }
    this.markParticleAttributes();
  }

  private spawnAttractor(colorValue: string, count: number, origin: GiftBox3DOrigin) {
    const color = new THREE.Color(colorValue);
    const now = (performance.now() - this.startedAt) / 1000;
    for (let index = 0; index < Math.min(count, this.profile.capacity); index += 1) {
      const slot = this.cursor++ % this.profile.capacity;
      const angle = this.random() * Math.PI * 2;
      const radius = 2.2 + this.random() * 2.4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      this.positions[slot * 3] = origin[0] * 3.2 + x;
      this.positions[slot * 3 + 1] = origin[1] * 2.4 + y;
      this.positions[slot * 3 + 2] = -1.2 + this.random() * 2.3;
      this.velocities[slot * 3] = -x * (1.7 + this.random() * .6) - y * .34;
      this.velocities[slot * 3 + 1] = -y * (1.7 + this.random() * .6) + x * .34;
      this.velocities[slot * 3 + 2] = .4 + this.random() * 1.1;
      this.lives[slot * 2] = now + this.random() * .18;
      this.lives[slot * 2 + 1] = .9 + this.random() * .35;
      this.seeds[slot] = this.random();
      this.sizes[slot] = 6 + this.random() * 11;
      this.colors[slot * 3] = color.r;
      this.colors[slot * 3 + 1] = color.g;
      this.colors[slot * 3 + 2] = color.b;
    }
    this.markParticleAttributes();
  }

  private markParticleAttributes() {
    ['position', 'aVelocity', 'aLife', 'aSeed', 'aSize', 'aColor'].forEach((name) => {
      const attribute = this.particleGeometry.getAttribute(name) as THREE.BufferAttribute;
      attribute.needsUpdate = true;
    });
  }

  private createShockwave(color: string, origin: GiftBox3DOrigin, duration: number, strength: number, delay = 0) {
    const geometry = new THREE.TorusGeometry(.17, .018 * strength, 6, 96);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.set(origin[0] * 3.2, origin[1] * 2.4, .25);
    ring.scale.setScalar(.15);
    this.world.add(ring);
    this.animated.push({
      object: ring,
      material,
      startedAt: performance.now() + delay * 1000,
      duration,
      update: (age, object, targetMaterial) => {
        const scale = .2 + easeOut(age) * (15 + strength * 5);
        object.scale.setScalar(scale);
        object.rotation.z = age * .35;
        targetMaterial.opacity = Math.sin(Math.min(1, age * 3) * Math.PI / 2) * Math.pow(1 - age, 1.8) * .82;
      },
    });
  }

  private createArcs(color: string, origin: GiftBox3DOrigin, count: number, duration: number, reach: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / Math.max(1, count)) * Math.PI * 2 + this.random() * .7;
      const length = reach * (.65 + this.random() * .6);
      const segments = this.profile === QUALITY.ultra ? 5 : 10;
      const points: THREE.Vector3[] = [];
      for (let segment = 0; segment <= segments; segment += 1) {
        const ratio = segment / segments;
        const jitter = Math.sin(ratio * Math.PI) * .2;
        points.push(new THREE.Vector3(
          origin[0] * 3.2 + Math.cos(angle) * length * ratio + (this.random() - .5) * jitter,
          origin[1] * 2.4 + Math.sin(angle) * length * ratio + (this.random() - .5) * jitter,
          .25 + Math.sin(ratio * Math.PI) * (.25 + this.random() * .75),
        ));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const line = new THREE.Line(geometry, material);
      this.world.add(line);
      this.animated.push({
        object: line,
        material,
        startedAt: performance.now() + this.random() * 160,
        duration: duration * (.7 + this.random() * .5),
        update: (age, object, targetMaterial) => {
          object.scale.setScalar(.12 + easeOut(age) * .95);
          targetMaterial.opacity = Math.pow(Math.sin(age * Math.PI), .48) * (.45 + this.random() * .5);
        },
      });
    }
  }

  private createLaserBurst(color: string, origin: GiftBox3DOrigin, intensity: number, delay: number) {
    const qualityCount = this.profile === QUALITY.high
      ? 44
      : this.profile === QUALITY.balanced
        ? 34
        : this.profile === QUALITY.low
          ? 22
          : 12;
    const count = Math.max(8, Math.round(qualityCount * Math.min(1.18, intensity)));
    const rays = Array.from({ length: count }, (_, index) => ({
      angle: index / count * Math.PI * 2 + (this.random() - .5) * .12,
      length: (2.9 + this.random() * 4.8) * (.88 + intensity * .13),
      width: .026 + this.random() * .105,
      inset: .12 + this.random() * .2,
    }));

    const createGeometry = (widthScale: number, lengthScale: number) => {
      const positions = new Float32Array(count * 12);
      const indices = new Uint16Array(count * 6);
      rays.forEach((ray, index) => {
        const directionX = Math.cos(ray.angle);
        const directionY = Math.sin(ray.angle);
        const perpendicularX = -directionY;
        const perpendicularY = directionX;
        const near = ray.inset;
        const far = ray.length * lengthScale;
        const nearWidth = ray.width * widthScale;
        const farWidth = nearWidth * .06;
        const positionOffset = index * 12;
        positions.set([
          directionX * near + perpendicularX * nearWidth, directionY * near + perpendicularY * nearWidth, 0,
          directionX * near - perpendicularX * nearWidth, directionY * near - perpendicularY * nearWidth, 0,
          directionX * far + perpendicularX * farWidth, directionY * far + perpendicularY * farWidth, 0,
          directionX * far - perpendicularX * farWidth, directionY * far - perpendicularY * farWidth, 0,
        ], positionOffset);
        const vertexOffset = index * 4;
        indices.set([
          vertexOffset, vertexOffset + 1, vertexOffset + 2,
          vertexOffset + 1, vertexOffset + 3, vertexOffset + 2,
        ], index * 6);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      return geometry;
    };

    const addLayer = (layerColor: string, widthScale: number, lengthScale: number, opacity: number, duration: number, z: number) => {
      const geometry = createGeometry(widthScale, lengthScale);
      const material = new THREE.MeshBasicMaterial({
        color: layerColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(origin[0] * 3.2, origin[1] * 2.4, z);
      mesh.scale.setScalar(.035);
      this.world.add(mesh);
      this.animated.push({
        object: mesh,
        material,
        startedAt: performance.now() + delay * 1000,
        duration,
        update: (age, object, targetMaterial) => {
          const growth = easeOut(Math.min(1, age / .32));
          object.scale.setScalar(.035 + growth * 1.08);
          object.rotation.z = age * (delay ? -.035 : .045);
          const attack = Math.min(1, age * 16);
          targetMaterial.opacity = attack * Math.pow(1 - age, 1.45) * opacity;
        },
      });
    };

    addLayer(color, 1.75, 1, .62, .58, .42);
    addLayer('#ffffff', .34, .96, 1, .43, .48);
  }

  private createOrbitCharge(color: string, intensity: number) {
    for (let index = 0; index < 3; index += 1) {
      const geometry = new THREE.TorusGeometry(.7 + index * .24, .025, 6, 72);
      const material = new THREE.MeshBasicMaterial({ color: index === 1 ? '#ffffff' : color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.set(index * .7, index * .55, 0);
      this.world.add(ring);
      this.animated.push({
        object: ring,
        material,
        startedAt: performance.now() + index * 80,
        duration: 1.05,
        update: (age, object, targetMaterial) => {
          const scale = .25 + easeInOut(age) * (1.25 + intensity * .25);
          object.scale.setScalar(scale);
          object.rotation.x += .055 * (index + 1);
          object.rotation.y -= .045 * (index + 1);
          targetMaterial.opacity = Math.sin(age * Math.PI) * .78;
        },
      });
    }
  }

  private createFlash(color: string, duration: number, strength: number) {
    const geometry = new THREE.PlaneGeometry(28, 18);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.z = 4.3;
    this.world.add(plane);
    this.animated.push({
      object: plane,
      material,
      startedAt: performance.now(),
      duration,
      update: (age, _object, targetMaterial) => {
        const envelope = age < .34 ? Math.pow(age / .34, 2.4) : Math.pow(1 - (age - .34) / .66, 2.2);
        targetMaterial.opacity = Math.min(.92, envelope * strength);
      },
    });
  }

  private createLightRays(color: string, origin: GiftBox3DOrigin, intensity: number) {
    if (this.profile === QUALITY.ultra) return;
    const count = this.profile === QUALITY.low ? 5 : 10;
    for (let index = 0; index < count; index += 1) {
      const geometry = new THREE.PlaneGeometry(.08 + this.random() * .14, 2.6 + this.random() * 2.4);
      const material = new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? '#ffffff' : color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const ray = new THREE.Mesh(geometry, material);
      const angle = index / count * Math.PI * 2 + this.random() * .35;
      ray.position.set(origin[0] * 3.2 + Math.cos(angle) * 1.45, origin[1] * 2.4 + Math.sin(angle) * 1.45, -.2 + this.random());
      ray.rotation.z = angle - Math.PI / 2;
      this.world.add(ray);
      this.animated.push({
        object: ray,
        material,
        startedAt: performance.now() + this.random() * 90,
        duration: 1.05,
        update: (age, object, targetMaterial) => {
          object.scale.y = .08 + easeOut(age) * intensity;
          targetMaterial.opacity = Math.sin(age * Math.PI) * .34;
        },
      });
    }
  }

  private impulseCamera(strength: number) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    const marker = new THREE.Object3D();
    this.animated.push({
      object: marker,
      material,
      startedAt: performance.now(),
      duration: .42,
      update: (age) => {
        const decay = 1 - age;
        this.camera.position.x = Math.sin(age * 78) * strength * decay;
        this.camera.position.y = .05 + Math.cos(age * 66) * strength * .65 * decay;
      },
    });
  }

  private resize = () => {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private handleVisibility = () => {
    this.suspended = document.hidden;
    if (!this.suspended && !this.animationFrame) this.animationFrame = requestAnimationFrame(this.render);
  };

  private render = (now: number) => {
    this.animationFrame = 0;
    if (this.disposed || this.suspended) return;
    const minimumFrame = 1000 / this.profile.fps;
    if (now - this.lastFrameAt < minimumFrame) {
      this.animationFrame = requestAnimationFrame(this.render);
      return;
    }
    this.lastFrameAt = now;
    const time = (now - this.startedAt) / 1000;
    void this.nebulaSystem?.update(minimumFrame / 1000);
    this.postFxEnergy *= .9;
    if (this.bloomEffect) this.bloomEffect.intensity = 1.18 + this.postFxEnergy * 1.22;
    if (this.chromaticEffect) {
      const chromaticAmount = this.postFxEnergy * .0045;
      this.chromaticEffect.offset.set(
        Math.sin(time * 37) * chromaticAmount,
        Math.cos(time * 29) * chromaticAmount * .55,
      );
    }
    this.particleMaterial.uniforms.uTime.value = time;
    this.ambientMaterial.uniforms.uTime.value = time;
    this.ambientGroup.rotation.z = Math.sin(time * .12) * .12;
    this.orbitGroup.children.forEach((child) => {
      child.rotation.z += Number(child.userData.speed || .002);
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        const baseOpacity = Number(child.userData.baseOpacity ?? child.material.opacity);
        child.material.opacity = baseOpacity * (.92 + Math.sin(time * 1.3 + child.id) * .08);
      }
    });
    for (let index = this.animated.length - 1; index >= 0; index -= 1) {
      const item = this.animated[index];
      const age = (now - item.startedAt) / (item.duration * 1000);
      if (age < 0) continue;
      if (age >= 1) {
        this.world.remove(item.object);
        const geometryObject = item.object as THREE.Object3D & { geometry?: THREE.BufferGeometry };
        geometryObject.geometry?.dispose();
        item.material.dispose();
        this.animated.splice(index, 1);
        continue;
      }
      item.update(age, item.object, item.material);
    }
    if (!this.animated.some((item) => item.object.type === 'Object3D')) {
      this.camera.position.x *= .82;
      this.camera.position.y = .05 + (this.camera.position.y - .05) * .82;
    }
    this.camera.lookAt(0, 0, 0);
    if (this.composer) this.composer.render(minimumFrame / 1000);
    else this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.render);
  };
}
