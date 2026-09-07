import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useTheme } from '@/lib/theme';

type ShaderStyle = 'fluid' | 'nebula' | 'plasma' | 'flare' | 'flame';

export interface AuraBackgroundProps {
  shaderStyle?: ShaderStyle;
  scale?: number;
  distortion?: number;
  speed?: number;
  intensity?: number;
  detail?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
}

const THEME_PRESETS = {
  dark: {
    shaderStyle: 'nebula' as ShaderStyle,
    scale: 1.9,
    distortion: 0.8,
    speed: 0.3,
    intensity: 1.4,
    detail: 5,
    color1: '#06041a',
    color2: '#2a14b8',
    color3: '#5b2cff',
    color4: '#b8a8ff',
  },
  light: {
    shaderStyle: 'nebula' as ShaderStyle,
    scale: 2.0,
    distortion: 0.7,
    speed: 0.28,
    intensity: 0.85,
    detail: 5,
    color1: '#ffffff',
    color2: '#e6e6e6',
    color3: '#bfbfbf',
    color4: '#d8d8d8',
  },
};

// ==========================================
// GLSL SHADERS (identiques à la référence Framer)
// ==========================================
const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`;

const sharedUniforms = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uScale;
uniform float uDistortion;
uniform float uSpeed;
uniform float uIntensity;
uniform float uDetail;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
varying vec2 vUv;
`;

