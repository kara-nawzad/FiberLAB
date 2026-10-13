Checks: all 28 tests passed and the production build succeeded. The guide also notes that npm ci reported 13 dependency audit findings. No app features were changed—this update is documentation only.
3m 48s | 12 hours ago
10:40 PM

text

### TASK: FiberLAB / FTTH-Studio — Phase 1: Real Component Imagery & Hardware Catalogue

You are working on the existing FiberLAB (FTTH-Studio) codebase documented in `PROJECT_GUIDE.md`. 
All 28 existing tests are currently passing and must REMAIN passing. Do not change the existing graph model where Fiber spans are nodes. Do not change the core calculation equations in `opticalSimulator.ts`.

#### OBJECTIVE
Implement the Component Catalogue and authentic visual hardware representation described in Section 10 & 11 of `PROJECT_GUIDE.md`:
1. Keep the canvas clean, smooth, and diagrammatic.
2. Add a static, decoupled component catalogue with SVG/CSS-crafted hardware illustrations and real-world field tips.
3. Display compact hardware thumbnails on the canvas nodes.
4. Display an authentic, detailed "Field Hardware Card" in the Inspector when a node is selected (photo, realistic port diagram, field tips, and practical explanation).

---

### STEP 1: CREATE `src/data/componentCatalogue.ts`
Create a dedicated catalogue module with zero React/DOM dependencies:

```typescript
export interface HardwareProfile {
  id: string;
  kind: 'olt' | 'splitter' | 'fiber' | 'ont';
  modelName: string;
  vendorCategory: string; // e.g., "Central Office Optical Line Terminal", "Outdoor Planar Lightwave Circuit"
  thumbnailSvg: string;   // Clean inline SVG data URI or crisp SVG markup
  heroSvg: string;        // Detailed vector illustration of the real equipment
  physicalPorts: string[];// e.g. ["16x SFP+ GPON Ports (SC/UPC)", "4x 10GE Uplink"]
  fieldNotes: string[];   // Practical advice for field technicians
  datasheetSnippet: {
    operatingTemp: string;
    wavelengths: string;
    standards: string[];
  };
}

export const HARDWARE_CATALOGUE: Record<string, HardwareProfile> = {
  // Profiles for:
  // 1. 'olt-standard': 1U GPON Pizza-Box OLT (with SFP cages, fan trays, management console)
  // 2. 'splitter-plc': Box-type PLC Splitter (ABS plastic cassette with loose-tube pigtails)
  // 3. 'fiber-feeder': Micro-duct Loose-Tube 48-Core Feeder Cable with cross-section
  // 4. 'fiber-distribution': 12-Core Aerial Self-Supporting Figure-8 Cable
  // 5. 'fiber-drop': 2-Core Flat Drop Cable with FRP strength members
  // 6. 'ont-indoor': Desktop GPON ONU/ONT (with green SC/APC optical receptacle, GE LAN, status LEDs)
};

export function getHardwareProfileForNode(kind: string, subType?: string): HardwareProfile;

Edited files+764−73
Edit
src/__tests__/app.test.tsx
+1−1
Edited files+118−101
Start FiberLAB preview:5173
Edit
src/components/FieldHardwareCard.tsx
+4−3
Edit
src/engine/factories.ts
+9−7
Edited files+6−6
Ran commands3

Phase 1 is implemented. The live FiberLAB preview is running.

    Added six framework-independent hardware profiles in src/data/componentCatalogue.ts, with inline SVG illustrations, port/construction details, field tips, explanations, and datasheet context.
    Added compact thumbnails to all four canvas node types and a Field Hardware Card in the Inspector with a larger illustration, configuration, practical notes, and expandable standards information.
    Kept the fiber-as-node graph model and opticalSimulator.ts equations unchanged.
    Updated PROJECT_GUIDE.md and the README.

The visuals are representative SVG illustrations, not genuine product photographs or exact vendor models; the card labels them accordingly.

Validation: all 28 existing tests still pass; five catalogue tests were added, for 33 passing tests total. The production build also passes.
10m 4s | 12 hours ago
11:00 PM

text

### TASK: FiberLAB — Design System Overhaul & Learning Missions Engine

You are implementing a comprehensive design and UX upgrade for the FiberLAB repository, guided by the attached Universal UI/UX Design System Specification and the official FiberLAB brand identity.

All 33 existing tests must remain passing. Do not alter the core physics equations in `src/engine/opticalSimulator.ts` or the node-based graph structure.

---

### 1. DESIGN CONCEPT & ART DIRECTION

1. **Concept:** A clean, high-precision optical engineering workbench. Not a generic dark AI template, but an authentic telecom laboratory combining diagrammatic canvas clarity with tangible field equipment photography.
2. **Theme & Palette:**
   - **Primary Canvas & Surfaces:** Precision off-white/light-grey workbench (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`).
   - **Borders & Dividers:** Subtle technical hairline borders (`#E2E8F0`, `#CBD5E1`).
   - **Typography & Ink:** Deep slate ink (`#0F172A`) for high contrast readability, muted slate (`#64748B`) for technical metadata, and monospace font for dB, dBm, and wavelengths.
   - **Brand Accent:** FiberLAB Cobalt Blue (`#2563EB`) matching the official brand logo.
   - **Telecom Semantics:** Authentic physical fiber colors — Single-Mode Cable Yellow (`#FACC15`), SC/APC Ferrule Green (`#16A34A`), SC/UPC Polish Blue (`#2563EB`).
3. **Typography:** Crisp sans-serif (`Inter` or system UI font) paired with `JetBrains Mono` / monospace for all measurements and optical equations.
4. **Imagery:** Authentic photographic representation of real telecom plant equipment in the Inspector and toolbox, completely replacing generic placeholder icons.

---

### 2. COMPONENT CATALOGUE ENHANCEMENT (`src/data/componentCatalogue.ts`)

Update the catalogue to provide authentic real-world telecom hardware data and verified imagery:
- **OLT Transceiver:** 1U Pizza-Box GPON OLT with dual AC power supplies, Class B+/C+ SFP modules, and management console. Include high-quality hardware photography of front-panel SFP ports.
- **PLC Splitter:** Industrial ABS box-type 1:N splitter cassette with fan-out single-mode 900µm pigtails and SC/APC green connectors.
- **Fiber Cable Plant:** Multi-layer cutaway photography showing outer PE jacket, water-blocking tape, PBT loose tubes, and optical glass core.
- **ONT Terminal:** Real desktop subscriber unit showing rear ports (SC/APC optical input, Gigabit LAN, RJ11 POTS, DC barrel jack).

Ensure fallback image URLs point to reliable, production-ready static assets or optimized SVG/WebP photo-accurate composites.

---

### 3. LIGHT THEME REFACTOR (`src/index.css`, Canvas & Custom Nodes)

Refactor the UI from dark mode to the clean laboratory light theme:
1. **Canvas (`App.tsx` & `@xyflow/react`):**
   - Background: `#F8FAFC` with subtle dotted grid (`#CBD5E1`).
   - Controls & MiniMap: Clean white card with slate borders and subtle shadows (`shadow-sm`).
2. **Nodes (`OLTNode`, `SplitterNode`, `FiberNode`, `ONTNode`):**
   - Clean white rounded cards (`bg-white border border-slate-200 shadow-sm hover:shadow-md`).
   - High-contrast typography: Title in `#0F172A`, technical metrics in clear slate tags.
   - Distinctive physical port indicators: Green accents for SC/APC interfaces.
   - Compact 40x40px real hardware thumbnail embedded beside node headers.
