import * as THREE from 'three';
import { CURB_HEIGHT, JUBILEE_PARK, ROADS } from './layout';

interface WalkRoute {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  width: number;
  crossing?: boolean;
}

interface PedestrianAgent {
  routeIdx: number;
  t: number;
  dir: 1 | -1;
  lateral: number;
  speed: number;
  phase: number;
  scale: number;
  hasBriefcase: boolean;
}

export interface CrowdSystemResult {
  group: THREE.Group;
  update: (elapsed: number, dt: number) => void;
}

export function buildCrowdSystem(count = 220): CrowdSystemResult {
  const group = new THREE.Group();
  group.name = 'BusinessCrowds';

  // Realistic Canary Wharf pedestrian corridors (zero building/fountain collisions!)
  const routes: WalkRoute[] = [
    // Cabot Square North & South walkways (avoiding central fountain radius 10.5)
    { x0: -96, z0: -22, x1: -36, z1: -22, y: CURB_HEIGHT, width: 5.0 },
    { x0: -96, z0: 22, x1: -36, z1: 22, y: CURB_HEIGHT, width: 5.0 },
    { x0: -86, z0: -32, x1: -86, z1: 32, y: CURB_HEIGHT, width: 4.5 },
    { x0: -44, z0: -32, x1: -44, z1: 32, y: CURB_HEIGHT, width: 4.5 },
    // Under DLR station walkway linking Cabot Square to Canada Square
    { x0: -40, z0: 13, x1: 68, z1: 13, y: CURB_HEIGHT, width: 5.5 },
    { x0: -40, z0: -56, x1: 68, z1: -56, y: CURB_HEIGHT, width: 5.5 },
    // Canada Square East-West promenade
    { x0: -4, z0: -70, x1: -4, z1: 18, y: CURB_HEIGHT, width: 4.0 },
    { x0: 63, z0: -70, x1: 63, z1: 18, y: CURB_HEIGHT, width: 4.0 },
    // Jubilee Park footpaths
    { x0: 28, z0: 26, x1: 28, z1: 71, y: JUBILEE_PARK.elevation, width: 2.6 },
    { x0: 48, z0: 26, x1: 48, z1: 71, y: JUBILEE_PARK.elevation, width: 2.4 },
    // North Quay & South Quay waterfront promenades
    { x0: -195, z0: -103, x1: 195, z1: -103, y: CURB_HEIGHT, width: 4.5 },
    { x0: -195, z0: 130, x1: 195, z1: 130, y: CURB_HEIGHT, width: 3.5 },
    // Boulevard sidewalks along North Colonnade & Bank St
    { x0: -105, z0: ROADS.northColonnadeZ + 10.2, x1: 125, z1: ROADS.northColonnadeZ + 10.2, y: CURB_HEIGHT, width: 3.0 },
    { x0: -105, z0: ROADS.southColonnadeZ - 10.2, x1: 125, z1: ROADS.southColonnadeZ - 10.2, y: CURB_HEIGHT, width: 3.0 },
    // Zebra Crossings across North Colonnade & Bank Street
    { x0: -66, z0: ROADS.northColonnadeZ - 9.5, x1: -66, z1: ROADS.northColonnadeZ + 9.5, y: 0.08, width: 2.4, crossing: true },
    { x0: 28, z0: ROADS.northColonnadeZ - 9.5, x1: 28, z1: ROADS.northColonnadeZ + 9.5, y: 0.08, width: 2.4, crossing: true },
    { x0: -66, z0: ROADS.southColonnadeZ - 9.5, x1: -66, z1: ROADS.southColonnadeZ + 9.5, y: 0.08, width: 2.4, crossing: true },
    { x0: 46, z0: ROADS.southColonnadeZ - 9.5, x1: 46, z1: ROADS.southColonnadeZ + 9.5, y: 0.08, width: 2.4, crossing: true }
  ];

  // Shared human-scale geometries (1.72m average adult height)
  const headGeo = new THREE.SphereGeometry(0.115, 10, 8);
  const torsoGeo = new THREE.BoxGeometry(0.38, 0.58, 0.21);
  const legGeo = new THREE.BoxGeometry(0.13, 0.78, 0.14);
  legGeo.translate(0, -0.39, 0);
  const armGeo = new THREE.BoxGeometry(0.1, 0.56, 0.11);
  armGeo.translate(0, -0.26, 0);
  const briefcaseGeo = new THREE.BoxGeometry(0.08, 0.28, 0.38);

  const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.02 });
  const suitMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.05 });
  const trouserMat = new THREE.MeshStandardMaterial({ roughness: 0.84, metalness: 0.04 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2a1d15, roughness: 0.45, metalness: 0.12 });

  const heads = new THREE.InstancedMesh(headGeo, skinMat, count);
  const torsos = new THREE.InstancedMesh(torsoGeo, suitMat, count);
  const leftLegs = new THREE.InstancedMesh(legGeo, trouserMat, count);
  const rightLegs = new THREE.InstancedMesh(legGeo, trouserMat, count);
  const leftArms = new THREE.InstancedMesh(armGeo, suitMat, count);
  const rightArms = new THREE.InstancedMesh(armGeo, suitMat, count);
  const briefcases = new THREE.InstancedMesh(briefcaseGeo, leatherMat, count);

  for (const m of [heads, torsos, leftLegs, rightLegs, leftArms, rightArms, briefcases]) {
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
  }
  torsos.castShadow = true;

  // Canary Wharf Corporate Attire Palettes (charcoal, navy, slate, camel trench, burgundy coat)
  const suitPalette = [0x1c2330, 0x262930, 0x182538, 0x353942, 0x4b4238, 0x7c6852, 0x222226, 0x3a242c];
  const trouserPalette = [0x161920, 0x22262e, 0x1c222d, 0x2a2d34];
  const skinPalette = [0xe8c4a6, 0xd9ae8a, 0xbc8863, 0x8f5f40, 0xf0d2bc];

  const colorTmp = new THREE.Color();
  const agents: PedestrianAgent[] = [];

  for (let i = 0; i < count; i++) {
    const routeIdx = i % routes.length;
    const route = routes[routeIdx];
    const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    agents.push({
      routeIdx,
      t: Math.random(),
      dir,
      lateral: (Math.random() - 0.5) * route.width,
      speed: 1.15 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      scale: 0.92 + Math.random() * 0.14,
      hasBriefcase: Math.random() < 0.65
    });

    colorTmp.setHex(skinPalette[i % skinPalette.length]);
    heads.setColorAt(i, colorTmp);

    colorTmp.setHex(suitPalette[i % suitPalette.length]);
    torsos.setColorAt(i, colorTmp);
    leftArms.setColorAt(i, colorTmp);
    rightArms.setColorAt(i, colorTmp);

    colorTmp.setHex(trouserPalette[i % trouserPalette.length]);
    leftLegs.setColorAt(i, colorTmp);
    rightLegs.setColorAt(i, colorTmp);
  }

  group.add(heads, torsos, leftLegs, rightLegs, leftArms, rightArms, briefcases);

  const m4 = new THREE.Matrix4();
  const rootPos = new THREE.Vector3();
  const partPos = new THREE.Vector3();
  const partQuat = new THREE.Quaternion();
  const rootQuat = new THREE.Quaternion();
  const swingQuat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const offsetVec = new THREE.Vector3();

  return {
    group,
    update(elapsed: number, dt: number) {
      for (let i = 0; i < count; i++) {
        const a = agents[i];
        const r = routes[a.routeIdx];
        const dx = r.x1 - r.x0;
        const dz = r.z1 - r.z0;
        const len = Math.max(1, Math.hypot(dx, dz));

        a.t += (a.dir * a.speed * dt) / len;
        if (a.t > 1) {
          a.t = 1;
          a.dir = -1;
        } else if (a.t < 0) {
          a.t = 0;
          a.dir = 1;
        }

        const nx = -dz / len;
        const nz = dx / len;
        const px = r.x0 + dx * a.t + nx * a.lateral;
        const pz = r.z0 + dz * a.t + nz * a.lateral;
        const yaw = Math.atan2(dx * a.dir, dz * a.dir);

        const stride = elapsed * a.speed * 5.2 + a.phase;
        const legSwing = Math.sin(stride) * 0.48;
        const bob = Math.abs(Math.cos(stride)) * 0.035;
        const s = a.scale;

        rootPos.set(px, r.y + bob, pz);
        rootQuat.setFromAxisAngle(yAxis, yaw);
        scaleVec.set(s, s, s);

        // Head
        offsetVec.set(0, 1.56 * s, 0).applyQuaternion(rootQuat);
        partPos.copy(rootPos).add(offsetVec);
        m4.compose(partPos, rootQuat, scaleVec);
        heads.setMatrixAt(i, m4);

        // Torso / Jacket
        offsetVec.set(0, 1.12 * s, 0).applyQuaternion(rootQuat);
        partPos.copy(rootPos).add(offsetVec);
        m4.compose(partPos, rootQuat, scaleVec);
        torsos.setMatrixAt(i, m4);

        // Left Leg
        offsetVec.set(-0.1 * s, 0.8 * s, 0).applyQuaternion(rootQuat);
        partPos.copy(rootPos).add(offsetVec);
        swingQuat.setFromAxisAngle(xAxis, legSwing);
        partQuat.copy(rootQuat).multiply(swingQuat);
        m4.compose(partPos, partQuat, scaleVec);
        leftLegs.setMatrixAt(i, m4);

        // Right Leg
        offsetVec.set(0.1 * s, 0.8 * s, 0).applyQuaternion(rootQuat);
        partPos.copy(rootPos).add(offsetVec);
        swingQuat.setFromAxisAngle(xAxis, -legSwing);
        partQuat.copy(rootQuat).multiply(swingQuat);
        m4.compose(partPos, partQuat, scaleVec);
        rightLegs.setMatrixAt(i, m4);

        // Left Arm
        offsetVec.set(-0.24 * s, 1.36 * s, 0).applyQuaternion(rootQuat);
        partPos.copy(rootPos).add(offsetVec);
        swingQuat.setFromAxisAngle(xAxis, -legSwing * 0.7);
        partQuat.copy(rootQuat).multiply(swingQuat);
        m4.compose(partPos, partQuat, scaleVec);
        leftArms.setMatrixAt(i, m4);

        // Right Arm
        offsetVec.set(0.24 * s, 1.36 * s, 0).applyQuaternion(rootQuat);
        partPos.copy(rootPos).add(offsetVec);
        swingQuat.setFromAxisAngle(xAxis, legSwing * 0.65);
        partQuat.copy(rootQuat).multiply(swingQuat);
        m4.compose(partPos, partQuat, scaleVec);
        rightArms.setMatrixAt(i, m4);

        // Leather Briefcase (held in right hand)
        if (a.hasBriefcase) {
          offsetVec.set(0.28 * s, 0.72 * s, Math.sin(stride) * 0.14 * s).applyQuaternion(rootQuat);
          partPos.copy(rootPos).add(offsetVec);
          m4.compose(partPos, rootQuat, scaleVec);
        } else {
          m4.makeScale(0, 0, 0);
        }
        briefcases.setMatrixAt(i, m4);
      }

      heads.instanceMatrix.needsUpdate = true;
      torsos.instanceMatrix.needsUpdate = true;
      leftLegs.instanceMatrix.needsUpdate = true;
      rightLegs.instanceMatrix.needsUpdate = true;
      leftArms.instanceMatrix.needsUpdate = true;
      rightArms.instanceMatrix.needsUpdate = true;
      briefcases.instanceMatrix.needsUpdate = true;
    }
  };
}
