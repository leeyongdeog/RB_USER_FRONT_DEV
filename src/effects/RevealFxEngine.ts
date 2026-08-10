import * as THREE from 'three';
import type { ResolvedQuality } from '../services/revealQuality';

export type RevealFxOrigin = readonly [number, number];

export type RevealFxBurstOptions = {
  color: string;
  count?: number;
  origin?: RevealFxOrigin;
  speed?: number;
  spread?: number;
  gravity?: number;
  duration?: number;
  size?: number;
};

export type RevealFxPulseOptions = {
  color: string;
  origin?: RevealFxOrigin;
  strength?: number;
  duration?: number;
  radius?: number;
};

export type RevealFxEnergyOptions = {
  color: string;
  origin?: RevealFxOrigin;
  intensity?: number;
  duration?: number;
  radius?: number;
};

type FxProfile = {
  dpr: number;
  fps: number;
  capacity: number;
};

const FX_PROFILES: Record<ResolvedQuality, FxProfile> = {
  high: { dpr: 1.25, fps: 60, capacity: 240 },
  balanced: { dpr: 1, fps: 60, capacity: 160 },
  low: { dpr: .78, fps: 30, capacity: 84 },
  ultra: { dpr: .58, fps: 30, capacity: 48 },
};

const PARTICLE_VERTEX = /* glsl */ `
precision highp float;

attribute vec2 aVelocity;
attribute vec2 aLife;
attribute float aSeed;
attribute float aSize;
attribute vec3 aColor;

uniform float uTime;
uniform float uPixelRatio;
uniform float uAspect;

varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

void main() {
  float elapsed = uTime - aLife.x;
  float age = elapsed / max(aLife.y, 0.001);
  if (elapsed < 0.0 || age >= 1.0) {
    vColor = vec3(0.0);
    vAlpha = 0.0;
    vSeed = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }

  float drag = 2.35;
  float dragTime = (1.0 - exp(-drag * elapsed)) / drag;
  vec2 velocity = vec2(aVelocity.x / max(uAspect, 0.001), aVelocity.y);
  vec2 point = position.xy + velocity * dragTime;
  point.y -= position.z * elapsed * elapsed;
  point += vec2(
    sin(elapsed * (8.0 + aSeed * 5.0) + aSeed * 23.0),
    cos(elapsed * (6.0 + aSeed * 3.0) + aSeed * 17.0)
  ) * 0.012 * smoothstep(0.0, 0.35, age);

  float grow = smoothstep(0.0, 0.08, age);
  float fade = 1.0 - smoothstep(0.48, 1.0, age);
  gl_PointSize = aSize * uPixelRatio * mix(1.0, 0.28, age);
  gl_Position = vec4(point, 0.0, 1.0);
  vColor = aColor;
  vAlpha = grow * fade;
  vSeed = aSeed;
}
`;

const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float distanceToCenter = length(p);
  float core = 1.0 - smoothstep(0.0, 0.18, distanceToCenter);
  float halo = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
  float cross = exp(-abs(p.x) * 35.0) + exp(-abs(p.y) * 35.0);
  float sparkle = mix(halo, max(halo, cross * (1.0 - distanceToCenter)), step(0.67, vSeed));
  float alpha = sparkle * vAlpha;
  if (alpha < 0.01) discard;
  vec3 color = vColor * (0.75 + core * 2.8 + cross * 0.38);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

const WAVE_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const WAVE_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uStart;
uniform float uDuration;
uniform float uStrength;
uniform float uRadius;
uniform vec2 uOrigin;
uniform vec2 uResolution;
uniform vec3 uColor;

varying vec2 vUv;