3. **Optical Edges (`OpticalEdge.tsx`):**
   - Live/Energized: Crisp emerald beam with subtle flow animation (`#16A34A`).
   - LOS/Degraded: Clear crimson beam (`#DC2626`).
   - Idle: Clean slate dashed line (`#94A3B8`).
   - Edge telemetry badges: Off-white pills with dark ink and colored status dots.
4. **TopBar & Sidebar:**
   - Display the official **FiberLAB** logo: Black "Fiber" + Cobalt Blue "LAB".
   - Clean white navbar with subtle bottom border (`border-slate-200`).
   - Clean, organized component toolbox with recognizable hardware previews.

---

### 4. LEARNING MISSIONS SYSTEM (`src/engine/missions.ts` & `src/components/MissionDrawer.tsx`)

Build an interactive guided mission drawer that teaches real field troubleshooting:
1. **Create `src/engine/missions.ts`:**
   - Define a `Mission` interface with `id`, `title`, `difficulty`, `scenarioBrief`, `objectives`, and a live validator function:
     ```typescript
     export interface MissionObjective {
       id: string;
       description: string;
       isMet: (simulation: NetworkSimulationResult, nodes: any[], edges: any[]) => boolean;
     }
     ```
   - **Mission 1: "The Marginal Villa (Link Margin Audit)"**
     - *Scenario:* A 1:32 GPON tree has three villas. Villa 3 is sitting in WARNING status (-24.3 dBm) due to an excessively long drop span and high connector count.
     - *Objectives:* 
       1. All 3 connected ONTs must be in ONLINE status (-8.0 dBm to -24.0 dBm).
       2. Maintain global safety margin at 2.0 dB.
       3. Do not increase OLT launch power above Class B+ limit (+5.0 dBm).
   - **Mission 2: "Diagnose the Silent ONT (Break & Laser Audit)"**
     - *Scenario:* A subscriber reports complete LOS. Investigate the OLT laser state, broken feeder connections, or excessive split insertion losses.
2. **Create `src/components/MissionDrawer.tsx`:**
   - Clean slide-over panel accessible via a "Missions" button in the TopBar.
   - Displays real-time progress indicators: Checkboxes automatically turn green with smooth checkmark animations as the learner solves the problem on the canvas.
   - Provide an expandable "Field Hint" accordion when the learner gets stuck.
   - Celebratory completion banner with link budget recap when all objectives are met.

---

### 5. VERIFICATION & QUALITY CHECKS

1. Run `npm run typecheck` to confirm zero TypeScript compilation errors.
2. Run `npm test` to verify that all existing tests plus any new mission tests pass.
3. Test canvas responsiveness at 1440px desktop and verify that light-theme text contrast meets WCAG AA standards.
4. Confirm no layout shifts or drag latency when wiring nodes.

Ran commands6
Edited files+842−26
Edited files+593−159
Ran commands2
Edited files+18−2
Ran commands3
Start FiberLAB workbench· exited (code 1)
Edited files+9−9
Explored5 reads
ReadFieldHardwareCard.tsx
ReadMissionDrawer.tsx
ReadcomponentCatalogue.ts
ReadedgeDecoration.ts
ReadOpticalEdge.tsx
Ran commands2
Edited files+12−12
Ran commands2
Edited files+116−61
Edited files+97−82
Edit
src/engine/edgeDecoration.ts
+2−2
Edit
src/App.tsx
+4−3
Ran commands3
Edit
src/__tests__/app.test.tsx
+5−3
Ran commands2
Edited files+6−6
Edited files+7−7
Explored1 read
Readindex.css
Edited files+6−6
Ran commands4
Edit
src/__tests__/app.test.tsx
+9−2
Ran commands2
Edited files+14−4
Edited files+4−4
Edited files+2−2
Edited files+25−8
Ran commands7
Edit
src/components/Sidebar.tsx
+8−8×2
Ran commands4

Implemented the Sidebar thumbnail change: ToolItem now destructures thumbnail and renders the hardware illustration in a 40×40 wrapper, with the icon retained as a fallback.

Also completed the light workbench styling, telecom color cues, live edge colors, and the two guided missions with live objectives, hints, completion recaps, and keyboard focus handling. Updated the README and project guide. The hardware artwork remains clearly labeled as representative SVG illustration—not photography.

The physics equations and node-based graph model are unchanged. All 37 tests pass, including the original 33; typecheck, production build, and git diff --check pass. Representative text colors were checked against WCAG AA contrast on the light surfaces.
19m 25s | 11 hours ago
11:30 PM

Please run the server again so I can see the preview.
Start FiberLAB preview· exited (code 127)
$ npm run dev -- --port 5174


> ftth-studio@1.0.0 dev
> vite --host 0.0.0.0 --port 5173 --port 5174

sh: 1: vite: not found

Process exited during startup (exit code 127).
Ran commands2
Start FiberLAB preview:5174
$ npm run dev -- --port 5174


> ftth-studio@1.0.0 dev
> vite --host 0.0.0.0 --port 5173 --port 5174


  VITE v6.4.4  ready in 225 ms

  ➜  Local:   http://localhost:5174/
  ➜  Network: http://169.254.0.21:5174/

FiberLAB is running in the live preview. Port 5173 was already occupied, so I started it on 5174 instead.

npm ci was needed to restore the dependencies and reported 13 existing audit advisories (5 moderate, 6 high, 2 critical); I didn’t apply automatic fixes.
51s | 1 hour ago
9:38 AM

text

# TASK SPECIFICATION: FiberLAB — Editorial Landing Showcase, Living Photonic Waveguide & Morphing Studio Cockpit

## 0. ROLE AND STANDARD
You are a senior product designer, creative director, UX architect, and principal front-end engineer.
Your task is to design, implement, and integrate an editorial-grade, animated entry experience and interactive hero for **FiberLAB**, fully connecting it into the existing React 18 + Vite + TypeScript + `@xyflow/react` codebase.

This is an independent, high-precision engineering instrument—NOT a university project, NOT a generic startup SaaS page, and NOT an AI-template clone. 

Every single visual, animation, line of copy, and mathematical parameter must be strictly derived from optical telecommunications physics (ITU-T G.984 GPON standards, total internal reflection, Rayleigh backscatter, and insertion loss models).

All 37 existing tests must remain passing. Do NOT modify the core equations in `src/engine/opticalSimulator.ts`, the node data interfaces, or the existing canvas mechanics.

---

## 1. DESIGN CONCEPT & EDITORIAL ART DIRECTION

### 1.1 The One-Sentence Concept
A high-contrast, editorial optical physics salon that bridges tangible glass craftsmanship with a live, deterministic GPON simulation cockpit.

### 1.2 The Signature Visual: "The Living Photonic Waveguide"
A custom, fully interactive vector schematic illustrating a single-mode optical fiber core ($9\,\mu\text{m}$) and cladding ($125\,\mu\text{m}$). 
It is NOT a static drawing or a generic 3D model. It is an interactive, mathematical SVG instrument where the user drags an optical launch power slider ($+1.0\text{ dBm}$ to $+7.0\text{ dBm}$) and selects wavelengths ($1310\,\text{nm}$, $1490\,\text{nm}$, $1550\,\text{nm}$).
The light beam physically traces total internal reflection zig-zag angles along the core boundary, enters a 1:4 Planar Lightwave Circuit (PLC) splitting junction, splits into 4 downstream branch rays, and outputs live, animated tabular decibel readings (`P_out = P_in - 7.2 dB`) that react in real time.

