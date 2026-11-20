import * as THREE from 'three';
import { BoxCollider, CURB_HEIGHT } from './layout';
import { FacadePBRSet, ProceduralTextureSuite } from './textures';

export interface BuildingsResult {
  group: THREE.Group;
  colliders: BoxCollider[];
  emissiveMaterials: THREE.MeshStandardMaterial[];
  signMaterials: THREE.MeshStandardMaterial[];
  beaconLight: THREE.PointLight;
  beaconMesh: THREE.Mesh;
  update: (elapsed: number, nightFactor: number) => void;
}

function makeFacadeMaterial(
  pbr: FacadePBRSet,
  repeatX: number,
  repeatY: number,
  metalness: number,
  envMapIntensity: number,
  emissiveList: THREE.MeshStandardMaterial[]
): THREE.MeshStandardMaterial {
  const cloneTex = (src: THREE.CanvasTexture): THREE.CanvasTexture => {
    const t = src.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 16;
    t.needsUpdate = true;
    return t;
  };

  const mat = new THREE.MeshStandardMaterial({
    map: cloneTex(pbr.map),
    normalMap: cloneTex(pbr.normalMap),
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: cloneTex(pbr.roughnessMap),
    roughness: 0.92, // Driven primarily by roughnessMap (0.05 on glass, 0.25-0.65 on mullions/stone)
    metalness,
    emissive: new THREE.Color(0xfff1dc),
    emissiveMap: cloneTex(pbr.emissiveMap),
    emissiveIntensity: 0.12,
    envMapIntensity
  });
  emissiveList.push(mat);
  return mat;
}

