export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  label?: string;
}

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
  maxY: number;
  label?: string;
}

export type TimeOfDay = 'day' | 'golden' | 'night';
export type QualityPreset = 'low' | 'high' | 'ultra';

export const EYE_HEIGHT = 1.7;
export const CURB_HEIGHT = 0.14;
export const WATER_LEVEL = -1.85;
export const QUAY_TOP = 0.0;

// Road network centerlines and half-widths (1 unit = 1 meter)
export const ROADS = {
  northColonnadeZ: -86,
  southColonnadeZ: 86,
  westferryX: -116,
  upperBankX: 138,
  roadWidth: 15.6,
  roadHalf: 7.8,
  loopMinX: -116,
  loopMaxX: 138,
  loopMinZ: -86,
  loopMaxZ: 86
};

// Water basins
export const WATER_BASINS = {
  northDock: { minX: -245, maxX: 280, minZ: -195, maxZ: -112 },
  middleDock: { minX: -245, maxX: 280, minZ: 138, maxZ: 204 },
  thames: { minX: -480, maxX: -232, minZ: -380, maxZ: 380 }
};

// Key landmark areas
export const CABOT_SQUARE = {
  centerX: -66,
  centerZ: 0,
  minX: -98,
  maxX: -34,
  minZ: -34,
  maxZ: 34,
  fountainRadius: 10.5
};

export const JUBILEE_PARK = {
  minX: 4,
  maxX: 74,
  minZ: 22,
  maxZ: 74,
  elevation: 0.45,
  stationCanopyX: 18,
  stationCanopyZ: 46
};

export const DLR_VIADUCT = {
  centerX: -15,
  deckY: 8.2,
  width: 11.5,
  stationMinZ: -44,
  stationMaxZ: 44
};

export interface Viewpoint {
  id: string;
  label: string;
  position: [number, number, number];
  lookAt: [number, number, number];
  fly?: boolean;
  streetViewUrl: string;
  streetViewLabel: string;
}

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: 'cabot',
    label: 'Cabot Square',
    position: [-91, EYE_HEIGHT + CURB_HEIGHT, 14],
    lookAt: [28, 52, -20],
    streetViewUrl:
      'https://www.google.com/maps/@51.5049697,-0.0229609,3a,75y,37.67h,90t/data=!3m6!1e1!3m4!1sCIABIhD53E-W59vVm1bDq3x-mCez!2e10!3e11',
    streetViewLabel: 'Street View ↗'
  },
  {
    id: 'canada-sq',
    label: 'One Canada Sq',
    position: [-4, EYE_HEIGHT + CURB_HEIGHT, 16],
    lookAt: [28, 92, -20],
    streetViewUrl:
      'https://www.google.com/maps/@51.5049234,-0.0169127,3a,75y,270.12h,90t/data=!3m6!1e1!3m4!1sCIABIhADydVgxjj7M2gJFPAABYaY!2e10!3e11',
    streetViewLabel: 'Street View ↗'
  },
  {
    id: 'jubilee',
    label: 'Jubilee Park',
    position: [44, EYE_HEIGHT + JUBILEE_PARK.elevation, 60],
    lookAt: [22, 46, -18],
    streetViewUrl:
      'https://www.google.com/maps/@51.5037142,-0.0199901,3a,75y,325.08h,90t/data=!3m6!1e1!3m4!1sCIHM0ogKEICAgIDqrfvV2gE!2e10!3e11',
    streetViewLabel: 'Street View ↗'
  },
  {
    id: 'waterfront',
    label: 'North Quay',
    position: [-48, EYE_HEIGHT + CURB_HEIGHT, -104],
    lookAt: [-168, 72, -34],
    streetViewUrl:
      'https://www.google.com/maps/@51.5067573,-0.0224524,3a,75y,139.07h,95.6t/data=!3m6!1e1!3m4!1sCIHM0ogKEICAgIDEwtb9pQE!2e10!3e11',
    streetViewLabel: 'Street View ↗'
  },
  {
    id: 'south-bridge',
    label: 'Middle Dock',
    position: [-26, EYE_HEIGHT + CURB_HEIGHT, 132],
    lookAt: [42, 62, 12],
    streetViewUrl:
      'https://www.google.com/maps/@51.5021515,-0.020189,3a,75y,197.52h,93.21t/data=!3m6!1e1!3m4!1sCIHM0ogKEICAgICEnYPPgQE!2e10!3e11',
    streetViewLabel: 'Street View ↗'
  },
  {
    id: 'aerial',
    label: 'Skyline Aerial',
    position: [-84, 96, 208],
    lookAt: [24, 68, -14],
    fly: true,
    streetViewUrl:
      'https://www.google.com/maps/@51.5048,-0.0202,420a,35y,20h,45t/data=!3m1!1e3',
    streetViewLabel: '3D Satellite ↗'
  }
];