const noiseFunctions = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0);
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 2; ++i) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}
`;

const fragmentShaderFluid = `
${sharedUniforms}
${noiseFunctions}
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    float t = uTime * uSpeed * 0.2;
    vec3 p1 = vec3(p * uScale, t);
    float n1 = fbm(p1);
    vec3 p2 = vec3(p * uScale + n1 * uDistortion, t * 1.2 + 10.0);
    float n2 = fbm(p2);
    vec3 p3 = vec3(p * uScale + n2 * uDistortion * 1.5, t * 1.5 - 10.0);
    float n3 = fbm(p3);
    float f1 = n1 * 0.5 + 0.5;
    float f2 = n2 * 0.5 + 0.5;
    float r = fbm(p3 + vec3(0.04, 0.0, 0.0));
    float g = n3;
    float b = fbm(p3 - vec3(0.04, 0.0, 0.0));
    vec3 chroma = vec3(r, g, b) * 0.5 + 0.5;
    float ridge = pow(1.0 - abs(n3), 6.0);
    vec3 colorBg = mix(uColor1, uColor3, f1);
    vec3 colorMid = mix(colorBg, uColor2, smoothstep(0.2, 0.8, f2));

    vec3 finalColor = colorMid + (chroma * ridge * uIntensity * uColor4);
    finalColor = pow(finalColor, vec3(0.85));
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const fragmentShaderNebula = `
${sharedUniforms}
${noiseFunctions}
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    float t = uTime * uSpeed * 0.2;
    vec3 p3 = vec3(p * uScale, t);
    p3 += vec3(
        snoise(p3 * 0.5 + t),
        snoise(p3 * 0.5 - t),
        0.0
    ) * uDistortion * 0.5;
    float f = 0.0;
    float amp = 0.5;
    float weight = 1.0;
    vec3 q = p3;

    for(int i = 0; i < 4; i++) {
        float n = snoise(q);
        n = 1.0 - abs(n);
        n = n * n;
        n *= weight;
        weight = clamp(n * 2.0, 0.0, 1.0);

        f += n * amp;
        amp *= 0.5;
        q *= 2.0;
        q += vec3(1.12, 0.8, 1.5);
    }

    f = pow(f, 1.5);
    float depth = snoise(p3 * 0.5 + 10.0) * 0.5 + 0.5;

    vec3 bg = mix(uColor1, uColor2, depth);
    vec3 mid = mix(bg, uColor3, smoothstep(0.2, 0.7, f));

    vec3 finalColor = mid + uColor4 * pow(f, 3.0) * uIntensity;
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const fragmentShaderPlasma = `
${sharedUniforms}
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    float t = uTime * uSpeed * 0.4;
    vec2 q = p * uScale * 2.5;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        float tempX = q.x;
        q.x += sin(q.y * uDistortion + t) * amplitude;
        q.y += cos(tempX * uDistortion - t) * amplitude;
        amplitude *= 0.6;
        t *= 1.2;
    }
    float plasma = abs(sin(q.x) * cos(q.y));
    float web = pow(1.0 - plasma, 4.0) * uIntensity;
    vec3 base = mix(uColor1, uColor3, uv.y);
    vec3 glow = mix(uColor2, uColor4, sin(q.x + q.y) * 0.5 + 0.5);
    vec3 finalColor = base + glow * web;
    finalColor += uColor4 * pow(1.0 - abs(sin(q.x - q.y)), 6.0) * uIntensity * 0.2;
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const fragmentShaderFlare = `
${sharedUniforms}
${noiseFunctions}
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    float t = uTime * uSpeed * 0.2;
    vec2 pos = p * uScale;

    float n = 0.0;
    float w = 0.5;
    vec2 d = vec2(0.0);

    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);

    for(int i = 0; i < 4; i++) {
        vec3 p3 = vec3(pos, t);

        d = vec2(
            snoise(p3 + vec3(1.2, 3.4, 5.6)),
            snoise(p3 + vec3(7.8, 9.0, 1.2))
        ) * uDistortion;

        pos += d * 0.5;

        float s = abs(snoise(vec3(pos, t * 0.5)));
        n += s * w;

        w *= 0.5;
        pos = rot * pos * 2.0;
        t *= 1.1;
    }

    n = 1.0 - n;
    n = pow(n, 2.0 + uDetail * 0.2);

    float bgNoise = snoise(vec3(p * uScale * 0.5, uTime * uSpeed * 0.1)) * 0.5 + 0.5;
    vec3 bg = mix(uColor1, uColor2, bgNoise * 0.8);

    vec3 finalColor = mix(bg, uColor3, smoothstep(0.1, 0.6, n));
    finalColor += uColor4 * pow(n, 4.0) * uIntensity;

    finalColor = finalColor / (1.0 + finalColor * 0.2);
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const fragmentShaderFlame = `
${sharedUniforms}
${noiseFunctions}
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    float t = uTime * uSpeed * 0.5;

    vec2 q = p * uScale;
    q.y *= 0.6;
    q.y -= t * 1.5;
    float warp = snoise(vec3(q.y * 1.2, 0.0, t)) * uDistortion * 0.4;
    warp += sin(q.y * 2.0 + t * 3.0) * uDistortion * 0.15;
    q.x += warp;
    vec3 finalColor = uColor1 * 0.02;
    float fire = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    float weight = 1.0;
    vec3 p3 = vec3(q, t);

    float detail = min(8.0, max(1.0, uDetail));
    for (int i = 0; i < int(detail); i++) {
        float n = snoise(p3 * freq);

        n = 1.0 - abs(n);
        n = pow(n, 2.0);

        n *= weight;
        weight = clamp(n * 1.5, 0.0, 1.0);

        fire += n * amp;

        amp *= 0.5;
        freq *= 2.0;

        p3.y -= t * 0.2 * freq;
        p3.x += t * 0.05 * freq;
        p3 += vec3(1.23, 4.56, 7.89);
    }
    fire *= 0.5;

    float mask = smoothstep(1.1, -0.2, uv.y);
    fire *= mix(0.4, 1.0, mask);
    fire = pow(fire, 2.0) * uIntensity;
    vec3 col1 = mix(finalColor, uColor2, smoothstep(0.0, 0.3, fire));
    vec3 col2 = mix(col1, uColor3, smoothstep(0.3, 0.7, fire));
    vec3 col3 = mix(col2, uColor4, smoothstep(0.7, 1.0, fire));

    finalColor = col3;
    finalColor += uColor4 * pow(fire, 3.0) * 0.5;
    finalColor = finalColor / (1.0 + finalColor * 0.2);
    finalColor = pow(finalColor, vec3(0.95));
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const getFragmentShader = (styleId: ShaderStyle) => {
  if (styleId === 'nebula') return fragmentShaderNebula;
  if (styleId === 'plasma') return fragmentShaderPlasma;
  if (styleId === 'flare') return fragmentShaderFlare;
  if (styleId === 'flame') return fragmentShaderFlame;
  return fragmentShaderFluid;
};