### 1.3 The Design System & Palette Tokens
- **Backgrounds & Surfaces:**
  - `ground-canvas`: `#FAFAF9` (warm technical alabaster)
  - `surface-card`: `#FFFFFF` (pure optical white)
  - `surface-elevated`: `#F4F4F5` (subtle zinc tint)
- **Typography & Ink:**
  - `ink-primary`: `#090D16` (deep obsidian ink for maximum contrast)
  - `ink-muted`: `#52525B` (technical metadata slate)
  - `ink-subtle`: `#71717A` (annotation and formula footnotes)
- **Architectural Borders:**
  - `hairline-default`: `1px solid #E4E4E7`
  - `hairline-strong`: `1px solid #D4D4D8`
  - `hairline-active`: `1px solid #2563EB`
- **Spectral Accents (Authentic Telecom Physical Roles):**
  - **FiberLAB Cobalt:** `#2563EB` (Primary brand action, UI indicators)
  - **1490 nm Downstream GPON:** `#10B981` (Emerald continuous signal)
  - **1310 nm Upstream Burst:** `#06B6D4` (Cyan TDMA laser)
  - **1550 nm Video / Low-loss Window:** `#8B5CF6` (Violet wavelength)
  - **650 nm VFL Fault Leak:** `#EF4444` (Crimson visual fault locator glow)
  - **Single-Mode Buffer Jacket:** `#FACC15` (Canary yellow)

### 1.4 Typographic System
- **Display Headlines:** Load and use high-contrast editorial serif typography (`Newsreader` / `Playfair Display` / `Instrument Serif` via Google Fonts or CSS font stack) paired with italic accents:
  - Example: *"Shoot the laser. Split the spectrum. <span class="italic font-serif text-blue-600">Watch the photons decay.</span>"*
- **Body & UI Controls:** High-legibility grotesque sans-serif (`Inter`, `-apple-system`, `sans-serif`) with tight letter-spacing (`-0.01em` to `-0.02em`).
- **Telemetry & Mathematics:** Monospace tabular numbers (`JetBrains Mono`, `ui-monospace`, `monospace`) with `font-feature-settings: "tnum" 1` for all dBm, dB, km, and nanometer readouts.

---

## 2. COPYWRITING & NARRATIVE ARCHITECTURE

Tone: Confident, direct, craftsman-like, and mathematically precise. Eliminate all passive fluff ("We built...", "We taught...", "Revolutionary...", "Next-gen...").

- **Eyebrow Tag:** `AUTONOMOUS OPTICAL ENGINEERING LAB · ITU-T G.984 GPON STANDARDS`
- **Main Hero Headline:**
  > Shoot the laser. Split the spectrum.  
  > *Watch the photons decay.*
- **Sub-headline:**
  > A real-time, deterministic sandbox for Passive Optical Networks. Wire Class C+ transceivers through cascaded splitters, simulate macro-bends, and resolve optical link budgets down to the sub-decibel level.
- **Primary CTA:** `[Launch Interactive Studio →]`
- **Secondary CTA:** `[Explore Guided Missions (3 Scenarios)]`
- **Tertiary Quick-Load CTA:** `[Load Standard 1:32 GPON Tree]`

---

## 3. COMPONENT ARCHITECTURE & IMPLEMENTATION DETAILS

Create the following files under `src/components/landing/`:

src/components/landing/
├── LandingView.tsx # Master landing layout and scroll-orchestrator
├── LandingNav.tsx # Editorial navbar with quick launch & presets
├── PhotonicHero.tsx # The signature interactive living waveguide
├── PillarsGrid.tsx # 3-column architectural capability cards
├── SpecsStrip.tsx # ITU-T G.984 reference table & mathematical constants
└── WaveguideCanvas.tsx # Mathematical SVG ray-tracing and reflection animation
code Code

### 3.1 `PhotonicHero.tsx` & `WaveguideCanvas.tsx` (Mathematical Interaction)
This component must be completely interactive:
1. **Physical Slider:**
   - Label: `Optical Launch Power (P_tx)`
   - Range: `+1.0 dBm` to `+7.0 dBm`, step `0.1 dBm`, default `+5.0 dBm` (Class C+ reference).
2. **Wavelength Selector Chips:**
   - `1310 nm (Upstream - 0.35 dB/km)`
   - `1490 nm (Downstream - 0.25 dB/km)`
   - `1550 nm (Ext. Low-loss - 0.20 dB/km)`
   - Changing wavelength updates the laser color (`#06B6D4`, `#10B981`, `#8B5CF6`) and changes the calculated core dispersion/refraction angle in the SVG.
3. **The Waveguide Graphic (Inline SVG):**
   - Render a layered cross-section: Outer Acrylate Coating ($250\,\mu\text{m}$), Silica Cladding ($125\,\mu\text{m}$), and Germanium-doped Silica Core ($9\,\mu\text{m}$).
   - Draw an SVG `<path>` representing the light ray bouncing off the upper and lower core-cladding boundary at the critical angle $\theta_c = \arcsin(n_2 / n_1) \approx 82^\circ$.
   - Animate the pulse traveling using `stroke-dasharray` and `stroke-dashoffset` keyframes.
   - At the center, pass the ray through an optical beam-splitter cassette ($1:4$ ratio, $-7.2\,\text{dB}$ insertion loss).
   - Divide the ray into 4 output pigtails, each terminating at a miniature digital power badge showing:
     $$P_{\text{branch}} = P_{\text{tx}} - 7.20\text{ dBm}$$
     The numbers must count up/down smoothly with no layout jitter.

### 3.2 `PillarsGrid.tsx` (Architectural Capability Showcase)
Render three asymmetric, clean architectural cards with hairline borders (`#E4E4E7`) and subtle hover lifts:
1. **Card 1: Pure Deterministic Physics**
   - *Title:* "Zero Approximation Link Budgets"
   - *Description:* "Every milliwatt is accounted for. The calculation engine recursively walks active OLT transceivers to subscriber ONTs, compiling fiber attenuation, fusion splices ($0.1\text{ dB}$), SC/APC connectors ($0.5\text{ dB}$), and PLC splitter ratios."
   - *Micro-graphic:* An SVG formula breakdown box showing $P_{\text{rx}} = P_{\text{tx}} - \sum L$.
2. **Card 2: Field Failure Missions**
   - *Title:* "Field Troubleshooting Missions"
   - *Description:* "Diagnose marginal links before they drop packets. Identify excessive drop cable runs, dirty connector penalties, and over-split cascades with real-time objective validation."
   - *Action Link:* Direct trigger to launch Mission 1 ("The Marginal Villa").
3. **Card 3: Complete Plant Audit & BOM**
   - *Title:* "Instant Bill of Materials"
   - *Description:* "Generate field deployment summaries instantly: total deployed single-mode fiber kilometers, fusion splice counts, connector inventories, and per-subscriber margin tables with one-click CSV/JSON export."