export function isOnRoadway(x: number, z: number): boolean {
  const hw = ROADS.roadHalf;
  // North Colonnade
  if (Math.abs(z - ROADS.northColonnadeZ) <= hw && x >= -215 && x <= 228) return true;
  // South Colonnade / Bank St
  if (Math.abs(z - ROADS.southColonnadeZ) <= hw && x >= -215 && x <= 228) return true;
  // Westferry Road
  if (Math.abs(x - ROADS.westferryX) <= hw && z >= -106 && z <= 132) return true;
  // Upper Bank Street
  if (Math.abs(x - ROADS.upperBankX) <= hw && z >= -106 && z <= 132) return true;
  return false;
}

export function getGroundElevation(x: number, z: number): number {
  // South Quay Footbridge arched deck
  if (x >= 8 && x <= 18 && z >= 134 && z <= 206) {
    const t = (z - 134) / (206 - 134);
    return CURB_HEIGHT + Math.sin(t * Math.PI) * 3.8;
  }
  // Adams Plaza / North Quay footbridge
  if (x >= 23 && x <= 33 && z >= -196 && z <= -110) {
    const t = (z + 196) / (-110 + 196);
    return CURB_HEIGHT + Math.sin(t * Math.PI) * 2.4;
  }
  // Jubilee Park raised terrace
  if (
    x >= JUBILEE_PARK.minX &&
    x <= JUBILEE_PARK.maxX &&
    z >= JUBILEE_PARK.minZ &&
    z <= JUBILEE_PARK.maxZ
  ) {
    return JUBILEE_PARK.elevation;
  }
  if (isOnRoadway(x, z)) {
    return 0.0;
  }
  return CURB_HEIGHT;
}

export function getZoneName(x: number, z: number, y: number): string {
  if (y > 28) return 'CANARY WHARF AERIAL';
  if (x >= CABOT_SQUARE.minX && x <= CABOT_SQUARE.maxX && z >= CABOT_SQUARE.minZ && z <= CABOT_SQUARE.maxZ) {
    return 'CABOT SQUARE';
  }
  if (x >= JUBILEE_PARK.minX && x <= JUBILEE_PARK.maxX && z >= JUBILEE_PARK.minZ && z <= JUBILEE_PARK.maxZ) {
    return 'JUBILEE PARK';
  }
  if (Math.abs(x - DLR_VIADUCT.centerX) < 14 && z >= -50 && z <= 50) {
    return 'CANARY WHARF DLR';
  }
  if (z < -95) return 'NORTH QUAY DOCKSIDE';
  if (z > 125) return 'MIDDLE DOCK · SOUTH QUAY';
  if (x < -126) return 'WESTFERRY · NEWFOUNDLAND QUAY';
  if (x > 144) return 'CHURCHILL PLACE · WOOD WHARF';
  if (Math.abs(z - ROADS.northColonnadeZ) < 12) return 'NORTH COLONNADE';
  if (Math.abs(z - ROADS.southColonnadeZ) < 12) return 'BANK STREET';
  return 'CANADA SQUARE';
}
