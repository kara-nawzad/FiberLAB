# FiberLAB

An editorial FiberLAB overview leads into a responsive, interactive photonic waveguide and a mounted-in-place FTTH/PON engineering studio. Design a Passive Optical Network on the graph canvas, connect components, and inspect live optical link-budget estimates as the graph changes. The calculations use simplified GPON learning assumptions; this is not a certified design tool.

Built with React 18 + Vite + TypeScript, `@xyflow/react` v12 for the graph canvas,
Tailwind CSS for styling and `lucide-react` for iconography.

For a full explanation of the current features, data model, simulation, limitations,
and roadmap for field-style learning and licensed component photography, see
[`PROJECT_GUIDE.md`](./PROJECT_GUIDE.md).

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build
npm run test       # 42 tests: engine, landing physics, hardware catalogue, missions + app smoke
npm run typecheck  # strict TypeScript, no emit
```

---

## The physics

The simulator walks the directed graph outward from every energised OLT
transceiver and terminates at each ONT it can reach:

```
P_rx = P_tx − (L_fiber + L_splitters + L_splices + L_connectors + Safety_Margin)
```

| Term | Model |
| --- | --- |
| `L_fiber` | `length_km × α` — 0.35 dB/km @ 1310 nm, 0.25 dB/km @ 1490 nm (per-span override supported) |
| `L_splitters` | Catalogue insertion loss: 1:2 = 3.7, 1:4 = 7.2, 1:8 = 10.5, 1:16 = 13.8, 1:32 = 17.5, 1:64 = 20.8 dB (+ optional excess loss) |
| `L_splices` | `count × 0.1 dB` (fusion) |
| `L_connectors` | `count × 0.5 dB` (SC/APC) |
| `Safety_Margin` | Global, default 2.0 dB |

### ONT classification (ITU-T G.984 GPON)

| Status | Condition | Colour |
| --- | --- | --- |
| `OVERLOAD` | `P_rx > −8.0 dBm` | Purple — saturation / burn risk |
| `ONLINE` | `−24.0 ≤ P_rx ≤ −8.0 dBm` | Green |
| `WARNING` | `−28.0 ≤ P_rx < −24.0 dBm` | Amber — high BER risk |
| `LOS` | `P_rx < −28.0 dBm` | Red |
| `DISCONNECTED` | no active OLT path | Grey |

Optical edges are coloured by the light they carry: **green** when live, **red**
when the carried power is below receiver sensitivity, **grey** when idle. Each
edge also labels the power arriving at its far end.

Where a subscriber is reachable from more than one OLT, every path is retained and
the best (highest `P_rx`) one is shown; cycles are traversed once, never looped.

---

## Layout

- **Landing overview** — editorial capabilities and GPON reference strips, a live 1310/1490/1550 nm photonic waveguide, adjustable launch power, and quick-load actions. The ray-angle display is an educational Sellmeier-based schematic, not a measured fiber-profile claim; the studio graph itself supports 1310/1490 nm.
- **Top bar** — FiberLAB wordmark + live network health, `Overview & Physics`, preset topologies, field
  missions, safety margin, auto-run toggle, `Run test`, `Bill of Materials`, `Clear Canvas`.
- **Left toolbox** — draggable OLT / splitter (1:2 … 1:64) / cable (feeder,
  distribution, drop) / ONT. Drag onto the canvas, or double-click to place.
- **Canvas** — dotted grid, pan/zoom, minimap, custom nodes with compact hardware
  thumbnails, and animated optical edges.
- **Right inspector** — Field Hardware Card for selected nodes (representative SVG
  equipment diagrams, ports/construction, and field tips), plus controls for physical
  parameters: Tx power, laser state, wavelength, span length, attenuation coefficient,
  splice/connector counts, split ratio, subscriber identity. The SVGs are generic
  illustrations, not product photos or exact vendor models.
- **BOM modal** — deployed fibre, splices, connectors, splitters by ratio, online vs
  offline counts, a per-subscriber optical budget table, and JSON / CSV export.
- **Mission drawer** — three scenarios: “The Marginal Villa,” “Diagnose the Silent ONT,” and “Rescue the Unpatched Subscriber,” each with live objectives, hints, and completion recap.

The hardware catalogue and SVGs are static, representative illustrations—not genuine
product photographs or exact-vendor datasheets. The canvas uses light surfaces, with
yellow cable, green SC/APC, and blue SC/UPC visual cues. Connector polish is not a
modeled graph property; verify real interfaces and never mate APC to UPC.

### Presets

- **Standard 1:32 GPON Tree** — `OLT → 5 km feeder → 1:4 → 1 km distribution → 1:8
  → 300 m drop → ONT`, with two further drops hanging off the 1:8 so the tree shows
  optimal, healthy and marginal subscribers at once. The 300 m subscriber lands at
  **−21.57 dBm (ONLINE)**.
- **Failing Long-Distance Link** — a 1:512 cascade stretched over ~30 km from a
  Class C+ port. Both wired ONTs fall into **LOS (≈ −39.5 dBm)** and a third is left
  unpatched to show **DISCONNECTED**.

---

## Source map

```
src/
├── data/
│   ├── componentCatalogue.ts      Hardware profiles, field tips, and SVG illustration data
│   └── __tests__/componentCatalogue.test.ts
├── types.ts                       Simulation model, loss catalogues, thresholds, telemetry types
├── engine/
│   ├── opticalSimulator.ts        Graph traversal + loss maths + status classification
│   ├── edgeDecoration.ts          Simulator telemetry → React Flow edge props
│   ├── factories.ts               Node factories and default physical parameters
│   ├── presets.ts                 The two reference topologies
│   ├── missions.ts                Three guided scenarios, objective validators, progress
│   ├── SimulationContext.ts       Telemetry broadcast to custom nodes
│   ├── __tests__/opticalSimulator.test.ts
│   └── __tests__/missions.test.ts
├── components/
│   ├── TopBar.tsx  Sidebar.tsx  Inspector.tsx  FieldHardwareCard.tsx
│   ├── MissionDrawer.tsx  BOMModal.tsx  OpticalEdge.tsx
│   ├── nodes/  OLTNode · SplitterNode · FiberNode · ONTNode · nodeShared
│   └── landing/                   Editorial landing, responsive SVG exhibit, reference model
├── App.tsx                        Persistent landing/studio shell, graph, commands, simulation
└── __tests__/app.test.tsx         jsdom tests for landing navigation and the application
```

`opticalSimulator.ts` deliberately has no runtime dependency on React or React Flow,
so it runs under a plain Node test environment.