### 3.3 `SpecsStrip.tsx` (Telecom Reference Footing)
A crisp, monospace technical table summarizing ITU-T G.984 class thresholds directly on the page:
- Class B+ ($+1.5\text{ to }+5.0\text{ dBm}$ Tx, $-28\text{ dBm}$ sensitivity)
- Class C+ ($+3.0\text{ to }+7.0\text{ dBm}$ Tx, $-32\text{ dBm}$ sensitivity)
- Overload saturation floor: $>-8.0\text{ dBm}$
- LOS threshold: $<-28.0\text{ dBm}$

---

## 4. THE "MORPHING COCKPIT" INTEGRATION IN `src/App.tsx`

The transition between the landing presentation and the React Flow workspace must be seamless:
1. **State Management:**
   - In `App.tsx`, maintain an active view state: `viewMode: 'landing' | 'studio'`.
   - The interactive React Flow canvas is already mounted in the DOM underneath or alongside, preventing any re-mounting lag or state loss.
2. **Smooth Layout Transition:**
   - When the user clicks `[Launch Interactive Studio →]` or selects a preset, trigger a smooth transition:
     - The landing overlay smoothly fades/translates out using `transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1)`.
     - The canvas workspace smoothly transitions into full focus.
3. **Persistent Top Bar Navigation:**
   - In the canvas TopBar, add a sleek editorial toggle button: `[← Overview & Physics]`.
   - Clicking it smoothly brings back the landing narrative view without resetting the canvas nodes or simulation state.
4. **Direct Preset Loading:**
   - Clicking `[Load Standard 1:32 GPON Tree]` or `[Load Failing Link]` from the landing page immediately loads the topology, switches to `'studio'`, and focuses the camera (`fitView()`).

---

## 5. MOTION TOKENS, MICRO-INTERACTIONS & ACCESSIBILITY

1. **Motion System:**
   - Deceleration curve: `cubic-bezier(0.16, 1, 0.3, 1)`.
   - Hover lifts: `transform: translateY(-2px)`, shadow transition `200ms ease`.
   - Animated SVG light beams: CSS keyframes on `stroke-dashoffset`.
2. **Reduced Motion:**
   - Under `@media (prefers-reduced-motion: reduce)`, immediately disable beam travel keyframes, render static optical paths, and replace transitions with instant opacity toggles.
3. **Contrast & Sizing:**
   - Every text element must meet WCAG AA standards against its background (`4.5:1` normal text, `3:1` large text).
   - Touch targets must be at least $44 \times 44\text{ px}$.
   - Ensure zero horizontal scrolling across mobile ($390\text{ px}$), tablet ($768\text{ px}$), and desktop ($1440\text{ px}+$).

---

## 6. VERIFICATION & ZERO REGRESSIONS

1. Run `npm run typecheck` — confirm zero errors.
2. Run `npm test` — all 37 tests must pass completely.
3. Verify that dragging nodes in React Flow remains at a locked 60 FPS.
4. Test keyboard navigation: Tab focus through all buttons, sliders, and chips with visible focus rings.

Edited files+944−32
Edited files+1762−81
Edit
src/engine/__tests__/missions.test.ts
+48−4×2
Edit
src/__tests__/app.test.tsx
+55−7×2
Edit
src/index.css
+9−9×2
Edited files+51−19
Ran commands12
Edit
src/components/landing/WaveguideCanvas.tsx
+2−2
Edit
src/components/landing/WaveguideCanvas.tsx
+8−8×2
Ran commands3
Edited files+8−8
Edited files+43−24
stop_process
Ran commands6
Edit
src/App.tsx
+13−11×3
Edited files+74−63
Edited files+34−25
Edited files+11−10
Ran commands5
Edited files+15−13
Ran commands2
Start FiberLAB:5173
Edit
PROJECT_GUIDE.md
+2−2
Ran commands3
get_process_output
Ran commands4

Implemented the landing showcase and connected it to the existing FiberLAB studio.

    Added a responsive editorial overview with capabilities, GPON references, preset quick-loads, and an interactive waveguide. Its wavelength and launch-power controls update the ray display and branch-power readout.
    Kept the studio mounted while switching views, preserving canvas state. Added accessible focus handling, reduced-motion support, and larger touch targets.
    Added the Rescue the Unpatched Subscriber mission, plus navigation, mission, and physics tests. The simulator’s core equations and node-based graph mechanics remain unchanged.
    Updated the README and project guide.

Validation: typecheck and production build pass; 42/42 tests pass; git diff --check passes. The live Vite preview is running. Responsive breakpoints are implemented, but I couldn’t verify rendered layouts at 390/768/1440px because this environment has no headless browser.

npm ci reported 13 dependency audit findings (5 moderate, 6 high, 2 critical); I did not apply automatic fixes.

Committed and pushed to arena/e5dbd5e6-fiberlab (96508d8).
26m 28s | 25 minutes ago
10:35 AM

which one is the ui file codes i want the whole codes fo th eui
Ran commands2

The UI isn’t all in one file. The main files are:

    src/App.tsx — app shell and navigation between the overview and studio.
    src/index.css — UI styling and responsive breakpoints.
    src/components/landing/ — the landing page and waveguide showcase.
    src/components/ — studio controls, inspector, mission drawer, and network nodes.
    src/main.tsx — React app entry point.

I’ve opened fiberlab-ui-source.zip in the file viewer. It contains the full source and build configuration (59 files; no node_modules or build output).
47s | 14 minutes ago
10:45 AM


Agent
FiberLAB
arena/e5dbd5e6-fiberlab
+4975-331
Create PR
Diff
Branch
unified
split
PROJECT_GUIDE.md+465

# FiberLAB — Complete Project Guide

- **Prepared:** 13 October 2026
- **Repository:** FiberLAB
- **Product name shown in the app:** FiberLAB
- **Purpose:** A visual learning and simulation tool for fiber-to-the-home (FTTH) and passive optical networks (PON).

> This guide describes the current codebase, how its parts work together, and which product capabilities remain future work. Hardware drawings are representative SVG illustrations—not manufacturer photographs.

---

## 1. The project in one minute

FiberLAB is a browser-based, Tinkercad-style workspace for drawing a fiber network and experimenting with its optical power budget. A learner can place network elements on a canvas, connect them, edit their physical parameters, and see the calculated receive power and status at each subscriber endpoint.

The current app already includes:

- An editorial landing overview with a responsive living photonic waveguide, wavelength/launch-power controls, capabilities, and GPON reference thresholds.
- A persistent, in-place transition between the overview and studio so canvas edits and selections survive navigation.
- A drag-and-drop topology canvas.
- Four modeled element types: **OLT**, **splitter**, **fiber span**, and **ONT/ONU**.
- Two example network topologies.
- A real-time (or manually triggered) downstream optical-loss calculation.
- Color-coded link and receiver states.
- A per-subscriber loss breakdown.
- A bill of materials and CSV/JSON downloads.
- A static, React/DOM-independent catalogue of six representative hardware profiles, 40 × 40 SVG thumbnails in the toolbox and canvas nodes, and a selected-node Field Hardware Card in the Inspector.
- A light optical-engineering workbench palette, live edge states, equipment/interface color cues, and field-oriented copy.
- Three guided missions with fresh scenario setup, live objective progress, field hints, and a completion recap.

The current app still does **not** include genuine manufacturer/product photographs, a broad lesson library, quizzes or scoring, exact vendor/SKU integrations, accounts, a server, or saved projects. The hardware visuals are carefully authored vector references, not photos or exact vendor/SKU representations.

---

## 2. The goal and the direction discussed

The product goal is to help people learn fiber-network design by doing—not only by reading about it. The initial implementation focuses on drawing a PON and understanding how distance, splitters, splices, connectors, and transmit power affect the signal.

