import * as THREE from 'three';

export interface FacadePBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface MaterialPBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface ProceduralTextureSuite {
  facades: {
    oneCanadaSteel: FacadePBRSet;
    hsbcBlueGlass: FacadePBRSet;
    citiSilverGlass: FacadePBRSet;
    darkBronzeGlass: FacadePBRSet;
    granitePostmodern: FacadePBRSet;
    residentialGlass: FacadePBRSet;
    retailShopfront: FacadePBRSet;
  };
  asphalt: MaterialPBRSet;
  granitePaver: MaterialPBRSet;
  cabotStone: MaterialPBRSet;
  quayWall: MaterialPBRSet;
  grass: MaterialPBRSet;
  brushedSteel: MaterialPBRSet;
  waterNormals: THREE.CanvasTexture;
  logos: {
    hsbc: THREE.CanvasTexture;
    citi: THREE.CanvasTexture;
    canaryWharfRoundel: THREE.CanvasTexture;
    dlrRoundel: THREE.CanvasTexture;
    busDestination: THREE.CanvasTexture;
    policeBattenburg: THREE.CanvasTexture;
    wayfindingMap: THREE.CanvasTexture;
    busAd: THREE.CanvasTexture;
  };
  lampGlow: THREE.CanvasTexture;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function configureRepeatTexture(
  canvas: HTMLCanvasElement,
  isSRGB: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 16;
  tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function heightToNormalCanvas(heightCanvas: HTMLCanvasElement, strength = 2.4): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  const dst = outCtx.createImageData(w, h);
  const d = dst.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      d[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  outCtx.putImageData(dst, 0, 0);
  return out;
}

interface FacadeConfig {
  seed: number;
  cols: number;
  rows: number;
  spandrelColor: string;
  mullionColor: string;
  glassTint: [number, number, number];
  spandrelRatio: number;
  mullionWidth: number;
  spandrelRoughness: number;
  glassRoughness: number;
  litRatio: number;
  warmBias: number;
  flutedSteel?: boolean;
  stoneMasonry?: boolean;
  balconyStyle?: boolean;
}

function buildFacadePBR(cfg: FacadeConfig): FacadePBRSet {
  const size = 512;
  const rand = mulberry32(cfg.seed);

  const albedoC = document.createElement('canvas');
  const heightC = document.createElement('canvas');
  const roughC = document.createElement('canvas');
  const emissiveC = document.createElement('canvas');

  for (const c of [albedoC, heightC, roughC, emissiveC]) {
    c.width = size;
    c.height = size;
  }

  const aCtx = albedoC.getContext('2d')!;
  const hCtx = heightC.getContext('2d')!;
  const rCtx = roughC.getContext('2d')!;
  const eCtx = emissiveC.getContext('2d')!;

  // Base spandrel / structural frame
  aCtx.fillStyle = cfg.spandrelColor;
  aCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#d4d4d4';
  hCtx.fillRect(0, 0, size, size);

  const spRoughVal = Math.round(cfg.spandrelRoughness * 255);
  rCtx.fillStyle = `rgb(${spRoughVal},${spRoughVal},${spRoughVal})`;
  rCtx.fillRect(0, 0, size, size);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  // Subtle brushed metal or stone grain on spandrels
  if (cfg.flutedSteel) {
    for (let x = 0; x < size; x += 2) {
      const shade = 165 + Math.sin(x * 0.9) * 14 + (rand() - 0.5) * 12;
      aCtx.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`;
      aCtx.fillRect(x, 0, 2, size);
      const hVal = 195 + Math.sin(x * 0.9) * 26;
      hCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
      hCtx.fillRect(x, 0, 2, size);
    }
  } else if (cfg.stoneMasonry) {
    for (let i = 0; i < 4500; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const v = 135 + (rand() - 0.5) * 32;
      aCtx.fillStyle = `rgba(${v},${v - 3},${v - 9},0.35)`;
      aCtx.fillRect(x, y, 3, 2);
    }
  }

  const cellW = size / cfg.cols;
  const cellH = size / cfg.rows;
  const spH = cellH * cfg.spandrelRatio;
  const winH = cellH - spH;
  const mulW = cfg.mullionWidth;

  for (let row = 0; row < cfg.rows; row++) {
    // Cluster floor activity so whole office suites tend to be lit or dim together
    const floorActivity = rand();
    const y0 = row * cellH;
    const winY = y0 + spH * 0.55;

    // Horizontal architectural transom groove
    hCtx.fillStyle = '#ffffff';
    hCtx.fillRect(0, y0, size, Math.max(2, spH * 0.16));
    aCtx.fillStyle = cfg.mullionColor;
    aCtx.fillRect(0, y0, size, Math.max(2, spH * 0.14));

    for (let col = 0; col < cfg.cols; col++) {
      const x0 = col * cellW;
      const wx = x0 + mulW;
      const ww = cellW - mulW * 2;
      const wh = winH - 2;

      // Subtle per-pane glass color variation (real curtain wall optical tinting)
      const tintShift = (rand() - 0.5) * 18;
      const r0 = Math.max(10, Math.min(255, cfg.glassTint[0] + tintShift));
      const g0 = Math.max(12, Math.min(255, cfg.glassTint[1] + tintShift));
      const b0 = Math.max(18, Math.min(255, cfg.glassTint[2] + tintShift * 1.15));

      // Interior room vertical gradient (brighter ceiling, darker desk floor)
      const grad = aCtx.createLinearGradient(wx, winY, wx, winY + wh);
      grad.addColorStop(0, `rgb(${Math.round(r0 * 1.28)},${Math.round(g0 * 1.3)},${Math.round(b0 * 1.35)})`);
      grad.addColorStop(0.45, `rgb(${Math.round(r0)},${Math.round(g0)},${Math.round(b0)})`);
      grad.addColorStop(1, `rgb(${Math.round(r0 * 0.55)},${Math.round(g0 * 0.58)},${Math.round(b0 * 0.65)})`);
      aCtx.fillStyle = grad;
      aCtx.fillRect(wx, winY, ww, wh);

      // Venetian blinds / interior curtain variation
      if (rand() < 0.34) {
        const blindH = wh * (0.25 + rand() * 0.45);
        aCtx.fillStyle = 'rgba(200, 212, 224, 0.22)';
        aCtx.fillRect(wx + 1, winY + 1, ww - 2, blindH);
      }

      // Recessed window depth in height map (creates crisp mullion bevels)
      hCtx.fillStyle = '#303030';
      hCtx.fillRect(wx, winY, ww, wh);
      // Slight optical bow across glass pane
      hCtx.fillStyle = '#383838';
      hCtx.fillRect(wx + 2, winY + 2, Math.max(1, ww - 4), Math.max(1, wh - 4));

      // Glass roughness (very glossy, slight pane-to-pane variation)
      const gRough = Math.max(6, Math.min(85, Math.round((cfg.glassRoughness + (rand() - 0.5) * 0.05) * 255)));
      rCtx.fillStyle = `rgb(${gRough},${gRough},${gRough})`;
      rCtx.fillRect(wx, winY, ww, wh);

      // Night interior illumination (realistic clustered London office suites)
      const suiteChance = floorActivity * 0.55 + rand() * 0.45;
      if (suiteChance > 1.0 - cfg.litRatio) {
        const intensity = 0.42 + rand() * 0.58;
        const isWarm = rand() < cfg.warmBias;
        const er = Math.round((isWarm ? 255 : 215) * intensity);
        const eg = Math.round((isWarm ? 214 : 234) * intensity);
        const eb = Math.round((isWarm ? 152 : 255) * intensity);

        const eGrad = eCtx.createLinearGradient(wx, winY, wx, winY + wh);
        eGrad.addColorStop(0, `rgb(${er},${eg},${eb})`);
        eGrad.addColorStop(0.28, `rgb(${Math.round(er * 0.86)},${Math.round(eg * 0.85)},${Math.round(eb * 0.82)})`);
        eGrad.addColorStop(0.85, `rgb(${Math.round(er * 0.48)},${Math.round(eg * 0.45)},${Math.round(eb * 0.42)})`);
        eGrad.addColorStop(1, `rgb(${Math.round(er * 0.25)},${Math.round(eg * 0.24)},${Math.round(eb * 0.22)})`);
        eCtx.fillStyle = eGrad;
        eCtx.fillRect(wx + 1, winY + 1, Math.max(1, ww - 2), Math.max(1, wh - 2));

        // Interior desk/monitor/partition dark silhouettes inside lit rooms!
        if (rand() < 0.55 && ww > 8) {
          eCtx.fillStyle = 'rgba(15, 18, 25, 0.55)';
          const partX = wx + ww * (0.2 + rand() * 0.55);
          eCtx.fillRect(partX, winY + wh * 0.45, Math.max(2, ww * 0.14), wh * 0.55);
        }
        // Bright overhead LED strip in office ceilings
        eCtx.fillStyle = `rgba(255, 248, 232, ${0.45 * intensity})`;
        eCtx.fillRect(wx + 2, winY + 2, Math.max(1, ww - 4), Math.max(1.5, wh * 0.12));
      }

      // Balcony railing bar for residential towers
      if (cfg.balconyStyle) {
        aCtx.fillStyle = 'rgba(218, 224, 230, 0.85)';
        aCtx.fillRect(x0, winY + wh * 0.62, cellW, 2.5);
        hCtx.fillStyle = '#ececec';
        hCtx.fillRect(x0, winY + wh * 0.62, cellW, 3);
      }

      // Vertical mullion highlight
      aCtx.fillStyle = cfg.mullionColor;
      aCtx.fillRect(x0, y0, mulW, cellH);
      hCtx.fillStyle = '#f0f0f0';
      hCtx.fillRect(x0, y0, mulW, cellH);
    }
  }

  const normalC = heightToNormalCanvas(heightC, 2.6);
  return {
    map: configureRepeatTexture(albedoC, true),
    normalMap: configureRepeatTexture(normalC, false),
    roughnessMap: configureRepeatTexture(roughC, false),
    emissiveMap: configureRepeatTexture(emissiveC, true)
  };
}

function buildRetailShopfrontPBR(): FacadePBRSet {
  const w = 512;
  const h = 256;
  const rand = mulberry32(9912);

  const albedoC = document.createElement('canvas');
  const heightC = document.createElement('canvas');
  const roughC = document.createElement('canvas');
  const emissiveC = document.createElement('canvas');
  for (const c of [albedoC, heightC, roughC, emissiveC]) {
    c.width = w;
    c.height = h;
  }

  const aCtx = albedoC.getContext('2d')!;
  const hCtx = heightC.getContext('2d')!;
  const rCtx = roughC.getContext('2d')!;
  const eCtx = emissiveC.getContext('2d')!;

  // Dark bronze & Portland stone retail surround
  aCtx.fillStyle = '#2b2d32';
  aCtx.fillRect(0, 0, w, h);
  hCtx.fillStyle = '#dcdcdc';
  hCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = '#707070';
  rCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  const shopNames = ['WAITROSE', 'GAIL\'S BAKERY', 'CANARY WHARF', 'ROLEX · BOUTIQUE'];
  const bayW = w / 4;

  for (let i = 0; i < 4; i++) {
    const x0 = i * bayW;
    // Top stone cornice & fascia signage band
    aCtx.fillStyle = '#181a1f';
    aCtx.fillRect(x0 + 6, 12, bayW - 12, 34);
    eCtx.fillStyle = '#fff0d2';
    eCtx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
    eCtx.textAlign = 'center';
    eCtx.fillText(shopNames[i], x0 + bayW * 0.5, 34);
    aCtx.fillStyle = '#e8dfd0';
    aCtx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
    aCtx.textAlign = 'center';
    aCtx.fillText(shopNames[i], x0 + bayW * 0.5, 34);

    // Tall boutique display glass
    const gx = x0 + 8;
    const gy = 54;
    const gw = bayW - 16;
    const gh = h - 72;

    const grad = aCtx.createLinearGradient(gx, gy, gx, gy + gh);
    grad.addColorStop(0, '#423930');
    grad.addColorStop(0.45, '#2b2724');
    grad.addColorStop(1, '#19181a');
    aCtx.fillStyle = grad;
    aCtx.fillRect(gx, gy, gw, gh);

    hCtx.fillStyle = '#242424';
    hCtx.fillRect(gx, gy, gw, gh);
    rCtx.fillStyle = '#181818';
    rCtx.fillRect(gx, gy, gw, gh);

    // Warm upscale boutique interior glow
    const eGrad = eCtx.createLinearGradient(gx, gy, gx, gy + gh);
    eGrad.addColorStop(0, '#ffdfad');
    eGrad.addColorStop(0.5, '#c9935b');
    eGrad.addColorStop(1, '#5a3f28');
    eCtx.fillStyle = eGrad;
    eCtx.fillRect(gx + 3, gy + 3, gw - 6, gh - 6);

    // Display shelves / interior mullions
    eCtx.fillStyle = 'rgba(20, 18, 22, 0.55)';
    eCtx.fillRect(gx + gw * 0.48, gy, 4, gh);
    for (let s = 0; s < 3; s++) {
      eCtx.fillRect(gx + 10 + rand() * 8, gy + 50 + s * 36, gw * 0.34, 4);
    }
  }

  return {
    map: configureRepeatTexture(albedoC, true),
    normalMap: configureRepeatTexture(heightToNormalCanvas(heightC, 2.5), false),
    roughnessMap: configureRepeatTexture(roughC, false),
    emissiveMap: configureRepeatTexture(emissiveC, true)
  };
}

function buildAsphaltPBR(): MaterialPBRSet {
  const size = 512;
  const rand = mulberry32(4411);
  const aC = document.createElement('canvas');
  const hC = document.createElement('canvas');
  const rC = document.createElement('canvas');
  for (const c of [aC, hC, rC]) {
    c.width = size;
    c.height = size;
  }
  const aCtx = aC.getContext('2d')!;
  const hCtx = hC.getContext('2d')!;
  const rCtx = rC.getContext('2d')!;

  aCtx.fillStyle = '#25272b';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  // Moderate-damp London road roughness base
  rCtx.fillStyle = '#a4a4a4';
  rCtx.fillRect(0, 0, size, size);

  // Subtle tire wear tracks & damp specular patches (classic GT6 London tarmac look!)
  for (let i = 0; i < 42; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const rx = 28 + rand() * 88;
    const ry = 22 + rand() * 72;
    const g = rCtx.createRadialGradient(px, py, 4, px, py, Math.max(rx, ry));
    const wet = rand() < 0.48;
    g.addColorStop(0, wet ? 'rgba(42,42,42,0.75)' : 'rgba(195,195,195,0.45)');
    g.addColorStop(1, 'rgba(130,130,130,0)');
    rCtx.fillStyle = g;
    rCtx.beginPath();
    rCtx.ellipse(px, py, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    rCtx.fill();

    if (wet) {
      aCtx.fillStyle = 'rgba(12,14,18,0.22)';
      aCtx.beginPath();
      aCtx.ellipse(px, py, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
      aCtx.fill();
    }
  }

  // Fine mineral aggregate speckle
  const imgA = aCtx.getImageData(0, 0, size, size);
  const imgH = hCtx.getImageData(0, 0, size, size);
  for (let i = 0; i < imgA.data.length; i += 4) {
    const n = (rand() - 0.5) * 26;
    imgA.data[i] = Math.max(14, Math.min(90, imgA.data[i] + n));
    imgA.data[i + 1] = Math.max(15, Math.min(92, imgA.data[i + 1] + n));
    imgA.data[i + 2] = Math.max(17, Math.min(96, imgA.data[i + 2] + n));

    const hn = 128 + (rand() - 0.5) * 95;
    imgH.data[i] = hn;
    imgH.data[i + 1] = hn;
    imgH.data[i + 2] = hn;
  }
  aCtx.putImageData(imgA, 0, 0);
  hCtx.putImageData(imgH, 0, 0);

  return {
    map: configureRepeatTexture(aC, true, 16, 16),
    normalMap: configureRepeatTexture(heightToNormalCanvas(hC, 1.5), false, 16, 16),
    roughnessMap: configureRepeatTexture(rC, false, 16, 16)
  };
}

function buildGranitePaverPBR(warmPortland: boolean): MaterialPBRSet {
  const size = 512;
  const rand = mulberry32(warmPortland ? 7721 : 5519);
  const aC = document.createElement('canvas');
  const hC = document.createElement('canvas');
  const rC = document.createElement('canvas');
  for (const c of [aC, hC, rC]) {
    c.width = size;
    c.height = size;
  }
  const aCtx = aC.getContext('2d')!;
  const hCtx = hC.getContext('2d')!;
  const rCtx = rC.getContext('2d')!;

  aCtx.fillStyle = '#3a3c40';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#202020';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const pw = size / cols;
  const ph = size / rows;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (pw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * pw + offset;
      const y = row * ph;
      const tone = (rand() - 0.5) * 18;
      const r = warmPortland ? 168 + tone : 138 + tone;
      const g = warmPortland ? 162 + tone : 141 + tone;
      const b = warmPortland ? 150 + tone : 146 + tone;
      aCtx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      aCtx.fillRect(x + 2, y + 2, pw - 4, ph - 4);

      hCtx.fillStyle = '#d8d8d8';
      hCtx.fillRect(x + 2, y + 2, pw - 4, ph - 4);

      // Polished granite pavers have crisp subtle specular sheen (roughness 0.42–0.68)
      const rv = Math.round((0.44 + rand() * 0.24) * 255);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
    }
  }

  // Granite mineral fleck noise
  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const dark = rand() < 0.5;
    aCtx.fillStyle = dark ? 'rgba(35,38,42,0.22)' : 'rgba(235,235,235,0.18)';
    aCtx.fillRect(x, y, 2, 2);
  }

  return {
    map: configureRepeatTexture(aC, true, 12, 12),
    normalMap: configureRepeatTexture(heightToNormalCanvas(hC, 1.8), false, 12, 12),
    roughnessMap: configureRepeatTexture(rC, false, 12, 12)
  };
}

function buildQuayWallPBR(): MaterialPBRSet {
  const size = 512;
  const rand = mulberry32(3190);
  const aC = document.createElement('canvas');
  const hC = document.createElement('canvas');
  const rC = document.createElement('canvas');
  for (const c of [aC, hC, rC]) {
    c.width = size;
    c.height = size;
  }
  const aCtx = aC.getContext('2d')!;
  const hCtx = hC.getContext('2d')!;
  const rCtx = rC.getContext('2d')!;

  aCtx.fillStyle = '#474643';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#303030';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d0d0d0';
  rCtx.fillRect(0, 0, size, size);

  const rows = 10;
  const cols = 6;
  const bw = size / cols;
  const bh = size / rows;
  for (let row = 0; row < rows; row++) {
    const shift = (row % 2) * (bw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + shift;
      const y = row * bh;
      const v = 86 + (rand() - 0.5) * 26;
      aCtx.fillStyle = `rgb(${v},${v - 2},${v - 5})`;
      aCtx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      hCtx.fillStyle = '#d0d0d0';
      hCtx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
  }

  // Wet tide mark & moss darkening along bottom third of dock quay wall
  const tide = aCtx.createLinearGradient(0, size * 0.55, 0, size);
  tide.addColorStop(0, 'rgba(20,28,22,0)');
  tide.addColorStop(0.65, 'rgba(24,36,24,0.58)');
  tide.addColorStop(1, 'rgba(14,22,18,0.85)');
  aCtx.fillStyle = tide;
  aCtx.fillRect(0, size * 0.55, size, size * 0.45);

  const wetR = rCtx.createLinearGradient(0, size * 0.55, 0, size);
  wetR.addColorStop(0, 'rgba(190,190,190,0)');
  wetR.addColorStop(1, 'rgba(42,42,42,0.92)');
  rCtx.fillStyle = wetR;
  rCtx.fillRect(0, size * 0.55, size, size * 0.45);

  return {
    map: configureRepeatTexture(aC, true, 16, 1),
    normalMap: configureRepeatTexture(heightToNormalCanvas(hC, 2.2), false, 16, 1),
    roughnessMap: configureRepeatTexture(rC, false, 16, 1)
  };
}

function buildGrassPBR(): MaterialPBRSet {
  const size = 256;
  const rand = mulberry32(6012);
  const aC = document.createElement('canvas');
  const hC = document.createElement('canvas');
  const rC = document.createElement('canvas');
  for (const c of [aC, hC, rC]) {
    c.width = size;
    c.height = size;
  }
  const aCtx = aC.getContext('2d')!;
  const hCtx = hC.getContext('2d')!;
  const rCtx = rC.getContext('2d')!;

  aCtx.fillStyle = '#334d29';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d8d8d8';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 8000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const g = 65 + rand() * 44;
    aCtx.fillStyle = `rgb(${Math.round(g * 0.58)},${Math.round(g)},${Math.round(g * 0.42)})`;
    aCtx.fillRect(x, y, 2, 3);
    const hv = 90 + rand() * 90;
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(x, y, 2, 3);
  }

  return {
    map: configureRepeatTexture(aC, true, 8, 8),
    normalMap: configureRepeatTexture(heightToNormalCanvas(hC, 1.4), false, 8, 8),
    roughnessMap: configureRepeatTexture(rC, false, 8, 8)
  };
}

function buildBrushedSteelPBR(): MaterialPBRSet {
  const size = 256;
  const rand = mulberry32(1299);
  const aC = document.createElement('canvas');
  const hC = document.createElement('canvas');
  const rC = document.createElement('canvas');
  for (const c of [aC, hC, rC]) {
    c.width = size;
    c.height = size;
  }
  const aCtx = aC.getContext('2d')!;
  const hCtx = hC.getContext('2d')!;
  const rCtx = rC.getContext('2d')!;

  for (let y = 0; y < size; y++) {
    const v = 188 + (rand() - 0.5) * 20;
    aCtx.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
    aCtx.fillRect(0, y, size, 1);
    const hv = 128 + (rand() - 0.5) * 40;
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(0, y, size, 1);
    const rv = 56 + (rand() - 0.5) * 28;
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.fillRect(0, y, size, 1);
  }

  return {
    map: configureRepeatTexture(aC, true, 4, 4),
    normalMap: configureRepeatTexture(heightToNormalCanvas(hC, 1.1), false, 4, 4),
    roughnessMap: configureRepeatTexture(rC, false, 4, 4)
  };
}

// Seamless multi-octave wave normal map for Three.js Water shader
function buildWaterNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const hC = document.createElement('canvas');
  hC.width = size;
  hC.height = size;
  const ctx = hC.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  // Periodic trigonometric wave octaves so texture tiles seamlessly with zero seams!
  const waves = [
    { fx: 2, fy: 3, amp: 0.32, ph: 0.4 },
    { fx: -3, fy: 2, amp: 0.28, ph: 1.9 },
    { fx: 5, fy: 4, amp: 0.18, ph: 3.1 },
    { fx: -6, fy: 5, amp: 0.14, ph: 0.8 },
    { fx: 9, fy: -7, amp: 0.09, ph: 2.3 },
    { fx: 13, fy: 11, amp: 0.06, ph: 4.5 },
    { fx: -17, fy: 14, amp: 0.04, ph: 1.2 },
    { fx: 23, fy: -19, amp: 0.03, ph: 5.1 }
  ];

  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const ny = y / size;
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      let val = 0;
      for (const wv of waves) {
        val += Math.sin((nx * wv.fx + ny * wv.fy) * tau + wv.ph) * wv.amp;
      }
      const c = Math.max(0, Math.min(255, Math.round((val * 0.5 + 0.5) * 255)));
      const idx = (y * size + x) * 4;
      data[idx] = c;
      data[idx + 1] = c;
      data[idx + 2] = c;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const normalC = heightToNormalCanvas(hC, 3.2);
  const tex = new THREE.CanvasTexture(normalC);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildHSBCLogo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0c1118';
  ctx.fillRect(0, 0, 512, 128);

  // Iconic HSBC red-and-white hexagonal bow-tie emblem
  const cx = 110;
  const cy = 64;
  const r = 38;
  ctx.fillStyle = '#db0011';
  // Left triangle
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.4, cy);
  ctx.lineTo(cx - r * 0.7, cy - r * 0.7);
  ctx.lineTo(cx - r * 0.7, cy + r * 0.7);
  ctx.closePath();
  ctx.fill();
  // Right triangle
  ctx.beginPath();
  ctx.moveTo(cx + r * 1.4, cy);
  ctx.lineTo(cx + r * 0.7, cy - r * 0.7);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
  ctx.closePath();
  ctx.fill();
  // Top triangle
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy - r * 0.7);
  ctx.lineTo(cx + r * 0.7, cy - r * 0.7);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  // Bottom triangle
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy + r * 0.7);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();

  // Crisp white wordmark
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 72px Georgia, "Times New Roman", serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('HSBC', 190, 68);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCitiLogo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d1522';
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = '#eef5ff';
  ctx.font = '600 80px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('citi', 256, 76);

  // Signature red arc over "iti"
  ctx.strokeStyle = '#e52521';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(282, 62, 46, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildTfLRoundel(ringColor: string, label: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Outer ring
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.arc(128, 128, 78, 0, Math.PI * 2);
  ctx.stroke();

  // Horizontal blue TfL bar
  ctx.fillStyle = '#0019a8';
  ctx.fillRect(14, 104, 228, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 129);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBusDestination(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#ffb82e';
  ctx.font = '700 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D3  CANARY WHARF', 128, 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildPoliceBattenburg(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2f5f9';
  ctx.fillRect(0, 0, 512, 128);

  // UK Metropolitan Police high-vis fluorescent yellow & royal blue Battenburg blocks
  const cols = 12;
  const bw = 512 / cols;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#d9ff00' : '#0047ab';
      ctx.fillRect(col * bw, 46 + row * 28, bw, 28);
    }
  }
  ctx.fillStyle = '#002c6c';
  ctx.font = '800 26px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('METROPOLITAN POLICE', 256, 30);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWayfindingMap(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#141923';
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = '#e5b84b';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#11151d';
  ctx.font = '700 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CANARY WHARF', 128, 40);

  // Stylized dock & plaza diagram
  ctx.fillStyle = '#1d4d6b';
  ctx.fillRect(20, 96, 216, 46);
  ctx.fillRect(20, 290, 216, 46);
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(20, 146, 216, 140);
  ctx.fillStyle = '#c8d4e0';
  ctx.fillRect(108, 175, 42, 42);
  ctx.fillStyle = '#38764a';
  ctx.fillRect(96, 228, 68, 40);

  ctx.fillStyle = '#e6eef8';
  ctx.font = '600 14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('→ One Canada Square', 24, 378);
  ctx.fillText('→ Cabot Square', 24, 406);
  ctx.fillText('→ Jubilee Line / DLR', 24, 434);
  ctx.fillText('→ Thames Pier', 24, 462);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBusAd(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 384);
  grad.addColorStop(0, '#0f2035');
  grad.addColorStop(0.55, '#1d3c5e');
  grad.addColorStop(1, '#c89d54');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('LONDON', 128, 92);
  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.fillText('WINTER LIGHTS', 128, 126);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(58, 152, 140, 2);
  ctx.font = '600 15px -apple-system, sans-serif';
  ctx.fillText('CANARY WHARF', 128, 322);
  ctx.font = '400 12px -apple-system, sans-serif';
  ctx.fillText('JUBILEE PARK · CABOT SQ', 128, 344);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildLampGlowSprite(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 245, 224, 1.0)');
  g.addColorStop(0.22, 'rgba(255, 226, 178, 0.55)');
  g.addColorStop(0.55, 'rgba(255, 195, 128, 0.14)');
  g.addColorStop(1, 'rgba(255, 180, 100, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures(): ProceduralTextureSuite {
  return {
    facades: {
      oneCanadaSteel: buildFacadePBR({
        seed: 101,
        cols: 12,
        rows: 16,
        spandrelColor: '#b7c0c9',
        mullionColor: '#98a3ae',
        glassTint: [44, 58, 72],
        spandrelRatio: 0.44,
        mullionWidth: 5,
        spandrelRoughness: 0.24,
        glassRoughness: 0.07,
        litRatio: 0.48,
        warmBias: 0.65,
        flutedSteel: true
      }),
      hsbcBlueGlass: buildFacadePBR({
        seed: 202,
        cols: 16,
        rows: 16,
        spandrelColor: '#5c6e80',
        mullionColor: '#92a5b8',
        glassTint: [54, 78, 104],
        spandrelRatio: 0.24,
        mullionWidth: 3,
        spandrelRoughness: 0.28,
        glassRoughness: 0.05,
        litRatio: 0.54,
        warmBias: 0.45
      }),
      citiSilverGlass: buildFacadePBR({
        seed: 303,
        cols: 14,
        rows: 16,
        spandrelColor: '#8d9ca8',
        mullionColor: '#b2c0cc',
        glassTint: [64, 86, 102],
        spandrelRatio: 0.30,
        mullionWidth: 3,
        spandrelRoughness: 0.22,
        glassRoughness: 0.06,
        litRatio: 0.50,
        warmBias: 0.50
      }),
      darkBronzeGlass: buildFacadePBR({
        seed: 404,
        cols: 14,
        rows: 14,
        spandrelColor: '#2f353d',
        mullionColor: '#4a525d',
        glassTint: [34, 44, 54],
        spandrelRatio: 0.22,
        mullionWidth: 3,
        spandrelRoughness: 0.32,
        glassRoughness: 0.05,
        litRatio: 0.52,
        warmBias: 0.68
      }),
      granitePostmodern: buildFacadePBR({
        seed: 505,
        cols: 10,
        rows: 12,
        spandrelColor: '#9e978b',
        mullionColor: '#7d776e',
        glassTint: [36, 48, 52],
        spandrelRatio: 0.38,
        mullionWidth: 6,
        spandrelRoughness: 0.64,
        glassRoughness: 0.08,
        litRatio: 0.42,
        warmBias: 0.78,
        stoneMasonry: true
      }),
      residentialGlass: buildFacadePBR({
        seed: 606,
        cols: 12,
        rows: 14,
        spandrelColor: '#d0d5db',
        mullionColor: '#525a64',
        glassTint: [48, 62, 74],
        spandrelRatio: 0.26,
        mullionWidth: 3,
        spandrelRoughness: 0.35,
        glassRoughness: 0.06,
        litRatio: 0.44,
        warmBias: 0.88,
        balconyStyle: true
      }),
      retailShopfront: buildRetailShopfrontPBR()
    },
    asphalt: buildAsphaltPBR(),
    granitePaver: buildGranitePaverPBR(false),
    cabotStone: buildGranitePaverPBR(true),
    quayWall: buildQuayWallPBR(),
    grass: buildGrassPBR(),
    brushedSteel: buildBrushedSteelPBR(),
    waterNormals: buildWaterNormalMap(),
    logos: {
      hsbc: buildHSBCLogo(),
      citi: buildCitiLogo(),
      canaryWharfRoundel: buildTfLRoundel('#dc241f', 'CANARY WHARF'),
      dlrRoundel: buildTfLRoundel('#00afad', 'CANARY WHARF'),
      busDestination: buildBusDestination(),
      policeBattenburg: buildPoliceBattenburg(),
      wayfindingMap: buildWayfindingMap(),
      busAd: buildBusAd()
    },
    lampGlow: buildLampGlowSprite()
  };
}
