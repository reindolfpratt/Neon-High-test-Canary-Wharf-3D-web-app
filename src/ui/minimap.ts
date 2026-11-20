import { CABOT_SQUARE, DLR_VIADUCT, JUBILEE_PARK, ROADS, WATER_BASINS } from '../scene/layout';

export class MinimapOverlay {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.size = canvas.width;
  }

  private worldToMap(wx: number, wz: number): [number, number] {
    // Map world [-250..250] x [-210..220] onto canvas
    const u = (wx + 250) / 500;
    const v = (wz + 210) / 430;
    return [u * this.size, v * this.size];
  }

  render(
    playerX: number,
    playerZ: number,
    yaw: number,
    vehicles: Array<{ x: number; z: number; kind: string }>
  ): void {
    const ctx = this.ctx;
    const s = this.size;

    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#0c1522';
    ctx.fillRect(0, 0, s, s);

    // Water basins (Thames + North Dock + Middle Dock)
    ctx.fillStyle = '#123249';
    const drawRect = (minX: number, minZ: number, maxX: number, maxZ: number) => {
      const [x0, y0] = this.worldToMap(minX, minZ);
      const [x1, y1] = this.worldToMap(maxX, maxZ);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    drawRect(-250, -210, -232, 220);
    drawRect(WATER_BASINS.northDock.minX, WATER_BASINS.northDock.minZ, WATER_BASINS.northDock.maxX, WATER_BASINS.northDock.maxZ);
    drawRect(WATER_BASINS.middleDock.minX, WATER_BASINS.middleDock.minZ, WATER_BASINS.middleDock.maxX, WATER_BASINS.middleDock.maxZ);

    // Main peninsula landmass
    ctx.fillStyle = '#1c2430';
    drawRect(-232, WATER_BASINS.northDock.maxZ, 250, WATER_BASINS.middleDock.minZ);

    // Jubilee Park green
    ctx.fillStyle = '#254a34';
    drawRect(JUBILEE_PARK.minX, JUBILEE_PARK.minZ, JUBILEE_PARK.maxX, JUBILEE_PARK.maxZ);

    // Cabot Square Plaza & Fountain
    ctx.fillStyle = '#2e3846';
    drawRect(CABOT_SQUARE.minX, CABOT_SQUARE.minZ, CABOT_SQUARE.maxX, CABOT_SQUARE.maxZ);
    const [fx, fy] = this.worldToMap(CABOT_SQUARE.centerX, CABOT_SQUARE.centerZ);
    ctx.fillStyle = '#29799e';
    ctx.beginPath();
    ctx.arc(fx, fy, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Roads
    ctx.fillStyle = '#333b48';
    drawRect(-215, ROADS.northColonnadeZ - 7.5, 228, ROADS.northColonnadeZ + 7.5);
    drawRect(-215, ROADS.southColonnadeZ - 7.5, 228, ROADS.southColonnadeZ + 7.5);
    drawRect(ROADS.westferryX - 7.5, -106, ROADS.westferryX + 7.5, 132);
    drawRect(ROADS.upperBankX - 7.5, -106, ROADS.upperBankX + 7.5, 132);

    // DLR Viaduct line
    ctx.strokeStyle = '#00b8b0';
    ctx.lineWidth = 2;
    const [dx0, dy0] = this.worldToMap(DLR_VIADUCT.centerX, -205);
    const [dx1, dy1] = this.worldToMap(DLR_VIADUCT.centerX, 215);
    ctx.beginPath();
    ctx.moveTo(dx0, dy0);
    ctx.lineTo(dx1, dy1);
    ctx.stroke();

    // Landmark Tower Footprints
    const towers: Array<[number, number, number, number, string]> = [
      [28, -20, 48, 48, '#e8edf2'], // One Canada Square (highlighted!)
      [96, -34, 46, 42, '#7da4c4'], // HSBC
      [104, 34, 44, 40, '#8ba8be'], // Citi
      [46, 114, 46, 32, '#627386'], // 40 Bank St
      [-168, -34, 34, 24, '#9cb4c9'], // Newfoundland
      [-168, 106, 34, 28, '#9cb4c9'], // Landmark Pinnacle
      [178, -36, 46, 40, '#6c7c8e'], // One Park Place
      [178, 36, 48, 42, '#6c7c8e'], // 1 Churchill Place
      [-67, -54, 46, 32, '#78756e'], // 25 Cabot Sq
      [-67, 54, 46, 32, '#78756e'] // 10 Cabot Sq
    ];
    for (const [tx, tz, tw, td, col] of towers) {
      ctx.fillStyle = col;
      drawRect(tx - tw * 0.5, tz - td * 0.5, tx + tw * 0.5, tz + td * 0.5);
    }

    // Live Traffic Vehicles
    for (const v of vehicles) {
      const [vx, vy] = this.worldToMap(v.x, v.z);
      ctx.fillStyle =
        v.kind === 'double-decker'
          ? '#e5252b'
          : v.kind === 'police'
            ? '#2998ff'
            : v.kind === 'black-cab'
              ? '#ffbe3d'
              : '#cbd5e1';
      ctx.beginPath();
      ctx.arc(vx, vy, v.kind === 'double-decker' ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Heading Cone & Marker
    const [px, py] = this.worldToMap(playerX, playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-yaw);
    ctx.fillStyle = 'rgba(255, 198, 92, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 18, -Math.PI * 0.68, -Math.PI * 0.32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090d14';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}