The product direction is to make the experience feel closer to real equipment and field work. The hybrid is now in place: an editorial physics overview fronts the diagrammatic canvas, toolbox and nodes use compact hardware illustrations, the Inspector shows a larger port/construction reference with practical tips, and three missions guide network repair and troubleshooting. The authored SVG drawings are **illustrations rather than genuine product photos**; they deliberately avoid claiming an exact vendor or SKU. A broader curriculum, scoring, and licensed photography remain future work.

Photos alone do not create field experience. A task such as “find why this subscriber has low receive power” is more educational when it asks the learner to inspect a route, identify the splitter and cable losses, make a change, rerun the test, and explain the result.

### 2.1 Light workbench palette and visual cues

- Canvas: `#F8FAFC`; cards/surfaces: `#FFFFFF` and `#F1F5F9`.
- Technical borders: `#E2E8F0` and `#CBD5E1`.
- Primary ink: `#0F172A`; metadata: `#64748B`; branding and focus: cobalt `#2563EB`.
- Telecom cues: cable yellow `#FACC15`, SC/APC green `#16A34A`, and SC/UPC blue `#2563EB`. Text labels accompany these colors so the interface does not rely on color alone. Connector polish is illustrative only—the graph does not model or enforce connector compatibility, so confirm installed interfaces and never mate APC with UPC.
- Measurements and equations use a monospace face; the rest of the interface uses the system sans-serif stack.

The main foreground tokens meet WCAG AA normal-text contrast on white and the canvas. Representative contrast ratios: metadata `#64748B` is 4.76:1 on white / 4.55:1 on canvas; cobalt `#2563EB` is 5.17:1 / 4.94:1; live-status text colors are at least 4.62:1 on the canvas. Connector/cable swatches are visual indicators paired with readable text labels.

### 2.2 Editorial landing system

The landing overview uses its own warm editorial tokens: ground `#FAFAF9`, white / `#F4F4F5` surfaces, ink `#090D16`, muted `#52525B`, subtle `#71717A`, and `#E4E4E7` / `#D4D4D8` borders. Spectrum cues are cobalt `#2563EB`, emerald 1490 nm `#10B981`, cyan 1310 nm `#06B6D4`, violet 1550 nm `#8B5CF6`, fault crimson `#EF4444`, and cable-jacket yellow `#FACC15`. It uses an available editorial serif stack and system sans/mono faces; no external font service is required. The waveguide diagram is responsive and labeled schematic art, not a to-scale construction drawing or measured fiber profile.

Its presentation-only reference model uses the fused-silica Sellmeier equation to show wavelength dispersion. A fixed illustrative core/cladding index step is calibrated to the approximate 82° reference at 1490 nm, and the near-unchanged ray path is labeled as schematic rather than visually exaggerated. The 1:4 branch readout uses the shared splitter catalogue loss; its arithmetic is dBm launch power minus dB insertion loss. The live graph engine remains authoritative for editable network budgets.

---

## 3. What a learner can do today

### 3.1 Starting state

The app opens on the **Overview & Physics** landing page. The waveguide starts at +5.0 dBm and 1490 nm; users can adjust the launch slider and choose 1310, 1490, or 1550 nm to inspect the educational ray-angle model and per-branch 1:4 PLC readout. **Launch Interactive Studio** opens the existing workbench, whose initial topology remains the **Standard 1:32 GPON Tree** with three subscribers. Landing quick-loads also open either the standard or failing-link preset directly.

### 3.2 Place and connect components

The left-hand **Component Toolbox** has four categories:

1. **OLT Transceiver** — the network's optical source.
2. **PLC Splitter** — choose a ratio from 1:2 through 1:64.
3. **Fiber Plant** — choose feeder, distribution, or drop cable.
4. **ONT/ONU** — the subscriber endpoint.

A component can be dragged to the canvas. Toolbox cards also support quick placement by double-click, and the ratio/cable shortcut buttons can add their selected item with a click. Components connect by dragging from a source handle to a target handle. The app uses a directed graph, and the simulation follows connections outward from an active OLT.

Every canvas node now shows a compact SVG hardware thumbnail while retaining its existing label, metrics, and connection handles. The visual handles are:

- OLT: one output.
- Fiber span: one input and one output.
- Splitter: one input and a limited number of visible output handles.
- ONT: one input.

When a splitter ratio is changed, the app removes wires attached to output handles that no longer exist. A new wire to an ONT replaces that ONT's prior incoming wire. A new outgoing wire from an OLT or fiber span replaces its previous outgoing wire.

### 3.3 Inspect and edit

Click a node or an optical patch cord to open the right-hand **Inspector**. It exposes settings specific to the selected element, such as:

- OLT class, port name, transmit power, wavelength, and laser state.
- Splitter ratio and excess loss.
- Fiber type, span length, wavelength, attenuation override, splice count, and connector count.
- ONT subscriber name and serial number, plus its calculated receiver status and path-loss breakdown.
- For a patch cord, the carried power/state and a delete action.

When a node is selected, the Inspector now begins with a **Field Hardware Card**. It shows the subtype-specific large SVG reference, current configuration, practical explanation, port/construction list, field tips, and a collapsible datasheet-context section. The card labels its artwork as a representative illustration, not a photograph or exact product model. Selecting an edge does not show a hardware card.

The Inspector also explains the calculation and shows a path's individual losses for a connected ONT. Nodes and wires can be removed from the Inspector; canvas items can also be selected and deleted with Backspace/Delete.

### 3.4 Watch the simulation

With **Auto** on, the network calculation updates as relevant values change. With Auto off, the top bar provides **Run test**; after a previous test, changes are marked as a stale/unsaved budget until the next run.

The canvas draws moving dashed lines to make live or degraded optical links easier to notice. Each link is labeled with its calculated power at the far end. A minimap, pan/zoom controls, and canvas grid help navigate larger designs.

### 3.5 Use a preset or inspect the inventory

The top bar includes the **Overview & Physics** return action, two presets, the **Missions** drawer, global safety margin, Auto mode, **Run test**, **Bill of Materials**, and **Clear Canvas**. The Bill of Materials (BOM) summarizes the plant and each subscriber's optical budget, and offers:

- CSV download for per-subscriber results.
- JSON download containing the topology, settings, and simulation summary/readings.

JSON export is implemented; **JSON import and automatic project saving are not currently implemented**.

### 3.6 Practice field missions

Open **Missions** in the top bar or choose **Explore Guided Missions** on the landing page to launch a scenario. Starting one loads a fresh copy of its existing preset, applies the mission setup, turns on Auto, restores the mission's safety-margin target, clears selection, and fits the graph. Objective progress is evaluated from the live simulation and graph state; hints are available in the drawer and a completion summary appears when every objective is met.

- **The Marginal Villa:** starts from the Standard 1:32 tree with one marginal subscriber. Bring all three connected ONTs into the ONLINE window, preserve exactly 2.0 dB safety margin, and keep OLT launch power at or below +5.0 dBm.
- **Diagnose the Silent ONT:** starts from the Failing Long-Distance Link with `olt-b` laser switched off. Re-enable an OLT source, restore an optical path to Dukan Ridge — Tower 7, and bring that target ONT into the ONLINE window.
- **Rescue the Unpatched Subscriber:** starts from the same long-haul preset with Dukan Ridge — Not Yet Wired unpatched. Connect the 1:16 splitter's `out-2` handle to its drop, connect the drop to the ONT, then reduce cascaded split loss until that subscriber is ONLINE. Dirty-end-face and macro-bend penalties are disclosed but are not separate simulator terms.

