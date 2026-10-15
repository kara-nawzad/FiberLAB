# FiberLAB — new "Workbench" UI (matches the design image)

Drop-in replacement for the studio screen. Your simulation engine, presets, missions,
OPM, OTDR, BOM and CAPEX code are NOT touched.

## Install
Copy everything in `src/` into your project's `src/`, overwriting the same filenames:

    src/photo-ui.css                      NEW   design system (imported last in main.tsx)
    src/main.tsx                          changed (one extra import)
    src/App.tsx                           changed (studio layout + wiring only)
    src/components/TopBar.tsx             rewritten (same props)
    src/components/Sidebar.tsx            rewritten (rail + searchable Components panel)
    src/components/CanvasToolbar.tsx      NEW   Select / Pan / Connect / Add Node / Delete / More tools
    src/components/BottomPanel.tsx        NEW   Network Overview / Optical Budget / Components / Topology
    src/components/Inspector.tsx          patched (Selected Component card + 3 tabs)
    src/components/nodes/OLTNode.tsx      restyled
    src/components/nodes/SplitterNode.tsx restyled
    src/components/nodes/ONTNode.tsx      restyled
    src/components/nodes/FiberNode.tsx    restyled (inline "20.4 km / -3.2 dB" pill)
    src/components/hardware/hardwareArt.ts   NEW  realistic vector hardware art (OLT, splitters, ONU, cable, connector, splice)
    src/components/hardware/HardwareArt.tsx  NEW  <HardwareArt kind="olt" width={230} /> component

Then:  npm run typecheck && npm run dev

## Where the old buttons went
OPM Tool, OTDR Trace, Missions, Overview & Physics, Safety margin, Auto and Clear
are under **More tools** in the canvas toolbar. Reports = BOM modal.

## Not restyled yet (still the old look)
ODF, NAP, Closure and Gateway nodes. Same recipe as ONTNode.tsx.

## Known differences / things to check
- Not compiled or run here (no network). Run typecheck + your 85 tests; tests that look up
  old labels ("Remove element", per-edge dBm pills, the old summary strip) will need updating.
- Avatar initials are a constant in TopBar.tsx (AVATAR_INITIALS).
- Photo-only items with no real feature behind them are left out: undo/redo, theme toggle,
  the "+" new-design tab, Cable Route / Test Point tools, event timestamps.

## Realistic hardware
The OLT, PLC splitters, ONU, fiber cable, connector and splice are detailed vector illustrations
(shaded chassis, SC/APC green boots, LEDs, labels) used on the canvas, in the Components list and in the
Selected Component card. They are drawings, not photos. To use real photos or renders later, replace the
strings in hardwareArt.ts with `<svg><image href="..."/></svg>` or swap HardwareArt for an <img>.
ODF, NAP, Closure and Gateway nodes still use the old art.
