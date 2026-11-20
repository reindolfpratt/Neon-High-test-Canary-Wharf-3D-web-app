# Canary Wharf, London — Photorealistic 3D WebGL2

A 100% local, zero-network-call, human-scale (`1 unit = 1 meter`, `1.7 m` eye height) 3D recreation of **Canary Wharf, London (E14)** built with **Three.js + WebGL2 + TypeScript + Vite**.

## Highlights

- **Iconic Canary Wharf Architecture**:
  - **One Canada Square (235 m)** with fluted brushed stainless-steel spandrels, notched corner geometry, granite lobby colonnade, louvered pyramid crown, and pulsing red aviation beacon.
  - **8 Canada Square (HSBC)** & **25 Canada Square (Citi)** with illuminated rooftop corporate emblems and vertical/horizontal structural fins.
  - **Newfoundland (220 m)** diamond-plan tower wrapped in a full 3D external steel diagrid exoskeleton.
  - **Landmark Pinnacle (233 m)** slender glass residential prism with continuous cantilevered silver balcony fins.
  - **40 Bank Street**, **One Park Place**, **1 Churchill Place**, **25 & 10 Cabot Square**, plus North Quay, South Quay Plaza, and Wood Wharf skyline clusters.
- **Docks, Waterfront & Public Spaces**:
  - Real-time planar reflective **Water** across North Dock, Middle Dock, and the River Thames western edge.
  - **South Quay Cable-Stayed Footbridge**, **Adams Plaza Glazed Footbridge**, historic West India Dock cranes, and Canary Wharf Thames Pier.
  - **Cabot Square** with animated tiered granite fountain, concentric stone inlays, and contemporary bronze sculpture.
  - **Jubilee Park** terraced lawns, water rill, London plane trees, and Norman Foster's curved glazed **Canary Wharf Underground** station canopy.
  - Elevated **Docklands Light Railway (DLR) Viaduct** & barrel-vaulted **Canary Wharf DLR Station** with animated 3-car DLR trains.
- **London Traffic & Crowds**:
  - UK left-hand driving circuits with **London Black Cabs**, **Red Double-Decker Buses**, **Metallic Executive Saloons**, and a **Metropolitan Police** response vehicle with Battenburg livery and flashing blue LED lightbar.
  - 220 instanced articulated business pedestrians walking promenades, squares, parks, and zebra crossings.
- **GT6-Inspired HDR Rendering Pipeline**:
  - Procedural high-resolution 4-map PBR facades (albedo, normal, roughness, and interior-lit emissive maps).
  - Real-time **Skyline CubeCamera + PMREM** environment lighting so glass facades and clearcoat vehicles reflect actual surrounding towers and sky.
  - Preetham physically-based sky + volumetric depth-occluded **God Rays**, **Screen-Space Reflections (SSR)** on damp tarmac/granite, **Camera-Velocity Motion Blur**, **GTAO**, **HDR Unreal Bloom**, optional **Depth of Field**, **SMAA**, and **ACES Filmic Tone Mapping**.
  - **Day / Golden Hour / Night** cycle (`N`) and **Low / High / Ultra** quality presets (`Q`).

## Run Locally

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

To build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / `Arrow Keys` | Move forward / back / strafe |
| `Mouse` (Click canvas) | First-person look via Pointer Lock (`Esc` to release) |
| `Shift` | Sprint / Fast fly |
| `Space` | Jump (Walk) / Ascend (Fly) |
| `N` | Cycle **Golden Hour → Night → Day** |
| `F` | Cycle **Walk → Free-Fly → Skyline Orbit** |
| `Q` | Cycle **Low → High → Ultra** quality presets |
| `B` | Toggle cinematic Depth of Field |
| `M` | Toggle procedural Docklands ambient audio |
| `H` | Toggle controls overlay |
