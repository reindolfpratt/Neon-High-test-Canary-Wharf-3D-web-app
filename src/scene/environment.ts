import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { QualityPreset, TimeOfDay } from './layout';

// Custom single-pass GPU Cinematic GT6 Shader:
// 1. Screen-Space Reflections (SSR) on damp tarmac & polished granite
// 2. Depth-occluded Volumetric God Rays (crepuscular sun shafts between skyscrapers)
// 3. Per-pixel Camera-Velocity Motion Blur
// 4. Optional Subtle Depth of Field + GT6 Vignette
const CinematicGT6Shader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCameraNear: { value: 0.15 },
    uCameraFar: { value: 950.0 },
    uInvProjection: { value: new THREE.Matrix4() },
    uCameraWorldMatrix: { value: new THREE.Matrix4() },
    uViewProjMatrix: { value: new THREE.Matrix4() },
    uPrevViewProjMatrix: { value: new THREE.Matrix4() },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
    uSunColor: { value: new THREE.Color(0xffb86c) },
    uGodRayStrength: { value: 0.32 },
    uSsrStrength: { value: 0.36 },
    uMotionBlurStrength: { value: 0.45 },
    uDofStrength: { value: 0.0 },
    uNightFactor: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform mat4 uInvProjection;
    uniform mat4 uCameraWorldMatrix;
    uniform mat4 uViewProjMatrix;
    uniform mat4 uPrevViewProjMatrix;
    uniform vec2 uSunScreenPos;
    uniform vec3 uSunColor;
    uniform float uGodRayStrength;
    uniform float uSsrStrength;
    uniform float uMotionBlurStrength;
    uniform float uDofStrength;
    uniform float uNightFactor;

    varying vec2 vUv;

    vec3 reconstructWorldPos(vec2 uv, float depth) {
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewPos = uInvProjection * clip;
      viewPos /= viewPos.w;
      return (uCameraWorldMatrix * viewPos).xyz;
    }

    float linearizeDepth(float depth) {
      float z = depth * 2.0 - 1.0;
      return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
    }

    void main() {
      float depth = texture2D(tDepth, vUv).r;
      vec3 baseColor = texture2D(tDiffuse, vUv).rgb;
      vec3 worldPos = reconstructWorldPos(vUv, depth);

      // 1. Per-pixel Camera-Velocity Motion Blur (skipped on sky so horizon stays crisp)
      vec3 color = baseColor;
      if (uMotionBlurStrength > 0.001 && depth < 0.9998) {
        vec4 prevClip = uPrevViewProjMatrix * vec4(worldPos, 1.0);
        if (prevClip.w > 0.05) {
          vec2 prevUv = (prevClip.xy / prevClip.w) * 0.5 + 0.5;
          vec2 vel = (vUv - prevUv) * uMotionBlurStrength;
          float speed = length(vel);
          if (speed > 0.0008) {
            vel = normalize(vel) * min(speed, 0.018);
            vec3 accum = baseColor;
            for (int i = 1; i <= 4; i++) {
              vec2 suv = clamp(vUv - vel * (float(i) / 4.0), vec2(0.002), vec2(0.998));
              accum += texture2D(tDiffuse, suv).rgb;
            }
            color = accum / 5.0;
          }
        }
      }

      // 2. Subtle Cinematic Depth of Field (Ultra preset: soft distant architectural bokeh)
      if (uDofStrength > 0.001 && depth < 0.9995) {
        float linD = linearizeDepth(depth);
        float coc = clamp((linD - 115.0) / 260.0, 0.0, 1.0) * uDofStrength;
        if (coc > 0.05) {
          vec2 px = (1.0 / uResolution) * (1.8 * coc);
          vec3 dof = color * 0.4;
          dof += texture2D(tDiffuse, clamp(vUv + vec2(px.x, px.y), 0.002, 0.998)).rgb * 0.15;
          dof += texture2D(tDiffuse, clamp(vUv + vec2(-px.x, px.y), 0.002, 0.998)).rgb * 0.15;
          dof += texture2D(tDiffuse, clamp(vUv + vec2(px.x, -px.y), 0.002, 0.998)).rgb * 0.15;
          dof += texture2D(tDiffuse, clamp(vUv + vec2(-px.x, -px.y), 0.002, 0.998)).rgb * 0.15;
          color = mix(color, dof, coc * 0.72);
        }
      }

      // 3. Screen-Space Reflections (SSR) on damp London roadways & polished granite plazas
      if (uSsrStrength > 0.001 && depth < 0.9992) {
        vec3 dx = dFdx(worldPos);
        vec3 dy = dFdy(worldPos);
        vec3 wNormal = normalize(cross(dx, dy));
        // Only apply wet-surface SSR to near-horizontal ground/plaza planes
        if (wNormal.y > 0.86 && worldPos.y > -0.35 && worldPos.y < 0.75) {
          vec3 camPos = uCameraWorldMatrix[3].xyz;
          vec3 viewDir = normalize(worldPos - camPos);
          vec3 reflDir = reflect(viewDir, vec3(0.0, 1.0, 0.0));
          float fresnel = pow(1.0 - max(dot(-viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.2);

          // Procedural damp puddle mask across tarmac/granite so reflections break up organically
          float puddle = sin(worldPos.x * 0.14) * cos(worldPos.z * 0.12) * 0.5 + 0.5;
          puddle = smoothstep(0.32, 0.78, puddle);

          float hitAlpha = 0.0;
          vec3 reflColor = vec3(0.0);
          float marchDist = 1.6;
          for (int s = 0; s < 14; s++) {
            vec3 sampleWorld = worldPos + reflDir * marchDist;
            vec4 sClip = uViewProjMatrix * vec4(sampleWorld, 1.0);
            if (sClip.w <= 0.05) break;
            vec2 sUv = (sClip.xy / sClip.w) * 0.5 + 0.5;
            if (sUv.x < 0.01 || sUv.x > 0.99 || sUv.y < 0.01 || sUv.y > 0.99) break;

            float sDepth = texture2D(tDepth, sUv).r;
            float rayDepth = (sClip.z / sClip.w) * 0.5 + 0.5;
            if (rayDepth > sDepth + 0.00015 && rayDepth - sDepth < 0.032) {
              reflColor = texture2D(tDiffuse, sUv).rgb;
              float edgeFade = smoothstep(0.0, 0.12, min(min(sUv.x, 1.0 - sUv.x), min(sUv.y, 1.0 - sUv.y)));
              hitAlpha = edgeFade;
              break;
            }
            marchDist *= 1.38;
          }

          float wetBoost = mix(0.28, 0.72, uNightFactor);
          float mixAmt = hitAlpha * fresnel * puddle * uSsrStrength * wetBoost;
          color = mix(color, reflColor, clamp(mixAmt, 0.0, 0.52));
        }
      }

      // 4. Depth-Occluded Volumetric Screen-Space God Rays (Crepuscular Sun Shafts)
      if (uGodRayStrength > 0.001) {
        vec2 deltaUv = (vUv - uSunScreenPos) * (1.0 / 18.0) * 0.88;
        vec2 sampleUv = vUv;
        float illuminationDecay = 1.0;
        float rays = 0.0;
        for (int i = 0; i < 18; i++) {
          sampleUv -= deltaUv;
          if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
            float d = texture2D(tDepth, sampleUv).r;
            // Sky pixels (unoccluded by towers) scatter sunlight!
            float skyMask = smoothstep(0.9993, 0.99995, d);
            rays += skyMask * illuminationDecay;
          }
          illuminationDecay *= 0.91;
        }
        float sunDistFade = clamp(1.15 - length(vUv - uSunScreenPos) * 0.85, 0.0, 1.0);
        color += uSunColor * (rays / 18.0) * uGodRayStrength * sunDistFade;
      }

      // 5. Subtle GT6 Optical Vignette
      vec2 centered = vUv - 0.5;
      float vig = 1.0 - dot(centered, centered) * 0.34;
      color *= clamp(vig, 0.78, 1.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

class CinematicGT6Pass extends Pass {
  material: THREE.ShaderMaterial;
  fsQuad: FullScreenQuad;

  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CinematicGT6Shader.uniforms),
      vertexShader: CinematicGT6Shader.vertexShader,
      fragmentShader: CinematicGT6Shader.fragmentShader,
      depthTest: false,
      depthWrite: false
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.needsSwap = true;
  }

  override setSize(width: number, height: number): void {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.tDepth.value = readBuffer.depthTexture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  override dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

export interface EnvironmentState {
  timeOfDay: TimeOfDay;
  quality: QualityPreset;
  nightFactor: number;
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  waterColor: THREE.Color;
  waterDistortion: number;
}

export class EnvironmentController {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  readonly sky: Sky;
  readonly nightDome: THREE.Mesh;
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly fillLight: THREE.DirectionalLight;

  readonly composer: EffectComposer;
  readonly renderPass: RenderPass;
  readonly gtaoPass: GTAOPass;
  readonly gt6Pass: CinematicGT6Pass;
  readonly bloomPass: UnrealBloomPass;
  readonly smaaPass: SMAAPass;
  readonly outputPass: OutputPass;

  readonly pmrem: THREE.PMREMGenerator;
  readonly cubeRT: THREE.WebGLCubeRenderTarget;
  readonly cubeCamera: THREE.CubeCamera;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  timeOfDay: TimeOfDay = 'golden';
  quality: QualityPreset = 'high';
  nightFactor = 0.42;
  dofEnabled = false;

  readonly sunDirection = new THREE.Vector3();
  readonly sunColor = new THREE.Color();
  readonly waterColor = new THREE.Color();
  waterDistortion = 1.65;

  private prevViewProj = new THREE.Matrix4();
  private currViewProj = new THREE.Matrix4();
  private hasPrevMatrix = false;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // 1. Physically-Based Atmospheric Scattering Sky (Preetham) + Deep London Night Dome
    this.sky = new Sky();
    this.sky.scale.setScalar(1800);
    scene.add(this.sky);

    const nightDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldDir;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        void main() {
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, 0.0, 1.0);
          // Deep indigo London midnight zenith blending to subtle warm Docklands urban skyglow at horizon
          vec3 zenith = vec3(0.008, 0.014, 0.032);
          vec3 mid = vec3(0.022, 0.036, 0.072);
          vec3 horizon = vec3(0.055, 0.068, 0.105);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.24, h));
          col = mix(col, zenith, smoothstep(0.2, 0.78, h));

          // Crisp sparse stars high above the horizon
          if (h > 0.14) {
            vec2 grid = floor(d.xz / (d.y + 0.12) * 140.0);
            float r = hash(grid);
            if (r > 0.9965) {
              float twinkle = smoothstep(0.9965, 1.0, r) * smoothstep(0.14, 0.45, h);
              col += vec3(0.75, 0.85, 1.0) * twinkle * 0.9;
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.nightDome = new THREE.Mesh(new THREE.SphereGeometry(1250, 32, 20), nightDomeMat);
    this.nightDome.visible = false;
    scene.add(this.nightDome);

    // 2. Real-time Shadow-Casting Directional Sun / Moon Light
    this.sunLight = new THREE.DirectionalLight(0xfff1dc, 3.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 20;
    this.sunLight.shadow.camera.far = 750;
    const d = 225;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.04;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Cool sky/ground hemisphere bounce light
    this.hemiLight = new THREE.HemisphereLight(0xaac8e8, 0x3b3d44, 0.72);
    scene.add(this.hemiLight);

    // Subtle secondary rim/sky bounce directional fill (no shadow map needed)
    this.fillLight = new THREE.DirectionalLight(0x7ca2d0, 0.55);
    this.fillLight.position.set(160, 120, 180);
    scene.add(this.fillLight);

    // 3. Dynamic Skyline CubeCamera + PMREM Environment Lighting
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileCubemapShader();
    this.cubeRT = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    this.cubeCamera = new THREE.CubeCamera(1.0, 1600, this.cubeRT);
    this.cubeCamera.position.set(-14, 46, 4);
    scene.add(this.cubeCamera);

    // 4. HDR EffectComposer with dedicated WebGL2 DepthTextures on both ping-pong buffers
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 1.5);
    const rw = Math.floor(w * pr);
    const rh = Math.floor(h * pr);

    const makeHDRTarget = () => {
      const dt = new THREE.DepthTexture(rw, rh);
      dt.type = THREE.UnsignedIntType;
      return new THREE.WebGLRenderTarget(rw, rh, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        depthTexture: dt
      });
    };

    const rt1 = makeHDRTarget();
    this.composer = new EffectComposer(renderer, rt1);
    // Ensure renderTarget2 owns an independent DepthTexture to prevent WebGL feedback loops!
    this.composer.renderTarget2.dispose();
    this.composer.renderTarget2 = makeHDRTarget();
    this.composer.writeBuffer = this.composer.renderTarget1;
    this.composer.readBuffer = this.composer.renderTarget2;

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.gtaoPass = new GTAOPass(scene, camera, rw, rh);
    this.gtaoPass.output = GTAOPass.OUTPUT.Default;
    this.gtaoPass.updateGtaoMaterial({
      radius: 0.62,
      distanceExponent: 1.8,
      thickness: 1.6,
      scale: 1.15,
      samples: 12,
      distanceFallOff: 1.0
    });
    this.gtaoPass.blendIntensity = 0.72;
    this.composer.addPass(this.gtaoPass);

    this.gt6Pass = new CinematicGT6Pass();
    this.composer.addPass(this.gt6Pass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.58, 0.86);
    this.composer.addPass(this.bloomPass);

    this.smaaPass = new SMAAPass(rw, rh);
    this.composer.addPass(this.smaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.setQuality('high');
    this.setTimeOfDay('golden', false);
  }

  /**
   * Captures the real Canary Wharf skyline + Preetham Sky into a PMREM cubemap
   * so all skyscraper glass facades and clearcoat vehicles reflect actual surrounding towers.
   */
  bakeSkylineReflections(): void {
    const prevFog = this.scene.fog;
    // Temporarily soften fog slightly so skyline reflections in glass stay crisp
    if (prevFog instanceof THREE.FogExp2) {
      prevFog.density *= 0.65;
    }
    this.cubeCamera.update(this.renderer, this.scene);
    if (prevFog instanceof THREE.FogExp2) {
      prevFog.density /= 0.65;
    }

    const nextEnv = this.pmrem.fromCubemap(this.cubeRT.texture);
    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
    }
    this.envRenderTarget = nextEnv;
    this.scene.environment = nextEnv.texture;
  }

  setTimeOfDay(mode: TimeOfDay, rebakeIBL = true): void {
    this.timeOfDay = mode;
    const skyUniforms = this.sky.material.uniforms;

    if (mode === 'day') {
      this.nightFactor = 0.0;
      this.sky.visible = true;
      this.nightDome.visible = false;
      const phi = THREE.MathUtils.degToRad(90 - 40);
      const theta = THREE.MathUtils.degToRad(148);
      this.sunDirection.setFromSphericalCoords(1, phi, theta);

      skyUniforms['turbidity'].value = 2.0;
      skyUniforms['rayleigh'].value = 2.15;
      skyUniforms['mieCoefficient'].value = 0.0025;
      skyUniforms['mieDirectionalG'].value = 0.76;
      skyUniforms['sunPosition'].value.copy(this.sunDirection);

      this.sunLight.color.setHex(0xfff6e8);
      this.sunLight.intensity = 4.6;
      this.sunLight.position.copy(this.sunDirection).multiplyScalar(320);

      this.hemiLight.color.setHex(0x9ec8f2);
      this.hemiLight.groundColor.setHex(0x454d58);
      this.hemiLight.intensity = 1.25;
      this.fillLight.color.setHex(0x88b4e2);
      this.fillLight.intensity = 0.82;

      this.scene.fog = new THREE.FogExp2(0x9fbcd8, 0.00088);
      this.renderer.toneMappingExposure = 0.62;

      this.bloomPass.strength = 0.2;
      this.bloomPass.threshold = 1.65;
      this.bloomPass.radius = 0.42;

      this.sunColor.setHex(0xfff4df);
      this.waterColor.setHex(0x0f3246);
      this.waterDistortion = 1.55;
      this.gt6Pass.material.uniforms.uSunColor.value.setHex(0xffecc6);
      this.gt6Pass.material.uniforms.uGodRayStrength.value = 0.14;
    } else if (mode === 'golden') {
      this.nightFactor = 0.34;
      this.sky.visible = true;
      this.nightDome.visible = false;
      // Low dramatic golden sunset over the River Thames behind Newfoundland & Cabot Square
      const phi = THREE.MathUtils.degToRad(90 - 8.5);
      const theta = THREE.MathUtils.degToRad(-108);
      this.sunDirection.setFromSphericalCoords(1, phi, theta);

      skyUniforms['turbidity'].value = 6.2;
      skyUniforms['rayleigh'].value = 2.75;
      skyUniforms['mieCoefficient'].value = 0.0055;
      skyUniforms['mieDirectionalG'].value = 0.83;
      skyUniforms['sunPosition'].value.copy(this.sunDirection);

      this.sunLight.color.setHex(0xffa04e);
      this.sunLight.intensity = 5.2;
      this.sunLight.position.copy(this.sunDirection).multiplyScalar(340);

      this.hemiLight.color.setHex(0xf4b684);
      this.hemiLight.groundColor.setHex(0x273246);
      this.hemiLight.intensity = 1.05;
      this.fillLight.color.setHex(0x5b82ba);
      this.fillLight.intensity = 0.82;

      this.scene.fog = new THREE.FogExp2(0x8f6e62, 0.00105);
      this.renderer.toneMappingExposure = 0.72;

      this.bloomPass.strength = 0.36;
      this.bloomPass.threshold = 1.22;
      this.bloomPass.radius = 0.56;

      this.sunColor.setHex(0xffb56b);
      this.waterColor.setHex(0x0d2230);
      this.waterDistortion = 1.4;
      this.gt6Pass.material.uniforms.uSunColor.value.setHex(0xffa24c);
      this.gt6Pass.material.uniforms.uGodRayStrength.value = 0.38;
    } else {
      // NIGHT: Authentic Deep Indigo Canary Wharf London Nocturne
      this.nightFactor = 1.0;
      this.sky.visible = false;
      this.nightDome.visible = true;
      const phi = THREE.MathUtils.degToRad(90 - 26);
      const theta = THREE.MathUtils.degToRad(-55);
      this.sunDirection.setFromSphericalCoords(1, phi, theta);

      this.sunLight.color.setHex(0x6c92cf);
      this.sunLight.intensity = 0.62;
      this.sunLight.position.copy(this.sunDirection).multiplyScalar(320);

      this.hemiLight.color.setHex(0x1e2e4c);
      this.hemiLight.groundColor.setHex(0x11151d);
      this.hemiLight.intensity = 0.62;
      this.fillLight.color.setHex(0x3f5e8c);
      this.fillLight.intensity = 0.38;

      this.scene.fog = new THREE.FogExp2(0x09101d, 0.00125);
      this.renderer.toneMappingExposure = 1.05;

      this.bloomPass.strength = 0.64;
      this.bloomPass.threshold = 0.68;
      this.bloomPass.radius = 0.68;

      this.sunColor.setHex(0x3d6294);
      this.waterColor.setHex(0x040b14);
      this.waterDistortion = 1.15;
      this.gt6Pass.material.uniforms.uSunColor.value.setHex(0x345480);
      this.gt6Pass.material.uniforms.uGodRayStrength.value = 0.0;
    }

    this.gt6Pass.material.uniforms.uNightFactor.value = this.nightFactor;
    if (rebakeIBL) {
      this.bakeSkylineReflections();
    }
  }

  cycleTimeOfDay(): TimeOfDay {
    const order: TimeOfDay[] = ['golden', 'night', 'day'];
    const next = order[(order.indexOf(this.timeOfDay) + 1) % order.length];
    this.setTimeOfDay(next, true);
    return next;
  }

  setQuality(preset: QualityPreset): void {
    this.quality = preset;
    if (preset === 'low') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.gtaoPass.enabled = false;
      this.gt6Pass.enabled = false;
      this.smaaPass.enabled = false;
      this.bloomPass.enabled = true;
      this.dofEnabled = false;
    } else if (preset === 'high') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.gtaoPass.enabled = true;
      this.gtaoPass.updateGtaoMaterial({ samples: 10, radius: 0.6 });
      this.gt6Pass.enabled = true;
      this.gt6Pass.material.uniforms.uSsrStrength.value = 0.38;
      this.gt6Pass.material.uniforms.uMotionBlurStrength.value = 0.42;
      this.gt6Pass.material.uniforms.uDofStrength.value = 0.0;
      this.smaaPass.enabled = true;
      this.bloomPass.enabled = true;
      this.dofEnabled = false;
    } else {
      // ULTRA: Maximum GT6 photorealism
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.sunLight.shadow.mapSize.set(4096, 4096);
      this.gtaoPass.enabled = true;
      this.gtaoPass.updateGtaoMaterial({ samples: 16, radius: 0.68 });
      this.gt6Pass.enabled = true;
      this.gt6Pass.material.uniforms.uSsrStrength.value = 0.52;
      this.gt6Pass.material.uniforms.uMotionBlurStrength.value = 0.55;
      this.gt6Pass.material.uniforms.uDofStrength.value = 0.55;
      this.smaaPass.enabled = true;
      this.bloomPass.enabled = true;
      this.dofEnabled = true;
    }

    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
    this.resize(window.innerWidth, window.innerHeight);
  }

  toggleDoF(): boolean {
    this.dofEnabled = !this.dofEnabled;
    this.gt6Pass.material.uniforms.uDofStrength.value = this.dofEnabled ? 0.65 : 0.0;
    return this.dofEnabled;
  }

  resize(width: number, height: number): void {
    const pr = this.renderer.getPixelRatio();
    const gtaoScale = this.quality === 'ultra' ? 0.75 : 0.5;
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    this.gt6Pass.setSize(Math.floor(width * pr), Math.floor(height * pr));
    this.smaaPass.setSize(Math.floor(width * pr), Math.floor(height * pr));
    this.gtaoPass.setSize(Math.max(1, Math.floor(width * pr * gtaoScale)), Math.max(1, Math.floor(height * pr * gtaoScale)));
  }

  render(): void {
    // Update camera matrices & sun screen projection for GT6 volumetric god rays, SSR, and motion blur
    this.camera.updateMatrixWorld();
    this.currViewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    if (!this.hasPrevMatrix) {
      this.prevViewProj.copy(this.currViewProj);
      this.hasPrevMatrix = true;
    }

    const u = this.gt6Pass.material.uniforms;
    u.uCameraNear.value = this.camera.near;
    u.uCameraFar.value = this.camera.far;
    u.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
    u.uCameraWorldMatrix.value.copy(this.camera.matrixWorld);
    u.uViewProjMatrix.value.copy(this.currViewProj);
    u.uPrevViewProjMatrix.value.copy(this.prevViewProj);

    // Project sun direction onto screen space for volumetric god rays
    const sunWorld = this.camera.position.clone().addScaledVector(this.sunDirection, 800);
    const sunNdc = sunWorld.project(this.camera);
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const sunFacing = Math.max(0, camForward.dot(this.sunDirection));
    u.uSunScreenPos.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);

    const baseGodRays = this.timeOfDay === 'golden' ? 0.44 : this.timeOfDay === 'day' ? 0.16 : 0.0;
    u.uGodRayStrength.value = baseGodRays * Math.pow(sunFacing, 1.35);

    this.composer.render();
    this.prevViewProj.copy(this.currViewProj);
  }
}