export default function AuraBackground(props: AuraBackgroundProps) {
  const { theme } = useTheme();
  const preset = THEME_PRESETS[theme];

  const shaderStyle = props.shaderStyle ?? preset.shaderStyle;
  const scale = props.scale ?? preset.scale;
  const distortion = props.distortion ?? preset.distortion;
  const speed = props.speed ?? preset.speed;
  const intensity = props.intensity ?? preset.intensity;
  const detail = props.detail ?? preset.detail;
  const color1 = props.color1 ?? preset.color1;
  const color2 = props.color2 ?? preset.color2;
  const color3 = props.color3 ?? preset.color3;
  const color4 = props.color4 ?? preset.color4;

  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef<AuraBackgroundProps>({
    shaderStyle,
    scale,
    distortion,
    speed,
    intensity,
    detail,
    color1,
    color2,
    color3,
    color4,
  });

  propsRef.current = {
    shaderStyle,
    scale,
    distortion,
    speed,
    intensity,
    detail,
    color1,
    color2,
    color3,
    color4,
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      depth: false,
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(container.clientWidth, container.clientHeight),
      },
      uScale: { value: propsRef.current.scale! },
      uDistortion: { value: propsRef.current.distortion! },
      uSpeed: { value: propsRef.current.speed! },
      uIntensity: { value: propsRef.current.intensity! },
      uDetail: { value: propsRef.current.detail! },
      uColor1: { value: new THREE.Color(propsRef.current.color1!) },
      uColor2: { value: new THREE.Color(propsRef.current.color2!) },
      uColor3: { value: new THREE.Color(propsRef.current.color3!) },
      uColor4: { value: new THREE.Color(propsRef.current.color4!) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: getFragmentShader(propsRef.current.shaderStyle ?? 'nebula'),
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId: number;
    let isIntersecting = true;
    let lastTime = performance.now();
    let currentShaderStyle = propsRef.current.shaderStyle ?? 'nebula';

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver((entries) => {
      isIntersecting = entries[0].isIntersecting;
      if (isIntersecting) {
        lastTime = performance.now();
      }
    });
    intersectionObserver.observe(container);

    const renderLoop = (time: number) => {
      frameId = requestAnimationFrame(renderLoop);
      if (!isIntersecting) return;

      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (delta < 0.1) {
        uniforms.uTime.value += delta;
      }

      const currentProps = propsRef.current;

      if (currentShaderStyle !== currentProps.shaderStyle) {
        currentShaderStyle = currentProps.shaderStyle ?? 'nebula';
        material.fragmentShader = getFragmentShader(currentShaderStyle);
        material.needsUpdate = true;
      }

      uniforms.uScale.value = currentProps.scale!;
      uniforms.uDistortion.value = currentProps.distortion!;
      uniforms.uSpeed.value = currentProps.speed!;
      uniforms.uIntensity.value = currentProps.intensity!;
      uniforms.uDetail.value = currentProps.detail!;
      uniforms.uColor1.value.set(currentProps.color1!);
      uniforms.uColor2.value.set(currentProps.color2!);
      uniforms.uColor3.value.set(currentProps.color3!);
      uniforms.uColor4.value.set(currentProps.color4!);

      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      scene.clear();
      geometry.dispose();
      material.dispose();
      renderer.forceContextLoss();
      renderer.dispose();

      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 w-full h-full overflow-hidden"
    />
  );
}
