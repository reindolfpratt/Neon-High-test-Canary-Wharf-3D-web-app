import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BoxCollider,
  CylinderCollider,
  EYE_HEIGHT,
  getGroundElevation
} from '../scene/layout';

export type CameraMode = 'walk' | 'fly' | 'orbit';

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLElement;
  readonly pointerLock: PointerLockControls;
  readonly orbit: OrbitControls;

  private readonly boxes: BoxCollider[];
  private readonly cylinders: CylinderCollider[];
  private readonly keys = new Set<string>();

  mode: CameraMode = 'walk';
  private velocityY = 0;
  private onGround = true;
  private readonly playerRadius = 0.55;
  private bobTimer = 0;

  onLockChange?: (locked: boolean) => void;
  onModeChange?: (mode: CameraMode) => void;

  private readonly forwardVec = new THREE.Vector3();
  private readonly rightVec = new THREE.Vector3();
  private readonly moveVec = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    boxes: BoxCollider[],
    cylinders: CylinderCollider[]
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.boxes = boxes;
    this.cylinders = cylinders;

    this.pointerLock = new PointerLockControls(camera, domElement);
    this.pointerLock.addEventListener('lock', () => this.onLockChange?.(true));
    this.pointerLock.addEventListener('unlock', () => this.onLockChange?.(false));

    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.06;
    this.orbit.maxPolarAngle = Math.PI * 0.485;
    this.orbit.minDistance = 24;
    this.orbit.maxDistance = 420;
    this.orbit.target.set(28, 62, -16);
    this.orbit.enabled = false;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (
      this.pointerLock.isLocked &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
    ) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  get isLocked(): boolean {
    return this.pointerLock.isLocked;
  }

  lock(): void {
    if (this.mode === 'orbit') {
      this.setMode('walk');
    }
    this.pointerLock.lock();
  }

  unlock(): void {
    if (this.pointerLock.isLocked) {
      this.pointerLock.unlock();
    }
  }

  setMode(next: CameraMode): void {
    this.mode = next;
    this.orbit.enabled = next === 'orbit';
    if (next === 'orbit') {
      if (this.pointerLock.isLocked) {
        this.pointerLock.unlock();
      }
      // Frame the Canary Wharf skyline hero composition unobstructed across Middle Dock
      if (this.camera.position.y < 18) {
        this.camera.position.set(-84, 96, 208);
      }
      this.orbit.target.set(24, 68, -14);
      this.orbit.update();
    } else if (next === 'walk') {
      const groundY = getGroundElevation(this.camera.position.x, this.camera.position.z);
      if (this.camera.position.y > groundY + 12) {
        this.camera.position.y = groundY + EYE_HEIGHT;
      }
      this.velocityY = 0;
    }
    this.onModeChange?.(next);
  }

  cycleMode(): CameraMode {
    const order: CameraMode[] = ['walk', 'fly', 'orbit'];
    const next = order[(order.indexOf(this.mode) + 1) % order.length];
    this.setMode(next);
    return next;
  }

  teleport(pos: [number, number, number], lookAt: [number, number, number], fly = false): void {
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    this.velocityY = 0;
    if (fly) {
      this.setMode('fly');
    } else if (this.mode === 'orbit') {
      this.setMode('walk');
    } else {
      this.setMode('walk');
    }
  }

  private resolveCollisions(pos: THREE.Vector3): void {
    const r = this.playerRadius;
    const feetY = pos.y - EYE_HEIGHT;

    // AABB colliders (buildings, quay railings, stations)
    for (const b of this.boxes) {
      if (feetY > b.maxY) continue;
      const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = r - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          // Push out along shallowest axis if embedded
          const penL = Math.abs(pos.x - b.minX);
          const penR = Math.abs(b.maxX - pos.x);
          const penT = Math.abs(pos.z - b.minZ);
          const penB = Math.abs(b.maxZ - pos.z);
          const m = Math.min(penL, penR, penT, penB);
          if (m === penL) pos.x = b.minX - r;
          else if (m === penR) pos.x = b.maxX + r;
          else if (m === penT) pos.z = b.minZ - r;
          else pos.z = b.maxZ + r;
        }
      }
    }

    // Cylinder colliders (fountain, trees, DLR piers, phone boxes)
    for (const c of this.cylinders) {
      if (feetY > c.maxY) continue;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minD = c.radius + r;
      const distSq = dx * dx + dz * dz;
      if (distSq < minD * minD && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = minD - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }

    // World boundary clamp (stay inside Canary Wharf peninsula & bridges)
    pos.x = Math.max(-230, Math.min(248, pos.x));
    pos.z = Math.max(-195, Math.min(205, pos.z));
  }

  update(dt: number): void {
    if (this.mode === 'orbit') {
      this.orbit.update();
      return;
    }

    const fwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    this.camera.getWorldDirection(this.forwardVec);
    if (this.mode === 'walk') {
      this.forwardVec.y = 0;
    }
    if (this.forwardVec.lengthSq() > 1e-6) {
      this.forwardVec.normalize();
    }
    this.rightVec.crossVectors(this.forwardVec, this.camera.up).normalize();

    this.moveVec.set(0, 0, 0);
    if (fwd !== 0) this.moveVec.addScaledVector(this.forwardVec, fwd);
    if (strafe !== 0) this.moveVec.addScaledVector(this.rightVec, strafe);
    if (this.moveVec.lengthSq() > 0) this.moveVec.normalize();

    if (this.mode === 'fly') {
      const flySpeed = sprinting ? 52 : 22;
      this.camera.position.addScaledVector(this.moveVec, flySpeed * dt);
      if (this.keys.has('Space') || this.keys.has('KeyE')) {
        this.camera.position.y += flySpeed * 0.72 * dt;
      }
      if (this.keys.has('KeyC') || this.keys.has('ControlLeft')) {
        this.camera.position.y -= flySpeed * 0.72 * dt;
      }
      this.camera.position.y = Math.max(1.5, Math.min(340, this.camera.position.y));
      return;
    }

    // WALK MODE (1.7m eye height, sprint, jump, smooth curb step-up & collision)
    const speed = sprinting ? 9.6 : 4.5;
    this.camera.position.x += this.moveVec.x * speed * dt;
    this.camera.position.z += this.moveVec.z * speed * dt;

    this.resolveCollisions(this.camera.position);

    const groundY = getGroundElevation(this.camera.position.x, this.camera.position.z);
    const targetEyeY = groundY + EYE_HEIGHT;

    if (this.keys.has('Space') && this.onGround) {
      this.velocityY = 6.2;
      this.onGround = false;
    }

    if (!this.onGround) {
      this.velocityY -= 16.5 * dt;
      this.camera.position.y += this.velocityY * dt;
      if (this.camera.position.y <= targetEyeY) {
        this.camera.position.y = targetEyeY;
        this.velocityY = 0;
        this.onGround = true;
      }
    } else {
      // Smooth step-up over curbs, Jubilee Park terraces, and arched footbridges
      const diff = targetEyeY - this.camera.position.y;
      this.camera.position.y += diff * Math.min(1, dt * 14);
      // Subtle realistic walking head bob when moving
      if (this.moveVec.lengthSq() > 0.01) {
        this.bobTimer += dt * (sprinting ? 12.5 : 8.2);
        this.camera.position.y += Math.sin(this.bobTimer) * (sprinting ? 0.012 : 0.006);
      }
    }
  }
}