These are guided practice missions, not a scored course. They do not add graph component types or change the simulator's core equations.

---

## 4. Current component model

The current toolbox has four model kinds. These are network abstractions, not a catalogue of exact manufacturer part numbers.

| Component | Current modeled fields | Typical use in the network |
|---|---|---|
| **OLT** | PON port name, class B+/C+, transmit power, laser on/off, wavelength | Launches downstream light into the network. |
| **Splitter** | 1:N ratio, optional excess loss | Divides a PON path into branches and adds insertion loss. |
| **Fiber span** | Feeder/distribution/drop type, length, splices, connectors, wavelength, optional attenuation override | Represents a physical cable segment and the losses assigned to it. |
| **ONT/ONU** | Subscriber label, serial number, informational receiver sensitivity | Terminates the network at a subscriber and displays calculated receive telemetry. |

Important modeling details:

- A fiber span is a **node**, not just an edge. This lets it own its length and loss inputs. The connecting edge is an idealized patch/connection that carries telemetry but adds no loss itself.
- The splitter ratios are 1:2, 1:4, 1:8, 1:16, 1:32, and 1:64. The current canvas displays at most four output handles (two for 1:2, four for the other ratios). These handles represent branch connections in the diagram; they are **not** one physical handle for every output port of a 1:8, 1:16, 1:32, or 1:64 splitter.
- The ONT's `sensitivityDbm` is stored in node data but is not currently exposed as an Inspector control; the status classifier uses shared thresholds instead of each ONT's individual sensitivity.
- OLT class receive-sensitivity and nominal link-budget values are displayed as reference information. The current traversal does not use those values as a separate pass/fail calculation.

### Factory defaults for newly placed elements

- **OLT:** Class B+, +3 dBm, laser on, 1490 nm.
- **Splitter:** 1:8, with zero extra loss.
- **Feeder fiber:** 5 km, 0 splices, 2 connectors.
- **Distribution fiber:** 1 km, 2 splices, 2 connectors.
- **Drop fiber:** 0.3 km, 1 splice, 2 connectors.
- **ONT:** automatically generated subscriber name/serial and an informational sensitivity of −28 dBm.
- **Global safety margin:** 2 dB.

Changing the cable preset in the Inspector resets that fiber span's length and splice/connector defaults to the selected cable preset. A learner can then adjust the values.

---

## 5. How the optical calculation works

The simulator is a small, deterministic graph calculation. Its main formula is:

```text
P_rx = P_tx − (fiber loss + splitter loss + splice loss + connector loss + safety margin)
```

It starts at each OLT whose laser is enabled, follows outgoing connections, adds losses as it passes through fiber and splitter nodes, and records a completed path when it reaches an ONT.

### 5.1 Fiber losses

For each fiber span:

```text
fiber loss = length in km × attenuation in dB/km
splice loss = splice count × 0.1 dB
connector loss = connector count × 0.5 dB
span total = fiber loss + splice loss + connector loss
```

Default attenuation is:

| Wavelength | Default attenuation | Direction represented in the UI |
|---|---:|---|
| 1310 nm | 0.35 dB/km | Upstream reference |
| 1490 nm | 0.25 dB/km | Downstream reference |

Each fiber node uses its own wavelength, unless the learner supplies a positive attenuation override. Changing the fiber wavelength clears that override. These are simplified default coefficients; a real cable's measured or datasheet-backed value can differ.

### 5.2 Splitter losses

The splitter loss catalogue currently used is:

| Split ratio | Modeled insertion loss |
|---:|---:|
| 1:2 | 3.7 dB |
| 1:4 | 7.2 dB |
| 1:8 | 10.5 dB |
| 1:16 | 13.8 dB |
| 1:32 | 17.5 dB |
| 1:64 | 20.8 dB |

The Inspector's **Excess / uniformity loss** is added to the catalogue value. Actual splitters vary by manufacturer and model, so a future exact-hardware profile should use the selected unit's documented insertion-loss data and identify its source.

### 5.3 OLT classes and transmit power

| Class | Default launch power | Stored transmit range | Displayed receiver sensitivity | Displayed nominal link budget |
|---|---:|---:|---:|---:|
| B+ | +3 dBm | +1.5 to +5 dBm | −28 dBm | 28 dB |
| C+ | +5 dBm | +3 to +7 dBm | −32 dBm | 32 dB |

Selecting a class sets its default transmit power. The Inspector then permits a wider manual transmit-power range; this is useful for experiments but does not enforce the class-specific minimum/maximum values stored in the catalogue.

### 5.4 Safety margin and receiver status

The global safety/ageing/repair allowance defaults to 2 dB and is subtracted on every completed OLT-to-ONT path. It is clamped to a non-negative value in the simulation.

The current receiver status thresholds are:

| Status | Current rule | Meaning shown in the app |
|---|---|---|
| **OVERLOAD** | Receive power greater than −8 dBm | Receiver saturation / potential overload risk. |
| **ONLINE** | −24 dBm through −8 dBm inclusive | Inside the modeled optimal window. |
| **WARNING** | −28 dBm through below −24 dBm | Marginal receive level. |
| **LOS** | Below −28 dBm | Loss of signal. |
| **DISCONNECTED** | No active path, or no receive reading | No active OLT route reaches the ONT. |

At exactly −28 dBm the current code returns **WARNING**; LOS begins below −28 dBm. These rules are app-level learning thresholds, not a claim that every real ONT has identical limits.

The UI's `marginDb` is calculated as the distance above the −28 dBm LOS floor. It is not the same thing as a full vendor-specific engineering margin against a particular transceiver class.

### 5.5 Graph and telemetry behavior

- All active OLTs are simulated. If multiple OLT paths reach the same ONT, all candidate paths are kept, sorted by receive power, and the strongest path is the one shown as primary.
- A visited-node guard and maximum traversal depth protect the engine from cycles or an unexpectedly deep graph.
- Each edge reports the strongest power found on it. An edge is **live** at or above −28 dBm, **degraded** below −28 dBm when light is present, and **idle** if no enabled OLT path reaches it.
- Network totals count the physical nodes on the canvas, including unconnected fiber spans. The mean receive power only includes ONTs with a reading.
- The BOM headline labeled “Online” currently counts ONLINE + WARNING + OVERLOAD (all ONTs with a signal), while its detailed table shows the individual statuses. Treat the per-status table as the precise breakdown.
- `allOptimal` is true only when there is at least one ONT and every ONT is ONLINE. `hasFault` is based on LOS/disconnected states; the top-bar health strip separately shows warnings/overload as amber.

---

## 6. The two included network presets

### 6.1 Standard 1:32 GPON Tree

This is the default topology. It contains:

```text
OLT → 5 km feeder → 1:4 splitter → 1 km distribution → 1:8 splitter → three drop branches → ONTs
```

The cascaded split is 1:4 × 1:8 = 1:32. The three branches are deliberately different so learners can compare outcomes.

For the 300 m subscriber, the modeled losses are approximately:

```text
Feeder span                          2.250 dB
1:4 splitter                         7.200 dB
Distribution span                    1.450 dB
1:8 splitter                        10.500 dB
300 m drop span                      1.175 dB
Safety margin                        2.000 dB
Total path loss                     24.575 dB
OLT launch power                    +3.000 dBm
ONT receive power                    −21.575 dBm  → ONLINE
```

