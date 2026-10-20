# FiberLAB

A warm, hold-to-splice introduction leads into a responsive photonic waveguide and an FTTH/PON studio with field diagnostics, live CAPEX, and an interactive OTDR trace analyzer. Design a GPON or XGS-PON network from an OLT through an ODF rack, fiber spans, dome closure, and 1:8 outdoor NAP/FAT to ONTs or Wi-Fi 6 home gateways. Probe ports and patch cords with the virtual OPM, inspect branch backscatter with the OTDR, inject separate training faults, and balance optical quality against a commercial planning quotation. Optical readings come from the simulator; component losses, speed estimates, trace events, and USD prices are educational references—not calibrated instrument results, guaranteed throughput, or vendor quotes.

Built with React 18 + Vite + TypeScript, `@xyflow/react` v12 for the graph canvas,
Tailwind CSS for styling and `lucide-react` for iconography. The warm visual system uses the Google Font families `Sora`, `Manrope`, and `JetBrains Mono` with local system fallbacks.

For a full explanation of the current features, data model, simulation, limitations,
and roadmap for field-style learning and licensed component photography, see
[`PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md).

**Live demo:** [https://kara-nawzad.github.io/FiberLAB/](https://kara-nawzad.github.io/FiberLAB/)

---

## Running it

FiberLAB requires **Node.js 22 or later**. Use `nvm use` when using nvm; the
repository's `.nvmrc` selects Node 22.

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build
npm run test       # 89 tests: optical engine, upstream dynamic range, OPM, OTDR, equipment, CAPEX, missions, and app interactions
npm run typecheck  # strict TypeScript, no emit
npm run lint       # ESLint checks for source and configuration files
npm run format:check  # verify Prettier formatting
```

---

## The physics

The simulator walks the directed graph outward from every energised OLT
transceiver and terminates at each reachable ONT or Wi-Fi gateway:

```
P_rx = P_tx − (L_fiber + L_splitters + L_ODF + L_NAP + L_splices + L_connectors + L_field_faults + L_closure + Safety_Margin)
```

| Term             | Model                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L_fiber`        | `length_km × α` — reference values: 0.35 dB/km @ 1270/1310 nm, 0.25 dB/km @ 1490 nm, 0.20 dB/km @ 1550 nm, and 0.22 dB/km @ 1577 nm; a manual per-span override takes precedence |
| `L_splitters`    | Catalogue insertion loss: 1:2 = 3.7, 1:4 = 7.2, 1:8 = 10.5, 1:16 = 13.8, 1:32 = 17.5, 1:64 = 20.8 dB (+ optional excess loss)                                                    |
| `L_ODF`          | 0.50 dB per modeled matched adapter through-pair; the two ODF pairs are isolated and do not cross-connect                                                                        |
| `L_NAP`          | Fixed 10.5 dB per connected branch for the NAP's internal 1:8 split (one modeled split stage)                                                                                    |
| `L_splices`      | `count × 0.1 dB` for fusion splices counted on cable spans                                                                                                                       |
| `L_connectors`   | `count × 0.5 dB` (SC/APC)                                                                                                                                                        |
| `L_field_faults` | Separate training allowances: +3.50 dB macro-bend and +2.00 dB dirty SC/APC ferrule                                                                                              |
| `L_closure`      | One adjustable 0.05–0.10 dB through-splice allowance per active closure output branch                                                                                            |
| `Safety_Margin`  | Global, default 2.0 dB                                                                                                                                                           |

### ONT classification (ITU-T G.984 GPON)

| Status         | Condition                  | Colour                          |
| -------------- | -------------------------- | ------------------------------- |
| `OVERLOAD`     | `P_rx > −8.0 dBm`          | Purple — saturation / burn risk |
| `ONLINE`       | `−24.0 ≤ P_rx ≤ −8.0 dBm`  | Green                           |
| `WARNING`      | `−28.0 ≤ P_rx < −24.0 dBm` | Amber — high BER risk           |
| `LOS`          | `P_rx < −28.0 dBm`         | Red                             |
| `DISCONNECTED` | no active OLT path         | Grey                            |

The existing GPON receive-power classification is retained and reused for XGS-PON endpoints; XGS-specific receiver-class budgets are not separately implemented. The standards selector shows the following nominal line rates and wavelength references:

| OLT standard       | Downstream           | Upstream             | Modeled fiber reference         |
| ------------------ | -------------------- | -------------------- | ------------------------------- |
| GPON (G.984)       | 1490 nm · 2.488 Gbps | 1310 nm · 1.244 Gbps | 0.25 dB/km @ 1490 nm by default |
| XGS-PON (G.9807.1) | 1577 nm · 9.953 Gbps | 1270 nm · 9.953 Gbps | 0.22 dB/km @ 1577 nm by default |

XGS-PON route simulation uses the downstream 1577 nm reference. The upstream wavelength and rate are displayed as capability references; upstream transmission, protocol overhead, OLT optical-class budgets, and service-plan limits are not simulated. A gateway's per-subscriber rate estimate divides the nominal shared line rate by the topology's cumulative split ratio—it is not a measured speed test.

Optical edges are coloured by the light they carry: **green** when live, **red**
when the carried power is below receiver sensitivity, **grey** when idle. Each
edge labels power at its far end; a warning glyph marks the downstream patch cord
of a span with an injected fault. The OPM re-simulates the current graph at its
selected 1310/1490/1550 nm calibration without changing the saved topology.

Where a subscriber is reachable from more than one OLT, every path is retained and
the best (highest `P_rx`) one is shown; cycles are traversed once, never looped.
Across active connected endpoints on each OLT port, the simulator also calculates
the upstream burst-mode power differential (`ΔP_upstream = P_rx,max − P_rx,min`) and
flags `upstreamDynamicRangeWarning` when `upstreamDeltaDb > 15.0 dB`, surfacing an
amber warning on the OLT node and TopBar and listing per-subscriber differentials in
the BOM optical audit table.

## The commercial budget

CAPEX is a parallel, graph-derived estimate; it is not folded into or allowed to alter the optical link-budget equation. Default USD planning rates are:

| Line item                                              |                                                Reference rate |
| ------------------------------------------------------ | ------------------------------------------------------------: |
| Feeder / OSP cable                                     |                                                     $350 / km |
| Distribution cable                                     |                                                     $250 / km |
| Drop cable                                             |                                                     $150 / km |
| Fusion-splice labor                                    |                                               $12.50 / splice |
| SC/APC connector termination                           |                                         $4.00 / connector end |
| PLC splitter                                           | 1:2 $14 · 1:4 $18 · 1:8 $26 · 1:16 $42 · 1:32 $68 · 1:64 $120 |
| Dome splice closure (FOSC-style reference)             |                                                    $85 / each |
| ODF rack panel / 2-pair patch field (reference)        |                                                   $110 / each |
| Outdoor NAP/FAT with internal 1:8 splitter (reference) |                                                    $65 / each |
| OLT PON port module (C+ reference)                     |                                                   $240 / each |
| Customer ONT terminal                                  |                                                    $55 / each |
| Wi-Fi 6 GPON/XGS-PON gateway (reference)               |                                                    $85 / each |

The estimator separates materials from labor, reports CAPEX per home passed and per connected subscriber (ONT or gateway), and derives quantities from placed nodes, including ODF panels, NAP/FATs, gateways, and active closure branches. Edit/reset the local rates in the Inspector's **Local unit pricing** panel. The BOM has an **Optical Budget Audit** tab and a **Commercial Quotation & CAPEX** tab; its version-2 JSON and combined quotation/optical CSV exports include the rates, deployed quantities, unit prices, extensions, totals, and subscriber budgets.

These are illustrative baseline rates for learning, not a current market survey, installed-price guarantee, tax estimate, or supplier quotation. Local labor, logistics, taxes, currency, procurement, and contingency are not modeled.

## OTDR trace analyzer

Open **OTDR Trace** in the TopBar to pulse a selected OLT output or fiber-span source toward a reachable ONT or gateway. Choose the target branch, 1270/1310/1490/1550/1577 nm wavelength, and a 10/100/1000 ns pulse width, then acquire the trace. The SVG analyzer plots 100–300 Rayleigh backscatter samples over 0–35 km and +5 to −45 dB, with a live distance/power crosshair and event markers for launch, fiber, connectors, splices, ODF/NAP/splitter losses, faults, and the terminal Fresnel reflection. Its automated event table reports distance, signed loss step, cumulative one-way loss, apparent reflection peak, and event assessment.

`src/engine/otdrSimulator.ts` is a deterministic, React-free route analyzer. It uses the selected wavelength's reference attenuation and topology component losses to synthesize a teaching trace; as the graph stores only per-span totals, splice/connector/fault locations are evenly distributed along the span. The terminal ONT or gateway is represented as an end-of-fiber Fresnel return and −45 dB noise-floor drop. This diagnostic visualization does not change the optical simulator's equations or report calibrated OTDR measurements.

---

## Layout

- **Landing overview** — warm fiber-splice hero with a hold-to-open interaction and receive-power readout sourced from the active studio simulation; preserved interactive 1310/1490/1550 nm waveguide, adjustable launch power, capability cards, and GPON reference strips. The ray-angle display is an educational Sellmeier-based schematic, not a measured fiber-profile claim. The graph simulator supports 1270/1310/1490/1550/1577 nm; its OPM calibration control remains 1310/1490/1550 nm.
- **Top bar** — FiberLAB wordmark + live optical health and CAPEX (including cost per home passed), overview, preset picker, zoom controls, `Run Simulation`, and Reports.
- **Canvas toolbar** — `Link nodes`, `OPM Tool`, `OTDR Trace`, `Delete`, missions, safety margin, Auto, and Clear controls beside the workbench.
- **Bottom panel** — compact live topology and simulation readouts below the canvas.
- **Left toolbox** — draggable or double-click quick-add OLT / ODF / splitter (1:2 … 1:64) / cable (feeder, distribution, drop) / FOSC-style dome closure / 1:8 NAP/FAT / ONT / Wi-Fi 6 gateway.
- **Canvas** — dotted grid, pan/zoom, minimap, compact hardware thumbnails, softly glowing animated optical edges, handle-drag connections, Link nodes mode, and an OPM probe cursor/HUD for port and patch-cord power. Faulted fiber spans mark their outgoing patch cord with a warning glyph.
- **Right inspector** — Field Hardware Cards for all eight component kinds; a GPON/XGS-PON OLT selector; five fiber/OTDR wavelengths; gateway optical/service telemetry, Wi-Fi SSID and a clearly marked TEST-NET IP placeholder; fiber fault toggles; a 12-color closure splice tray; and editable local USD reference rates. Price edits recalculate CAPEX without changing optical results. The SVGs are representative illustrations, not product photos or exact vendor models.
- **BOM modal** — an Optical Budget Audit (including per-subscriber `Upstream Δ` differentials) and Commercial Quotation & CAPEX view, with material/labor/project/subscriber metrics, detailed quote lines, gateway SSID/IP/PON-rate fields, and JSON / combined CSV export.
- **Mission drawer** — five scenarios: “The Marginal Villa,” “Diagnose the Silent ONT,” “Rescue the Unpatched Subscriber,” “The Budget Crunch: Cost vs. Performance,” and “Blind Fault: The Cut in the Trunk,” each with live objectives, hints, and completion recap. Budget Crunch requires three ONLINE homes, CAPEX below $1,600, and at least 2 dB global safety margin; Blind Fault hides visual fault badges on the canvas so learners diagnose a distribution break with the OPM and OTDR.

The hardware catalogue and SVGs are static, representative illustrations—not genuine
product photographs or exact-vendor datasheets. The closure profile's up-to-48-splice
capacity and IP68 rating are reference claims that must be checked against a chosen
SKU and sealing kit. The canvas uses light surfaces, with yellow cable, green SC/APC,
and blue SC/UPC visual cues. Connector polish is not a modeled graph property; verify
real interfaces and never mate APC to UPC. The bend/dust penalties are instructional
fixed allowances, not universal measured values.

### Presets

- **Standard 1:32 GPON Tree** — `OLT → 5 km feeder → 1:4 → 1 km distribution → 1:8
→ 300 m drop → ONT`, with two further drops hanging off the 1:8 so the tree shows
  optimal, healthy and marginal subscribers at once. The 300 m subscriber lands at
  **−21.57 dBm (ONLINE)**.
- **Failing Long-Distance Link** — a 1:512 cascade stretched over ~30 km from a
  Class C+ port. Both wired ONTs fall into **LOS (≈ −39.5 dBm)** and a third is left
  unpatched to show **DISCONNECTED**.
- **MODERN 10G XGS-PON SUBURB** — XGS-PON OLT → paired ODF → 3.5 km feeder →
  dome closure → 1.2 km distribution → fixed 1:8 NAP/FAT → three 150 m drops and
  Wi-Fi 6 gateways. Each path includes the modeled 0.5 dB ODF, 10.5 dB NAP split,
  fiber/splice/connector losses, and safety margin; the XGS-PON shared-line-rate
  estimate is divided by 1:8 (not a measured speed test).

---

## Source map

```
.
├── .github/workflows/
│   ├── ci.yml                     Main / pull-request verification workflow
│   └── deploy.yml                 GitHub Pages deployment workflow
├── docs/
│   ├── PROJECT_GUIDE.md           Architecture, operation, and learning-model guide
│   └── design/                    Archived self-contained mock and workbench references
├── src/
│   ├── assets/                    Bundled cursor and splice-hero SVG assets
│   ├── components/
│   │   ├── hardware/HardwareArt.tsx
│   │   ├── landing/               LandingNav, LandingView, hero, waveguide, and splice UI
│   │   └── nodes/                 React Flow node renderers and NodePrimitives
│   ├── context/SimulationContext.ts
│   ├── data/                      Catalogues, hardwareArtwork, pricing, and data tests
│   ├── engine/                    Pure simulation, opticalPhysics, presets, missions, and engine tests
│   ├── styles/                    global.css, theme.css, and photo-ui.css
│   ├── test/setup.ts              Vitest / Testing Library setup
│   ├── __tests__/app.test.tsx     Mounted application tests
│   ├── App.tsx                    Persistent studio shell and orchestration
│   ├── main.tsx                   Browser entry and stylesheet import order
│   ├── types.ts                   Graph, simulation, and UI types
│   └── vite-env.d.ts              Vite ambient type declarations
├── .editorconfig                 Shared whitespace and encoding rules
├── .gitignore                     Repository ignore rules
├── .nvmrc                         Node 22 selector
├── .prettierrc.json               Prettier formatting settings
├── LICENSE                        MIT license
├── THIRD_PARTY_NOTICES.md         Runtime font notices
├── eslint.config.js               Flat ESLint configuration
├── index.html                     Vite document shell and Google Font imports
├── package.json / package-lock.json
├── postcss.config.js / tailwind.config.js
├── tsconfig.json / vite.config.ts / vitest.workspace.ts
└── README.md                      Project overview and quick start
```

`opticalSimulator.ts` and `otdrSimulator.ts` deliberately have no runtime dependency on React or React Flow, so their independent calculations run under a plain Node test environment.
