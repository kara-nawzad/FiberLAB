# FiberLAB — Complete Project Guide

- **Prepared:** 13 October 2026
- **Repository:** FiberLAB
- **Product name shown in the app:** FiberLAB
- **Purpose:** A visual learning and simulation tool for fiber-to-the-home (FTTH) and passive optical networks (PON).

> This guide describes the current codebase, how its parts work together, and which product capabilities remain future work. Hardware drawings are representative SVG illustrations—not manufacturer photographs.

---

## 1. The project in one minute

FiberLAB is a browser-based, Tinkercad-style workspace for drawing GPON and XGS-PON access networks and exploring a graph-derived optical power budget, independent CAPEX estimate, and route-based OTDR traces. Learners can place and connect representative headend, outside-plant, and customer-premises equipment, edit physical parameters and local reference prices, and inspect optical/service telemetry, commercial totals, and diagnostic events.

The current app already includes:

- A warm, hold-to-splice landing hero with an SVG fiber scene and a simulator-backed readout, plus a responsive living photonic waveguide, wavelength/launch-power controls, capabilities, and GPON reference thresholds.
- A persistent, in-place transition between the overview and studio so canvas edits and selections survive navigation.
- A drag-and-drop topology canvas.
- Eight graph element types: **OLT**, **ODF**, **splitter**, **fiber span**, **dome splice closure**, **NAP/FAT**, **ONT/ONU**, and **Wi-Fi 6 gateway**.
- Three selectable network topologies, including a modern XGS-PON suburb.
- A real-time (or manually triggered) downstream optical-loss calculation.
- Color-coded link and receiver states.
- A per-subscriber loss breakdown, including separate macro-bend and dirty-ferrule training penalties.
- A virtual handheld OPM that probes nodes, ports, and patch cords with simulator-backed 1310/1490/1550 nm readings and a relative dB reference mode.
- An interactive OTDR Trace Analyzer with ONT/gateway target selection, 1270/1310/1490/1550/1577 nm wavelengths, adjustable pulse widths, Rayleigh backscatter chart, crosshair readout, ODF/NAP event markers, and a pass/warning/fail event table.
- An OSP dome-closure node with two inputs, four modeled branches, an adjustable per-branch splice allowance, and an interactive 12-color tray.
- A dual-view bill of materials/quotation with material, labor, project, and subscriber metrics; a pure topology-derived estimator; editable local reference rates; and financial data in CSV/JSON downloads.
- A static, React/DOM-independent catalogue of ten representative hardware profiles, 40 × 40 SVG thumbnails in the toolbox and canvas nodes, and a selected-node Field Hardware Card in the Inspector.
- A light optical-engineering workbench palette, live edge states, equipment/interface color cues, and field-oriented copy.
- Upstream burst-mode dynamic range telemetry (`upstreamDeltaDb`, `upstreamDynamicRangeWarning`) flagging when the power differential across active connected ONTs on a PON port exceeds 15.0 dB, with amber indicators on the OLT node and TopBar plus per-subscriber upstream differentials in the BOM optical table.
- Five guided missions with fresh scenario setup, live objective progress, field hints, and completion recaps, including a three-home cost-versus-performance challenge and a blind trunk-cut troubleshooting mission with hidden canvas fault indicators.

The current app still does **not** include genuine manufacturer/product photographs, a broad lesson library, quizzes or scoring, exact vendor/SKU integrations, accounts, a server, or saved projects. The hardware visuals are carefully authored vector references, not photos or exact vendor/SKU representations.

---

## 2. The goal and the direction discussed

The product goal is to help people learn fiber-network design by doing—not only by reading about it. The workbench models a PON from the OLT and central-office patch field through the outside plant and into a subscriber's optical terminal or home gateway, while showing how distance, passive splits, splices, connectors, wavelength, and transmit power affect the downstream signal.

The product direction is to make the experience feel closer to real equipment and field work. The hybrid now combines a warm splice-to-studio landing, diagrammatic canvas, compact representative hardware, Inspector field cards, five guided missions, and commercial planning. The network includes an ODF panel, FOSC-style dome closure, 1:8 outdoor NAP/FAT, Wi-Fi 6 GPON/XGS-PON gateway, wavelength-dependent OPM/OTDR references, and distinct macro-bend/dust training faults. The authored SVG drawings are **illustrations rather than genuine product photos**; they deliberately avoid claiming an exact vendor or SKU. A broader curriculum, scoring, saved projects, real service provisioning, and licensed photography remain future work.

Photos alone do not create field experience. A task such as “find why this subscriber has low receive power” is more educational when it asks the learner to inspect a route, identify the splitter and cable losses, make a change, rerun the test, and explain the result.

### 2.1 Warm workbench palette and visual cues

- Ground: `#FFF4E6`; cards/surfaces: `#FFFAF2`; elevated surfaces: `#F4E8D8`.
- Ink: `#2B1A14`; muted text: `#85695A`; hairline: `#EED8BF`; cobalt accent: `#2F6BFF`.
- Warm accents: sun `#FF9F1C`, coral `#E4673F`, and green `#0F8A5F`.
- Telecom cues remain explicit: cable yellow `#FACC15`, SC/APC green, and SC/UPC cobalt. Text labels accompany these colors; connector polish is illustrative only—the graph does not model or enforce connector compatibility, so confirm installed interfaces and never mate APC with UPC.
- Display typography uses the exact Google Font families **Sora**, **Manrope**, and **JetBrains Mono**, with system fallbacks. The HTML imports them from Google Fonts.

`src/styles/tokens.css` holds one type scale (11 / 12 / 13 / 15 / 18 / 22 / 28 px) with semantic roles, one 4 px spacing scale (4 / 8 / 12 / 16 / 24 / 32), six radii and one control-height set. Body copy is never smaller than 13 px; the 11 px step is reserved for uppercase chips, unit suffixes and canvas node art. Sizing roles:

| Role                    | Token                                | Size                    | Weight  |
| ----------------------- | ------------------------------------ | ----------------------- | ------- |
| Landing hero            | `--type-display`                     | `clamp(45, 5.25vw, 76)` | 700     |
| Landing section heading | `--type-section-title-lg`            | 28 (22 ≤640)            | 700     |
| Section / modal title   | `--type-section-title`               | 22                      | 700     |
| Panel title             | `--type-panel-title`                 | 18                      | 700     |
| Card title              | `--type-card-title`                  | 15                      | 600     |
| Body                    | `--type-body`                        | 13                      | 400–500 |
| Label / tab / table     | `--type-small`                       | 12                      | 600     |
| Caption / unit          | `--type-caption`                     | 11                      | 600–700 |
| Metric                  | `--type-metric` / `--type-metric-sm` | 28 / 22                 | 700     |

Spacing follows the same rule: every `padding`, `margin` and `gap` resolves to `--sp-1` (4) / `--sp-2` (8) / `--sp-3` (12) / `--sp-4` (16) / `--sp-6` (24) / `--sp-8` (32). Cards, tables and rows use one of three rhythms — 4 px between a label and its value, 8 px between rows, 12 px inside a card, 16 px from a panel edge (`--shell-pad`) — and the same element type always has the same padding (for example `--card-pad` for every stat, card and tile). Tailwind utilities in the components use only the matching steps (`gap-1` … `gap-8`), never the half steps. Controls share `--control-sm/md/lg` (32 / 36 / 40) so a select, a button and a pill on the same row line up. Numeric readouts and numeric table columns use `font-variant-numeric: tabular-nums` and a right edge of their own, which keeps digits from jumping as values update. Tracking follows four steps — `--tracking-display` (-0.07em for the wordmark and large readouts), `--tracking-tight` (-0.02em for titles), `--tracking-label` (0.08em for uppercase labels) and `--tracking-eyebrow` (0.13em for eyebrows) — and every `border-radius` resolves to one of the six `--r-*` steps in both the workbench and the landing views. Control padding comes from `--inset-control` (8/12), so a button, a select and a search field are inset identically.

Interactive components follow one spec, so a button, a select and a tab never disagree:

| Component               | Height              | Padding                   | Radius                        | Type             |
| ----------------------- | ------------------- | ------------------------- | ----------------------------- | ---------------- |
| Button / select (`md`)  | `--control-md` (36) | `--inset-control` (8/12)  | `--r-md` (8)                  | 13 / 600         |
| Compact button, chip    | `--control-sm` (32) | 8/0 – 8/8                 | `--r-md`                      | 11–12 mono       |
| CTA (`.landing-button`) | `--control-lg` (40) | 0/16                      | `--r-pill`                    | 13 / 700         |
| Input / select          | 36                  | 8/12                      | `--r-md`                      | 13 mono          |
| Tab                     | `--tab-h` (40)      | 0 (text), 0/16 (doc chip) | `--r-md` when contained       | 13 / 600→700     |
| Table header            | —                   | 0 0 8                     | —                             | 11 uppercase/600 |
| Table cell              | 8 vertical          | 8 / 12                    | —                             | 12               |
| Badge / pill            | 4 vertical          | 4/8                       | `--r-sm` (6), pill for status | 11 / 700         |
| Icon                    | 12 · 14 · 16 · 20   | —                         | —                             | —                |