The other two branches receive approximately −22.0 dBm (ONLINE) and −24.3 dBm (WARNING). The preset has 13.5 km of total cable nodes, two splitters, and three ONTs.

### 6.2 Failing Long-Distance Link

This exercise has a C+ OLT, a 20 km feeder, a 1:32 splitter, 8 km of distribution cable, a 1:16 splitter, and three possible drops. Its aggregate split is 1:512. Two subscribers are connected and calculate to roughly −39.5 dBm and −39.1 dBm, so they are LOS. A third ONT is intentionally left unwired to demonstrate DISCONNECTED.

This preset helps distinguish **weak signal on a connected path** from **no path at all**.

---

## 7. Architecture and source-code map

The app is a client-side React/TypeScript application. There is no backend service in the current repository.

| File or folder | Responsibility |
|---|---|
| `src/main.tsx` | Browser entry point. Loads React Flow styles and the app stylesheet, then mounts the React application. |
| `src/App.tsx` | Main workspace. Owns node/edge/settings state, drag and drop, connections, selection, presets, simulation, and the top-level layout. |
| `src/types.ts` | Shared simulation domain types and catalogues: wavelengths, losses, OLT classes, cable defaults, thresholds, node data, telemetry, settings, and export format. |
| `src/data/componentCatalogue.ts` | Framework-independent static hardware profiles, descriptions, field tips, datasheet context, and inline SVG data-URI illustrations. It is separate from the optical calculation model. |
| `src/engine/opticalSimulator.ts` | Pure optical calculations, graph traversal, path selection, status classification, and network summaries. It does not render React UI. |
| `src/engine/factories.ts` | Creates OLT, splitter, fiber, and ONT nodes with consistent defaults and IDs. |
| `src/engine/presets.ts` | Builds the two ready-made topologies. |
| `src/engine/edgeDecoration.ts` | Maps edge telemetry to colors and React Flow arrow markers. |
| `src/engine/SimulationContext.ts` | Shares the current simulation result with custom nodes without copying telemetry into node data. |
| `src/components/Sidebar.tsx` | Toolbox, cable/ratio choices, drag payloads, and quick-add controls. |
| `src/components/TopBar.tsx` | Health summary, presets, safety margin, Auto switch, test, BOM, and clear actions. |
| `src/components/Inspector.tsx` | Selected-node/edge editing, status details, and ONT loss breakdown. |
| `src/components/FieldHardwareCard.tsx` | Reusable Inspector card for the selected node's equipment illustration, physical interfaces/construction, explanation, field tips, and datasheet context. |
| `src/components/BOMModal.tsx` | Plant totals, per-subscriber table, CSV download, and JSON topology export. |
| `src/components/OpticalEdge.tsx` | Draws optical wires and labels their carried power. |
| `src/components/nodes/` | Custom React Flow nodes for OLT, splitter, fiber, and ONT, plus reusable node styling. |
| `src/index.css` | Dark visual theme, shared controls, React Flow styling, and optical-edge animations. |
| `src/engine/__tests__/` | Unit tests for loss calculations, classifications, paths, presets, and edge decoration. |
| `src/data/__tests__/componentCatalogue.test.ts` | Node-environment checks for all hardware profiles, SVG data URIs, subtype resolution, and unsupported kinds. |
| `src/__tests__/app.test.tsx` | Mounted-app tests for the default workspace, telemetry, hardware card, Inspector, BOM, presets, and clearing. |

`App.tsx` calculates a simulation result from the current node graph. That result is shared through `SimulationContext`, used to decorate the optical edges, and passed to the top bar, Inspector, and BOM. This keeps the physical data model, calculation, and presentation as separate concerns.

---

## 8. Technology and local development

Main libraries and tools:

- React 18 and TypeScript.
- Vite 6 for local development and production builds.
- `@xyflow/react` 12 for the canvas, nodes, edges, handles, zoom, and minimap.
- Tailwind CSS 3 plus `lucide-react` for styling and icons.
- Vitest and Testing Library for tests.

Commands from the repository root:

```bash
npm ci             # install exactly what the lockfile specifies
npm run dev        # run the Vite development server
npm test           # run engine and app tests
npm run typecheck  # strict TypeScript check
npm run build      # type-check and create a production build
npm run preview    # serve the production build locally
```

The Vite development and preview servers are configured to bind to `0.0.0.0` and accept the preview host, which is useful in hosted development environments.

### Verification performed for this guide

On 13 October 2026, after implementing the landing overview and third field mission:

- `npm run typecheck`: passed.
- `npm test`: **42 tests passed** (21 optical-engine tests, 2 landing-physics tests, 5 catalogue tests, 4 mission tests, and 10 app tests).
- `npm run build`: passed, including strict TypeScript checking and a Vite production build.
- `git diff --check`: passed.
- `npm ci` reported **13 dependency audit findings** in the lockfile (5 moderate, 6 high, 2 critical). These need to be reviewed before a production release; no automatic dependency fix was applied as part of this implementation.

---

## 9. Current boundaries and accuracy notes

FiberLAB is a useful **learning simulator**, but the current model should not be treated as a certified live-network design tool. In particular:

1. **Downstream only:** the graph traversal calculates OLT-to-ONT received power. Although 1310 nm is labeled upstream and can be selected on a fiber span, there is no separate ONT-to-OLT upstream budget or OLT receiver calculation yet. The landing waveguide separately displays 1550 nm as an educational reference; graph wavelengths remain 1310 and 1490 nm.
2. **Generic equipment:** an OLT class or splitter ratio is an abstract model, not an exact make/model. The app uses representative SVG illustrations, not product photos, and does not contain SKU-specific datasheets.
3. **Simplified losses:** fiber attenuation is one coefficient per selected wavelength; splice and connector losses are fixed; splitter values come from a shared table. The model does not yet include per-connector condition, dirty connectors, bend loss, repair history, temperature, or measurement uncertainty.
4. **Shared ONT thresholds:** every ONT uses the same global status window even though its sensitivity field is stored.
5. **Informational OLT budgets:** class link-budget and OLT receiver-sensitivity values are displayed but are not independently enforced by the path engine.
6. **Abstract splitter ports:** high-ratio splitters have four visible branch handles, not a handle for every physical subscriber port.
7. **No project persistence:** workspace state is in browser memory. Reloading starts over at the default preset. JSON export exists, but import, autosave, and account/cloud storage do not.
8. **Limited learning content:** three guided missions provide live objective progress and hints, but there is no broader curriculum, quiz, points, or grading. One mission begins with an intentionally disabled OLT laser; there is no general-purpose fault-injection editor.
9. **No hardware can be damaged by the app:** an OVERLOAD state is a simulation warning. It is not a physical safety interlock.
10. **Values need domain review:** standards and component specifications evolve and vary by product. Any real equipment profile should cite its source and distinguish typical values from guaranteed limits.

For real deployment engineering, learners should confirm all assumptions against current standards, product datasheets, measured plant data, and qualified engineering practice.

---

## 10. Recommended approach for real component imagery

The first version is now implemented as a small, well-organized **component catalogue**, rather than embedding ad-hoc image URLs inside each node. It contains six generic hardware profiles: OLT, PLC splitter, three fiber constructions, and indoor ONT. The drawings are inline SVGs; licensed product photographs are still a future content task.

