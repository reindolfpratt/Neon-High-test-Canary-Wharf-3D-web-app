import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import {
  BoxCollider,
  CURB_HEIGHT,
  QUAY_TOP,
  WATER_BASINS,
  WATER_LEVEL
} from './layout';
import { ProceduralTextureSuite } from './textures';

export interface WaterAndTerrainResult {
  group: THREE.Group;
  water: Water;
  colliders: BoxCollider[];
  bridgeLights: THREE.MeshStandardMaterial[];
  update: (dt: number) => void;
  setWaterAppearance: (sunDir: THREE.Vector3, sunColor: THREE.Color, waterColor: THREE.Color, distortion: number) => void;
}

export function buildWaterAndTerrain(textures: ProceduralTextureSuite): WaterAndTerrainResult {
  const group = new THREE.Group();
  group.name = 'WaterAndTerrain';
  const colliders: BoxCollider[] = [];
  const bridgeLights: THREE.MeshStandardMaterial[] = [];

  // 1. Unified Real-Time Planar Reflective Water (North Dock + Middle Dock + Thames)
  const waterGeo = new THREE.PlaneGeometry(1150, 920);
  const water = new Water(waterGeo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: textures.waterNormals,
    sunDirection: new THREE.Vector3(0.4, 0.7, 0.3).normalize(),
    sunColor: 0xfff5e0,
    waterColor: 0x0b222e,
    distortionScale: 1.55,
    fog: true
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(-40, WATER_LEVEL, 0);
  water.receiveShadow = false;
  group.add(water);

  // Dark riverbed underneath water for depth
  const bedMat = new THREE.MeshBasicMaterial({ color: 0x061017 });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(1200, 960), bedMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(-40, WATER_LEVEL - 2.4, 0);
  group.add(bed);

  // 2. Main Canary Wharf Peninsula Deck + Surrounding Quays
  const pavingMat = new THREE.MeshStandardMaterial({
    map: textures.granitePaver.map,
    normalMap: textures.granitePaver.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: textures.granitePaver.roughnessMap,
    roughness: 0.78,
    metalness: 0.08
  });

  const quayMat = new THREE.MeshStandardMaterial({
    map: textures.quayWall.map,
    normalMap: textures.quayWall.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: textures.quayWall.roughnessMap,
    roughness: 0.85,
    metalness: 0.05
  });

  const copingMat = new THREE.MeshStandardMaterial({
    color: 0xbcb8ae,
    roughness: 0.62,
    metalness: 0.06
  });

  const addLandMass = (minX: number, maxX: number, minZ: number, maxZ: number, topY: number) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const h = topY - (WATER_LEVEL - 2.0);
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    // Quay wall vertical perimeter slab
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), quayMat);
    baseMesh.position.set(cx, topY - h * 0.5 - 0.05, cz);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = false;
    group.add(baseMesh);

    // Top granite deck surface
    const topDeck = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.18, d + 0.1), pavingMat);
    topDeck.position.set(cx, topY - 0.04, cz);
    topDeck.receiveShadow = true;
    group.add(topDeck);
  };

  // Main Canary Wharf Central Peninsula (between North Dock and Middle Dock, east of Thames)
  addLandMass(-232, 260, WATER_BASINS.northDock.maxZ, WATER_BASINS.middleDock.minZ, CURB_HEIGHT);

  // North Quay (north side of West India Dock North)
  addLandMass(-232, 280, -310, WATER_BASINS.northDock.minZ, CURB_HEIGHT);

  // South Quay / Heron Quays (south side of Middle Dock)
  addLandMass(-232, 280, WATER_BASINS.middleDock.maxZ, 320, CURB_HEIGHT);

  // Far West Bank (Rotherhithe / Limehouse across the Thames)
  addLandMass(-600, -470, -380, 380, CURB_HEIGHT);

  // 3. Quay Edge Coping Stones, Safety Railings & Colliders (prevent walking into water)
  const railMetalMat = new THREE.MeshStandardMaterial({
    color: 0x262c34,
    roughness: 0.34,
    metalness: 0.86
  });
  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0x1d2126,
    roughness: 0.42,
    metalness: 0.75
  });

  const addQuayEdge = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    gapRanges: Array<[number, number]> = []
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    // Coping slab
    const coping = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, len), copingMat);
    coping.position.set((x1 + x2) * 0.5, CURB_HEIGHT + 0.05, (z1 + z2) * 0.5);
    coping.rotation.y = angle;
    coping.receiveShadow = true;
    group.add(coping);

    // Railing posts & horizontal bars in segments respecting footbridge gaps
    const step = 4.0;
    const postGeo = new THREE.CylinderGeometry(0.035, 0.04, 1.08, 8);
    const segments: Array<[number, number]> = [];
    let cursor = 0;
    const sortedGaps = [...gapRanges].sort((a, b) => a[0] - b[0]);
    for (const [g0, g1] of sortedGaps) {
      if (g0 > cursor) segments.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    }
    if (cursor < len) segments.push([cursor, len]);

    for (const [s0, s1] of segments) {
      const segLen = s1 - s0;
      if (segLen < 1) continue;
      const midT = (s0 + s1) * 0.5 / len;
      const mx = x1 + dx * midT;
      const mz = z1 + dz * midT;

      // Top & mid horizontal stainless rails
      for (const ry of [1.05, 0.62, 0.28]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, segLen), railMetalMat);
        bar.position.set(mx, CURB_HEIGHT + ry, mz);
        bar.rotation.y = angle;
        group.add(bar);
      }

      // Collider along quay railing so player stays safely on dockside
      const halfX = Math.abs(Math.sin(angle)) * segLen * 0.5 + 0.45;
      const halfZ = Math.abs(Math.cos(angle)) * segLen * 0.5 + 0.45;
      colliders.push({
        minX: mx - halfX,
        maxX: mx + halfX,
        minZ: mz - halfZ,
        maxZ: mz + halfZ,
        maxY: CURB_HEIGHT + 1.4,
        label: 'Quay Railing'
      });

      // Vertical posts & heritage mooring bollards
      const count = Math.floor(segLen / step);
      for (let i = 0; i <= count; i++) {
        const dAlong = s0 + (i / Math.max(1, count)) * segLen;
        const t = dAlong / len;
        const px = x1 + dx * t;
        const pz = z1 + dz * t;
        const post = new THREE.Mesh(postGeo, railMetalMat);
        post.position.set(px, CURB_HEIGHT + 0.56, pz);
        group.add(post);

        if (i % 5 === 0) {
          const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.58, 12), bollardMat);
          bollard.position.set(px, CURB_HEIGHT + 0.34, pz);
          bollard.castShadow = true;
          group.add(bollard);
        }
      }
    }
  };

  // North Dock south quay (with gap for Adams Plaza Footbridge at x = 23..33 -> dist from -232 is 255..265)
  addQuayEdge(-232, WATER_BASINS.northDock.maxZ, 260, WATER_BASINS.northDock.maxZ, [[254, 266]]);
  // Middle Dock north quay (with gap for South Quay Footbridge at x = 8..18 -> dist from -232 is 240..250)
  addQuayEdge(-232, WATER_BASINS.middleDock.minZ, 260, WATER_BASINS.middleDock.minZ, [[239, 251]]);
  // Thames Riverfront Embankment (west side of peninsula, gap for Pier gangway)
  addQuayEdge(-232, WATER_BASINS.northDock.maxZ, -232, WATER_BASINS.middleDock.minZ, [[110, 122]]);

  // 4. Historic West India Dock Cargo Cranes on North Quay (iconic Canary Wharf detail!)
  const craneYellowMat = new THREE.MeshStandardMaterial({
    color: 0xc2932e,
    roughness: 0.48,
    metalness: 0.62
  });
  const craneDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2a313a,
    roughness: 0.45,
    metalness: 0.72
  });
  for (const cx of [-88, -36, 74]) {
    const crane = new THREE.Group();
    crane.position.set(cx, CURB_HEIGHT, WATER_BASINS.northDock.minZ - 3.5);
    // Portal legs
    for (const lx of [-2.4, 2.4]) {
      for (const lz of [-2.2, 2.2]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 9.5, 0.45), craneDarkMat);
        leg.position.set(lx, 4.75, lz);
        leg.castShadow = true;
        crane.add(leg);
      }
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.7, 5.2), craneDarkMat);
    platform.position.y = 9.5;
    crane.add(platform);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.2, 4.0), craneYellowMat);
    cab.position.set(0, 11.4, 0);
    cab.castShadow = true;
    crane.add(cab);

    // Angled steel jib boom reaching out over North Dock water
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 24), craneYellowMat);
    boom.position.set(0, 18.5, 9.5);
    boom.rotation.x = -0.52;
    boom.castShadow = true;
    crane.add(boom);

    group.add(crane);
  }

  // 5. Iconic South Quay Cable-Stayed Footbridge (Middle Dock, x = 13, z = 136..204)
  const buildSouthQuayBridge = () => {
    const bridge = new THREE.Group();
    const whiteSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe6ebf0,
      roughness: 0.28,
      metalness: 0.72
    });
    const timberDeckMat = new THREE.MeshStandardMaterial({
      color: 0x5c4738,
      roughness: 0.74,
      metalness: 0.05
    });
    const glassBalustradeMat = new THREE.MeshPhysicalMaterial({
      color: 0x9ac6d8,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.45,
      transparent: true,
      opacity: 0.55
    });
    const ledStripMat = new THREE.MeshStandardMaterial({
      color: 0xfff0d4,
      emissive: 0xffd594,
      emissiveIntensity: 1.4,
      roughness: 0.2
    });
    bridgeLights.push(ledStripMat);

    const zStart = 134;
    const zEnd = 206;
    const steps = 28;
    const bx = 13;

    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const tm = (t0 + t1) * 0.5;
      const z0 = zStart + (zEnd - zStart) * t0;
      const z1 = zStart + (zEnd - zStart) * t1;
      const y0 = CURB_HEIGHT + Math.sin(t0 * Math.PI) * 3.8;
      const y1 = CURB_HEIGHT + Math.sin(t1 * Math.PI) * 3.8;
      const ym = (y0 + y1) * 0.5;
      const segLen = Math.hypot(z1 - z0, y1 - y0);
      const pitch = Math.atan2(y1 - y0, z1 - z0);

      // Deck slab
      const deck = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.45, segLen + 0.08), timberDeckMat);
      deck.position.set(bx, ym - 0.2, (z0 + z1) * 0.5);
      deck.rotation.x = -pitch;
      deck.castShadow = true;
      deck.receiveShadow = true;
      bridge.add(deck);

      // White steel edge girders & glass parapets & glowing night handrail strip
      for (const side of [-1, 1]) {
        const girder = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.72, segLen + 0.08), whiteSteelMat);
        girder.position.set(bx + side * 3.85, ym - 0.15, (z0 + z1) * 0.5);
        girder.rotation.x = -pitch;
        bridge.add(girder);

        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, segLen), glassBalustradeMat);
        glass.position.set(bx + side * 3.7, ym + 0.65, (z0 + z1) * 0.5);
        glass.rotation.x = -pitch;
        bridge.add(glass);

        const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, segLen), ledStripMat);
        led.position.set(bx + side * 3.65, ym + 1.18, (z0 + z1) * 0.5);
        led.rotation.x = -pitch;
        bridge.add(led);
      }

      // Bridge side parapet colliders
      if (i % 4 === 0) {
        const cz = (z0 + z1) * 0.5;
        for (const side of [-1, 1]) {
          colliders.push({
            minX: bx + side * 4.1 - 0.3,
            maxX: bx + side * 4.1 + 0.3,
            minZ: cz - 5.5,
            maxZ: cz + 5.5,
            maxY: ym + 2.5
          });
        }
      }
      void tm;
    }

    // Twin dramatic inclined cable-stayed steel masts rising from water caissons
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e0,
      roughness: 0.25,
      metalness: 0.9
    });
    for (const mz of [154, 186]) {
      const caisson = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 4.5, 16), copingMat);
      caisson.position.set(bx + 5.2, WATER_LEVEL + 0.8, mz);
      bridge.add(caisson);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.62, 32, 14), whiteSteelMat);
      mast.position.set(bx + 4.2, 14.5, mz);
      mast.rotation.z = 0.14;
      mast.castShadow = true;
      bridge.add(mast);

      const topPos = new THREE.Vector3(bx + 2.0, 29.5, mz);
      // Fan stay cables to deck edges
      for (let c = -3; c <= 3; c++) {
        const anchorZ = mz + c * 6.5;
        if (anchorZ < zStart + 4 || anchorZ > zEnd - 4) continue;
        const t = (anchorZ - zStart) / (zEnd - zStart);
        const anchorY = CURB_HEIGHT + Math.sin(t * Math.PI) * 3.8 + 0.2;
        const anchorPos = new THREE.Vector3(bx + 3.8, anchorY, anchorZ);
        const dir = new THREE.Vector3().subVectors(topPos, anchorPos);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, dir.length(), 6), cableMat);
        cable.position.copy(anchorPos).addScaledVector(dir, 0.5);
        cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        bridge.add(cable);
      }
    }

    group.add(bridge);
  };
  buildSouthQuayBridge();

  // 6. Adams Plaza / North Quay Glazed Footbridge (North Dock, x = 28, z = -196..-110)
  const buildNorthFootbridge = () => {
    const northBridge = new THREE.Group();
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xcfd6de,
      roughness: 0.26,
      metalness: 0.84
    });
    const canopyGlass = new THREE.MeshPhysicalMaterial({
      color: 0xaed2e4,
      roughness: 0.1,
      metalness: 0.12,
      transparent: true,
      opacity: 0.34
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x62676f,
      roughness: 0.68,
      metalness: 0.12
    });
    const z0 = -196;
    const z1 = -110;
    const bx = 28;
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const za = z0 + (z1 - z0) * t0;
      const zb = z0 + (z1 - z0) * t1;
      const ya = CURB_HEIGHT + Math.sin(t0 * Math.PI) * 2.4;
      const yb = CURB_HEIGHT + Math.sin(t1 * Math.PI) * 2.4;
      const ym = (ya + yb) * 0.5;
      const segLen = Math.hypot(zb - za, yb - ya);
      const pitch = Math.atan2(yb - ya, zb - za);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.42, segLen + 0.06), deckMat);
      deck.position.set(bx, ym - 0.18, (za + zb) * 0.5);
      deck.rotation.x = -pitch;
      deck.receiveShadow = true;
      northBridge.add(deck);

      // Arched glazed canopy rib every 2 segments
      if (i % 2 === 0) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.12, 8, 20, Math.PI), ribMat);
        arch.position.set(bx, ym + 0.1, (za + zb) * 0.5);
        northBridge.add(arch);
      }

      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(3.78, 3.78, segLen + 0.05, 16, 1, true, 0, Math.PI),
        canopyGlass
      );
      shell.rotation.z = Math.PI / 2;
      shell.rotation.y = Math.PI / 2;
      shell.position.set(bx, ym + 0.1, (za + zb) * 0.5);
      northBridge.add(shell);
    }
    group.add(northBridge);
  };
  buildNorthFootbridge();

  // 7. Canary Wharf Thames Clippers Pier (West Embankment on River Thames)
  const pierGroup = new THREE.Group();
  const pontoon = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 34), craneDarkMat);
  pontoon.position.set(-252, WATER_LEVEL + 0.45, 10);
  pontoon.castShadow = true;
  pontoon.receiveShadow = true;
  pierGroup.add(pontoon);

  const pierRoof = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.28, 22), copingMat);
  pierRoof.position.set(-252, WATER_LEVEL + 4.2, 10);
  pierGroup.add(pierRoof);

  // Connecting gangway from embankment
  const gangway = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 3.8), craneDarkMat);
  gangway.position.set(-241, (QUAY_TOP + WATER_LEVEL + 0.8) * 0.5, 10);
  gangway.rotation.z = 0.08;
  pierGroup.add(gangway);
  group.add(pierGroup);

  return {
    group,
    water,
    colliders,
    bridgeLights,
    update(dt: number) {
      water.material.uniforms['time'].value += dt * 0.38;
    },
    setWaterAppearance(sunDir, sunColor, waterColor, distortion) {
      water.material.uniforms['sunDirection'].value.copy(sunDir).normalize();
      water.material.uniforms['sunColor'].value.copy(sunColor);
      water.material.uniforms['waterColor'].value.copy(waterColor);
      water.material.uniforms['distortionScale'].value = distortion;
    }
  };
}
