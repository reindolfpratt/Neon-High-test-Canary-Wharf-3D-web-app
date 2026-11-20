import * as THREE from 'three';
import {
  BoxCollider,
  CABOT_SQUARE,
  CURB_HEIGHT,
  CylinderCollider,
  DLR_VIADUCT,
  JUBILEE_PARK,
  ROADS
} from './layout';
import { ProceduralTextureSuite } from './textures';

export interface SignalLightSet {
  nsRed: THREE.MeshStandardMaterial;
  nsGreen: THREE.MeshStandardMaterial;
  ewRed: THREE.MeshStandardMaterial;
  ewGreen: THREE.MeshStandardMaterial;
}

export interface StreetscapeResult {
  group: THREE.Group;
  colliders: BoxCollider[];
  cylColliders: CylinderCollider[];
  signalLights: SignalLightSet;
  lampEmissives: THREE.MeshStandardMaterial[];
  lampHalos: THREE.Sprite[];
  streetPointLights: THREE.PointLight[];
  update: (elapsed: number, dt: number, nightFactor: number) => void;
}

export function buildStreetscape(textures: ProceduralTextureSuite): StreetscapeResult {
  const group = new THREE.Group();
  group.name = 'Streetscape';

  const colliders: BoxCollider[] = [];
  const cylColliders: CylinderCollider[] = [];
  const lampEmissives: THREE.MeshStandardMaterial[] = [];
  const lampHalos: THREE.Sprite[] = [];
  const streetPointLights: THREE.PointLight[] = [];

  // Shared materials
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt.map,
    normalMap: textures.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: textures.asphalt.roughnessMap,
    roughness: 0.72,
    metalness: 0.08
  });

  const whitePaintMat = new THREE.MeshStandardMaterial({
    color: 0xe8ecf0,
    roughness: 0.52,
    metalness: 0.04
  });

  const yellowPaintMat = new THREE.MeshStandardMaterial({
    color: 0xdcb032,
    roughness: 0.55,
    metalness: 0.04
  });

  const cycleLaneMat = new THREE.MeshStandardMaterial({
    color: 0x1e5c8c,
    roughness: 0.62,
    metalness: 0.05
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xa5a8ac,
    roughness: 0.64,
    metalness: 0.06
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x22272f,
    roughness: 0.34,
    metalness: 0.86
  });

  const brushedSteelMat = new THREE.MeshStandardMaterial({
    map: textures.brushedSteel.map,
    normalMap: textures.brushedSteel.normalMap,
    roughnessMap: textures.brushedSteel.roughnessMap,
    roughness: 0.28,
    metalness: 0.88
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    roughness: 0.76,
    metalness: 0.05
  });

  const warmLampMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e0,
    emissive: 0xffd28e,
    emissiveIntensity: 0.1,
    roughness: 0.15
  });
  lampEmissives.push(warmLampMat);

  const coolStationLightMat = new THREE.MeshStandardMaterial({
    color: 0xeef6ff,
    emissive: 0xcfe8ff,
    emissiveIntensity: 0.3,
    roughness: 0.2
  });
  lampEmissives.push(coolStationLightMat);

  // --------------------------------------------------------------------------
  // 1. ROAD NETWORK, UK LANE MARKINGS, CYCLE LANES & ZEBRA CROSSINGS
  // --------------------------------------------------------------------------
  const addRoadSegment = (x: number, z: number, w: number, d: number, isEW: boolean) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), asphaltMat);
    mesh.position.set(x, 0.02, z);
    mesh.receiveShadow = true;
    group.add(mesh);

    // Granite curbs along road edges
    if (isEW) {
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(w, CURB_HEIGHT + 0.04, 0.35), curbMat);
        curb.position.set(x, (CURB_HEIGHT + 0.04) * 0.5, z + side * (d * 0.5 + 0.16));
        curb.receiveShadow = true;
        group.add(curb);
      }
      // Dashed white UK centerlines
      const dashCount = Math.floor(w / 7.5);
      for (let i = 0; i < dashCount; i++) {
        const dx = x - w * 0.5 + 4 + i * 7.5;
        // Skip intersections
        if (Math.abs(dx - ROADS.westferryX) < 11 || Math.abs(dx - ROADS.upperBankX) < 11) continue;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.18), whitePaintMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, 0.07, z);
        group.add(dash);
      }
      // Double yellow no-parking edge lines + Blue London Cycle Superhighway lane on inner side
      for (const side of [-1, 1]) {
        const yLine = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), yellowPaintMat);
        yLine.rotation.x = -Math.PI / 2;
        yLine.position.set(x, 0.068, z + side * (d * 0.5 - 0.35));
        group.add(yLine);
      }
      const cycle = new THREE.Mesh(new THREE.PlaneGeometry(w - 18, 1.45), cycleLaneMat);
      cycle.rotation.x = -Math.PI / 2;
      cycle.position.set(x, 0.066, z + (z < 0 ? d * 0.5 - 1.3 : -(d * 0.5 - 1.3)));
      group.add(cycle);
    } else {
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, CURB_HEIGHT + 0.04, d), curbMat);
        curb.position.set(x + side * (w * 0.5 + 0.16), (CURB_HEIGHT + 0.04) * 0.5, z);
        curb.receiveShadow = true;
        group.add(curb);
      }
      const dashCount = Math.floor(d / 7.5);
      for (let i = 0; i < dashCount; i++) {
        const dz = z - d * 0.5 + 4 + i * 7.5;
        if (Math.abs(dz - ROADS.northColonnadeZ) < 11 || Math.abs(dz - ROADS.southColonnadeZ) < 11) continue;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 3.2), whitePaintMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.07, dz);
        group.add(dash);
      }
      for (const side of [-1, 1]) {
        const yLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, d), yellowPaintMat);
        yLine.rotation.x = -Math.PI / 2;
        yLine.position.set(x + side * (w * 0.5 - 0.35), 0.068, z);
        group.add(yLine);
      }
    }
  };

  // North Colonnade (E-W)
  addRoadSegment(6, ROADS.northColonnadeZ, 444, ROADS.roadWidth, true);
  // Bank Street / South Colonnade (E-W)
  addRoadSegment(6, ROADS.southColonnadeZ, 444, ROADS.roadWidth, true);
  // Westferry Road (N-S)
  addRoadSegment(ROADS.westferryX, 12, ROADS.roadWidth, 232, false);
  // Upper Bank Street (N-S)
  addRoadSegment(ROADS.upperBankX, 12, ROADS.roadWidth, 232, false);

  // Zebra Crossings & Belisha Beacons
  const belishaMat = new THREE.MeshStandardMaterial({
    color: 0xffa61a,
    emissive: 0xff8c00,
    emissiveIntensity: 0.75,
    roughness: 0.25
  });
  lampEmissives.push(belishaMat);

  const addZebraCrossing = (cx: number, cz: number, acrossZ: boolean) => {
    const stripes = 8;
    const span = ROADS.roadWidth - 1.4;
    for (let i = 0; i < stripes; i++) {
      const offset = -span * 0.5 + (i + 0.5) * (span / stripes);
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(acrossZ ? 3.2 : 0.75, acrossZ ? 0.75 : 3.2),
        whitePaintMat
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(cx + (acrossZ ? 0 : offset), 0.074, cz + (acrossZ ? offset : 0));
      group.add(stripe);
    }
    // Belisha beacon poles at both curbs
    for (const side of [-1, 1]) {
      const bx = cx + (acrossZ ? 0 : side * (ROADS.roadHalf + 0.7));
      const bz = cz + (acrossZ ? side * (ROADS.roadHalf + 0.7) : 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 2.7, 8), darkSteelMat);
      pole.position.set(bx, CURB_HEIGHT + 1.35, bz);
      group.add(pole);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), belishaMat);
      globe.position.set(bx, CURB_HEIGHT + 2.8, bz);
      group.add(globe);
    }
  };

  addZebraCrossing(-66, ROADS.northColonnadeZ, true);
  addZebraCrossing(28, ROADS.northColonnadeZ, true);
  addZebraCrossing(-66, ROADS.southColonnadeZ, true);
  addZebraCrossing(46, ROADS.southColonnadeZ, true);
  addZebraCrossing(ROADS.westferryX, 0, false);
  addZebraCrossing(ROADS.upperBankX, 0, false);

  // Traffic Signals at the 4 main intersections
  const signalLights: SignalLightSet = {
    nsRed: new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1111, emissiveIntensity: 0.1 }),
    nsGreen: new THREE.MeshStandardMaterial({ color: 0x22ee66, emissive: 0x11dd55, emissiveIntensity: 1.8 }),
    ewRed: new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1111, emissiveIntensity: 1.8 }),
    ewGreen: new THREE.MeshStandardMaterial({ color: 0x22ee66, emissive: 0x11dd55, emissiveIntensity: 0.1 })
  };

  const intersections: Array<[number, number]> = [
    [ROADS.westferryX, ROADS.northColonnadeZ],
    [ROADS.upperBankX, ROADS.northColonnadeZ],
    [ROADS.westferryX, ROADS.southColonnadeZ],
    [ROADS.upperBankX, ROADS.southColonnadeZ]
  ];
  for (const [ix, iz] of intersections) {
    for (const [ox, oz, isNS] of [
      [-9.2, -9.2, true],
      [9.2, 9.2, true],
      [9.2, -9.2, false],
      [-9.2, 9.2, false]
    ] as Array<[number, number, boolean]>) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 4.4, 8), darkSteelMat);
      post.position.set(ix + ox, CURB_HEIGHT + 2.2, iz + oz);
      group.add(post);

      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.95, 0.38), darkSteelMat);
      housing.position.set(ix + ox, CURB_HEIGHT + 4.1, iz + oz);
      group.add(housing);

      const redBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        isNS ? signalLights.nsRed : signalLights.ewRed
      );
      redBulb.position.set(ix + ox, CURB_HEIGHT + 4.34, iz + oz + (isNS ? 0.18 : 0));
      group.add(redBulb);

      const greenBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        isNS ? signalLights.nsGreen : signalLights.ewGreen
      );
      greenBulb.position.set(ix + ox, CURB_HEIGHT + 3.86, iz + oz + (isNS ? 0.18 : 0));
      group.add(greenBulb);
    }
  }

  // --------------------------------------------------------------------------
  // 2. CABOT SQUARE PLAZA & ICONIC TIERED GRANITE FOUNTAIN
  // --------------------------------------------------------------------------
  const cabotFloorMat = new THREE.MeshStandardMaterial({
    map: textures.cabotStone.map,
    normalMap: textures.cabotStone.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: textures.cabotStone.roughnessMap,
    roughness: 0.66,
    metalness: 0.08
  });

  const cabotPlaza = new THREE.Mesh(new THREE.BoxGeometry(68, 0.06, 68), cabotFloorMat);
  cabotPlaza.position.set(CABOT_SQUARE.centerX, CURB_HEIGHT + 0.02, CABOT_SQUARE.centerZ);
  cabotPlaza.receiveShadow = true;
  group.add(cabotPlaza);

  // Decorative concentric granite inlay rings in Cabot Square
  const inlayMat = new THREE.MeshStandardMaterial({ color: 0x383c42, roughness: 0.48, metalness: 0.12 });
  for (const r of [14.5, 22.5, 29.5]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.35, r + 0.35, 64), inlayMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(CABOT_SQUARE.centerX, CURB_HEIGHT + 0.065, CABOT_SQUARE.centerZ);
    group.add(ring);
  }

  // Cabot Square Fountain
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(CABOT_SQUARE.centerX, CURB_HEIGHT, CABOT_SQUARE.centerZ);

  const polishedGraniteMat = new THREE.MeshStandardMaterial({
    color: 0x3b4047,
    roughness: 0.24,
    metalness: 0.18
  });

  // Outer stepped granite basin wall
  const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(10.2, 10.6, 0.72, 48), polishedGraniteMat);
  basinOuter.position.y = 0.36;
  basinOuter.castShadow = true;
  basinOuter.receiveShadow = true;
  fountainGroup.add(basinOuter);

  // Luminous turquoise fountain water basin
  const fountainWaterMat = new THREE.MeshPhysicalMaterial({
    color: 0x22687e,
    roughness: 0.06,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emissive: 0x164a60,
    emissiveIntensity: 0.15
  });
  lampEmissives.push(fountainWaterMat);

  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 0.12, 48), fountainWaterMat);
  basinWater.position.y = 0.68;
  fountainGroup.add(basinWater);

  // Tiered central stone bowls
  const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 3.6, 1.35, 36), polishedGraniteMat);
  tier1.position.y = 1.25;
  tier1.castShadow = true;
  fountainGroup.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 1.5, 1.25, 32), polishedGraniteMat);
  tier2.position.y = 2.4;
  tier2.castShadow = true;
  fountainGroup.add(tier2);

  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 1.2, 24), brushedSteelMat);
  finial.position.y = 3.45;
  fountainGroup.add(finial);

  // Animated sparkling fountain water spray plumes
  const sprayCount = 320;
  const sprayPos = new Float32Array(sprayCount * 3);
  const sprayMeta: Array<{ angle: number; speed: number; radius: number; phase: number; height: number }> = [];
  for (let i = 0; i < sprayCount; i++) {
    const isCenter = i < 120;
    const angle = Math.random() * Math.PI * 2;
    const radius = isCenter ? 0.35 + Math.random() * 1.4 : 4.0 + Math.random() * 2.6;
    const height = isCenter ? 4.2 + Math.random() * 2.4 : 2.1 + Math.random() * 1.1;
    sprayMeta.push({
      angle,
      speed: 0.7 + Math.random() * 0.7,
      radius,
      phase: Math.random(),
      height
    });
  }
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const sprayMat = new THREE.PointsMaterial({
    color: 0xdff6ff,
    size: 0.28,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sprayPoints = new THREE.Points(sprayGeo, sprayMat);
  fountainGroup.add(sprayPoints);

  // Fountain underwater warm/cyan accent point light
  const fountainLight = new THREE.PointLight(0x7fd8ff, 0, 26, 1.6);
  fountainLight.position.set(CABOT_SQUARE.centerX, CURB_HEIGHT + 2.8, CABOT_SQUARE.centerZ);
  group.add(fountainLight);
  streetPointLights.push(fountainLight);

  group.add(fountainGroup);
  cylColliders.push({
    x: CABOT_SQUARE.centerX,
    z: CABOT_SQUARE.centerZ,
    radius: CABOT_SQUARE.fountainRadius + 0.3,
    maxY: CURB_HEIGHT + 3.0,
    label: 'Cabot Square Fountain'
  });

  // Contemporary Brushed-Bronze Public Art Sculpture in Canada Square (Igor Mitoraj / modern arch inspired)
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x5c4b37,
    roughness: 0.32,
    metalness: 0.84
  });
  const sculptureGroup = new THREE.Group();
  sculptureGroup.position.set(-18, CURB_HEIGHT, -58);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 3.2), polishedGraniteMat);
  plinth.position.y = 0.55;
  plinth.castShadow = true;
  sculptureGroup.add(plinth);
  const torusArt = new THREE.Mesh(new THREE.TorusKnotGeometry(1.15, 0.32, 72, 16), bronzeMat);
  torusArt.position.y = 2.75;
  torusArt.castShadow = true;
  sculptureGroup.add(torusArt);
  group.add(sculptureGroup);
  cylColliders.push({ x: -18, z: -58, radius: 2.1, maxY: CURB_HEIGHT + 4 });

  // --------------------------------------------------------------------------
  // 3. JUBILEE PARK & NORMAN FOSTER'S UNDERGROUND STATION GLASS CANOPY
  // --------------------------------------------------------------------------
  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grass.map,
    normalMap: textures.grass.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: textures.grass.roughnessMap,
    roughness: 0.88,
    metalness: 0.02
  });

  const jpW = JUBILEE_PARK.maxX - JUBILEE_PARK.minX;
  const jpD = JUBILEE_PARK.maxZ - JUBILEE_PARK.minZ;
  const jpCX = (JUBILEE_PARK.minX + JUBILEE_PARK.maxX) * 0.5;
  const jpCZ = (JUBILEE_PARK.minZ + JUBILEE_PARK.maxZ) * 0.5;

  // Raised granite retaining plinth
  const parkRetainer = new THREE.Mesh(
    new THREE.BoxGeometry(jpW, JUBILEE_PARK.elevation, jpD),
    curbMat
  );
  parkRetainer.position.set(jpCX, JUBILEE_PARK.elevation * 0.5, jpCZ);
  parkRetainer.receiveShadow = true;
  group.add(parkRetainer);

  // Lush lawn beds inside Jubilee Park
  const lawnA = new THREE.Mesh(new THREE.BoxGeometry(24, 0.08, 42), grassMat);
  lawnA.position.set(40, JUBILEE_PARK.elevation + 0.02, 48);
  lawnA.receiveShadow = true;
  group.add(lawnA);

  const lawnB = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 38), grassMat);
  lawnB.position.set(62, JUBILEE_PARK.elevation + 0.02, 48);
  lawnB.receiveShadow = true;
  group.add(lawnB);

  // Cascading architectural granite water rill running through Jubilee Park
  const rillChannel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 38), polishedGraniteMat);
  rillChannel.position.set(52, JUBILEE_PARK.elevation + 0.06, 48);
  group.add(rillChannel);
  const rillWater = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 37.2), fountainWaterMat);
  rillWater.position.set(52, JUBILEE_PARK.elevation + 0.13, 48);
  group.add(rillWater);

  // Norman Foster's Iconic Canary Wharf Underground Station Glazed Rib Canopy
  const buildUndergroundCanopy = () => {
    const stGroup = new THREE.Group();
    stGroup.position.set(JUBILEE_PARK.stationCanopyX, JUBILEE_PARK.elevation, JUBILEE_PARK.stationCanopyZ);

    const canopyGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9ec6d8,
      roughness: 0.08,
      metalness: 0.12,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.42
    });

    // Sweeping ribbed elliptical glass dome (11 curved steel arch ribs)
    const ribCount = 11;
    const canopyLen = 28;
    for (let i = 0; i < ribCount; i++) {
      const t = i / (ribCount - 1);
      const zPos = (t - 0.5) * canopyLen;
      // Foster's dome rises smoothly from ground at the north end to a grand 9m entrance mouth!
      const archRadius = 4.2 + Math.sin(t * Math.PI * 0.78 + 0.2) * 5.4;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 0.16, 10, 28, Math.PI),
        brushedSteelMat
      );
      arch.position.set(0, 0, zPos);
      arch.castShadow = true;
      stGroup.add(arch);
    }

    // Translucent curved glass envelope
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(8.2, 6.2, canopyLen, 24, 1, true, 0, Math.PI),
      canopyGlassMat
    );
    shell.rotation.z = Math.PI / 2;
    shell.rotation.y = Math.PI / 2;
    shell.position.set(0, 0.4, 0);
    stGroup.add(shell);

    // Warm glowing interior escalator descent well
    const concourseWell = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.3, 20),
      coolStationLightMat
    );
    concourseWell.position.set(0, 0.08, 1.5);
    stGroup.add(concourseWell);

    // London Underground CANARY WHARF Roundel Totem right beside the entrance!
    const roundelPole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 4.4, 12), darkSteelMat);
    roundelPole.position.set(-7.5, 2.2, 16.5);
    roundelPole.castShadow = true;
    stGroup.add(roundelPole);

    const roundelSignMat = new THREE.MeshStandardMaterial({
      map: textures.logos.canaryWharfRoundel,
      emissiveMap: textures.logos.canaryWharfRoundel,
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      transparent: true,
      roughness: 0.25
    });
    const roundelBoard = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 0.16), roundelSignMat);
    roundelBoard.position.set(-7.5, 4.4, 16.5);
    stGroup.add(roundelBoard);

    const stLight = new THREE.PointLight(0xd9efff, 0, 32, 1.6);
    stLight.position.set(JUBILEE_PARK.stationCanopyX, JUBILEE_PARK.elevation + 5.0, JUBILEE_PARK.stationCanopyZ + 8);
    group.add(stLight);
    streetPointLights.push(stLight);

    group.add(stGroup);

    // Colliders on the side skirts of the Underground station canopy
    colliders.push({
      minX: JUBILEE_PARK.stationCanopyX - 8.5,
      maxX: JUBILEE_PARK.stationCanopyX + 8.5,
      minZ: JUBILEE_PARK.stationCanopyZ - 14.5,
      maxZ: JUBILEE_PARK.stationCanopyZ + 12.5,
      maxY: JUBILEE_PARK.elevation + 9.0,
      label: 'Canary Wharf Underground Station'
    });
  };
  buildUndergroundCanopy();

  // --------------------------------------------------------------------------
  // 4. ELEVATED DLR VIADUCT & CANARY WHARF DLR STATION BARREL-VAULT CANOPY
  // --------------------------------------------------------------------------
  const buildDLRViaduct = () => {
    const dlrGroup = new THREE.Group();
    const vx = DLR_VIADUCT.centerX;
    const dy = DLR_VIADUCT.deckY;
    const totalLen = 500;

    // Continuous prestressed concrete deck girder
    const deck = new THREE.Mesh(new THREE.BoxGeometry(DLR_VIADUCT.width, 1.1, totalLen), concreteMat);
    deck.position.set(vx, dy - 0.55, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    dlrGroup.add(deck);

    // Acoustic steel side parapets along viaduct
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.25, totalLen), darkSteelMat);
      wall.position.set(vx + side * (DLR_VIADUCT.width * 0.5 - 0.15), dy + 0.55, 0);
      dlrGroup.add(wall);
    }

    // Twin pairs of gleaming steel rails (northbound x = vx + 2.3, southbound x = vx - 2.3)
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.22, metalness: 0.94 });
    for (const trackOffset of [-2.3, 2.3]) {
      for (const rOff of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, totalLen), railMat);
        rail.position.set(vx + trackOffset + rOff, dy + 0.08, 0);
        dlrGroup.add(rail);
      }
    }

    // Sculpted Concrete Piers spaced every 26 meters (keeping roadways completely clear!)
    for (let pz = -230; pz <= 230; pz += 26) {
      if (Math.abs(pz - ROADS.northColonnadeZ) < 12 || Math.abs(pz - ROADS.southColonnadeZ) < 12) continue;
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, dy + 2.4, 16), concreteMat);
      pier.position.set(vx, (dy - 2.4) * 0.5, pz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      dlrGroup.add(pier);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(DLR_VIADUCT.width - 0.8, 0.9, 2.4), concreteMat);
      cap.position.set(vx, dy - 1.35, pz);
      dlrGroup.add(cap);

      if (pz > -110 && pz < 135) {
        cylColliders.push({ x: vx, z: pz, radius: 1.35, maxY: dy, label: 'DLR Viaduct Pier' });
      }
    }

    // Canary Wharf DLR Station Iconic Glazed Barrel-Vault Roof (z = -44..+44)
    const stLen = DLR_VIADUCT.stationMaxZ - DLR_VIADUCT.stationMinZ;
    const vaultRadius = 11.4;
    const whiteArchMat = new THREE.MeshStandardMaterial({
      color: 0xe6ecf2,
      roughness: 0.28,
      metalness: 0.72
    });
    const vaultGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xa6cbe0,
      roughness: 0.09,
      metalness: 0.1,
      transparent: true,
      opacity: 0.36
    });

    // Translucent arched roof vault
    const roofShell = new THREE.Mesh(
      new THREE.CylinderGeometry(vaultRadius, vaultRadius, stLen, 28, 1, true, 0, Math.PI),
      vaultGlassMat
    );
    roofShell.rotation.z = Math.PI / 2;
    roofShell.rotation.y = Math.PI / 2;
    roofShell.position.set(vx, dy + 1.2, 0);
    dlrGroup.add(roofShell);

    // Structural steel arch ribs every 8 meters
    for (let rz = DLR_VIADUCT.stationMinZ; rz <= DLR_VIADUCT.stationMaxZ; rz += 8) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(vaultRadius + 0.15, 0.24, 10, 32, Math.PI), whiteArchMat);
      arch.position.set(vx, dy + 1.2, rz);
      arch.castShadow = true;
      dlrGroup.add(arch);
    }

    // Glowing overhead station platform lighting strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, stLen - 6), coolStationLightMat);
    strip.position.set(vx, dy + vaultRadius - 0.8, 0);
    dlrGroup.add(strip);

    // Turquoise DLR Roundel Entrance Signs on East & West facades of the station
    const dlrSignMat = new THREE.MeshStandardMaterial({
      map: textures.logos.dlrRoundel,
      emissiveMap: textures.logos.dlrRoundel,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      transparent: true,
      roughness: 0.22
    });
    for (const side of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 2.6), dlrSignMat);
      sign.position.set(vx + side * (vaultRadius + 0.3), dy + 2.4, 0);
      dlrGroup.add(sign);
    }

    group.add(dlrGroup);
  };
  buildDLRViaduct();

  // --------------------------------------------------------------------------
  // 5. INSTANCED TREES (London Plane & Silver Birch in Cabot Sq, Jubilee Park, Boulevards)
  // --------------------------------------------------------------------------
  const treeCoords: Array<[number, number, number, number]> = [];
  // Cabot Square perimeter ornamental trees
  for (const angle of [0.35, 1.15, 2.0, 2.75, 3.55, 4.35, 5.15, 5.95]) {
    treeCoords.push([
      CABOT_SQUARE.centerX + Math.cos(angle) * 24.5,
      CURB_HEIGHT,
      CABOT_SQUARE.centerZ + Math.sin(angle) * 24.5,
      1.05
    ]);
  }
  // Jubilee Park lush grove
  const jpTrees: Array<[number, number, number]> = [
    [33, 30, 1.2], [44, 32, 1.35], [60, 31, 1.15], [68, 36, 1.1],
    [34, 42, 1.25], [46, 45, 1.3], [61, 44, 1.2], [69, 49, 1.15],
    [35, 56, 1.2], [45, 60, 1.35], [59, 59, 1.25], [67, 65, 1.1],
    [29, 66, 1.05], [39, 68, 1.15], [53, 68, 1.1]
  ];
  for (const [tx, tz, sc] of jpTrees) {
    treeCoords.push([tx, JUBILEE_PARK.elevation, tz, sc]);
  }
  // North Quay & Boulevard avenue trees
  for (let x = -200; x <= 210; x += 26) {
    if (Math.abs(x - ROADS.westferryX) < 14 || Math.abs(x - ROADS.upperBankX) < 14 || Math.abs(x - DLR_VIADUCT.centerX) < 14) continue;
    treeCoords.push([x, CURB_HEIGHT, -101, 0.95]);
    treeCoords.push([x, CURB_HEIGHT, 100, 0.92]);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4f4338, roughness: 0.9, metalness: 0.02 });
  const foliageMatA = new THREE.MeshStandardMaterial({ color: 0x2f4d28, roughness: 0.82, metalness: 0.02 });
  const foliageMatB = new THREE.MeshStandardMaterial({ color: 0x3f6432, roughness: 0.78, metalness: 0.02 });

  const trunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 4.4, 8), trunkMat, treeCoords.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  const crownInstA = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.6, 1), foliageMatA, treeCoords.length);
  crownInstA.castShadow = true;
  crownInstA.receiveShadow = true;

  const crownInstB = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.05, 1), foliageMatB, treeCoords.length);
  crownInstB.castShadow = true;
  crownInstB.receiveShadow = true;

  const planterInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.15, 1.25, 0.55, 16), curbMat, treeCoords.length);
  planterInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  treeCoords.forEach(([x, y, z, sc], i) => {
    dummy.position.set(x, y + 0.27, z);
    dummy.scale.set(sc, 1, sc);
    dummy.rotation.set(0, i * 1.1, 0);
    dummy.updateMatrix();
    planterInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, y + 2.2 * sc, z);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + 0.2, y + 5.2 * sc, z - 0.15);
    dummy.scale.set(sc * 1.12, sc * 0.92, sc * 1.08);
    dummy.rotation.set(0.2, i * 0.7, 0.1);
    dummy.updateMatrix();
    crownInstA.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x - 0.45, y + 6.4 * sc, z + 0.35);
    dummy.scale.set(sc * 0.96, sc * 0.85, sc * 0.95);
    dummy.rotation.set(-0.15, i * 1.5, -0.1);
    dummy.updateMatrix();
    crownInstB.setMatrixAt(i, dummy.matrix);

    cylColliders.push({ x, z, radius: 0.95, maxY: y + 4.5 });
  });
  group.add(planterInst, trunkInst, crownInstA, crownInstB);

  // --------------------------------------------------------------------------
  // 6. LONDON STREET FURNITURE: K6 PHONE BOXES, BUS SHELTERS, LAMPS, BOLLARDS, BIKES
  // --------------------------------------------------------------------------

  // Iconic Red K6 London Telephone Boxes
  const k6RedMat = new THREE.MeshPhysicalMaterial({
    color: 0xb81018,
    roughness: 0.22,
    metalness: 0.18,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12
  });
  const k6GlassMat = new THREE.MeshStandardMaterial({
    color: 0xffeed0,
    emissive: 0xffcc78,
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.1
  });
  lampEmissives.push(k6GlassMat);

  const phoneBoxCoords: Array<[number, number, number]> = [
    [-98, -28, 0],
    [-98, 28, 0],
    [-34, -75, Math.PI / 2],
    [16, 75, -Math.PI / 2],
    [-128, -74, 0]
  ];
  for (const [px, pz, rotY] of phoneBoxCoords) {
    const box = new THREE.Group();
    box.position.set(px, CURB_HEIGHT, pz);
    box.rotation.y = rotY;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.95), k6RedMat);
    base.position.y = 0.18;
    box.add(base);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.95, 0.76), k6GlassMat);
    core.position.y = 1.28;
    box.add(core);
    // Corner red cast-iron frames
    for (const sx of [-0.41, 0.41]) {
      for (const sz of [-0.41, 0.41]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.05, 0.14), k6RedMat);
        pillar.position.set(sx, 1.32, sz);
        pillar.castShadow = true;
        box.add(pillar);
      }
    }
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.22, 0.98), k6RedMat);
    cornice.position.y = 2.38;
    box.add(cornice);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      k6RedMat
    );
    dome.scale.set(1, 0.48, 1);
    dome.position.y = 2.48;
    box.add(dome);
    group.add(box);
    cylColliders.push({ x: px, z: pz, radius: 0.75, maxY: CURB_HEIGHT + 2.8 });
  }

  // Modern London Bus Shelters with Illuminated Poster Lightboxes & TfL Stop Flags
  const busAdMat = new THREE.MeshStandardMaterial({
    map: textures.logos.busAd,
    emissiveMap: textures.logos.busAd,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.2
  });
  lampEmissives.push(busAdMat);

  const shelterGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xb6d0de,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.38
  });

  const busStops: Array<[number, number, number]> = [
    [-44, ROADS.northColonnadeZ - 9.4, 0],
    [62, ROADS.northColonnadeZ + 9.4, Math.PI],
    [-40, ROADS.southColonnadeZ + 9.4, Math.PI],
    [68, ROADS.southColonnadeZ - 9.4, 0]
  ];
  for (const [bx, bz, rot] of busStops) {
    const sh = new THREE.Group();
    sh.position.set(bx, CURB_HEIGHT, bz);
    sh.rotation.y = rot;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.14, 1.85), darkSteelMat);
    roof.position.set(0, 2.55, 0);
    roof.castShadow = true;
    sh.add(roof);

    const backGlass = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.35, 0.06), shelterGlassMat);
    backGlass.position.set(0, 1.3, -0.78);
    sh.add(backGlass);

    // Backlit ad panel
    const adPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.05, 1.45), busAdMat);
    adPanel.position.set(2.2, 1.3, 0);
    sh.add(adPanel);

    // Bench inside shelter
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.45), brushedSteelMat);
    seat.position.set(-0.5, 0.52, -0.45);
    sh.add(seat);

    // Red TfL Bus Stop Flag Post
    const flagPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), brushedSteelMat);
    flagPost.position.set(-2.9, 1.6, 0.45);
    sh.add(flagPost);
    const flagSign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.08), k6RedMat);
    flagSign.position.set(-2.9, 2.95, 0.45);
    sh.add(flagSign);

    group.add(sh);
  }

  // Wayfinding Monolith Totems
  const wayfindingMat = new THREE.MeshStandardMaterial({
    map: textures.logos.wayfindingMap,
    emissiveMap: textures.logos.wayfindingMap,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    roughness: 0.25
  });
  lampEmissives.push(wayfindingMat);
  for (const [wx, wz, rot] of [
    [-38, 12, Math.PI * 0.5],
    [2, 16, 0],
    [-64, -73, 0],
    [34, 74, Math.PI]
  ]) {
    const totem = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.55, 0.24), wayfindingMat);
    totem.position.set(wx, CURB_HEIGHT + 1.28, wz);
    totem.rotation.y = rot;
    totem.castShadow = true;
    group.add(totem);
  }

  // Canary Wharf Contemporary Street Lamps + Volumetric Halo Sprites
  const lampPositions: Array<[number, number, number]> = [];
  for (let x = -190; x <= 200; x += 28) {
    if (Math.abs(x - ROADS.westferryX) < 10 || Math.abs(x - ROADS.upperBankX) < 10) continue;
    lampPositions.push([x, ROADS.northColonnadeZ - 8.8, 0]);
    lampPositions.push([x + 14, ROADS.northColonnadeZ + 8.8, Math.PI]);
    lampPositions.push([x, ROADS.southColonnadeZ - 8.8, 0]);
    lampPositions.push([x + 14, ROADS.southColonnadeZ + 8.8, Math.PI]);
  }
  for (let z = -64; z <= 64; z += 26) {
    lampPositions.push([ROADS.westferryX - 8.8, z, Math.PI / 2]);
    lampPositions.push([ROADS.upperBankX + 8.8, z, -Math.PI / 2]);
  }
  // Cabot Square & Waterfront pedestrian lamp columns
  for (const [lx, lz] of [
    [-82, -16], [-82, 16], [-48, -16], [-48, 16],
    [-4, -18], [-4, 18], [58, -10], [58, 12],
    [-90, -107], [-30, -107], [48, -107], [108, -107],
    [-90, 132], [-30, 132], [58, 132], [108, 132]
  ]) {
    lampPositions.push([lx, lz, 0]);
  }

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.13, 7.6, 8);
  const poleInst = new THREE.InstancedMesh(poleGeo, darkSteelMat, lampPositions.length);
  poleInst.castShadow = false;
  const headGeo = new THREE.BoxGeometry(0.95, 0.16, 0.34);
  const headInst = new THREE.InstancedMesh(headGeo, darkSteelMat, lampPositions.length);
  const lensGeo = new THREE.BoxGeometry(0.75, 0.08, 0.24);
  const lensInst = new THREE.InstancedMesh(lensGeo, warmLampMat, lampPositions.length);

  const haloMat = new THREE.SpriteMaterial({
    map: textures.lampGlow,
    color: 0xffd28e,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  lampPositions.forEach(([lx, lz, rot], idx) => {
    dummy.position.set(lx, CURB_HEIGHT + 3.8, lz);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(idx, dummy.matrix);

    const armX = lx + Math.sin(rot) * 0.55;
    const armZ = lz + Math.cos(rot) * 0.55;
    dummy.position.set(armX, CURB_HEIGHT + 7.55, armZ);
    dummy.updateMatrix();
    headInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(armX, CURB_HEIGHT + 7.45, armZ);
    dummy.updateMatrix();
    lensInst.setMatrixAt(idx, dummy.matrix);

    const halo = new THREE.Sprite(haloMat);
    halo.position.set(armX, CURB_HEIGHT + 7.35, armZ);
    halo.scale.set(4.8, 4.8, 1);
    group.add(halo);
    lampHalos.push(halo);
  });
  group.add(poleInst, headInst, lensInst);

  // Select key warm real PointLights in hero zones for authentic night street illumination (keeping draw cost low)
  const heroLampLightCoords: Array<[number, number, number]> = [
    [-82, 7.2, 16],
    [-48, 7.2, -16],
    [2, 7.2, 12],
    [28, 7.2, -52],
    [42, 7.2, 54],
    [-66, 7.2, -82],
    [34, 7.2, 82],
    [-116, 7.2, 0]
  ];
  for (const [hx, hy, hz] of heroLampLightCoords) {
    const pt = new THREE.PointLight(0xffcb80, 0, 38, 1.55);
    pt.position.set(hx, hy, hz);
    group.add(pt);
    streetPointLights.push(pt);
  }

  // Instanced Stainless Security Bollards & Timber Benches & London Litter Bins
  const bollardCoords: Array<[number, number]> = [];
  for (let x = -94; x <= -38; x += 6.5) {
    bollardCoords.push([x, -34.5], [x, 34.5]);
  }
  for (let x = 2; x <= 68; x += 7) {
    bollardCoords.push([x, 19.5], [x, -74.5]);
  }
  const bollardInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.11, 0.12, 0.92, 10),
    brushedSteelMat,
    bollardCoords.length
  );
  bollardCoords.forEach(([bx, bz], i) => {
    dummy.position.set(bx, CURB_HEIGHT + 0.46, bz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bollardInst.setMatrixAt(i, dummy.matrix);
  });
  group.add(bollardInst);

  // Benches & Cast-Iron Bins around Cabot Square & Jubilee Park
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6e4e34, roughness: 0.72, metalness: 0.04 });
  const benchCoords: Array<[number, number, number, number]> = [
    [-80, CURB_HEIGHT, 0, Math.PI / 2],
    [-52, CURB_HEIGHT, 0, -Math.PI / 2],
    [-66, CURB_HEIGHT, -16, 0],
    [-66, CURB_HEIGHT, 16, Math.PI],
    [34, JUBILEE_PARK.elevation, 36, 0],
    [48, JUBILEE_PARK.elevation, 36, Math.PI / 2],
    [56, JUBILEE_PARK.elevation, 58, -Math.PI / 2],
    [40, JUBILEE_PARK.elevation, 64, 0]
  ];
  for (const [bx, by, bz, rot] of benchCoords) {
    const bench = new THREE.Group();
    bench.position.set(bx, by, bz);
    bench.rotation.y = rot;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.62), timberMat);
    slat.position.y = 0.48;
    slat.castShadow = true;
    bench.add(slat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.08), timberMat);
    back.position.set(0, 0.74, -0.26);
    back.rotation.x = -0.18;
    bench.add(back);
    for (const sx of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.56), darkSteelMat);
      leg.position.set(sx, 0.24, 0);
      bench.add(leg);
    }
    group.add(bench);
  }

  // Santander Cycle Docking Station (Red London Rental Bikes near Cabot Square & North Colonnade)
  const dockGroup = new THREE.Group();
  dockGroup.position.set(-96, CURB_HEIGHT, -73);
  const dockBar = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.22, 0.65), darkSteelMat);
  dockBar.position.y = 0.11;
  dockGroup.add(dockBar);
  for (let b = 0; b < 8; b++) {
    const bx = -4.2 + b * 1.2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 1.35), k6RedMat);
    frame.position.set(bx, 0.62, 0.35);
    dockGroup.add(frame);
    for (const wz of [-0.15, 0.85]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 14), darkSteelMat);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(bx, 0.34, wz);
      dockGroup.add(wheel);
    }
  }
  group.add(dockGroup);

  return {
    group,
    colliders,
    cylColliders,
    signalLights,
    lampEmissives,
    lampHalos,
    streetPointLights,
    update(elapsed: number, _dt: number, nightFactor: number) {
      // Animate Cabot Square fountain water plumes
      const posAttr = sprayGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < sprayCount; i++) {
        const m = sprayMeta[i];
        const t = (elapsed * m.speed + m.phase) % 1.0;
        const r = m.radius * (0.25 + t * 0.95);
        const y = 0.72 + Math.sin(t * Math.PI) * m.height;
        arr[i * 3] = Math.cos(m.angle) * r;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.sin(m.angle) * r;
      }
      posAttr.needsUpdate = true;

      // Update traffic signal cycle (18 second cycle)
      const phase = elapsed % 18;
      const nsGo = phase < 8.5;
      const ewGo = phase >= 9.2 && phase < 17.3;
      signalLights.nsGreen.emissiveIntensity = nsGo ? 2.2 : 0.08;
      signalLights.nsRed.emissiveIntensity = nsGo ? 0.08 : 2.2;
      signalLights.ewGreen.emissiveIntensity = ewGo ? 2.2 : 0.08;
      signalLights.ewRed.emissiveIntensity = ewGo ? 0.08 : 2.2;

      // Update street lamp glow & night halos
      warmLampMat.emissiveIntensity = 0.15 + nightFactor * 4.5;
      coolStationLightMat.emissiveIntensity = 0.35 + nightFactor * 2.4;
      fountainWaterMat.emissiveIntensity = 0.1 + nightFactor * 1.45;
      haloMat.opacity = nightFactor * 0.78;

      const lightStrength = nightFactor * 28;
      for (let i = 0; i < streetPointLights.length; i++) {
        streetPointLights[i].intensity = i === 0 ? nightFactor * 36 : lightStrength;
      }
    }
  };
}