### 10.1 Start with the four existing kinds

Gather a representative image for:

- OLT / GPON line terminal.
- PLC optical splitter.
- Single-mode fiber cable (ideally a cable photo plus a cross-section/cutaway illustration).
- ONT/ONU subscriber terminal.

The current app does not yet model connectors, closures, patch panels/ODFs, cabinets, fusion splicers, or power meters as separate canvas components. Add those only when their simulation/teaching behavior is defined—not just to increase the number of pictures.

### 10.2 Keep the interface smooth

- **Toolbox:** each draggable item uses a compact, recognizable 40 × 40 hardware illustration while keeping its label and quick interaction easy to scan.
- **Canvas:** each node now uses a small SVG hardware thumbnail beside its existing label and live status; the drawing does not cover ports or telemetry.
- **Inspector:** selected nodes now show a larger SVG field illustration, component explanation, physical interfaces/construction, field tips, and collapsible standards/operating-context notes.
- **Loading:** thumbnails and hero drawings are local encoded SVG data URIs; the hero is only mounted for a selected node and uses lazy decoding.
- **Accessibility:** the hardware images have descriptive alt text, and status continues to use textual labels as well as color.

### 10.3 Keep content and physics separate

The current `HardwareProfile` stores an ID, component kind, model/category labels, thumbnail and hero SVG data URIs, physical ports or construction notes, field notes, a short explanation, and a datasheet-context snippet. The module has no React or browser-DOM dependencies. The optical simulation model does not import or depend on the display catalogue.

The initial entries are representative generic references. When licensed photos or exact vendor models are introduced, add image source/rights metadata and, if the learner selects an exact SKU, use a stable `modelId` to look up verified optical values. Do not silently change loss assumptions merely because an image or illustration was selected.

### 10.4 Image rights and quality

- Prefer photos you have permission to use, your own photos, or explicitly licensed assets.
- Do not assume a manufacturer image is free to reuse; record its source and usage terms.
- Avoid hotlinking remote product images. Local, optimized assets are more reliable and do not disappear when another website changes its URL.
- AI-created art can be useful for diagrams or cutaways, but should not be labeled as an authentic photograph of a specific product.
- Use consistent framing, background, crop, and lighting. Compress images and provide useful alt text.

---

## 11. Recommended path to a more realistic learning product

A smooth way to grow the project is to deliver one complete vertical slice at a time.

### Phase 1 — Component recognition (implemented)

A decoupled catalogue, six representative SVG hardware profiles, compact canvas thumbnails, and a selected-node Field Hardware Card are now in place. The existing graph model and optical calculation equations were left unchanged. The artwork is illustrative rather than photographic; licensed real-world photos and source/rights metadata remain future work. Catalogue and UI tests cover profile resolution and card rendering.

### Phase 2 — First guided build (initial version implemented)

**The Marginal Villa** turns the Standard 1:32 tree into a short objective-based mission with field hints and live completion tracking. It checks the three connected ONTs, a fixed 2.0 dB safety margin, and the Class B+ OLT launch-power limit. A fuller course can add step narration and deeper explanations of each change.

### Phase 3 — Troubleshooting practice (initial version implemented)

**Diagnose the Silent ONT** starts with a disabled OLT laser in the existing long-haul preset, then asks the learner to restore a path and bring the target subscriber online. The model already supports disabled sources, disconnected paths, long spans, split loss, and receiver thresholds. A future iteration can add diagnosis-before-hint sequencing and before/after loss explanations.

### Phase 4 — Add realistic fault models

Add new, explicit loss/fault properties for experiences such as dirty connector, macro-bend, damaged cable, or an unexpectedly lossy splice. Keep these effects separate and visible in the path breakdown so learners understand the cause. Do not pretend the current fixed connector/splice model already simulates these faults.

### Phase 5 — Expand the network and content library

After the existing component profiles and three guided missions have been exercised with learners, consider equipment such as connector types, patch panels/ODFs, closures, outlets, attenuators, and measurement tools. Each new type should have a clear purpose in the graph, a teachable interaction, tested simulation behavior, and a cited source for its physical assumptions.

### Example included mission

> **The Marginal Villa:** Three subscribers share a GPON tree. One is in the warning range. Inspect the route, identify the loss contributors, and correct the plant while preserving the 2.0 dB design margin and the OLT launch-power limit.

This uses the existing Standard 1:32 preset and simulator. The other included missions cover disabled-laser troubleshooting and an unpatched subscriber in the failing long-haul preset; future lessons can introduce more explicit diagnosis sequencing and after-action budget comparisons.

---

## 12. Glossary

- **FTTH:** Fiber to the Home; optical access fiber reaches a residence or subscriber location.
- **PON:** Passive Optical Network; an access architecture that shares an OLT port through passive optical distribution components.
- **GPON:** Gigabit-capable PON; the family modeled by the current examples.
- **OLT:** Optical Line Terminal; the provider-side equipment that launches and manages the PON signal.
- **ONT / ONU:** Optical Network Terminal / Unit; the subscriber-side optical endpoint. The names can be used differently by vendors and network contexts.
- **PLC splitter:** Planar Lightwave Circuit splitter; a passive component that divides optical power among output branches.
- **Feeder / distribution / drop:** Common network sections from the headend toward a distribution point, through the local distribution plant, and finally to the subscriber.
- **dB:** A logarithmic ratio commonly used to express gain or loss.
- **dBm:** An absolute optical/electrical power level referenced to 1 milliwatt. In the simulator, losses in dB are subtracted from transmit power in dBm.
- **Wavelength (nm):** The optical carrier wavelength. The UI labels 1490 nm as downstream and 1310 nm as upstream for this GPON learning model.
- **Link budget:** The accounting of transmit power minus losses and allowances along a path, used to estimate receive power.
- **LOS:** Loss of signal; here, the modeled received power is below the configured LOS threshold.
- **SC/APC:** A common angled-polish fiber connector family. The simulator uses a simplified fixed 0.5 dB loss per counted connector.

---

## 13. What has happened so far

- The FiberLAB repository was reviewed, including the UI, simulator, presets, data model, exports, and existing tests.
- The project guide was created and linked from the README.
- Phase 1 hardware recognition was implemented: a zero-React/DOM component catalogue, six SVG hardware profiles, small canvas thumbnails, and the selected-node Field Hardware Card.
- The card includes equipment/construction diagrams, practical explanations, field tips, and cautious datasheet context. It explicitly identifies the drawings as representative illustrations rather than product photos.
- The existing graph model—particularly fiber spans as nodes—and the core equations in `opticalSimulator.ts` were not changed.
- The persistent editorial landing/studio shell, responsive photonic waveguide, and wavelength/power controls are in place; the core simulator and node graph mechanics remain untouched.
- **Rescue the Unpatched Subscriber** is the third guided scenario, and physics, mission-recovery, navigation, and state-preservation tests cover the new experience.
- The suite now has **42 passing tests**: 21 optical-engine tests, 2 landing-physics tests, 5 catalogue tests, 4 mission tests, and 10 app tests. The typecheck, production build, and `git diff --check` also pass.
- Three guided missions and the light workbench palette are in place. A broader curriculum, scoring, general-purpose fault-injection controls, and licensed product photographs remain future work.

This is a snapshot of the codebase and product plan as of the preparation date. Revisit the physical assumptions and dependency audit before using the app for real engineering work or publishing a production release.