Icon sizes carry meaning: 12 inside a badge or caption row, 14 inline with 13 px text (buttons, selects, chevrons), 16 in a panel or modal header and in icon-only 36 px buttons, 20 in the rail/sidebar. Touch devices (`pointer: coarse`) lift every control to the 44 px `--control-tap` target.

**Responsive behaviour.** Five widths are checked — 1920, 1440, 1024, 768 and 390 px. Above 1024 px the shell keeps all four columns and nothing stretches: the shell has a fixed rail, a fixed library and inspector, and the canvas takes the rest. At ≤1024 px the header drops the zoom menu and the stat grid falls to two columns; at ≤900 px the component library and the inspector become overlay sheets inside the body gutter (both start collapsed, and the inspector re-opens when a node is selected), and the header scrolls as a last resort while its menus are rendered as fixed panels so a scroll container cannot clip them. At ≤767 px the left rail leaves the layout and the four sections move to a bottom tab bar (Design, Simulation, Reports, Settings) whose 44 px tabs sit under the status bar and add `env(safe-area-inset-bottom)` padding for the iPhone home indicator; the library becomes a bottom sheet opened by the **+ Components** button at the top-left of the canvas (handle drag to expand or dismiss, tap-to-place, 44 px controls), the canvas toolbar drops to a compact icon-only strip along the bottom of the canvas (React Flow's duplicate zoom buttons hide), the status bar stays one scrollable row that expands into a bottom sheet, and the Inspector becomes a half-height bottom sheet that drags up to full height, down to half, then closes — the canvas stays visible and pannable above it, and every sheet stops above the tab bar so navigation is never buried; at ≤640 px the top bar buttons print their short captions; in landscape (≤900 px wide and ≤520 px tall) the top bar drops to 44 px, the design bar to 40 px, the three-step hint steps aside and the status bar floats over the canvas instead of holding a grid row, which lifts the canvas from about 37 % to about 58 % of a 740 × 360 viewport (below 400 px of height the design bar gives way entirely so the drawing area survives); every sheet is capped at `100vh − top bar − tab bar − 16 px`, and at `100dvh` where supported so the mobile URL bar cannot push a sheet past the screen; at ≤560 px every tab, chip, menu row and icon button reaches the 44 px `--control-tap`, the preset and document names truncate with an ellipsis, and the page itself may not scroll sideways (`overflow-x: clip` on `body`, one row of overflow on the header only). Wide tables — OTDR events (850 px), BOM quotation (720 px), the BOM subscriber budget (860 px) and the landing spec sheet (580 px) — scroll inside their own wrapper, so a phone never scrolls the page sideways, and the phone tool strip wraps rather than scrolls so its ⋯ menu is never clipped; `.pu-sb-detail` caps the status sheet at 40 vh on desktop and 68 vh on phones; and the empty-canvas hint is offset so it clears the floating tool strip.

The theme tokens are used by both the landing and the existing React Flow workbench. Status colors remain semantically distinct; telemetry values and statuses are still calculated by the simulator, not the stylesheet or prototype artwork.

### 2.2 Warm photonic landing and splice interaction

The landing page ports the redesign's dusk fiber-splice SVG into the React experience. A press-and-hold action animates the splice before opening the studio; a direct “open the studio now” link remains available for keyboard/screen-reader users. The adjacent receive-power readout is selected from the active studio simulation. When Auto is off and the run is stale, the readout says it is showing the last committed run.

The existing interactive waveguide is preserved below the introductory hero. Its presentation-only reference model uses the fused-silica Sellmeier equation to show wavelength dispersion. A fixed illustrative core/cladding index step is calibrated to the approximate 82° reference at 1490 nm, and the near-unchanged ray path is labeled as schematic rather than visually exaggerated. The 1:4 branch readout uses the shared splitter catalogue loss; its arithmetic is dBm launch power minus dB insertion loss. The live graph engine remains authoritative for editable network budgets.
---

## 3. What a learner can do today

### 3.1 Starting state

The app opens on the warm landing hero. **Launch Interactive Studio** is the primary action; holding the optional **HOLD TO FUSE THE SPLICE** pill on the fibre scene plays the fusion animation and opens Studio too. The receive-power panel reports the weakest subscriber (ONT or gateway) in the current simulator result and marks the last committed reading when Auto is off and edits are stale. Below the hero, one slider drives the 1490 nm waveguide demo at +5.0 dBm with the per-branch 1:4 PLC readout, and model caveats sit behind a **Model scope & assumptions** disclosure. Studio opens on an **empty canvas** with a short dismissible mission hint; the TopBar exposes all three presets, including **MODERN 10G XGS-PON SUBURB**, and the landing quick-load buttons load the standard or failing-link scenario directly.

### 3.2 Place and connect components

The left-hand **Component Library** keeps all eight modeled element kinds in a five-category accordion (plus a **Tools** group). No component was removed to make room:

| Category               | Contents                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OLT / Headend**      | OLT transceiver — the network's optical source; ODF rack panel — two isolated matched input/output adapter through-pairs at the headend.                             |
| **Fiber Cables**       | One card driven by a **Cable type** selector: feeder, distribution or drop.                                                                                          |
| **Splitters**          | One card driven by a **Splitter ratio** selector (1:2 … 1:64) that prints the selected ratio's insertion loss.                                                       |
| **Splices & Closures** | Dome splice closure (representative FOSC-style OSP joint enclosure) and Outdoor NAP/FAT (one feeder input, eight subscriber drop outputs, fixed internal 1:8 split). |
| **Customer / ONT**     | ONT/ONU subscriber optical endpoint; Wi-Fi 6 PON gateway (integrated GPON/XGS-PON termination plus home service telemetry).                                          |
| **Tools**              | Optical power meter and OTDR trace launchers.                                                                                                                        |

Only one category is open at a time and every header carries a count badge; up to four recently used parts sit as one-click shortcuts under the search box. Search spans every category at once and labels each hit with its category name. The library header has a collapse toggle, and the "Need help?" links that used to sit in its footer live on the Settings screen's Workspace card.

A component can be dragged to the canvas, or clicked to place it at the visible canvas centre. On phones the library is a bottom sheet summoned by the **+ Components** button: drag its handle up to expand, down to shrink or dismiss, and tap a part to drop it on the canvas and close the sheet — no drag-and-drop required on touch. Components connect by dragging from a source handle to a target handle or by using **Link nodes**: click a source node, then a destination; selecting an existing source/destination pair removes its patch cord. Press Escape or Cancel to leave link mode. The app uses a directed graph, and the simulation follows connections outward from an active OLT.

Splice trays are a property of the closure's Inspector panel, and patch cords/connectors are the graph's edges rather than placeable nodes, so neither appears as a library card; the closure category says so in a footnote.

Every canvas node now shows a compact SVG hardware thumbnail while retaining its existing label, metrics, and connection handles. The visual handles are:

- OLT: one output.
- Fiber span: one input and one output.
- Splitter: one input and a limited number of visible output handles.
- Dome closure: two input entries and four branch outputs. Branch handles A–D map to the Blue–Brown tray channels; the other eight colors are spare strand positions in this cable-level graph.
- ODF: two inputs and two outputs; each input is routed only to its matching numbered output pair.
- NAP/FAT: one input and eight drop outputs; each valid output applies the internal split loss once.
- ONT and gateway: one optical input each.

When a splitter ratio is changed, the app removes wires attached to output handles that no longer exist. A new wire to an ONT, gateway, or NAP replaces that endpoint's prior incoming wire. A new outgoing wire from an OLT or fiber span replaces its previous outgoing wire. ODF input/output pairs are isolated in both the connection and simulation logic.

### 3.3 Inspect and edit

Click a node or an optical patch cord to open the right-hand **Inspector**. The panel only exists while something is selected: it appears on selection, closes from its **X** (or a downward swipe on a phone), and the canvas reflows to take the freed width. It opens on the **Properties** tab with just the everyday fields — name, type, ratio or length, and the resulting insertion loss — and folds every table, allowance and reference note into a closed **Advanced** disclosure. Three tabs remain: **Properties**, **Optical Power** (live telemetry and the per-segment link budget) and **Info** (the Field Hardware Card).

The essentials per type are the fields an engineer edits while drawing; everything else is one click away under **Advanced**:

- OLT port name, PON standard, operating wavelength, transceiver class and laser state; **Advanced** adds transmit power, the class budget/sensitivity metrics and the line-rate note. GPON retains its existing wavelength behavior; XGS-PON shows 1577 nm downstream / 1270 nm upstream references and symmetrical 9.953 Gbps line rate.
- Splitter ratio with its insertion loss (and branch-port count); **Advanced** adds the ratio/loss table, excess-uniformity slider and the port list.
- Fiber type and span length with the span's total loss and attenuation; **Advanced** adds wavelength, the attenuation override, splice/connector counts, the independent macro-bend / dirty-ferrule toggles and the port note.
- Dome closure: the switchable 12-color tray with heat-shrink sleeve indicators; **Advanced** adds the through-splice allowance and the two-entry/four-branch note.
- ODF 0.50 dB educational through-loss setting; **Advanced** adds the matched-pair port counts and reference note.
- NAP/FAT fixed 1:8 ratio and branch split loss; **Advanced** adds the 1-input/8-output port counts and reference note.
- ONT subscriber name/serial plus a live Rx/margin readout; the status banner and the full path-loss breakdown sit in **Optical Power**.
- Wi-Fi gateway subscriber/serial and editable SSID; **Optical Power** carries optical receive/status, PON standard and line rates, the split-derived down/up estimate, and the simulated IPv4 placeholder when online. The 192.0.2.x TEST-NET value is illustrative; DHCP, routing, and Internet reachability are not modeled.
- For a patch cord, the carried power/state and a delete action. In **OPM Tool** mode, probing a port or cord opens the wavelength-calibrated power HUD.
- **Remove component** (or **Delete patch cord**) as a red action at the foot of the panel, behind a two-step confirm so a stray tap cannot delete.

The USD reference rates live with the money they change: **Local unit pricing** now sits under the Bill of Materials' _Commercial Quotation & CAPEX_ tab, not in the Inspector. Edits immediately update the CAPEX banner in Reports, the quotation, exports, and cost-based mission objectives; they never change an optical loss or receiver status. Reset restores the app's baseline estimates.

When a node is selected, the Inspector now begins with a **Field Hardware Card**. It shows the subtype-specific large SVG reference, current configuration, practical explanation, port/construction list, field tips, and a collapsible datasheet-context section. The card labels its artwork as a representative illustration, not a photograph or exact product model. Selecting an edge does not show a hardware card.

The **Optical Power** tab explains the calculation and lists individual losses for connected ONTs or gateways, including ODF and NAP segments. Nodes and wires can be removed from the Inspector; canvas items can also be selected and deleted with Backspace/Delete.

### 3.4 Watch the simulation

With **Auto** on, the network calculation updates as relevant values change. With Auto off, the top bar's **Run Simulation** button commits the next run; after a previous test, changes are marked as a stale/unsaved optical budget until the next run. Per-subscriber status and the live project CAPEX are reported in the canvas status bar and in Reports rather than the top bar. The price calculation updates independently of Auto and the committed optical simulation.

The canvas draws moving dashed lines to make live or degraded optical links easier to notice. Each link is labeled with its calculated power at the far end. A minimap, pan/zoom controls, and canvas grid help navigate larger designs.

#### Virtual handheld OPM

Choose **OPM Tool** on the Settings screen (it hands the screen back to Design and arms the probe), then hover or tap a node body, input/output handle, or optical edge. The floating meter displays the simulator-backed power at that port/edge, offers 1310, 1490, and 1550 nm calibration choices, and can store a relative dB reference. It reports `LO` if no modeled light arrives and `UNDER` below its illustrative −60 dBm range. Escape or **Close OPM** exits probe mode. While active, node dragging and connecting are suspended; pan/zoom remains available. Probe hover only updates React state when the target changes; pointer positioning for the HUD is a direct DOM style update so normal canvas panning remains available.

The meter re-simulates the current graph with the selected calibration wavelength on its own copy of the node data; it does not mutate the design topology or the committed studio budget. These wavelength-specific readings are model estimates, not OTDR or actual instrument readings.

#### Interactive OTDR trace analyzer

Choose **OTDR Trace** in the TopBar to open the instrument drawer. Select an OLT output or fiber span as the launch source, choose a reachable ONT or gateway branch, select 1270/1310/1490/1550/1577 nm, and choose a 10, 100, or 1000 ns pulse. **Acquire Trace / Pulse Laser** animates a scanline before the deterministic route trace and event table appear. Hover the chart for a live distance and backscatter-level readout.

The SVG chart uses a 0–35 km and +5 to −45 dB grid, displays 100–300 samples, and marks launch reflections, continuous fiber spans, connector returns, ODF/NAP/splitter insertion steps, fusion/closure splices, macro-bend/dirty-ferrule fault steps, and the terminal ONT/gateway Fresnel reflection followed by the −45 dB noise-floor drop. The event table lists signed loss steps, cumulative one-way loss, apparent reflection peaks, and pass/warning/fail assessments.

`src/engine/otdrSimulator.ts` is pure TypeScript with no React dependencies. It finds a directed path using the existing node-as-fiber-span graph and leaves CAPEX calculations independent. The selected wavelength sets reference attenuation (0.35 dB/km at 1270/1310 nm, 0.25 at 1490 nm, 0.20 at 1550 nm, and 0.22 at 1577 nm); configured per-span attenuation overrides are honored. The pre-existing 1550 nm coefficient and trace behavior remain covered by tests. Since the graph stores splice and connector totals rather than measured locations, those event markers are evenly distributed along a fiber span. Event peaks, noise floor, and pass/fail thresholds are illustrative diagnostics, not calibrated OTDR specifications or live measurements.

#### Closure and field-fault behavior

The FOSC-style closure has two input handles and four output branches. Each outgoing branch maps to a tray channel; only an active channel carries light, with one adjustable 0.05–0.10 dB through-splice allowance (default 0.08 dB). The Inspector's 12 color-coded switches mark tray occupancy/sleeves; branches A–D map to the first four color channels, while channels 5–12 are reserve positions in this simplified cable-level abstraction. The generic SVG profile says “up to 48 splices / IP68 reference”; neither value is a claim about every closure—verify the exact product, tray, seals, and rating.

Fiber spans expose independent **Macro-bend fault (<15 mm)** and **Dirty SC/APC ferrule** switches. The simulator adds +3.50 dB and +2.00 dB respectively as separate path segments; these are explicit teaching allowances, not universal measured losses. A warning glyph appears on the span's outgoing cord when either fault is active.

### 3.5 Use a preset or inspect the inventory

The workbench is four sections — **Design → Simulation → Reports → Settings** — and only one screen mounts at a time. The top bar holds four things: the logo (back to Overview & Physics), the project name with an **Edited** marker, the zoom percentage and the primary **Run Simulation** button. Presets, the first-run hint and the stale-budget chip sit on the design bar above the canvas. The floating **canvas toolbar** keeps only the drawing tools — Select, Pan, Connect and a selection-aware Delete, then Zoom out, Zoom in and Fit with tooltips. Its **⋯** overflow is deliberately canvas-only: fit view, zoom to 100 % and snap to grid. Nothing in it duplicates a Settings control — app-level actions (Overview & Physics, OPM, OTDR Trace, missions, safety margin, Auto-run, Clear canvas, help links) live on the Settings screen — and adding components is the library's job rather than a toolbar button. The estimated CAPEX and cost per home passed are printed on the Reports banner, not in the top bar. The studio is a four-column grid — rail · component library · canvas · inspector — whose widths come from `tokens.css` (`--rail-w`, `--library-w`, `--inspector-w`, `--topbar-h`) with one flexible canvas column (`minmax(0, 1fr)`). One gutter, `--shell-gap`, separates the tab strip, canvas and status bar, and `--shell-pad` aligns the top bar, library title, inspector title and every panel edge on the same vertical line. The status bar is one slim in-flow row pinned under the canvas; expanding it opens an absolutely positioned panel capped at 40 vh, so the canvas never gives up height for it. Column widths step at 1280 px (rail 64, library 208, inspector 264), 1024 px (56 / 184 / 240) and 900 px.

At or below 900 px the workbench becomes canvas-first: the icon rail stays fixed while the component library and the Inspector float above the canvas (opening the Inspector on selection) instead of squeezing it out of the row, and the minimap is hidden. The 560 px breakpoint collapses popovers into a full-width sheet under the top bar. The OTDR analyzer and the mission drawer are labelled `aria-modal` dialogs that close on Escape or a backdrop click, trap Tab inside themselves and return focus to the control that opened them, and only one can be open at a time; the Bill of Materials is the Reports screen rather than an overlay. The project name in the top bar marks a topology as **Edited** once it deviates from the preset it was loaded from. A first-run hint on the design bar spells out the three steps — pick a component, connect them, press Run Simulation — and stays dismissed on that device (it is remembered in `localStorage`). Section moves push a history entry each (`history.pushState`, URL and hash untouched), so the browser Back button and the phone back gesture walk the same Design → Simulation → Reports → Settings path; opening a section moves keyboard focus to its heading.

**Simulation** is the focused read-out screen: total loss, total distance, subscribers OK and the upstream differential, the four optical-budget anchors, and a subscriber table where every row jumps back to that component on the Design canvas. **Reports** is the Bill of Materials itself (Optical Budget Audit and Commercial Quotation & CAPEX tabs, the CAPEX banner and the deployed-components list) rendered as a page instead of a dialog: it carries a **Back to Design** button, closes on Escape, and renders as a `<main>` landmark with an `<h1>` title over `<h2>` section headings; every BOM table scrolls inside its own box. **Settings** collects the simulation options (global safety margin, Auto-run), the test gear (OPM, OTDR, missions) and the workspace actions (Overview & Physics, Clear canvas, help links).

The BOM has an **Optical Budget Audit** view and a **Commercial Quotation & CAPEX** view. The commercial view groups detailed quotation lines into Cables, Passives, Active Gear, and Labor & Splicing, and reports material subtotal, labor subtotal, total project CAPEX, cost per home passed, and cost per connected subscriber. Export actions include:

- Combined CSV with commercial line items, financial summary fields, and ONT/gateway optical-service results.
- Version-2 JSON with topology/settings/simulation plus currency, resolved local unit rates, commercial breakdown, and subscriber cost metrics.

JSON export is implemented; **JSON import and automatic project saving are not currently implemented**.

### 3.6 Practice field missions

Open **Missions** on the Settings screen (the button reports the active mission), or choose **Explore Guided Missions** on the landing page to launch a scenario. Starting one loads a fresh copy of its existing preset, applies the mission setup, turns on Auto, restores the mission's safety-margin target, clears selection, and fits the graph. Objective progress is evaluated from the live simulation and graph state; hints are available in the drawer and a completion summary appears when every objective is met.

- **The Marginal Villa:** starts from the Standard 1:32 tree with one marginal subscriber. Bring all three connected ONTs into the ONLINE window, preserve exactly 2.0 dB safety margin, and keep OLT launch power at or below +5.0 dBm.
- **Diagnose the Silent ONT:** starts from the Failing Long-Distance Link with `olt-b` laser switched off. Re-enable an OLT source, restore an optical path to Dukan Ridge — Tower 7, and bring that target ONT into the ONLINE window.
- **Rescue the Unpatched Subscriber:** starts from the same long-haul preset with Dukan Ridge — Not Yet Wired unpatched. Connect the 1:16 splitter's `out-2` handle to its drop, connect the drop to the ONT, then reduce cascaded split loss until that subscriber is ONLINE. Optional macro-bend and dirty-ferrule switches add separate educational penalties to the path breakdown.
- **The Budget Crunch: Cost vs. Performance:** connect all three homes, keep every ONT ONLINE (−24 to −8 dBm), stay below $1,600 total reference CAPEX, and preserve at least 2 dB global safety margin. The default topology starts over budget; shorten spans and adjust the layout without sacrificing optical acceptance. Editable local rates are shared by the TopBar, quotation, export, and objective evaluation.
- **Blind Fault: The Cut in the Trunk:** a neighborhood distribution branch outage with visual fault badges and warning glyphs disabled on the canvas (`blindFaultMode`). Use the handheld OPM probe and launch an OTDR laser trace from the Central Office to locate the exact break distance where the backscatter curve drops to the −45 dB noise floor, remove the faulty/severed span, splice in a healthy replacement distribution span, and restore all affected subscribers to ONLINE status (−8 to −24 dBm).

These are guided practice missions, not a scored course. They do not add graph component types or change the simulator's core equations.

---

## 4. Current component model

The current toolbox has eight graph kinds. These are network abstractions, not a catalogue of exact manufacturer part numbers.

| Component           | Current modeled fields                                                                                                      | Typical use in the network                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **OLT**             | PON port name, class B+/C+, transmit power, laser on/off, wavelength                                                        | Launches downstream light into the network.                                                          |
| **Splitter**        | 1:N ratio, optional excess loss                                                                                             | Divides a PON path into branches and adds insertion loss.                                            |
| **Fiber span**      | Feeder/distribution/drop type, length, splices, connectors, wavelength, optional attenuation override, optional fault flags | Represents a physical cable segment, its losses, and the separate educational bend/ferrule faults.   |
| **Dome closure**    | Two input handles, four branch outputs, 12 active tray channels, configurable 0.05–0.10 dB through-splice allowance         | Represents an outside-plant splice enclosure; each modeled branch applies one active through-splice. |
| **ONT/ONU**         | Subscriber label, serial number, informational receiver sensitivity                                                         | Simple subscriber optical endpoint with calculated receive telemetry.                                |
| **ODF rack panel**  | Two matched input/output pairs; default 0.50 dB through allowance                                                           | Patches headend OLT ports to feeder fibers. Each pair is isolated, not cross-connected.              |
| **Outdoor NAP/FAT** | One input, eight outputs; fixed 1:8 split and default 10.5 dB loss                                                          | Distributes an outside-plant feeder to up to eight modeled drop branches.                            |
| **Wi-Fi 6 gateway** | Subscriber/serial, SSID, TEST-NET IPv4 placeholder, informational sensitivity                                               | Integrated GPON/XGS-PON endpoint with optical/status and topology-derived service telemetry.         |

Important modeling details:

- A fiber span is a **node**, not just an edge. This lets it own its length and loss inputs. The connecting edge is an idealized patch/connection that carries telemetry but adds no loss itself.
- The OSP closure is also a **node**. It passes light through active branch handles with one configured splice allowance per traversed branch; its tray switches identify fiber-channel occupancy. Branches A–D map to channels 1–4; the other eight tray slots are not separately addressable in the graph.
- ODFs and NAP/FATs are graph nodes, not patch-cord edges. Each ODF input is constrained to its paired output and adds 0.50 dB once per through-path. A NAP accepts one feeder input; each valid output contributes one fixed 10.5 dB 1:8 split and one split stage. These are explicit educational defaults, not calibrated or universal product values.
- The virtual OPM runs the pure simulator against a copy of the graph retuned to its selected wavelength, then reads the requested handle/edge telemetry. This does not alter the editor's node data.
- The splitter ratios are 1:2, 1:4, 1:8, 1:16, 1:32, and 1:64. The canvas exposes one patchable branch handle per connectorised output up to 1:16 (`splitterBranchPortCount` in `src/types.ts`), so a 1:8 splitter can feed eight drops. A 1:32 or 1:64 cassette is ribbon-pigtailed in practice, so those two ratios stop at 16 branch ports and the node, the splitter's Advanced port list, and the inspector type line all say so. Handle count, patch-cord pruning when a ratio is reduced, Link-mode port assignment, and connection validation all read from the same helper.
- ONT and gateway `sensitivityDbm` are informational fields; the status classifier retains the shared receive thresholds instead of applying per-device sensitivity values.
- OLT class receive-sensitivity and nominal link-budget values are displayed as reference information. The current traversal does not use those values as a separate pass/fail calculation.

### Factory defaults for newly placed elements

- **OLT:** Class B+, +3 dBm, laser on, 1490 nm.
- **Splitter:** 1:8, with zero extra loss.
- **Feeder fiber:** 5 km, 0 splices, 2 connectors.
- **Distribution fiber:** 1 km, 2 splices, 2 connectors.
- **Drop fiber:** 0.3 km, 1 splice, 2 connectors.
- **ONT:** automatically generated subscriber name/serial and an informational sensitivity of −28 dBm.
- **ODF:** two matched input/output pairs and 0.50 dB reference through loss.
- **NAP/FAT:** one input, eight drops, fixed 1:8 ratio, and 10.5 dB reference loss.
- **Wi-Fi 6 gateway:** generated serial, subscriber, and SSID; reserved 192.0.2.x service-address placeholder; informational sensitivity of −28 dBm.
- **Global safety margin:** 2 dB.

Changing the cable preset in the Inspector resets that fiber span's length and splice/connector defaults to the selected cable preset. A learner can then adjust the values.

---

## 5. How the optical calculation works

The simulator is a small, deterministic graph calculation. Its main formula is:

```text
P_rx = P_tx − (fiber loss + splitter loss + ODF through loss + NAP split loss + splice loss + connector loss + field-fault penalties + closure through-splice + safety margin)
```

It starts at each OLT whose laser is enabled, follows outgoing connections, adds losses at fiber/passive-equipment nodes, and records a completed path when it reaches an ONT or gateway.

### 5.1 Fiber losses

For each fiber span:

```text
fiber loss = length in km × attenuation in dB/km
splice loss = splice count × 0.1 dB
connector loss = connector count × 0.5 dB
macro-bend penalty = +3.5 dB when enabled (instructional fixed allowance)
dirty ferrule penalty = +2.0 dB when enabled (instructional fixed allowance)
span total = fiber loss + splice loss + connector loss + active fault penalties
```

Default attenuation is:

| Wavelength | Default attenuation | Direction represented in the UI                     |
| ---------- | ------------------: | --------------------------------------------------- |
| 1270 nm    |          0.35 dB/km | XGS-PON upstream reference (not simulated upstream) |
| 1310 nm    |          0.35 dB/km | GPON upstream / OPM reference                       |
| 1490 nm    |          0.25 dB/km | GPON downstream reference                           |
| 1550 nm    |          0.20 dB/km | OPM calibration / diagnostic reference              |
| 1577 nm    |          0.22 dB/km | XGS-PON downstream reference                        |

For GPON routes, each fiber node uses its own selected wavelength unless the learner supplies a positive attenuation override. XGS-PON routes use the downstream 1577 nm reference through all spans, unless a per-span override is set. Changing a fiber wavelength clears that override. These are simplified educational coefficients, not universal cable constants; preserve the existing 1550 nm value as a diagnostic/OPM reference.

When the OPM selects a wavelength, it re-simulates a retuned copy of the current topology and samples the requested port or patch-cord telemetry. An unlit path shows `LO`; readings below the meter's illustrative −60 dBm floor show `UNDER`. Relative `REF` mode displays the difference from the stored reference in dB. This is not a wavelength-selective hardware instrument or an OTDR measurement.

#### ODF through-port model

The ODF contains two independent matched input/output adapter pairs. The simulator routes `in-0` only to `out-0` and `in-1` only to `out-1`; it does not cross-connect pairs. One traversed pair adds the default 0.50 dB reference allowance, reported as a distinct ODF segment. This value represents a simplified mated through-path, not a calibrated connector measurement or universal adapter loss.

#### NAP/FAT 1:8 model

The outdoor NAP/FAT accepts one modeled feeder input and eight drop outputs. Each connected output branch adds one fixed 10.5 dB 1:8 split-loss reference and increments cumulative split ratio by eight. The reference is intentionally explicit and fixed for learning; real insertion loss, balance, weather sealing, and connector performance depend on the selected product and installation.

#### Dome closure through-splice model

The closure applies one adjustable `spliceLossDb` per active outgoing branch, clamped to 0.05–0.10 dB (default 0.08 dB). The path segment is labeled with the closure and the matching branch channel. The 12-tray occupancy indicators are strand-level learning UI; only output branches A–D (tray channels Blue through Brown) map into this cable-level graph. Active spare tray channels do not multiply a subscriber path's loss.

### 5.2 GPON and XGS-PON standards

The OLT Inspector retains GPON as the default and adds a PON-standard selector:

| Standard                 | Downstream | Upstream | Nominal line rate  |
| ------------------------ | ---------- | -------- | ------------------ |
| GPON (ITU-T G.984)       | 1490 nm    | 1310 nm  | 2.488 / 1.244 Gbps |
| XGS-PON (ITU-T G.9807.1) | 1577 nm    | 1270 nm  | 9.953 / 9.953 Gbps |

The simulator changes fiber attenuation to the XGS-PON downstream reference of 0.22 dB/km when the OLT is set to XGS-PON. The upstream wavelength/rate are shown as nominal capability only; reverse-path physics and XGS-specific optical-class budgets are not modeled. Connected Wi-Fi gateways surface the selected standard, line rates, `XGS-PON 10G ACTIVE` badge, receive power, and an equal-share estimate (nominal line rate ÷ cumulative split ratio). It is not an Internet speed test; protocol overhead, contention, plan limits, LAN and Wi-Fi conditions are not simulated.

### 5.3 Splitter losses

The splitter loss catalogue currently used is:

| Split ratio | Modeled insertion loss |
| ----------: | ---------------------: |
|         1:2 |                 3.7 dB |
|         1:4 |                 7.2 dB |
|         1:8 |                10.5 dB |
|        1:16 |                13.8 dB |
|        1:32 |                17.5 dB |
|        1:64 |                20.8 dB |

The Inspector's **Excess / uniformity loss** is added to the catalogue value. Actual splitters vary by manufacturer and model, so a future exact-hardware profile should use the selected unit's documented insertion-loss data and identify its source.

### 5.4 OLT classes and transmit power

| Class | Default launch power | Stored transmit range | Displayed receiver sensitivity | Displayed nominal link budget |
| ----- | -------------------: | --------------------: | -----------------------------: | ----------------------------: |
| B+    |               +3 dBm |        +1.5 to +5 dBm |                        −28 dBm |                         28 dB |
| C+    |               +5 dBm |          +3 to +7 dBm |                        −32 dBm |                         32 dB |

Selecting a class sets its default transmit power. The Inspector then permits a wider manual transmit-power range; this is useful for experiments but does not enforce the class-specific minimum/maximum values stored in the catalogue.

### 5.5 Safety margin and receiver status

The global safety/ageing/repair allowance defaults to 2 dB and is subtracted on every completed OLT-to-subscriber path. It is clamped to a non-negative value in the simulation.

The current receiver status thresholds are:

| Status           | Current rule                          | Meaning shown in the app                       |
| ---------------- | ------------------------------------- | ---------------------------------------------- |
| **OVERLOAD**     | Receive power greater than −8 dBm     | Receiver saturation / potential overload risk. |
| **ONLINE**       | −24 dBm through −8 dBm inclusive      | Inside the modeled optimal window.             |
| **WARNING**      | −28 dBm through below −24 dBm         | Marginal receive level.                        |
| **LOS**          | Below −28 dBm                         | Loss of signal.                                |
| **DISCONNECTED** | No active path, or no receive reading | No active OLT route reaches the ONT.           |

At exactly −28 dBm the current code returns **WARNING**; LOS begins below −28 dBm. ONTs, gateways, and XGS-PON endpoints share these existing GPON-oriented app thresholds; separate receiver-class limits are not modeled. These are learning thresholds, not universal device limits.

The UI's `marginDb` is calculated as the distance above the −28 dBm LOS floor. It is not the same thing as a full vendor-specific engineering margin against a particular transceiver class.

### 5.6 Graph and telemetry behavior

- All active OLTs are simulated. If multiple OLT paths reach the same ONT or gateway, candidate paths are kept, sorted by receive power, and the strongest path is primary.
- A visited-node guard and maximum traversal depth protect the engine from cycles or an unexpectedly deep graph.
- Each edge reports the strongest power found on it. An edge is **live** at or above −28 dBm, **degraded** below −28 dBm when light is present, and **idle** if no enabled OLT path reaches it.
- Network totals count placed physical nodes, including unconnected fiber spans. The mean receive power includes all ONT and gateway subscriber endpoints that have a reading.
- Health status and subscriber counts include both endpoint types. The detailed table/export retains each endpoint's actual status.
- `allOptimal` is true only when there is at least one subscriber endpoint and every endpoint is ONLINE. `hasFault` is based on LOS/disconnected states; the top-bar health strip separately shows warnings/overload as amber.
- **Upstream burst-mode dynamic range (ITU-T G.984.2 reference):** the simulator (`simulateTopology` / `simulatePON`) computes $\Delta P_{\text{upstream}} = P_{\text{rx, max}} - P_{\text{rx, min}}$ across active connected endpoints on each OLT PON port. When `upstreamDeltaDb > 15.0` dB, `upstreamDynamicRangeWarning` is flagged, the OLT node and TopBar show `⚠️ Dynamic Range Exceeded (Delta: X.X dB > 15 dB max) — Attenuate near-end ONTs`, and the BOM optical table lists each subscriber's upstream differential (`Upstream Δ`).

### 5.7 Independent CAPEX and quotation model

`src/data/pricingCatalogue.ts` is a pure, deterministic estimator over the graph's nodes and edges. It does **not** import the optical simulator, alter traversal, add loss terms, or affect received power. The calculation reports quantities and cost line items by Cables, Passives, Active Gear, and Labor & Splicing, reconciling materials + labor to total CAPEX.

The supplied default USD reference rates are editable for the current workspace session in the Inspector's **Local unit pricing** panel:

| Line item                                        |                                       Baseline reference rate |
| ------------------------------------------------ | ------------------------------------------------------------: |
| Feeder / OSP cable                               |                                                     $350 / km |
| Distribution cable                               |                                                     $250 / km |
| Drop cable                                       |                                                     $150 / km |
| Fusion-splice labor                              |                                       $12.50 / counted splice |
| SC/APC connector termination                     |                                         $4.00 / connector end |
| PLC splitter                                     | 1:2 $14 · 1:4 $18 · 1:8 $26 · 1:16 $42 · 1:32 $68 · 1:64 $120 |
| FOSC-style dome closure                          |                                                    $85 / each |
| OLT PON port module (C+ reference)               |                                                   $240 / each |
| ODF rack panel / 2-pair through panel            |                                                   $110 / each |
| Outdoor NAP/FAT with fixed internal 1:8 splitter |                                                    $65 / each |
| ONT                                              |                                                    $55 / each |
| Wi-Fi 6 GPON/XGS-PON gateway                     |                                                    $85 / each |

Cable cost is length in km multiplied by the node's feeder/distribution/drop rate. Material and labor are reported separately; fusion splices and SC/APC connector terminations are grouped as labor. Closure splice labor counts active outgoing branches represented by the topology. Subscriber summaries count ONTs and Wi-Fi gateways: CAPEX per home passed uses placed subscriber endpoints, and cost per connected subscriber uses ONTs/gateways reachable in current simulator telemetry. With no connected subscriber, the UI shows an em dash and the numeric export field is zero.

All rates are user-supplied educational baseline estimates, not universal market facts or vendor-specific quotes. They are intentionally not presented as procurement, construction, installed-price, or certified design numbers. Taxes, local labor differences, logistics, currency conversion, contingency, and vendor quotes are outside the current model. Changing them affects CAPEX, commercial exports, and cost objectives only.

---

## 6. The three included network presets

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

### 6.3 MODERN 10G XGS-PON SUBURB

The third selectable preset models an XGS-PON headend through an ODF, feeder, dome closure, distribution cable, outdoor NAP/FAT, three short drops, and Wi-Fi 6 gateways:

```text
XGS-PON OLT → ODF → 3.5 km feeder → dome closure → 1.2 km distribution
→ 1:8 NAP/FAT → three 150 m drops → three Wi-Fi 6 gateways
```

The ODF contributes 0.50 dB through loss; the NAP contributes its fixed 10.5 dB internal 1:8 split. Gateway paths are 4.85 km and use three per-drop branches. With preset OLT power +5 dBm and global 2 dB margin, the modeled subscriber receive power is approximately −12.45 dBm; the gateway rate estimate is 9.953 Gbps ÷ 8 ≈ 1244 Mbps in each direction. These readings/rates are simulator estimates, not measurements or service guarantees. The topology is designed for OTDR traces to each gateway.

---

## 7. Architecture and source-code map

The app is a client-side React/TypeScript application. There is no backend service in the current repository. The table is exhaustive for the version-controlled leaf files in this layout; each path appears once, and path prefixes show its folder.

| File or folder                                              | Responsibility                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`                                  | Continuous-integration workflow for `main`, pull requests, and manual dispatch.                                    |
| `.github/workflows/deploy.yml`                              | GitHub Pages build and deployment workflow.                                                                        |
| `.editorconfig`                                             | Shared encoding, line-ending, indentation, and whitespace rules.                                                   |
| `.gitignore`                                                | Ignored dependency, build, environment, cache, editor, and OS artifacts.                                           |
| `.nvmrc`                                                    | Node.js 22 selector.                                                                                               |
| `.prettierrc.json`                                          | Project Prettier formatting policy.                                                                                |
| `LICENSE`                                                   | MIT licence for FiberLAB.                                                                                          |
| `README.md`                                                 | Project overview, quick start, live link, and high-level source map.                                               |
| `THIRD_PARTY_NOTICES.md`                                    | SIL OFL notices for runtime Google Fonts.                                                                          |
| `docs/PROJECT_GUIDE.md`                                     | This detailed product, architecture, and operating guide.                                                          |
| `docs/design/hardware-ui-mock.html`                         | Archived self-contained hardware UI mock.                                                                          |
| `docs/design/hardware-ui-mock.md`                           | Archived design-reference notes for the mock.                                                                      |
| `docs/design/workbench-reference.jpg`                       | Archived workbench visual reference.                                                                               |
| `eslint.config.js`                                          | Flat ESLint policy for TypeScript source and Node-side configuration.                                              |
| `index.html`                                                | Vite document shell and runtime Google Font imports.                                                               |
| `package.json`                                              | Package metadata, scripts, Node requirement, and dependencies.                                                     |
| `package-lock.json`                                         | Exact npm dependency resolution.                                                                                   |
| `postcss.config.js`                                         | PostCSS plugin configuration.                                                                                      |
| `tailwind.config.js`                                        | Tailwind content scanning and retained theme extensions.                                                           |
| `tsconfig.json`                                             | Strict TypeScript compiler configuration.                                                                          |
| `vite.config.ts`                                            | Vite and React plugin configuration.                                                                               |
| `vitest.workspace.ts`                                       | Separate app and engine Vitest projects.                                                                           |
| `src/App.tsx`                                               | Persistent studio shell, graph state, simulations, CAPEX, and top-level composition.                               |
| `src/main.tsx`                                              | Browser entry point and ordered global stylesheet imports.                                                         |
| `src/types.ts`                                              | Shared graph, simulation, optical, and UI type definitions.                                                        |
| `src/vite-env.d.ts`                                         | Vite ambient type declarations.                                                                                    |
| `src/__tests__/app.test.tsx`                                | Mounted application regression tests.                                                                              |
| `src/assets/opm-probe-cursor.svg`                           | Bundled cursor image for OPM probe mode.                                                                           |
| `src/assets/splice-hero-scene.svg`                          | Raw SVG scene rendered by the splice introduction.                                                                 |
| `src/context/SimulationContext.ts`                          | React context that shares the current simulation result with custom nodes.                                         |
| `src/data/componentCatalogue.ts`                            | Framework-independent hardware profiles and inline SVG illustration data.                                          |
| `src/data/hardwareArtwork.ts`                               | Reusable hardware art data and geometry helpers.                                                                   |
| `src/data/pricingCatalogue.ts`                              | Pure graph-derived CAPEX calculator and local-rate defaults.                                                       |
| `src/data/__tests__/commercialQuoteExports.test.ts`         | Commercial quotation JSON and CSV export tests.                                                                    |
| `src/data/__tests__/componentCatalogue.test.ts`             | Hardware catalogue tests.                                                                                          |
| `src/data/__tests__/pricingCatalogue.test.ts`               | CAPEX and local-pricing calculator tests.                                                                          |
| `src/engine/edgeDecoration.ts`                              | Maps simulation telemetry and faults to React Flow edge presentation.                                              |
| `src/engine/factories.ts`                                   | Creates graph node kinds with stable IDs and reference defaults.                                                   |
| `src/engine/missions.ts`                                    | Definitions and objective evaluators for five guided missions.                                                     |
| `src/engine/opticalPhysics.ts`                              | Pure waveguide optical-physics helpers used by landing visuals.                                                    |
| `src/engine/opticalProbe.ts`                                | Simulator-backed readings for nodes, ports, and edges at a meter wavelength.                                       |
| `src/engine/opticalSimulator.ts`                            | Pure PON graph traversal, loss, status, and summary calculation.                                                   |
| `src/engine/otdrSimulator.ts`                               | Pure directed-route OTDR event and backscatter trace generator.                                                    |
| `src/engine/presets.ts`                                     | Reference GPON, long-haul, and XGS-PON topology builders.                                                          |
| `src/engine/__tests__/missions.test.ts`                     | Mission evaluator tests.                                                                                           |
| `src/engine/__tests__/opticalPhysics.test.ts`               | Waveguide optical-physics tests.                                                                                   |
| `src/engine/__tests__/opticalProbe.test.ts`                 | Optical probe tests.                                                                                               |
| `src/engine/__tests__/opticalSimulator.test.ts`             | Optical graph simulation tests, including the public alias.                                                        |
| `src/engine/__tests__/otdrSimulator.test.ts`                | OTDR route and event generation tests.                                                                             |
| `src/engine/__tests__/xgsPon.test.ts`                       | XGS-PON standards and equipment tests.                                                                             |
| `src/styles/tokens.css`                                     | Design tokens: type scale, 4px spacing scale, radii, panel padding, control heights.                               |
| `src/styles/global.css`                                     | Tailwind layers, application-wide styles, and mission keyframes.                                                   |
| `src/styles/photo-ui.css`                                   | Photo-inspired studio UI overrides, loaded last.                                                                   |
| `src/styles/theme.css`                                      | Warm responsive landing and studio theme, including modal and hardware treatments.                                 |
| `src/test/setup.ts`                                         | Vitest setup and Testing Library matcher registration.                                                             |
| `src/components/BOMModal.tsx`                               | Optical audit and commercial quotation modal with exporters.                                                       |
| `src/components/CanvasToolbar.tsx`                          | Canvas-level editing, diagnostics, mission, and simulation controls.                                               |
| `src/components/FieldHardwareCard.tsx`                      | Reusable Inspector hardware illustration and field-context card.                                                   |
| `src/components/Inspector.tsx`                              | Selected node/edge editor: Properties / Optical Power / Info, Advanced disclosure, confirm-to-remove, phone sheet. |
| `src/components/MissionDrawer.tsx`                          | Guided-mission selection, objectives, hints, and completion recap.                                                 |
| `src/components/OpmMeterHud.tsx`                            | Floating optical power meter HUD.                                                                                  |
| `src/components/OpticalEdge.tsx`                            | Optical wire, power-label, and fault-warning renderer.                                                             |
| `src/components/OtdrModal.tsx`                              | OTDR controls, animated acquisition, SVG trace, and event table.                                                   |
| `src/components/PricingSettings.tsx`                        | Accessible local CAPEX-rate editor and reset controls.                                                             |
| `src/components/Sidebar.tsx`                                | Accordion component library, search, recently-used shortcuts, cable/splitter selectors, phone bottom sheet.        |
| `src/components/TopBar.tsx`                                 | Logo, project name + Edited marker, zoom percentage and Run Simulation.                                            |
| `src/components/SectionNav.tsx`                             | Section model plus the desktop rail and the phone bottom tab bar.                                                  |
| `src/components/DesignBar.tsx`                              | Preset picker, stale-budget chip and the dismissible first-run hint above the canvas.                              |
| `src/components/SimulationScreen.tsx`                       | Simulation step: budget anchors, subscriber results table, warnings.                                               |
| `src/components/SettingsScreen.tsx`                         | Settings step: safety margin, Auto-run, test gear, workspace actions and help links.                               |
| `src/components/StatusBar.tsx`                              | Always-on status bar: loss, distance, subscribers, status colour, optical budget bars and clickable events.        |
| `src/components/hardware/HardwareArt.tsx`                   | React component that renders reusable hardware illustrations.                                                      |
| `src/components/landing/LandingNav.tsx`                     | Landing-page navigation.                                                                                           |
| `src/components/landing/LandingView.tsx`                    | Landing-page composition and studio transition.                                                                    |
| `src/components/landing/PhotonicHero.tsx`                   | Physics hero, capability content, and five-scenario CTA.                                                           |
| `src/components/landing/PillarsGrid.tsx`                    | Landing capability-card grid.                                                                                      |
| `src/components/landing/SpecsStrip.tsx`                     | Landing optical reference specification strip.                                                                     |
| `src/components/landing/SpliceIntroHero.tsx`                | Hold-to-open splice interaction and live receive-power readout.                                                    |
| `src/components/landing/WaveguideCanvas.tsx`                | Interactive waveguide illustration.                                                                                |
| `src/components/landing/__tests__/SpliceIntroHero.test.tsx` | Splice interaction regression test.                                                                                |
| `src/components/nodes/ClosureNode.tsx`                      | Dome-closure React Flow node.                                                                                      |
| `src/components/nodes/FiberNode.tsx`                        | Fiber-span React Flow node.                                                                                        |
| `src/components/nodes/GatewayNode.tsx`                      | Wi-Fi PON gateway React Flow node.                                                                                 |
| `src/components/nodes/NAPNode.tsx`                          | Outdoor NAP/FAT React Flow node.                                                                                   |
| `src/components/nodes/NodePrimitives.tsx`                   | Shared LED, statistic, and badge primitives for node renderers.                                                    |
| `src/components/nodes/ODFNode.tsx`                          | ODF React Flow node.                                                                                               |
| `src/components/nodes/OLTNode.tsx`                          | OLT React Flow node.                                                                                               |
| `src/components/nodes/ONTNode.tsx`                          | ONT React Flow node.                                                                                               |
| `src/components/nodes/SplitterNode.tsx`                     | PLC splitter React Flow node.                                                                                      |
| `src/components/nodes/index.ts`                             | Live `nodeTypes` registry consumed by `App.tsx`.                                                                   |

`App.tsx` calculates the optical simulation from the current node graph and separately calculates `NetworkCostBreakdown` from the same nodes/edges plus local rates. Optical telemetry is shared through `SimulationContext`, decorates optical edges, and feeds optical displays; the CAPEX result feeds the Reports banner, the BOM, exports, and mission objectives. The OPM independently invokes the pure probe engine, and the OTDR modal invokes the pure route analyzer at its selected source, branch, wavelength, and pulse width. This keeps all three calculations decoupled from presentation.

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

On 13 October 2026, after the ODF/NAP/gateway and XGS-PON expansion:

- `npm ci --no-audit`: passed; dependencies installed from the lockfile. No automatic dependency fixes were applied.
- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: **105 tests passed** across 12 files (26 optical-simulator, 5 OPM, 5 OTDR, 5 XGS-PON/equipment, 6 mission, 5 pricing, 3 commercial-export, 7 hardware-catalogue, 2 optical-physics, 3 splitter-port, 33 app, and 5 splice-hero tests).
- `npm run build`: passed, including strict TypeScript checking and a Vite production build. Vite reports an informational large-chunk advisory for the 650.10 kB minified JavaScript bundle.
- `git diff --check`: passed.
- A previous audit scan reported **13 dependency findings** (5 moderate, 6 high, 2 critical). Review these before production; no `npm audit fix` was run.

---

## 9. Current boundaries and accuracy notes

FiberLAB is a useful **learning simulator**, but the current model should not be treated as a certified live-network design tool. In particular:

1. **Downstream graph budget:** the main path engine calculates OLT-to-ONT/gateway received power; there is no separate upstream subscriber-to-OLT budget or OLT receiver calculation. XGS-PON uses 1577 nm downstream; 1270 nm is an upstream wavelength reference only. The OPM calibration selector remains 1310/1490/1550 nm and produces model estimates, not instrument readings. The 1550 nm coefficient is retained as a generic learning reference.
2. **Generic equipment:** OLTs, ODFs, splitters, NAP/FATs, gateways, and FOSC-style closures are abstract reference models, not exact make/models. The closure's up-to-48-splice capacity and IP68 note are reference-only; verify the exact enclosure, tray, seal, and product rating. SVGs are illustrations, not product photos or SKU-specific datasheets.
3. **Simplified losses:** fiber attenuation uses a per-wavelength learning reference, with manual per-span overrides; splice/connector losses are fixed; the ODF uses 0.50 dB and the NAP uses a fixed 10.5 dB internal 1:8 split. These ODF/NAP defaults are not calibrated or universal product specifications; splitter and weather/connector values also vary by SKU. Macro-bend (+3.50 dB) and dirty-ferrule (+2.00 dB) values are instructional fixed penalties, not universal measured losses. Closure tray occupancy is not a strand-by-strand OTDR model.
4. **Shared endpoint thresholds:** ONTs, gateways, GPON, and XGS-PON currently share the existing GPON-oriented status window even though endpoint sensitivity fields are stored; XGS-PON receiver classes are not separately modeled.
5. **Informational OLT budgets:** class link-budget and OLT receiver-sensitivity values are displayed but are not independently enforced by the path engine.
6. **Abstract branch ports:** high-ratio splitters have four visible branch handles, not a handle for every physical subscriber port. The closure likewise exposes four modeled branches; only its first four tray channels map to those handles.
7. **No project persistence:** workspace state is in browser memory. Reloading starts over at the default preset. JSON export exists, but import, autosave, and account/cloud storage do not.
8. **Limited learning content:** five guided missions provide live objective progress and hints, and two explicit fiber fault switches support introductory troubleshooting; there is no broader curriculum, quiz, points, grading, or general fault library.
9. **No hardware can be damaged by the app:** an OVERLOAD state is a simulation warning. It is not a physical safety interlock.
10. **Values need domain review:** standards and component specifications evolve and vary by product. Any real equipment profile should cite its source and distinguish typical values from guaranteed limits.
11. **OTDR is a teaching trace:** event peaks, status thresholds, and the −45 dB floor are illustrative; the graph has no measured event coordinates, connector reflectance, pulse dead-zone calibration, or bidirectional sweep. Splice/connector locations are estimated along a span, so the analyzer is not a calibrated OTDR measurement and does not feed back into ONT telemetry.

For real deployment engineering, learners should confirm all assumptions against current standards, product datasheets, measured plant data, and qualified engineering practice.

---

## 10. Recommended approach for real component imagery

The current catalogue is implemented as a static, well-organized **component catalogue**, rather than embedding ad-hoc image URLs inside each node. It contains ten generic hardware profiles: OLT, PLC splitter, three fiber constructions, dome closure, indoor ONT, 2-pair ODF, 1:8 NAP/FAT, and Wi-Fi 6 PON gateway. The drawings are inline SVGs; licensed product photographs are still a future content task.

### 10.1 Keep the eight modeled kinds recognizable

The current canvas models OLT, splitter, fiber span, dome closure, ODF, outdoor NAP/FAT, ONT, and Wi-Fi gateway. The ODF, NAP, and gateway are now functional graph nodes with explicit port constraints, optical/service telemetry, and reference loss/pricing behavior. Their pictures clarify representative interfaces/construction without implying a specific vendor or part number.

Connectors, fusion splicers, and test tools remain outside the topology graph. The OPM is a toolbar mode with a floating simulator-backed HUD—not a component added to the network graph. Add node kinds only when their simulation/teaching behavior is defined, not just to increase the number of pictures.

### 10.2 Keep the interface smooth

- **Component library:** each draggable item uses a compact, recognizable 40 × 40 hardware illustration while keeping its label and quick interaction easy to scan; categories collapse so only one parts list is on screen.
- **Canvas:** each node now uses a small SVG hardware thumbnail beside its existing label and live status; the drawing does not cover ports or telemetry.
- **Inspector:** selected nodes show a larger SVG field illustration on the Info tab, a one-line explanation and type summary on Properties, the physical interfaces/construction in Field Hardware, and one Advanced disclosure for tables, allowances and operating-context notes.
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

A decoupled catalogue, ten representative SVG hardware profiles, compact canvas thumbnails, and selected-node Field Hardware Cards are in place. The legacy GPON loss behavior and fiber-as-node graph model are preserved; ODF, NAP/FAT, gateway and XGS-PON behavior are targeted, tested extensions alongside the closure, field-fault, OPM, and OTDR features. The artwork is illustrative rather than photographic; licensed real-world photos and source/rights metadata remain future work. Catalogue and UI tests cover profile resolution, equipment placement, and card rendering.

### Phase 2 — First guided build (initial version implemented)

**The Marginal Villa** turns the Standard 1:32 tree into a short objective-based mission with field hints and live completion tracking. It checks the three connected ONTs, a fixed 2.0 dB safety margin, and the Class B+ OLT launch-power limit. A fuller course can add step narration and deeper explanations of each change.

### Phase 3 — Troubleshooting practice (initial version implemented)

**Diagnose the Silent ONT** starts with a disabled OLT laser in the existing long-haul preset, then asks the learner to restore a path and bring the target subscriber online. The model also has independent macro-bend and dirty-ferrule toggles for simple fault practice. A future iteration can add diagnosis-before-hint sequencing, richer fault scenarios, and before/after loss explanations.

### Phase 4 — Expand and validate the fault models (initial version implemented)

The app now exposes distinct macro-bend and dirty SC/APC ferrule flags on fiber spans. They add fixed +3.50 dB and +2.00 dB learner-scenario penalties, appear as separate path segments, change ONT status when appropriate, and mark the outgoing patch cord. These are intentionally not presented as universal measured losses. Future work could add product- or measurement-backed ranges, damaged cable, splice defects, connectors at individual endpoints, and evidence-led repair scenarios.

### Phase 5 — Expand the network and content library

The closure, ODF, 1:8 NAP/FAT, Wi-Fi 6 gateway, toolbar OPM, route-based OTDR analyzer, GPON/XGS-PON selector, and modern suburb preset are implemented as targeted vertical slices. Future work could consider connector endpoints, outlets, attenuators, additional meter functions, real DHCP/service-plan modeling, and measurement-tool missions. Each addition should have a clear modeling purpose, teachable interaction, tested simulation behavior, and cited evidence for any physical assumptions.

### Phase 6 — Dual optical and commercial planning (implemented)

`pricingCatalogue.ts` supplies a pure CAPEX calculation decoupled from optical physics. Editable local reference prices feed the TopBar, materials/labor quotation, CSV/JSON export, and the Budget Crunch mission. The mission keeps three ONTs ONLINE within the stated receive window, CAPEX below $1,600, and global margin at least 2 dB. Its rates are educational planning estimates, not vendor quotations. Future work may add saved project-specific rate profiles, region/currency support, quantities for civil works and logistics, and source-date/vendor metadata—without changing the optical model.

### Phase 7 — Interactive OTDR trace analysis (implemented)

`otdrSimulator.ts` is an independent, deterministic graph-route analyzer that creates 100–300 trace samples, discrete loss/reflection events, cumulative loss, and an end-of-fiber Fresnel return at the −45 dB teaching floor. The TopBar opens a source/branch/wavelength/pulse-width analyzer with an animated acquisition line, SVG plot, cursor readout, and event assessments. Fiber spans remain nodes; the analyzer uses the existing directed graph but does not modify optical simulator equations or CAPEX pricing. It is a learning visualization, not a calibrated field instrument. Future work could add user-supplied measured event distances, calibrated reflectance/attenuation profiles, bidirectional traces, and saved trace comparisons.

### Example included missions

> **The Marginal Villa:** Three subscribers share a GPON tree. One is in the warning range. Inspect the route, identify the loss contributors, and correct the plant while preserving the 2.0 dB design margin and the OLT launch-power limit.

> **The Budget Crunch: Cost vs. Performance:** Connect three homes, keep every ONT in the ONLINE receive window, stay below $1,600 reference CAPEX, and preserve a global safety margin of at least 2 dB. The learner can shorten spans and revise the design while checking both the live optical readings and commercial quote.

These use the existing Standard 1:32 topology and simulator; the other two missions cover disabled-laser troubleshooting and an unpatched subscriber in the failing long-haul preset. Future lessons can introduce more explicit diagnosis sequencing and after-action budget comparisons.

---

## 12. Glossary

- **FTTH:** Fiber to the Home; optical access fiber reaches a residence or subscriber location.
- **PON:** Passive Optical Network; an access architecture that shares an OLT port through passive optical distribution components.
- **GPON:** Gigabit-capable PON (ITU-T G.984); the existing 1490 nm downstream / 1310 nm upstream reference uses 2.488 / 1.244 Gbps nominal line rates.
- **XGS-PON:** 10-Gigabit-capable symmetric PON (ITU-T G.9807.1); FiberLAB shows 1577/1270 nm downstream/upstream references and 9.953 Gbps nominal line rates in each direction.
- **OLT:** Optical Line Terminal; the provider-side equipment that launches and manages the PON signal.
- **ONT / ONU:** Optical Network Terminal / Unit; a subscriber-side optical endpoint.
- **Wi-Fi 6 gateway:** Integrated PON termination and dual-band Wi-Fi 6 router reference; its per-split line-rate estimate and `192.0.2.x` TEST-NET IP placeholder are educational, not service measurements/assignments.
- **ODF:** Optical Distribution Frame; the headend patch field. FiberLAB's two matched pairs are isolated and each traversed pair uses a 0.50 dB educational loss allowance.
- **PLC splitter:** Planar Lightwave Circuit splitter; a passive component that divides optical power among output branches.
- **NAP / FAT:** Network Access Point / Fiber Access Terminal; FiberLAB's outdoor reference node contains one input, eight drops, and a fixed 1:8 split loss of 10.5 dB.
- **FOSC / dome splice closure:** A sealed outside-plant enclosure that protects fiber joints and splice trays; the modeled component is representative, not a vendor-specific SKU.
- **OPM:** Optical Power Meter; FiberLAB's virtual OPM reports power derived from the current simulated graph, not a physical instrument reading.
- **OTDR:** Optical Time Domain Reflectometer; FiberLAB's educational trace analyzer plots modeled backscatter and event loss along one selected directed route, not a calibrated reflectometer reading.
- **Rayleigh backscatter:** Light scattered by small refractive-index fluctuations along fiber; the OTDR model uses its relative decline as a wavelength-selected trace slope.
- **Feeder / distribution / drop:** Common network sections from the headend toward a distribution point, through the local distribution plant, and finally to the subscriber.
- **dB:** A logarithmic ratio commonly used to express gain or loss.
- **dBm:** An absolute optical/electrical power level referenced to 1 milliwatt. In the simulator, losses in dB are subtracted from transmit power in dBm.
- **Wavelength (nm):** The optical carrier wavelength. GPON uses 1490 nm downstream / 1310 nm upstream; XGS-PON uses 1577/1270 nm in this reference. The graph supports 1270/1310/1490/1550/1577 nm; the OPM HUD's wavelength calibration choices remain 1310/1490/1550 nm.
- **Link budget:** The accounting of transmit power minus losses and allowances along a path, used to estimate receive power.
- **LOS:** Loss of signal; here, the modeled received power is below the configured LOS threshold.
- **SC/APC:** A common angled-polish fiber connector family. The simulator uses a simplified fixed 0.5 dB loss per counted connector.

---

## 13. What has happened so far

- The repository pairs the persistent warm landing/studio shell, splice interaction, simulator-backed waveguide, responsive layout, five guided missions, three presets, and eight functional graph types with a static ten-profile hardware catalogue. SVG diagrams are representative illustrations, not product photos or vendor-specific SKUs.
- The core node-based graph abstraction is preserved: fiber spans remain nodes, with patch cords represented by edges. ODF pairs and NAP outputs have explicit route constraints; their through/split losses and the gateway endpoint are targeted extensions. Existing GPON fiber-loss equations, OPM calibration behavior, closure/fault mechanics, and CAPEX reconciliation are preserved.
- The virtual OPM probes live graph ports, node bodies, and edges; its 1310/1490/1550 nm readings come from wavelength-specific simulations of the current topology. Its HUD supports relative reference, Escape/Close exit, and tap/hover probing.
- The OTDR module independently traces a directed source-to-ONT/gateway route, adds 1270/1310/1490/1550/1577 nm attenuation and ODF/NAP/fault events, plots a sampled Rayleigh curve with Fresnel returns, and reports cumulative loss without changing CAPEX calculations.
- The dome closure has two input handles, four modeled outputs, a representative static SVG profile, an adjustable 0.05–0.10 dB through-splice allowance, and a 12-color tray whose first four channels map to the modeled branches.
- Macro-bend and dirty-ferrule toggles contribute separate +3.50 dB and +2.00 dB learner-scenario penalties to fiber loss, path breakdowns, warning badges, and resulting ONT status. These are not universal measured constants.
- Navigation became a workflow: **Design**, **Simulation**, **Reports** and **Settings** are separate screens mounted one at a time (desktop rail, phone bottom tab bar with safe-area padding). The top bar shrank to the logo, the project name with an **Edited** marker, the zoom percentage and **Run Simulation**; the preset picker moved to a design bar along with a dismissible three-step first-run hint that is remembered in `localStorage`. Reports is now a section rather than a dialog, and Settings gathers the margin, Auto-run, test gear and workspace actions.
- Final responsive and accessibility polish: the accent got a contrast pair (`--pu-pri-text` for small text on light surfaces, `--pu-pri-cta` for white-on-orange fills), every interactive element shares one `:focus-visible` ring, control transitions run at 160–180 ms and switch off under `prefers-reduced-motion`, `viewport-fit=cover` plus notch gutters reach the shell, one-finger pan now works on touch in Select mode, and landscape phones keep about 58 % of their height for the canvas.
- The canvas **⋯** menu now holds canvas actions only — fit view, zoom to 100 % and snap to grid — and every app-level action it used to duplicate (Overview & Physics, OPM Tool, OTDR Trace, Missions, safety margin, Auto-run, Clear canvas, Docs/GitHub) lives solely on the Settings screen, which hands the screen back to Design when a tool is armed. Reports gained a **Back to Design** button, Escape-to-Design, section history for the browser/phone back gesture, focus on the section heading, a `<main>` landmark with an `<h1>`/`<h2>` hierarchy, and per-table horizontal scrolling so phones never scroll the page sideways.
- The bottom of the design view is a single slim status bar — total loss, total distance, subscribers OK and a coloured OK/Marginal/Fail dot — that expands into two tabs only: **Optical Budget** (OLT launch, after splitter, closest and farthest ONT as bars) and **Events** (warnings and recent events, each of which selects and frames the affected component). The old **Components** and **Topology** tabs are gone: per-type placed counts, patch cords, splitters, splices and connectors now live in the BOM's **Deployed components** block, and the CAPEX / cost-per-home-passed banner moved into the Reports header. Only one bottom sheet (library, Inspector or status) is open at a time on phones.
- The CAPEX estimator is a separate pure calculation with user-editable reference rates, including $110 ODF, $65 NAP/FAT, and $85 gateway defaults; quotation lines reconcile materials, labor, total CAPEX, home/subscriber costs, and JSON/CSV data.
- The test suite now contains 123 passing tests, including `src/engine/__tests__/preset-golden.test.ts`, which pins every Standard 1:32 GPON Tree reading (−24.30 dBm worst Rx, −22.62 dBm mean, 13.5 km, 2 ONLINE + 1 WARNING) so layout work can never quietly move an optical number. Typecheck, production build, and `git diff --check` pass; verification details are in §8.
- `npm ci` reported 13 dependency audit findings (5 moderate, 6 high, 2 critical); review them before production release. No automatic dependency fix was applied.

This snapshot records the current product/model boundaries. Revisit physical assumptions and the dependency audit before using the app for engineering work or publishing a production release.
