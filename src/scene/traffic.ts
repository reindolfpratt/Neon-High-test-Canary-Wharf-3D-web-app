import * as THREE from 'three';
import { DLR_VIADUCT, ROADS } from './layout';
import { ProceduralTextureSuite } from './textures';
import { SignalLightSet } from './streetscape';

type VehicleKind = 'black-cab' | 'double-decker' | 'executive' | 'police';

interface LoopPoint {
  x: number;
  z: number;
}

interface VehicleAgent {
  mesh: THREE.Group;
  kind: VehicleKind;
  loopIndex: 0 | 1;
  dist: number;
  speed: number;
  targetSpeed: number;
  length: number;
  wheels: THREE.Object3D[];
}

export interface TrafficSystemResult {
  group: THREE.Group;
  getVehiclePositions: () => Array<{ x: number; z: number; kind: VehicleKind }>;
  update: (elapsed: number, dt: number, nightFactor: number) => void;
}

class RoundedLoopPath {
  readonly points: LoopPoint[] = [];
  readonly cumLen: number[] = [];
  readonly totalLength: number;

  constructor(minX: number, maxX: number, minZ: number, maxZ: number, clockwise: boolean, cornerR = 6.5) {
    // Build smooth rounded rectangle waypoints
    const rawCorners: Array<[number, number]> = clockwise
      ? [
          [minX, minZ],
          [maxX, minZ],
          [maxX, maxZ],
          [minX, maxZ]
        ]
      : [
          [minX, minZ],
          [minX, maxZ],
          [maxX, maxZ],
          [maxX, minZ]
        ];

    const arcSteps = 7;
    for (let i = 0; i < 4; i++) {
      const prev = rawCorners[(i + 3) % 4];
      const curr = rawCorners[i];
      const next = rawCorners[(i + 1) % 4];

      const dInX = Math.sign(curr[0] - prev[0]);
      const dInZ = Math.sign(curr[1] - prev[1]);
      const dOutX = Math.sign(next[0] - curr[0]);
      const dOutZ = Math.sign(next[1] - curr[1]);

      const pStartX = curr[0] - dInX * cornerR;
      const pStartZ = curr[1] - dInZ * cornerR;
      const pEndX = curr[0] + dOutX * cornerR;
      const pEndZ = curr[1] + dOutZ * cornerR;

      for (let s = 0; s <= arcSteps; s++) {
        const t = s / arcSteps;
        // Quadratic Bezier corner fillet for realistic smooth vehicle turning
        const omt = 1 - t;
        const x = omt * omt * pStartX + 2 * omt * t * curr[0] + t * t * pEndX;
        const z = omt * omt * pStartZ + 2 * omt * t * curr[1] + t * t * pEndZ;
        this.points.push({ x, z });
      }
    }

    let len = 0;
    this.cumLen.push(0);
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      len += Math.hypot(b.x - a.x, b.z - a.z);
      this.cumLen.push(len);
    }
    this.totalLength = len;
  }

  sample(dist: number): { x: number; z: number; yaw: number } {
    const d = ((dist % this.totalLength) + this.totalLength) % this.totalLength;
    let i = 0;
    while (i < this.points.length - 1 && this.cumLen[i + 1] < d) {
      i++;
    }
    const segLen = Math.max(0.001, this.cumLen[i + 1] - this.cumLen[i]);
    const t = (d - this.cumLen[i]) / segLen;
    const a = this.points[i];
    const b = this.points[(i + 1) % this.points.length];
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    return { x, z, yaw };
  }
}