void main() {
  float elapsed = uTime - uStart;
  float age = clamp(elapsed / max(uDuration, 0.001), 0.0, 1.0);
  float activeMask = step(0.0, elapsed) * (1.0 - step(1.0, age));
  vec2 ratio = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float distanceToOrigin = length((vUv - uOrigin) * ratio);
  float radius = mix(0.015, uRadius, pow(age, 0.68));
  float ringWidth = mix(0.025, 0.006, age);
  float ring = exp(-pow((distanceToOrigin - radius) / ringWidth, 2.0));
  float secondary = exp(-pow((distanceToOrigin - radius * 0.72) / (ringWidth * 1.4), 2.0)) * 0.42;
  float flash = exp(-distanceToOrigin * mix(2.3, 8.0, age)) * pow(1.0 - age, 2.4);
  float veil = pow(1.0 - age, 4.0) * 0.34;
  float intensity = (ring + secondary + flash * 1.8 + veil) * uStrength * activeMask;
  vec3 color = mix(uColor, vec3(1.0), clamp(flash + ring * 0.35, 0.0, 0.9));
  gl_FragColor = vec4(color * intensity, clamp(intensity, 0.0, 0.94));
}
`;

const ENERGY_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uStart;
uniform float uDuration;
uniform float uIntensity;
uniform float uAmbient;
uniform float uRadius;
uniform float uDetail;
uniform vec2 uOrigin;
uniform vec2 uResolution;
uniform vec3 uColor;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = noise21(p) * 0.52;
  p = p * 2.03 + 17.7;
  value += noise21(p) * 0.26;
  if (uDetail > 0.45) {
    p = p * 2.01 + 9.2;
    value += noise21(p) * 0.13;
  }
  if (uDetail > 0.8) {
    p = p * 2.04 + 4.8;
    value += noise21(p) * 0.065;
  }
  return value;
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (vUv - uOrigin) * aspect;
  float distanceToCenter = length(p);
  float angle = atan(p.y, p.x);
  float elapsed = uTime - uStart;
  float age = clamp(elapsed / max(uDuration, 0.001), 0.0, 1.0);
  float activeMask = step(0.0, elapsed) * (1.0 - step(1.0, age));
  float eventEnvelope = smoothstep(0.0, 0.13, age) * (1.0 - smoothstep(0.72, 1.0, age)) * activeMask;

  float fastTime = uTime * 1.55;
  float slowTime = uTime * 0.42;
  vec2 polarDirection = p / max(distanceToCenter, 0.0001);
  float boundaryNoiseA = fbm(polarDirection * 2.6 + vec2(slowTime * 0.55, fastTime * 0.54));
  float boundaryNoiseB = fbm(polarDirection * 4.3 + vec2(-slowTime * 0.7, fastTime * 0.77 + 7.3));
  float boundaryWave = sin(angle * 7.0 - fastTime * 2.7 + boundaryNoiseB * 7.0) * 0.016;
  float sphereRadius = uRadius * 0.78 + (boundaryNoiseA - 0.5) * 0.052 + (boundaryNoiseB - 0.5) * 0.024 + boundaryWave;
  float signedSphere = sphereRadius - distanceToCenter;
  float sphereMask = smoothstep(-0.026, 0.018, signedSphere);
  float softSphereMask = smoothstep(-0.095, 0.045, signedSphere);
  float boundaryCore = exp(-abs(signedSphere) * 70.0);
  float boundaryHalo = exp(-abs(signedSphere) * 19.0);

  vec2 driftA = vec2(cos(slowTime * 1.13), sin(slowTime * 0.91)) * 0.62;
  vec2 driftB = vec2(sin(slowTime * 1.37), cos(slowTime * 1.08)) * 0.51;
  float domainA = fbm(p * 5.3 + driftA);
  float domainB = fbm(p * 8.7 + driftB + vec2(domainA * 2.4, -domainA * 1.9));
  float domainC = fbm(p * 14.5 - driftA * 1.6 + vec2(domainB * 1.7, domainA * 1.3));
  float ridgeA = 1.0 - abs(domainB * 2.0 - 1.0);
  float ridgeB = 1.0 - abs(domainC * 2.0 - 1.0);
  float turbulentBody = (pow(ridgeA, 5.0) * 0.92 + pow(ridgeB, 9.0) * 0.72 + domainA * 0.3) * sphereMask;

  float branchA = pow(1.0 - abs(sin(angle * 4.0 + distanceToCenter * 26.0 - fastTime * 2.3 + domainA * 9.0)), 20.0);
  float branchB = pow(1.0 - abs(sin(angle * 7.0 - distanceToCenter * 34.0 + fastTime * 1.7 + domainB * 11.0)), 27.0);
  float branchC = pow(1.0 - abs(sin(angle * 11.0 + distanceToCenter * 41.0 - fastTime * 1.15 + domainC * 12.0)), 32.0);
  float branchMask = sphereMask * smoothstep(0.015, sphereRadius * 0.72, distanceToCenter);
  float lightning = (branchA * 1.35 + branchB + branchC * 0.65) * branchMask;

  float coronaNoise = fbm(polarDirection * 3.55 + vec2(slowTime, fastTime * 0.82));
  float coronaReach = 0.035 + coronaNoise * 0.11;
  float outerDistance = max(0.0, distanceToCenter - sphereRadius);
  float corona = exp(-outerDistance / max(coronaReach, 0.001) * 3.7) * (0.35 + coronaNoise * 0.95);
  corona *= 1.0 - smoothstep(sphereRadius + 0.19, sphereRadius + 0.3, distanceToCenter);
  float coronaThreads = pow(1.0 - abs(sin(angle * 13.0 + distanceToCenter * 39.0 - fastTime * 2.0 + coronaNoise * 10.0)), 25.0);
  coronaThreads *= corona * smoothstep(sphereRadius - 0.025, sphereRadius + 0.018, distanceToCenter);

  float dischargeBand = smoothstep(-0.012, 0.022, outerDistance)
    * (1.0 - smoothstep(0.24, 0.46, outerDistance));
  dischargeBand *= exp(-outerDistance * 4.2);
  float dischargeA = pow(1.0 - abs(sin(angle * 5.0 + distanceToCenter * 31.0 + domainA * 10.0 - fastTime * 2.7)), 38.0);
  float dischargeB = pow(1.0 - abs(sin(angle * 8.0 - distanceToCenter * 27.0 + domainB * 12.0 + fastTime * 2.1)), 46.0);
  float dischargeC = pow(1.0 - abs(sin(angle * 3.0 + distanceToCenter * 22.0 + domainC * 9.0 - fastTime * 3.4)), 34.0);
  float dischargeGate = smoothstep(0.32, 0.84, 0.5 + 0.5 * sin(fastTime * 7.5 + domainA * 8.0 + domainC * 5.0));
  float outwardDischarge = (dischargeA * 1.3 + dischargeB + dischargeC * 0.72)
    * dischargeBand * dischargeGate;

  float core = exp(-distanceToCenter * distanceToCenter * 112.0);
  float coreHot = exp(-distanceToCenter * distanceToCenter * 260.0);
  float coreHalo = exp(-distanceToCenter * distanceToCenter * 24.0);
  float sparks = step(0.987, noise21(p * 126.0 + fastTime * 5.3)) * softSphereMask;
  float flicker = 0.74 + 0.19 * sin(fastTime * 10.5 + domainA * 14.0) + 0.07 * sin(fastTime * 23.0);
  float eventStrobe = 0.82 + 0.42 * pow(0.5 + 0.5 * sin(fastTime * 13.0 + domainB * 8.0), 5.0);

  float ambientEnergy = uAmbient * flicker * (
    turbulentBody * 1.08 + lightning * 1.65 + boundaryCore * 1.7 + boundaryHalo * 0.82 + corona * 0.75 + coronaThreads * 1.5 + core * 1.05 + coreHalo * 0.46 + sparks * 1.8
  );
  float eventEnergy = eventEnvelope * uIntensity * flicker * eventStrobe * (
    turbulentBody * 1.52 + lightning * 2.15 + boundaryCore * 2.15 + boundaryHalo + corona * 1.15 + coronaThreads * 2.05 + outwardDischarge * 3.1 + core * 3.25 + coreHot * 4.4 + coreHalo * 1.35 + sparks * 2.2
  );
  float intensity = ambientEnergy + eventEnergy;
  float whiteMix = clamp(coreHot * 1.4 + core * 0.72 + lightning * 0.58 + outwardDischarge * 0.85 + boundaryCore * 0.24, 0.0, 0.96);
  vec3 energyColor = mix(uColor, vec3(1.0), whiteMix);
  float alpha = clamp(intensity * 0.72, 0.0, 0.98);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(energyColor * (1.15 + intensity * 0.72), alpha);
}
`;