export function buildCanaryWharfBuildings(textures: ProceduralTextureSuite): BuildingsResult {
  const group = new THREE.Group();
  group.name = 'CanaryWharfBuildings';

  const colliders: BoxCollider[] = [];
  const emissiveMaterials: THREE.MeshStandardMaterial[] = [];
  const signMaterials: THREE.MeshStandardMaterial[] = [];

  // Shared architectural accent materials
  const stainlessMat = new THREE.MeshStandardMaterial({
    map: textures.brushedSteel.map,
    normalMap: textures.brushedSteel.normalMap,
    roughnessMap: textures.brushedSteel.roughnessMap,
    color: 0xd8e0e8,
    roughness: 0.26,
    metalness: 0.88,
    envMapIntensity: 1.5
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x20262e,
    roughness: 0.32,
    metalness: 0.86,
    envMapIntensity: 1.25
  });

  const silverAluminumMat = new THREE.MeshStandardMaterial({
    color: 0xc2ccd6,
    roughness: 0.28,
    metalness: 0.82,
    envMapIntensity: 1.35
  });

  const graniteTrimMat = new THREE.MeshStandardMaterial({
    color: 0x8f8a82,
    roughness: 0.62,
    metalness: 0.08
  });

  const lobbyGlassMat = makeFacadeMaterial(
    textures.facades.retailShopfront,
    3.0,
    1.2,
    0.45,
    1.65,
    emissiveMaterials
  );

  const retailMat = makeFacadeMaterial(textures.facades.retailShopfront, 2.5, 1, 0.25, 1.3, emissiveMaterials);

  const addCollider = (cx: number, cz: number, w: number, d: number, h: number, label: string) => {
    colliders.push({
      minX: cx - w * 0.5 - 0.35,
      maxX: cx + w * 0.5 + 0.35,
      minZ: cz - d * 0.5 - 0.35,
      maxZ: cz + d * 0.5 + 0.35,
      maxY: CURB_HEIGHT + h,
      label
    });
  };

  // Helper to attach illuminated rooftop crown strips
  const makeCrownLightMat = (colorHex: number) => {
    const m = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.3,
      roughness: 0.2
    });
    signMaterials.push(m);
    return m;
  };

  // ==========================================================================
  // 1. HERO LANDMARK: ONE CANADA SQUARE (235 m, x = 28, z = -20)
  // ==========================================================================
  const buildOneCanadaSquare = () => {
    const cx = 28;
    const cz = -20;
    const tower = new THREE.Group();
    tower.position.set(cx, CURB_HEIGHT, cz);

    const ocsWallMat = makeFacadeMaterial(
      textures.facades.oneCanadaSteel,
      2.6,
      8.5,
      0.72,
      1.65,
      emissiveMaterials
    );

    // Monumental double-height granite & glazed lobby podium (y = 0..15 m)
    const lobbyCore = new THREE.Mesh(new THREE.BoxGeometry(47, 15, 47), lobbyGlassMat);
    lobbyCore.position.y = 7.5;
    lobbyCore.castShadow = true;
    lobbyCore.receiveShadow = true;
    tower.add(lobbyCore);

    // Granite perimeter colonnade columns around ground lobby
    for (let i = -3; i <= 3; i++) {
      const off = i * 7.2;
      for (const side of [-24.5, 24.5]) {
        const colA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 15.2, 1.5), graniteTrimMat);
        colA.position.set(off, 7.6, side);
        colA.castShadow = true;
        tower.add(colA);
        const colB = new THREE.Mesh(new THREE.BoxGeometry(1.5, 15.2, 1.5), graniteTrimMat);
        colB.position.set(side, 7.6, off);
        colB.castShadow = true;
        tower.add(colB);
      }
    }
    // Podium cornice belt
    const podiumCornice = new THREE.Mesh(new THREE.BoxGeometry(50.5, 2.2, 50.5), stainlessMat);
    podiumCornice.position.y = 15.5;
    tower.add(podiumCornice);

    // Cesar Pelli's unmistakable notched cruciform stainless-steel shaft (y = 16..200 m)
    const shaftH = 184;
    const shaftY = 16 + shaftH * 0.5;
    const mainShaft = new THREE.Mesh(new THREE.BoxGeometry(44, shaftH, 44), ocsWallMat);
    mainShaft.position.y = shaftY;
    mainShaft.castShadow = true;
    mainShaft.receiveShadow = true;
    tower.add(mainShaft);

    // Protruding central facade bays creating authentic recessed corner notches
    const bayNS = new THREE.Mesh(new THREE.BoxGeometry(36, shaftH, 47.4), ocsWallMat);
    bayNS.position.y = shaftY;
    bayNS.castShadow = true;
    tower.add(bayNS);

    const bayEW = new THREE.Mesh(new THREE.BoxGeometry(47.4, shaftH, 36), ocsWallMat);
    bayEW.position.y = shaftY;
    bayEW.castShadow = true;
    tower.add(bayEW);

    // Architectural stainless mechanical plant floor bands & top parapet cornice
    for (const bandY of [108, 196]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(48.2, 4.2, 48.2), stainlessMat);
      band.position.y = bandY;
      tower.add(band);
    }

    // Iconic 35-meter Stainless-Steel Louvered Pyramid Crown (y = 200..235 m)
    const pyramidH = 35;
    const pyramidRadius = 33.4; // 47.2m square diagonal / 2
    const pyramid = new THREE.Mesh(
      new THREE.ConeGeometry(pyramidRadius, pyramidH, 4),
      stainlessMat
    );
    pyramid.rotation.y = Math.PI / 4;
    pyramid.position.y = 200 + pyramidH * 0.5;
    pyramid.castShadow = true;
    tower.add(pyramid);

    // Illuminated horizontal louvre rings stepping up the pyramid crown
    const pyramidGlowMat = makeCrownLightMat(0xffe9c2);
    for (let r = 0; r < 6; r++) {
      const t = (r + 0.5) / 6;
      const sideLen = 46.8 * (1 - t);
      const ry = 200 + t * pyramidH;
      const ring = new THREE.Mesh(new THREE.BoxGeometry(sideLen + 0.6, 0.45, sideLen + 0.6), stainlessMat);
      ring.position.y = ry;
      tower.add(ring);

      if (r === 0 || r === 3) {
        const glow = new THREE.Mesh(new THREE.BoxGeometry(sideLen + 0.9, 0.25, sideLen + 0.9), pyramidGlowMat);
        glow.position.y = ry + 0.3;
        tower.add(glow);
      }
    }

    // Iconic Flashing Red Aviation Warning Beacon at the very tip (y = 235.8 m)
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 3.2, 8), stainlessMat);
    spire.position.y = 235.5;
    tower.add(spire);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff2020,
      emissive: 0xff1111,
      emissiveIntensity: 8.0,
      roughness: 0.1
    });
    const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 12), beaconMat);
    beaconMesh.position.y = 237.2;
    tower.add(beaconMesh);

    const beaconLight = new THREE.PointLight(0xff2222, 12, 65, 1.5);
    beaconLight.position.set(cx, CURB_HEIGHT + 237.2, cz);
    group.add(beaconLight);

    group.add(tower);
    addCollider(cx, cz, 50.5, 50.5, 235, 'One Canada Square');

    return { beaconLight, beaconMesh };
  };
  const { beaconLight, beaconMesh } = buildOneCanadaSquare();

  // ==========================================================================
  // 2. 8 CANADA SQUARE — HSBC TOWER (200 m, x = 96, z = -34)
  // ==========================================================================
  {
    const cx = 96;
    const cz = -34;
    const h = 200;
    const w = 46;
    const d = 42;
    const tGroup = new THREE.Group();
    tGroup.position.set(cx, CURB_HEIGHT, cz);

    const hsbcWallMat = makeFacadeMaterial(textures.facades.hsbcBlueGlass, 2.8, 8.2, 0.62, 1.75, emissiveMaterials);

    // Tall glazed atrium podium
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 14, d + 2), lobbyGlassMat);
    podium.position.y = 7;
    podium.castShadow = true;
    tGroup.add(podium);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h - 14, d), hsbcWallMat);
    shaft.position.y = 14 + (h - 14) * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    tGroup.add(shaft);

    // Norman Foster's signature twin vertical silver-steel structural fins on N/S/E/W faces
    for (const off of [-11, 11]) {
      for (const zSide of [-d * 0.5 - 0.5, d * 0.5 + 0.5]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, h - 10, 1.3), silverAluminumMat);
        fin.position.set(off, h * 0.5, zSide);
        tGroup.add(fin);
      }
      for (const xSide of [-w * 0.5 - 0.5, w * 0.5 + 0.5]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.3, h - 10, 1.1), silverAluminumMat);
        fin.position.set(xSide, h * 0.5, off);
        tGroup.add(fin);
      }
    }

    // Crown parapet & Illuminated HSBC rooftop signage on all 4 facades
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 9, d + 1.2), darkSteelMat);
    crown.position.y = h - 4.5;
    tGroup.add(crown);

    const hsbcSignMat = new THREE.MeshStandardMaterial({
      map: textures.logos.hsbc,
      emissiveMap: textures.logos.hsbc,
      emissive: 0xffffff,
      emissiveIntensity: 0.75,
      roughness: 0.2
    });
    signMaterials.push(hsbcSignMat);

    for (const [sx, sz, ry] of [
      [0, d * 0.5 + 0.7, 0],
      [0, -d * 0.5 - 0.7, Math.PI],
      [-w * 0.5 - 0.7, 0, -Math.PI / 2],
      [w * 0.5 + 0.7, 0, Math.PI / 2]
    ]) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(24, 6.2), hsbcSignMat);
      board.position.set(sx, h - 4.5, sz);
      board.rotation.y = ry;
      tGroup.add(board);
    }

    group.add(tGroup);
    addCollider(cx, cz, w + 2, d + 2, h, '8 Canada Square (HSBC)');
  }

  // ==========================================================================
  // 3. 25 CANADA SQUARE — CITIGROUP CENTRE (200 m, x = 104, z = +34)
  // ==========================================================================
  {
    const cx = 104;
    const cz = 34;
    const h = 200;
    const w = 44;
    const d = 40;
    const tGroup = new THREE.Group();
    tGroup.position.set(cx, CURB_HEIGHT, cz);

    const citiWallMat = makeFacadeMaterial(textures.facades.citiSilverGlass, 2.5, 8.0, 0.68, 1.7, emissiveMaterials);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 13, d + 2.4), retailMat);
    podium.position.y = 6.5;
    podium.castShadow = true;
    tGroup.add(podium);

    const lowerShaft = new THREE.Mesh(new THREE.BoxGeometry(w, 162, d), citiWallMat);
    lowerShaft.position.y = 13 + 81;
    lowerShaft.castShadow = true;
    lowerShaft.receiveShadow = true;
    tGroup.add(lowerShaft);

    // Stepped upper shoulder (y = 175..200 m)
    const upperShaft = new THREE.Mesh(new THREE.BoxGeometry(w - 4, 25, d - 4), citiWallMat);
    upperShaft.position.y = 175 + 12.5;
    tGroup.add(upperShaft);

    // Subtle horizontal brushed stainless fins
    for (let fy = 30; fy <= 170; fy += 28) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.7, d + 0.8), silverAluminumMat);
      rib.position.y = fy;
      tGroup.add(rib);
    }

    // Illuminated Citi Crown Signage
    const citiSignMat = new THREE.MeshStandardMaterial({
      map: textures.logos.citi,
      emissiveMap: textures.logos.citi,
      emissive: 0xffffff,
      emissiveIntensity: 0.75,
      roughness: 0.2
    });
    signMaterials.push(citiSignMat);

    for (const [sx, sz, ry] of [
      [0, (d - 4) * 0.5 + 0.35, 0],
      [0, -(d - 4) * 0.5 - 0.35, Math.PI],
      [-(w - 4) * 0.5 - 0.35, 0, -Math.PI / 2],
      [(w - 4) * 0.5 + 0.35, 0, Math.PI / 2]
    ]) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 6.2), citiSignMat);
      board.position.set(sx, h - 5.2, sz);
      board.rotation.y = ry;
      tGroup.add(board);
    }

    group.add(tGroup);
    addCollider(cx, cz, w + 2.4, d + 2.4, h, '25 Canada Square (Citi)');
  }

  // ==========================================================================
  // 4. NEWFOUNDLAND — 220 m ICONIC DIAMOND EXTERNAL DIAGRID TOWER (x = -168, z = -34)
  // ==========================================================================
  {
    const cx = -168;
    const cz = -34;
    const h = 220;
    const rx = 20; // diamond half-length along X
    const rz = 13.5; // diamond half-width along Z
    const tGroup = new THREE.Group();
    tGroup.position.set(cx, CURB_HEIGHT, cz);

    const nfGlassMat = makeFacadeMaterial(textures.facades.residentialGlass, 2.2, 10.5, 0.55, 1.75, emissiveMaterials);

    // Diamond plan extruded glass core (4-sided cylinder scaled into diamond plan!)
    const coreGeo = new THREE.CylinderGeometry(1, 1, h - 12, 4, 1);
    coreGeo.scale(rx, 1, rz);
    const core = new THREE.Mesh(coreGeo, nfGlassMat);
    core.position.y = 12 + (h - 12) * 0.5;
    core.castShadow = true;
    core.receiveShadow = true;
    tGroup.add(core);

    // Sculpted cantilevered podium base
    const baseGeo = new THREE.CylinderGeometry(0.95, 0.72, 12, 4, 1);
    baseGeo.scale(rx, 1, rz);
    const base = new THREE.Mesh(baseGeo, darkSteelMat);
    base.position.y = 6;
    base.castShadow = true;
    tGroup.add(base);

    // REAL 3D External Steel Diagrid Exoskeleton wrapping all 4 diamond faces!
    const vertices = [
      new THREE.Vector2(rx * 1.03, 0),
      new THREE.Vector2(0, rz * 1.03),
      new THREE.Vector2(-rx * 1.03, 0),
      new THREE.Vector2(0, -rz * 1.03)
    ];

    const tiers = 16;
    const tierH = (h - 14) / tiers;
    const strutsPerFace = 4; // 2 diagonals * 2 bays per tier
    const totalStruts = 4 * tiers * strutsPerFace;
    const strutGeo = new THREE.BoxGeometry(0.58, 1.0, 0.62);
    const diagridInst = new THREE.InstancedMesh(strutGeo, darkSteelMat, totalStruts);
    diagridInst.castShadow = false;

    const up = new THREE.Vector3(0, 1, 0);
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const mat4 = new THREE.Matrix4();

    let idx = 0;
    for (let f = 0; f < 4; f++) {
      const v0 = vertices[f];
      const v1 = vertices[(f + 1) % 4];
      for (let t = 0; t < tiers; t++) {
        const y0 = 12 + t * tierH;
        const y1 = y0 + tierH;
        for (let b = 0; b < 2; b++) {
          const u0 = b * 0.5;
          const u1 = (b + 1) * 0.5;
          const x0 = v0.x + (v1.x - v0.x) * u0;
          const z0 = v0.y + (v1.y - v0.y) * u0;
          const x1 = v0.x + (v1.x - v0.x) * u1;
          const z1 = v0.y + (v1.y - v0.y) * u1;

          // Up-right diagonal
          pA.set(x0, y0, z0);
          pB.set(x1, y1, z1);
          dir.subVectors(pB, pA);
          mid.copy(pA).addScaledVector(dir, 0.5);
          quat.setFromUnitVectors(up, dir.clone().normalize());
          scale.set(1, dir.length(), 1);
          mat4.compose(mid, quat, scale);
          diagridInst.setMatrixAt(idx++, mat4);

          // Up-left diagonal
          pA.set(x1, y0, z1);
          pB.set(x0, y1, z0);
          dir.subVectors(pB, pA);
          mid.copy(pA).addScaledVector(dir, 0.5);
          quat.setFromUnitVectors(up, dir.clone().normalize());
          scale.set(1, dir.length(), 1);
          mat4.compose(mid, quat, scale);
          diagridInst.setMatrixAt(idx++, mat4);
        }
      }
    }
    tGroup.add(diagridInst);

    // Illuminated Penthouse Crown Rim
    const crownGlow = makeCrownLightMat(0xffdfaa);
    const crownGeo = new THREE.CylinderGeometry(1.02, 1.02, 2.2, 4, 1);
    crownGeo.scale(rx, 1, rz);
    const crownRing = new THREE.Mesh(crownGeo, crownGlow);
    crownRing.position.y = h - 1.5;
    tGroup.add(crownRing);

    group.add(tGroup);
    addCollider(cx, cz, rx * 1.65, rz * 1.65, h, 'Newfoundland');
  }

  // ==========================================================================
  // 5. LANDMARK PINNACLE — 233 m SLENDER BALCONY GLASS PRISM (x = -168, z = +106)
  // ==========================================================================
  {
    const cx = -168;
    const cz = 106;
    const h = 233;
    const w = 34;
    const d = 28;
    const tGroup = new THREE.Group();
    tGroup.position.set(cx, CURB_HEIGHT, cz);

    const lpGlassMat = makeFacadeMaterial(textures.facades.residentialGlass, 2.2, 12.0, 0.58, 1.75, emissiveMaterials);
    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lpGlassMat);
    core.position.y = h * 0.5;
    core.castShadow = true;
    core.receiveShadow = true;
    tGroup.add(core);

    // Continuous cantilevered silver-white horizontal balcony slab fins (signature Landmark Pinnacle texture!)
    const finCount = 46;
    const finGeo = new THREE.BoxGeometry(w + 1.8, 0.42, d + 1.8);
    const finInst = new THREE.InstancedMesh(finGeo, silverAluminumMat, finCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < finCount; i++) {
      dummy.position.set(0, 10 + i * 4.8, 0);
      dummy.updateMatrix();
      finInst.setMatrixAt(i, dummy.matrix);
    }
    tGroup.add(finInst);

    // Subtle dark glazed sky-garden recess & slim architectural crown lighting strip
    const skyGardenGlass = new THREE.Mesh(
      new THREE.BoxGeometry(w - 1.2, 4.0, d - 1.2),
      darkSteelMat
    );
    skyGardenGlass.position.y = 118;
    tGroup.add(skyGardenGlass);

    const lpGlow = makeCrownLightMat(0xffdfb0);
    const crownBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.95, d + 0.4), lpGlow);
    crownBand.position.y = h - 1.2;
    tGroup.add(crownBand);
    const gardenTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.42, d + 0.25), lpGlow);
    gardenTrim.position.y = 116.2;
    tGroup.add(gardenTrim);

    group.add(tGroup);
    addCollider(cx, cz, w + 1.8, d + 1.8, h, 'Landmark Pinnacle');
  }

  // ==========================================================================
  // 6. 40 BANK STREET (153 m, x = 46, z = +114)
  // ==========================================================================
  {
    const cx = 46;
    const cz = 114;
    const h = 153;
    const w = 46;
    const d = 32;
    const tGroup = new THREE.Group();
    tGroup.position.set(cx, CURB_HEIGHT, cz);

    const bankWallMat = makeFacadeMaterial(textures.facades.darkBronzeGlass, 2.6, 6.8, 0.64, 1.65, emissiveMaterials);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 12, d + 2), retailMat);
    podium.position.y = 6;
    tGroup.add(podium);

    // Stepped double-volume Cesar Pelli profile
    const mainVol = new THREE.Mesh(new THREE.BoxGeometry(w, 124, d), bankWallMat);
    mainVol.position.y = 12 + 62;
    mainVol.castShadow = true;
    mainVol.receiveShadow = true;
    tGroup.add(mainVol);

    const upperVol = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 22, d * 0.84), bankWallMat);
    upperVol.position.set(-4, 136 + 11, 0);
    upperVol.castShadow = true;
    tGroup.add(upperVol);

    const crownStrip = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.68 + 0.6, 1.4, d * 0.84 + 0.6),
      makeCrownLightMat(0xb8e6ff)
    );
    crownStrip.position.set(-4, h + 3, 0);
    tGroup.add(crownStrip);

    group.add(tGroup);
    addCollider(cx, cz, w + 2, d + 2, h, '40 Bank Street');
  }

  // ==========================================================================
  // 7. ONE PARK PLACE (156 m, x = 178, z = -36) & 1 CHURCHILL PLACE (156 m, x = 178, z = +36)
  // ==========================================================================
  const buildModularTower = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    pbr: FacadePBRSet,
    metalness: number,
    opts: {
      label: string;
      crownColor?: number;
      stepped?: boolean;
      granitePodium?: boolean;
      fins?: boolean;
      skipCollider?: boolean;
    }
  ) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(cx, CURB_HEIGHT, cz);

    const repX = Math.max(1.4, w / 16);
    const repY = Math.max(2.0, h / 22);
    const wallMat = makeFacadeMaterial(pbr, repX, repY, metalness, 1.55, emissiveMaterials);

    const podiumH = Math.min(12, h * 0.14);
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.6, podiumH, d + 1.6),
      opts.granitePodium ? retailMat : lobbyGlassMat
    );
    podium.position.y = podiumH * 0.5;
    podium.castShadow = true;
    podium.receiveShadow = true;
    tGroup.add(podium);

    const bodyH = opts.stepped ? (h - podiumH) * 0.78 : h - podiumH;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), wallMat);
    body.position.y = podiumH + bodyH * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    tGroup.add(body);

    if (opts.stepped) {
      const topH = (h - podiumH) * 0.24;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, topH, d * 0.76), wallMat);
      top.position.y = podiumH + bodyH + topH * 0.5;
      top.castShadow = true;
      tGroup.add(top);
    }

    if (opts.fins) {
      for (let fy = podiumH + 14; fy < h - 8; fy += 18) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.55, d + 0.9), silverAluminumMat);
        fin.position.y = fy;
        tGroup.add(fin);
      }
    }

    // Mechanical rooftop penthouse
    const mech = new THREE.Mesh(new THREE.BoxGeometry(w * 0.52, 4.5, d * 0.52), darkSteelMat);
    mech.position.y = h + 2.25;
    tGroup.add(mech);

    if (opts.crownColor !== undefined) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w * (opts.stepped ? 0.75 : 1.01), 1.1, d * (opts.stepped ? 0.77 : 1.01)),
        makeCrownLightMat(opts.crownColor)
      );
      strip.position.y = h - 1.2;
      tGroup.add(strip);
    }

    group.add(tGroup);
    if (!opts.skipCollider) {
      addCollider(cx, cz, w + 1.8, d + 1.8, h, opts.label);
    }
  };

  // One Park Place
  buildModularTower(178, -36, 46, 40, 156, textures.facades.darkBronzeGlass, 0.65, {
    label: 'One Park Place',
    crownColor: 0xffe4b8,
    stepped: true,
    fins: true
  });

  // 1 Churchill Place (Barclays)
  buildModularTower(178, 36, 48, 42, 156, textures.facades.hsbcBlueGlass, 0.62, {
    label: '1 Churchill Place',
    crownColor: 0x35b8ff,
    fins: true,
    granitePodium: true
  });

  // 25 Cabot Square (Morgan Stanley — North side of Cabot Square)
  buildModularTower(-67, -54, 46, 32, 92, textures.facades.granitePostmodern, 0.28, {
    label: '25 Cabot Square',
    stepped: true,
    granitePodium: true
  });

  // 10 Cabot Square (South side of Cabot Square)
  buildModularTower(-67, 54, 46, 32, 90, textures.facades.granitePostmodern, 0.28, {
    label: '10 Cabot Square',
    stepped: true,
    granitePodium: true
  });

  // 20 Bank Street (Morgan Stanley Bank St)
  buildModularTower(104, 114, 42, 30, 155, textures.facades.citiSilverGlass, 0.65, {
    label: '20 Bank Street',
    crownColor: 0xd8ecff,
    fins: true
  });

  // 10 Upper Bank Street / 5 Canada Square
  buildModularTower(228, -36, 34, 34, 134, textures.facades.residentialGlass, 0.52, {
    label: 'Wood Wharf Tower N1',
    crownColor: 0xffd79b,
    stepped: true
  });
  buildModularTower(228, 34, 34, 34, 168, textures.facades.darkBronzeGlass, 0.62, {
    label: 'Wood Wharf Tower S1',
    crownColor: 0xffe2b5
  });
  buildModularTower(178, 114, 44, 30, 128, textures.facades.granitePostmodern, 0.34, {
    label: '30 South Colonnade',
    granitePodium: true
  });

  // Westferry / Heron Quays West perimeter buildings
  buildModularTower(-168, 36, 38, 36, 118, textures.facades.citiSilverGlass, 0.6, {
    label: 'Westferry House',
    stepped: true,
    granitePodium: true
  });
  buildModularTower(-66, 114, 46, 30, 108, textures.facades.darkBronzeGlass, 0.58, {
    label: '50 Bank Street',
    granitePodium: true
  });

  // ==========================================================================
  // 8. ACROSS THE DOCKS SKYLINE (North Quay & South Quay Plaza — Reflected in Water!)
  // ==========================================================================
  // North Quay (north of West India Dock North — reflected in North Dock!)
  buildModularTower(-135, -225, 42, 34, 112, textures.facades.darkBronzeGlass, 0.56, {
    label: 'North Quay West',
    skipCollider: true
  });
  buildModularTower(-58, -225, 52, 34, 86, textures.facades.granitePostmodern, 0.32, {
    label: 'West India Quay Marriott',
    stepped: true,
    skipCollider: true
  });
  buildModularTower(28, -230, 44, 34, 148, textures.facades.hsbcBlueGlass, 0.62, {
    label: 'One Park Drive North',
    crownColor: 0xffe3b0,
    skipCollider: true
  });
  buildModularTower(105, -226, 46, 36, 174, textures.facades.residentialGlass, 0.56, {
    label: 'Aspen Consort Place',
    crownColor: 0xd0e8ff,
    stepped: true,
    skipCollider: true
  });
  buildModularTower(182, -228, 42, 36, 126, textures.facades.citiSilverGlass, 0.6, {
    label: 'Crossrail Place East',
    skipCollider: true
  });

  // South Quay Plaza & Valiant Tower (south of Middle Dock — reflected in Middle Dock!)
  buildModularTower(-102, 234, 42, 34, 162, textures.facades.residentialGlass, 0.58, {
    label: 'South Quay West',
    crownColor: 0xffe6bd,
    skipCollider: true
  });
  buildModularTower(-28, 236, 38, 34, 215, textures.facades.hsbcBlueGlass, 0.66, {
    label: 'Valiant Tower (South Quay Plaza)',
    crownColor: 0xcbe8ff,
    stepped: true,
    fins: true,
    skipCollider: true
  });
  buildModularTower(48, 236, 42, 34, 182, textures.facades.darkBronzeGlass, 0.64, {
    label: 'Harbour Central',
    crownColor: 0xffd79a,
    skipCollider: true
  });
  buildModularTower(128, 238, 44, 36, 146, textures.facades.citiSilverGlass, 0.6, {
    label: 'Pan Peninsula',
    stepped: true,
    skipCollider: true
  });

  // ==========================================================================
  // 9. DISTANT LONDON SKYLINE SILHOUETTE ACROSS THE THAMES (Atmosphere & Horizon Depth)
  // ==========================================================================
  const distantMat = new THREE.MeshStandardMaterial({
    color: 0x3b4858,
    roughness: 0.78,
    metalness: 0.22
  });
  const distantClusters: Array<[number, number, number, number, number]> = [
    [-510, -180, 36, 36, 85],
    [-525, -110, 40, 38, 128],
    [-505, -40, 34, 34, 96],
    [-535, 35, 44, 38, 142],
    [-515, 110, 38, 34, 108],
    [-520, 190, 42, 36, 78],
    [-495, -260, 44, 36, 65]
  ];
  for (const [dx, dz, dw, dd, dh] of distantClusters) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), distantMat);
    m.position.set(dx, dh * 0.5, dz);
    group.add(m);
  }

  return {
    group,
    colliders,
    emissiveMaterials,
    signMaterials,
    beaconLight,
    beaconMesh,
    update(elapsed: number, nightFactor: number) {
      // Smoothly ramp interior office window glow & corporate crown signage from Day -> Golden Hour -> Night
      const winEmissive = 0.08 + nightFactor * 2.25;
      for (const m of emissiveMaterials) {
        m.emissiveIntensity = winEmissive;
      }
      const signEmissive = 0.35 + nightFactor * 2.6;
      for (const m of signMaterials) {
        m.emissiveIntensity = signEmissive;
      }

      // Authentic aviation beacon pulse on One Canada Square pyramid apex (0.8 Hz)
      const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * 4.8), 3);
      (beaconMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = (2.5 + nightFactor * 10) * pulse;
      beaconLight.intensity = (4 + nightFactor * 28) * pulse;
    }
  };
}