export function buildTrafficSystem(
  _signals: SignalLightSet,
  textures: ProceduralTextureSuite
): TrafficSystemResult {
  const group = new THREE.Group();
  group.name = 'TrafficAndDLR';

  // Authentic UK Left-Hand Driving Closed Circuits
  // Loop 0: Outer Clockwise (East on North Colonnade, South on Upper Bank, West on Bank St, North on Westferry)
  // Loop 1: Inner Counter-Clockwise (South on Westferry, East on Bank St, North on Upper Bank, West on North Colonnade)
  const laneOff = 3.35;
  const loops: [RoundedLoopPath, RoundedLoopPath] = [
    new RoundedLoopPath(
      ROADS.loopMinX - laneOff,
      ROADS.loopMaxX + laneOff,
      ROADS.loopMinZ - laneOff,
      ROADS.loopMaxZ + laneOff,
      true,
      7.2
    ),
    new RoundedLoopPath(
      ROADS.loopMinX + laneOff,
      ROADS.loopMaxX - laneOff,
      ROADS.loopMinZ + laneOff,
      ROADS.loopMaxZ - laneOff,
      false,
      5.8
    )
  ];

  // GT6-grade Clearcoat Metallic Vehicle Materials
  const blackCabPaint = new THREE.MeshPhysicalMaterial({
    color: 0x111318,
    roughness: 0.14,
    metalness: 0.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.9
  });
  const busRedPaint = new THREE.MeshPhysicalMaterial({
    color: 0xb8121f,
    roughness: 0.18,
    metalness: 0.28,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.65
  });
  const policeWhitePaint = new THREE.MeshPhysicalMaterial({
    color: 0xf0f4f8,
    roughness: 0.15,
    metalness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.7
  });
  const policeSideMat = new THREE.MeshStandardMaterial({
    map: textures.logos.policeBattenburg,
    roughness: 0.24,
    metalness: 0.2
  });
  const carGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x141d26,
    roughness: 0.05,
    metalness: 0.18,
    clearcoat: 1.0,
    envMapIntensity: 1.9
  });
  const busWindowMat = new THREE.MeshStandardMaterial({
    color: 0x1c2530,
    emissive: 0xffd79b,
    emissiveIntensity: 0.12,
    roughness: 0.08,
    metalness: 0.35
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8ee,
    roughness: 0.12,
    metalness: 0.96,
    envMapIntensity: 2.0
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.85, metalness: 0.06 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff4dd,
    emissiveIntensity: 1.6,
    roughness: 0.1
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff1c1c,
    emissive: 0xff0d0d,
    emissiveIntensity: 1.8,
    roughness: 0.1
  });
  const taxiSignMat = new THREE.MeshStandardMaterial({
    color: 0xffb82e,
    emissive: 0xff9f1a,
    emissiveIntensity: 2.4,
    roughness: 0.2
  });
  const busDestMat = new THREE.MeshStandardMaterial({
    map: textures.logos.busDestination,
    emissiveMap: textures.logos.busDestination,
    emissive: 0xffbe42,
    emissiveIntensity: 1.4,
    roughness: 0.2
  });

  const policeBlueLeft = new THREE.MeshStandardMaterial({
    color: 0x0066ff,
    emissive: 0x0077ff,
    emissiveIntensity: 6.0
  });
  const policeBlueRight = new THREE.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: 0x1199ff,
    emissiveIntensity: 0.5
  });

  const executivePalettes = [0xc8d0d8, 0x1b2738, 0x3b4048, 0xe8ecef, 0x183828, 0x625a52];
  const executiveMats = executivePalettes.map(
    (hex) =>
      new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.16,
        metalness: 0.65,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.85
      })
  );

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 10);
  rimGeo.rotateZ(Math.PI / 2);

  const addWheelSet = (parent: THREE.Group, halfW: number, wheelZs: number[], radiusScale = 1): THREE.Object3D[] => {
    const wheels: THREE.Object3D[] = [];
    for (const wz of wheelZs) {
      for (const side of [-1, 1]) {
        const wGroup = new THREE.Group();
        wGroup.position.set(side * halfW, 0.35 * radiusScale, wz);
        wGroup.scale.setScalar(radiusScale);
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        const rim = new THREE.Mesh(rimGeo, chromeMat);
        wGroup.add(tire, rim);
        parent.add(wGroup);
        wheels.push(wGroup);
      }
    }
    return wheels;
  };

  let policeLight: THREE.PointLight | null = null;
  const policeHeadlights: THREE.SpotLight[] = [];

  const createVehicleMesh = (kind: VehicleKind, variantIdx: number): { mesh: THREE.Group; length: number; wheels: THREE.Object3D[] } => {
    const v = new THREE.Group();

    if (kind === 'double-decker') {
      // Iconic Red London New Routemaster Double-Decker Bus (11.2m long, 4.35m tall)
      const lower = new THREE.Mesh(new THREE.BoxGeometry(2.52, 1.95, 11.0), busRedPaint);
      lower.position.y = 1.38;
      lower.castShadow = true;
      v.add(lower);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.48, 1.9, 10.6), busRedPaint);
      upper.position.set(0, 3.25, -0.1);
      upper.castShadow = true;
      v.add(upper);

      // Wraparound dark glazed upper & lower deck window bands
      const lowWin = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.92, 9.6), busWindowMat);
      lowWin.position.set(0, 1.68, 0.15);
      v.add(lowWin);

      const upWin = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.95, 9.8), busWindowMat);
      upWin.position.set(0, 3.32, 0.05);
      v.add(upWin);

      // Front amber LED destination display
      const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.38), busDestMat);
      dest.position.set(0, 2.52, 5.38);
      v.add(dest);

      // Headlights & Taillights
      for (const sx of [-0.95, 0.95]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.12), headlightMat);
        hl.position.set(sx, 0.88, 5.52);
        v.add(hl);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.12), taillightMat);
        tl.position.set(sx, 1.05, -5.52);
        v.add(tl);
      }

      const wheels = addWheelSet(v, 1.18, [3.4, -2.6, -4.1], 1.25);
      return { mesh: v, length: 12.2, wheels };
    }

    if (kind === 'black-cab') {
      // Iconic London Black Cab (LEVC TX / TX4 silhouette)
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.72, 4.75), blackCabPaint);
      body.position.y = 0.68;
      body.castShadow = true;
      v.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.86, 2.75), blackCabPaint);
      cabin.position.set(0, 1.42, -0.35);
      cabin.castShadow = true;
      v.add(cabin);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.64, 2.52), carGlassMat);
      glass.position.set(0, 1.42, -0.32);
      v.add(glass);

      // Vertical Chrome Front Grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.08), chromeMat);
      grille.position.set(0, 0.68, 2.39);
      v.add(grille);

      // Iconic Glowing Amber TAXI Roof Sign
      const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.22), taxiSignMat);
      taxiSign.position.set(0, 1.92, 0.82);
      v.add(taxiSign);

      for (const sx of [-0.68, 0.68]) {
        const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), headlightMat);
        hl.rotation.x = Math.PI / 2;
        hl.position.set(sx, 0.74, 2.38);
        v.add(hl);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.08), taillightMat);
        tl.position.set(sx, 0.76, -2.38);
        v.add(tl);
      }

      const wheels = addWheelSet(v, 0.92, [1.45, -1.42], 1.0);
      return { mesh: v, length: 5.5, wheels };
    }

    // Executive Saloon OR Metropolitan Police Response Car
    const isPolice = kind === 'police';
    const paint = isPolice ? policeWhitePaint : executiveMats[variantIdx % executiveMats.length];
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.66, 4.82), paint);
    body.position.y = 0.62;
    body.castShadow = true;
    v.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.62, 2.45), paint);
    cabin.position.set(0, 1.22, -0.22);
    cabin.castShadow = true;
    v.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.48, 2.26), carGlassMat);
    glass.position.set(0, 1.22, -0.2);
    v.add(glass);

    if (isPolice) {
      // Side Battenburg fluorescent yellow/blue livery panels
      for (const side of [-1, 1]) {
        const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.56), policeSideMat);
        sidePanel.position.set(side * 0.97, 0.64, 0);
        sidePanel.rotation.y = side * (Math.PI / 2);
        v.add(sidePanel);
      }
      // Roof Lightbar with alternating flashing blue pods
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.28), chromeMat);
      barBase.position.set(0, 1.58, -0.05);
      v.add(barBase);
      const podL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.26), policeBlueLeft);
      podL.position.set(-0.34, 1.62, -0.05);
      v.add(podL);
      const podR = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.26), policeBlueRight);
      podR.position.set(0.34, 1.62, -0.05);
      v.add(podR);

      policeLight = new THREE.PointLight(0x1f88ff, 0, 26, 1.6);
      policeLight.position.set(0, 2.3, 0);
      v.add(policeLight);
    }

    for (const sx of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.1), headlightMat);
      hl.position.set(sx, 0.66, 2.42);
      v.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.1), taillightMat);
      tl.position.set(sx, 0.68, -2.42);
      v.add(tl);
    }

    const wheels = addWheelSet(v, 0.92, [1.46, -1.42], 0.96);
    return { mesh: v, length: 5.5, wheels };
  };

  // Spawn balanced realistic London traffic fleet across both loops
  const agents: VehicleAgent[] = [];
  const fleetSpec: Array<{ kind: VehicleKind; loop: 0 | 1; speed: number }> = [
    // Outer loop (Clockwise UK left-hand)
    { kind: 'double-decker', loop: 0, speed: 7.4 },
    { kind: 'black-cab', loop: 0, speed: 10.6 },
    { kind: 'executive', loop: 0, speed: 11.4 },
    { kind: 'black-cab', loop: 0, speed: 10.2 },
    { kind: 'police', loop: 0, speed: 12.2 },
    { kind: 'executive', loop: 0, speed: 11.0 },
    { kind: 'double-decker', loop: 0, speed: 7.6 },
    { kind: 'black-cab', loop: 0, speed: 10.8 },
    { kind: 'executive', loop: 0, speed: 11.2 },
    { kind: 'black-cab', loop: 0, speed: 10.4 },
    // Inner loop (Counter-Clockwise UK left-hand)
    { kind: 'black-cab', loop: 1, speed: 10.5 },
    { kind: 'double-decker', loop: 1, speed: 7.3 },
    { kind: 'executive', loop: 1, speed: 11.3 },
    { kind: 'black-cab', loop: 1, speed: 10.1 },
    { kind: 'executive', loop: 1, speed: 11.6 },
    { kind: 'black-cab', loop: 1, speed: 10.7 },
    { kind: 'double-decker', loop: 1, speed: 7.5 },
    { kind: 'executive', loop: 1, speed: 11.0 },
    { kind: 'black-cab', loop: 1, speed: 10.4 }
  ];

  const countPerLoop = [
    fleetSpec.filter((f) => f.loop === 0).length,
    fleetSpec.filter((f) => f.loop === 1).length
  ];
  const cursorLoop = [0, 0];

  fleetSpec.forEach((spec, idx) => {
    const loopPath = loops[spec.loop];
    const spacing = loopPath.totalLength / countPerLoop[spec.loop];
    const dist = cursorLoop[spec.loop] * spacing;
    cursorLoop[spec.loop]++;

    const built = createVehicleMesh(spec.kind, idx);
    group.add(built.mesh);
    agents.push({
      mesh: built.mesh,
      kind: spec.kind,
      loopIndex: spec.loop,
      dist,
      speed: spec.speed,
      targetSpeed: spec.speed,
      length: built.length,
      wheels: built.wheels
    });
  });

  // ==========================================================================
  // ELEVATED DOCKLANDS LIGHT RAILWAY (DLR) AUTOMATED TRAINS
  // ==========================================================================
  const dlrRedMat = new THREE.MeshPhysicalMaterial({
    color: 0xc21e28,
    roughness: 0.22,
    metalness: 0.35,
    clearcoat: 0.9
  });
  const dlrTealMat = new THREE.MeshPhysicalMaterial({
    color: 0x008c95,
    roughness: 0.25,
    metalness: 0.35,
    clearcoat: 0.85
  });
  const dlrSilverMat = new THREE.MeshStandardMaterial({ color: 0xc8d2dc, roughness: 0.28, metalness: 0.78 });
  const dlrWindowMat = new THREE.MeshStandardMaterial({
    color: 0x20303c,
    emissive: 0xffe8be,
    emissiveIntensity: 0.35,
    roughness: 0.1
  });

  const buildDLRTrain = () => {
    const train = new THREE.Group();
    for (let c = -1; c <= 1; c++) {
      const car = new THREE.Group();
      car.position.z = c * 14.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.68, 2.75, 13.6), dlrSilverMat);
      body.position.y = 1.6;
      body.castShadow = true;
      car.add(body);
      const redBand = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.88, 13.65), dlrRedMat);
      redBand.position.y = 0.88;
      car.add(redBand);
      const tealBand = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.35, 13.65), dlrTealMat);
      tealBand.position.y = 2.72;
      car.add(tealBand);
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.73, 1.05, 12.2), dlrWindowMat);
      win.position.y = 1.85;
      car.add(win);
      train.add(car);
    }
    // Front & rear LED headlamps/markers
    for (const end of [-1, 1]) {
      const endLight = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.22, 0.14),
        end > 0 ? headlightMat : taillightMat
      );
      endLight.position.set(0, 1.0, end * 21.3);
      train.add(endLight);
    }
    group.add(train);
    return train;
  };

  const dlrTrains = [
    { mesh: buildDLRTrain(), trackX: DLR_VIADUCT.centerX + 2.3, dir: -1, z: 180, dwell: 0 },
    { mesh: buildDLRTrain(), trackX: DLR_VIADUCT.centerX - 2.3, dir: 1, z: -150, dwell: 0 }
  ];

  // Ensure unused variable lint check doesn't complain
  void policeHeadlights;

  return {
    group,
    getVehiclePositions() {
      return agents.map((a) => ({ x: a.mesh.position.x, z: a.mesh.position.z, kind: a.kind }));
    },
    update(elapsed: number, dt: number, nightFactor: number) {
      // Update vehicle emissive intensities by time of day
      headlightMat.emissiveIntensity = 1.2 + nightFactor * 5.2;
      taillightMat.emissiveIntensity = 1.2 + nightFactor * 3.8;
      taxiSignMat.emissiveIntensity = 1.0 + nightFactor * 3.2;
      busWindowMat.emissiveIntensity = 0.08 + nightFactor * 1.4;
      dlrWindowMat.emissiveIntensity = 0.25 + nightFactor * 1.8;

      // Police flashing blue LED lightbar strobe (6 Hz alternating)
      const strobe = Math.sin(elapsed * 22) > 0;
      policeBlueLeft.emissiveIntensity = strobe ? 8.5 : 0.4;
      policeBlueRight.emissiveIntensity = strobe ? 0.4 : 8.5;
      if (policeLight) {
        policeLight.intensity = (0.45 + nightFactor * 1.6) * (strobe ? 16 : 9);
      }

      // Collision-free lane headway spacing update
      for (const loopIdx of [0, 1] as const) {
        const path = loops[loopIdx];
        const laneAgents = agents.filter((a) => a.loopIndex === loopIdx);
        laneAgents.sort((a, b) => a.dist - b.dist);

        const n = laneAgents.length;
        for (let i = 0; i < n; i++) {
          const curr = laneAgents[i];
          const ahead = laneAgents[(i + 1) % n];

          let gap = ahead.dist - curr.dist;
          if (gap <= 0) gap += path.totalLength;
          const minSafeGap = (curr.length + ahead.length) * 0.5 + 4.8;

          let desiredSpeed = curr.targetSpeed;
          if (gap < minSafeGap * 2.1) {
            const factor = Math.max(0, (gap - minSafeGap) / (minSafeGap * 1.1));
            desiredSpeed = Math.min(desiredSpeed, ahead.speed * 0.9 + factor * curr.targetSpeed * 0.6);
            if (gap < minSafeGap) desiredSpeed = 0;
          }

          // Smooth acceleration & braking
          const accel = desiredSpeed > curr.speed ? 4.2 : 9.5;
          curr.speed += Math.sign(desiredSpeed - curr.speed) * Math.min(Math.abs(desiredSpeed - curr.speed), accel * dt);
          curr.dist = (curr.dist + curr.speed * dt) % path.totalLength;

          const pose = path.sample(curr.dist);
          curr.mesh.position.set(pose.x, 0.06, pose.z);
          curr.mesh.rotation.y = pose.yaw;

          // Spin wheels proportional to travel speed
          const wheelSpin = curr.speed * dt * 2.6;
          for (const w of curr.wheels) {
            w.rotation.x += wheelSpin;
          }
        }
      }

      // Animate DLR trains gliding along the viaduct & dwelling gracefully at Canary Wharf Station
      for (const tr of dlrTrains) {
        if (tr.dwell > 0) {
          tr.dwell -= dt;
        } else {
          const distToStation = Math.abs(tr.z);
          const nearStation = distToStation < 45;
          const speed = nearStation ? Math.max(2.6, (distToStation / 45) * 18) : 18.5;
          const prevZ = tr.z;
          tr.z += tr.dir * speed * dt;
          if (prevZ * tr.z <= 0) {
            tr.z = 0;
            tr.dwell = 3.2; // Stop briefly at Canary Wharf DLR platform
          }
          if (tr.z > 235) tr.z = -235;
          if (tr.z < -235) tr.z = 235;
        }
        tr.mesh.position.set(tr.trackX, DLR_VIADUCT.deckY + 0.16, tr.z);
        tr.mesh.rotation.y = tr.dir > 0 ? 0 : Math.PI;
      }
    }
  };
}