const toColor = (value: string) => new THREE.Color(value);

export class RevealFxEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  private readonly particleGeometry = new THREE.BufferGeometry();
  private readonly particleMaterial: THREE.ShaderMaterial;
  private readonly waveMaterial: THREE.ShaderMaterial;
  private readonly energyMaterial: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly lives: Float32Array;
  private readonly seeds: Float32Array;
  private readonly sizes: Float32Array;
  private readonly colors: Float32Array;
  private readonly profile: FxProfile;
  private readonly resizeObserver: ResizeObserver;
  private readonly onVisibilityChange: () => void;
  private animationFrame = 0;
  private cursor = 0;
  private startedAt = performance.now();
  private lastFrameAt = 0;
  private disposed = false;
  private suspended = false;
  private seed = 0x51f15e;

  constructor(canvas: HTMLCanvasElement, quality: ResolvedQuality) {
    this.canvas = canvas;
    this.profile = FX_PROFILES[quality];
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

    const capacity = this.profile.capacity;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 2);
    this.lives = new Float32Array(capacity * 2);
    this.seeds = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 3);
    this.lives.fill(-1000);

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particleGeometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 2));
    this.particleGeometry.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 2));
    this.particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1));
    this.particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.particleGeometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uAspect: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.waveMaterial = new THREE.ShaderMaterial({
      vertexShader: WAVE_VERTEX,
      fragmentShader: WAVE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uStart: { value: -100 },
        uDuration: { value: 1 },
        uStrength: { value: 0 },
        uRadius: { value: .9 },
        uOrigin: { value: new THREE.Vector2(.5, .5) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uColor: { value: new THREE.Color('#ffffff') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.energyMaterial = new THREE.ShaderMaterial({
      vertexShader: WAVE_VERTEX,
      fragmentShader: ENERGY_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uStart: { value: -100 },
        uDuration: { value: 1 },
        uIntensity: { value: 0 },
        uAmbient: { value: 0 },
        uRadius: { value: .3 },
        uDetail: { value: quality === 'high' ? 1 : quality === 'balanced' ? .68 : quality === 'low' ? .4 : .2 },
        uOrigin: { value: new THREE.Vector2(.5, .5) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uColor: { value: new THREE.Color('#6eeaff') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const energy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.energyMaterial);
    energy.renderOrder = 0;
    const wave = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.waveMaterial);
    wave.renderOrder = 1;
    const particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
    particles.renderOrder = 2;
    this.scene.add(energy, wave, particles);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.onVisibilityChange = () => {
      this.suspended = document.hidden;
      if (!this.suspended && !this.animationFrame) this.animationFrame = requestAnimationFrame(this.render);
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.resize();
    this.prewarm();
    this.animationFrame = requestAnimationFrame(this.render);
  }

  burst(options: RevealFxBurstOptions) {
    const now = this.now();
    const origin = options.origin || [.5, .5];
    const baseColor = toColor(options.color);
    const count = Math.min(options.count || Math.round(this.profile.capacity * .55), this.profile.capacity);
    const speed = options.speed ?? 1.85;
    const spread = options.spread ?? Math.PI * 2;
    const duration = options.duration ?? 1.35;
    const size = options.size ?? 13;
    const gravity = options.gravity ?? .42;

    for (let index = 0; index < count; index += 1) {
      const slot = this.cursor++ % this.profile.capacity;
      const random = this.random();
      const angle = -Math.PI / 2 + (this.random() - .5) * spread;
      const velocity = speed * (.35 + this.random() * .75);
      const positionOffset = slot * 3;
      const velocityOffset = slot * 2;
      const lifeOffset = slot * 2;
      this.positions[positionOffset] = origin[0] * 2 - 1;
      this.positions[positionOffset + 1] = 1 - origin[1] * 2;
      this.positions[positionOffset + 2] = gravity * (.7 + this.random() * .7);
      this.velocities[velocityOffset] = Math.cos(angle) * velocity;
      this.velocities[velocityOffset + 1] = Math.sin(angle) * velocity;
      this.lives[lifeOffset] = now + index * .0015;
      this.lives[lifeOffset + 1] = duration * (.72 + this.random() * .44);
      this.seeds[slot] = random;
      this.sizes[slot] = size * (.55 + this.random() * .9);
      const tint = .72 + this.random() * .5;
      this.colors[positionOffset] = Math.min(1.8, baseColor.r * tint + (random > .82 ? .65 : 0));
      this.colors[positionOffset + 1] = Math.min(1.8, baseColor.g * tint + (random > .82 ? .65 : 0));
      this.colors[positionOffset + 2] = Math.min(1.8, baseColor.b * tint + (random > .82 ? .65 : 0));
    }
    this.markParticlesDirty();
  }

  pulse(options: RevealFxPulseOptions) {
    const origin = options.origin || [.5, .5];
    this.waveMaterial.uniforms.uStart.value = this.now();
    this.waveMaterial.uniforms.uDuration.value = options.duration ?? .9;
    this.waveMaterial.uniforms.uStrength.value = options.strength ?? 1;
    this.waveMaterial.uniforms.uRadius.value = options.radius ?? 1.05;
    this.waveMaterial.uniforms.uOrigin.value.set(origin[0], 1 - origin[1]);
    this.waveMaterial.uniforms.uColor.value.set(options.color);
  }

  setEnergyAmbient(options: RevealFxEnergyOptions) {
    const origin = options.origin || [.5, .5];
    this.energyMaterial.uniforms.uAmbient.value = options.intensity ?? .32;
    this.energyMaterial.uniforms.uRadius.value = options.radius ?? .3;
    this.energyMaterial.uniforms.uOrigin.value.set(origin[0], 1 - origin[1]);
    this.energyMaterial.uniforms.uColor.value.set(options.color);
  }

  energy(options: RevealFxEnergyOptions) {
    const origin = options.origin || [.5, .5];
    this.energyMaterial.uniforms.uStart.value = this.now();
    this.energyMaterial.uniforms.uDuration.value = options.duration ?? 2.4;
    this.energyMaterial.uniforms.uIntensity.value = options.intensity ?? 1;
    this.energyMaterial.uniforms.uRadius.value = options.radius ?? .3;
    this.energyMaterial.uniforms.uOrigin.value.set(origin[0], 1 - origin[1]);
    this.energyMaterial.uniforms.uColor.value.set(options.color);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) object.geometry.dispose();
    });
    this.particleMaterial.dispose();
    this.waveMaterial.dispose();
    this.energyMaterial.dispose();
    this.renderer.dispose();
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.suspended = true;
  };

  private readonly render = (time: number) => {
    this.animationFrame = 0;
    if (this.disposed || this.suspended) return;
    const minimumFrameDuration = 1000 / this.profile.fps;
    if (time - this.lastFrameAt >= minimumFrameDuration - .5) {
      this.lastFrameAt = time;
      const now = this.now();
      this.particleMaterial.uniforms.uTime.value = now;
      this.waveMaterial.uniforms.uTime.value = now;
      this.energyMaterial.uniforms.uTime.value = now;
      this.renderer.render(this.scene, this.camera);
    }
    this.animationFrame = requestAnimationFrame(this.render);
  };

  private prewarm() {
    this.particleMaterial.uniforms.uTime.value = 0;
    this.waveMaterial.uniforms.uTime.value = 0;
    this.energyMaterial.uniforms.uTime.value = 0;
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.renderer.setSize(width, height, false);
    this.particleMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    this.particleMaterial.uniforms.uAspect.value = width / height;
    this.waveMaterial.uniforms.uResolution.value.set(width, height);
    this.energyMaterial.uniforms.uResolution.value.set(width, height);
  }

  private markParticlesDirty() {
    for (const name of ['position', 'aVelocity', 'aLife', 'aSeed', 'aSize', 'aColor']) {
      const attribute = this.particleGeometry.getAttribute(name);
      attribute.needsUpdate = true;
    }
  }

  private now() {
    return (performance.now() - this.startedAt) / 1000;
  }

  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
