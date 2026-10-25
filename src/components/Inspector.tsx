import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { artForNode } from '../data/hardwareArtwork';
import {
  AlertTriangle,
  Cable,
  ChevronRight,
  Link2,
  Network,
  PackageOpen,
  PanelsTopLeft,
  Radio,
  Router,
  Split,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import type {
  CableType,
  AttenuatorNodeData,
  FiberProfile,
  GatewayTelemetry,
  OltClass,
  PonEdge,
  PonNode,
  PonStandard,
  SimulationResult,
  SplitRatio,
  SubscriberOpticalTelemetry,
  Wavelength,
} from '../types';
import { splitterBranchPortCount } from '../types';
import {
  ATTENUATION_DB_PER_KM,
  ATTENUATOR_VALUES_DB,
  CABLE_SPECS,
  CLOSURE_SPLICE_LOSS_MAX_DB,
  CLOSURE_SPLICE_LOSS_MIN_DB,
  CONNECTOR_LOSS_DB,
  DEFAULT_ODF_THROUGH_PORT_LOSS_DB,
  DIRTY_CONNECTOR_PENALTY_DB,
  FIBER_PROFILES,
  FIBER_PROFILE_SPECS,
  isMultiModeProfile,
  MACRO_BEND_PENALTY_DB,
  MAX_BRANCH_PORTS,
  NAP_OUTPUT_PORTS,
  MODAL_DISPERSION_LIMIT_KM,
  MODAL_DISPERSION_WARNING,
  NAP_SPLIT_LOSS_DB,
  NAP_SPLIT_RATIO,
  ODF_INPUT_PORTS,
  ODF_OUTPUT_PORTS,
  OLT_CLASS_SPECS,
  ONT_THRESHOLDS,
  PON_STANDARD_SPECS,
  SPLICE_LOSS_DB,
  SPLICE_TRAY_CHANNELS,
  SPLIT_RATIOS,
  SPLITTER_LOSS_DB,
  STATUS_STYLES,
  WAVELENGTH_LABEL,
} from '../types';
import {
  computeAttenuatorLoss,
  computeClosureSpliceLoss,
  computeFiberLoss,
  computeSplitterLoss,
  describeStatus,
  formatDbm,
  isAttenuatorNode,
  isClosureNode,
  isFiberNode,
  isGatewayNode,
  isNapNode,
  isOdfNode,
  isOltNode,
  isOntNode,
  isSplitterNode,
  wavelengthsForProfile,
} from '../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../data/componentCatalogue';
import { FieldHardwareCard } from './FieldHardwareCard';

/* ========================================================================== *
 * Selected Component inspector.
 *
 * Only mounted while something is selected, so the canvas keeps the space
 * otherwise. Each type leads with the handful of fields an engineer touches
 * every day; the loss tables, allowances and reference notes live under one
 * "Advanced" disclosure that starts closed. Desktop shows the panel on the
 * right; phones turn it into a half/full-height bottom sheet.
 * ========================================================================== */

interface InspectorProps {
  node: PonNode | null;
  edge: PonEdge | null;
  simulation: SimulationResult;
  onPatchNode: (nodeId: string, patch: Partial<PonNode['data']>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onClose: () => void;
}

type InspectorTab = 'properties' | 'optical' | 'info';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="metric">
      <div className="text-caption uppercase tracking-label text-slate-500">{label}</div>
      <div className="metric-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-label font-medium text-noc-300">{label}</label>
        <span className="font-mono text-label font-semibold text-[var(--pu-pri)]">
          {value.toFixed(step < 1 ? 2 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function FaultToggle({
  label,
  description,
  penaltyDb,
  active,
  onChange,
}: {
  label: string;
  description: string;
  penaltyDb: number;
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <div className={`fiber-fault-control ${active ? 'is-active' : ''}`}>
      <AlertTriangle size={16} className={active ? 'text-orange-700' : 'text-stone-400'} aria-hidden="true" />
      <span className="fiber-fault-control-copy">
        <strong>{label}</strong>
        <small>
          {description} · {active ? `+${penaltyDb.toFixed(2)} dB active` : 'no added loss'}
        </small>
      </span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={active}
        className="fiber-fault-switch"
        onClick={() => onChange(!active)}
      >
        <span />
      </button>
    </div>
  );
}

function Advanced({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`pu-adv${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="pu-adv-head"
        aria-expanded={open}
        onClick={onToggle}
        title={open ? 'Hide detailed values' : 'Show loss tables and detailed values'}
      >
        <ChevronRight size={14} className="pu-adv-chevron" aria-hidden="true" />
        <span className="pu-adv-label">Advanced</span>
        <span className="pu-adv-hint">loss tables &amp; detailed values</span>
      </button>
      <div className="pu-adv-body" hidden={!open}>
        {open ? children : null}
      </div>
    </div>
  );
}

function SpliceTrayView({ channels, onChange }: { channels: boolean[]; onChange: (channels: boolean[]) => void }) {
  const activeCount = channels.filter(Boolean).length;
  return (
    <section className="splice-tray" aria-label="Interactive splice organizer tray">
      <div className="splice-tray-heading">
        <strong>Splice organizer · 12F</strong>
        <span>{activeCount}/12 SLEEVED</span>
      </div>
      <div className="splice-tray-grid">
        {SPLICE_TRAY_CHANNELS.map((channel, index) => {
          const active = channels[index] ?? false;
          return (
            <button
              key={channel.name}
              type="button"
              role="switch"
              aria-label={`Channel ${index + 1} ${channel.name} splice`}
              aria-checked={active}
              title={`${index + 1}. ${channel.name}${active ? ' · active fusion splice with protective sleeve' : ' · open / spare channel'}`}
              className="splice-tray-channel"
              onClick={() => {
                const next = Array.from({ length: SPLICE_TRAY_CHANNELS.length }, (_, slot) => Boolean(channels[slot]));
                next[index] = !active;
                onChange(next);
              }}
            >
              <span className="splice-tray-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="splice-tray-fiber" style={{ background: channel.hex }} aria-hidden="true">
                <span className="splice-tray-sleeve" />
              </span>
              <span className="splice-tray-label">{channel.name}</span>
              <span className="splice-tray-state">{active ? 'SLEEVED' : 'OPEN'}</span>
            </button>
          );
        })}
      </div>
      <p className="splice-tray-note">
        Green heat-shrink sleeves mark active joints. Branches A–D map to channels 1–4 in this simplified cable-level
        graph; channels 5–12 are reserve tray positions.
      </p>
    </section>
  );
}

function SegmentTable({ telemetry }: { telemetry: SubscriberOpticalTelemetry }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full font-mono text-label">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="px-2 py-1 text-left font-medium">Element</th>
            <th className="px-2 py-1 text-right font-medium">Loss</th>
          </tr>
        </thead>
        <tbody>
          {telemetry.segments.length === 0 ? (
            <tr>
              <td className="px-2 py-2 text-slate-500" colSpan={2}>
                No active path
              </td>
            </tr>
          ) : (
            telemetry.segments.map((segment, index) => (
              <tr key={`${segment.component}-${index}`} className="border-t border-slate-200/80">
                <td className="px-2 py-1 text-slate-700">{segment.label}</td>
                <td className="px-2 py-1 text-right font-semibold text-amber-700">−{segment.lossDb.toFixed(2)}</td>
              </tr>
            ))
          )}
          <tr className="border-t border-slate-300 bg-slate-50 font-semibold text-slate-900">
            <td className="px-2 py-1">Total path loss</td>
            <td className="px-2 py-1 text-right">−{telemetry.totalLossDb.toFixed(2)} dB</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StatusBanner({ status, detail }: { status: SubscriberOpticalTelemetry['status']; detail: string }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-md border px-2 py-2"
      style={{ borderColor: `${STATUS_STYLES[status].hex}66`, background: `${STATUS_STYLES[status].hex}14` }}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: STATUS_STYLES[status].hex, boxShadow: `0 0 8px ${STATUS_STYLES[status].hex}` }}
      />
      <div className="min-w-0">
        <div className="font-mono text-body font-bold" style={{ color: STATUS_STYLES[status].hex }}>
          {STATUS_STYLES[status].label}
        </div>
        <div className="text-caption text-noc-400">{detail}</div>
      </div>
    </div>
  );
}

export function Inspector({
  node,
  edge,
  simulation,
  onPatchNode,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('properties');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const [sheetDrag, setSheetDrag] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);

  const showProperties = activeTab === 'properties';
  const showOptical = activeTab === 'optical';
  const showInfo = activeTab === 'info';
  const selectionKey = node?.id ?? edge?.id ?? null;

  // A different component starts clean: essentials first, details folded away.
  useEffect(() => {
    setActiveTab('properties');
    setAdvancedOpen(false);
    setConfirmingDelete(false);
    setSheetFull(false);
    setSheetDrag(0);
  }, [selectionKey]);

  const telemetry: SubscriberOpticalTelemetry | undefined = node
    ? isOntNode(node)
      ? simulation.ontTelemetry[node.id]
      : isGatewayNode(node)
        ? simulation.gatewayTelemetry[node.id]
        : undefined
    : undefined;
  const gatewayTelemetry: GatewayTelemetry | undefined =
    node && isGatewayNode(node) ? simulation.gatewayTelemetry[node.id] : undefined;

  const header = useMemo(() => {
    if (node) {
      if (isOltNode(node)) return { icon: <Radio size={14} />, title: 'OLT Transceiver', accent: '#2563eb' };
      if (isSplitterNode(node)) return { icon: <Split size={14} />, title: 'Optical Splitter', accent: '#7c3aed' };
      if (isFiberNode(node)) return { icon: <Cable size={14} />, title: 'Fiber Cable Span', accent: '#a16207' };
      if (isClosureNode(node))
        return { icon: <PackageOpen size={14} />, title: 'Dome Splice Closure', accent: '#2b3033' };
      if (isOdfNode(node)) return { icon: <PanelsTopLeft size={14} />, title: 'ODF Rack Panel', accent: '#0f766e' };
      if (isNapNode(node)) return { icon: <Network size={14} />, title: 'Outdoor NAP / FAT', accent: '#c2410c' };
      if (isGatewayNode(node)) return { icon: <Wifi size={14} />, title: 'Wi-Fi 6 PON Gateway', accent: '#2563eb' };
      if (isOntNode(node)) return { icon: <Router size={14} />, title: 'ONT / ONU', accent: '#16a34a' };
    }
    return { icon: <Link2 size={14} />, title: 'Optical Patch Cord', accent: '#64748b' };
  }, [node]);

  /** One-line "type" summary shown under the name, so the essentials read at a glance. */
  const typeSummary = useMemo(() => {
    if (!node) return edge ? `${edge.source} → ${edge.target}` : '';
    if (isOltNode(node)) return `${node.data.ponStandard ?? 'GPON'} · Class ${node.data.oltClass}`;
    if (isSplitterNode(node)) return `PLC 1:${node.data.ratio} · ${computeSplitterLoss(node.data).toFixed(2)} dB loss`;
    if (isFiberNode(node))
      return `${CABLE_SPECS[node.data.cableType].label} · ${node.data.lengthKm.toFixed(2)} km · ${computeFiberLoss(node.data).totalDb.toFixed(2)} dB`;
    if (isClosureNode(node))
      return `OSP dome · ${node.data.activeSpliceChannels.filter(Boolean).length}/12 tray channels`;
    if (isOdfNode(node)) return `2 matched pairs · ${node.data.throughPortLossDb.toFixed(2)} dB through`;
    if (isNapNode(node)) return `Fixed 1:${NAP_SPLIT_RATIO} · ${node.data.splitLossDb.toFixed(2)} dB split`;
    if (isAttenuatorNode(node)) return `Inline pad · ${computeAttenuatorLoss(node.data).toFixed(0)} dB fixed`;
    if (isGatewayNode(node)) return `${node.data.ssid} · GPON / XGS-PON`;
    return `Subscriber · ${node.data.subscriber}`;
  }, [node, edge]);

  const hardwareInfo = useMemo(() => {
    if (!node) return null;
    if (isOltNode(node)) {
      return {
        profile: getHardwareProfileForNode('olt', node.data.oltClass),
        configurationLabel: `Class ${node.data.oltClass} · ${node.data.portName}`,
      };
    }
    if (isSplitterNode(node)) {
      return {
        profile: getHardwareProfileForNode('splitter', String(node.data.ratio)),
        configurationLabel: `Current split ratio · 1:${node.data.ratio}`,
      };
    }
    if (isFiberNode(node)) {
      const profile = FIBER_PROFILE_SPECS[node.data.fiberProfile ?? 'singlemode'];
      return {
        profile: getHardwareProfileForNode(
          'fiber',
          isMultiModeProfile(node.data.fiberProfile) ? node.data.fiberProfile : node.data.cableType,
        ),
        configurationLabel: `${profile.short} · ${CABLE_SPECS[node.data.cableType].label} · ${node.data.lengthKm.toFixed(3)} km`,
      };
    }
    if (isClosureNode(node)) {
      return {
        profile: getHardwareProfileForNode('closure'),
        configurationLabel: `OSP dome · ${node.data.activeSpliceChannels.filter(Boolean).length}/12 tray channels active`,
      };
    }
    if (isOdfNode(node)) {
      return {
        profile: getHardwareProfileForNode('odf'),
        configurationLabel: `Two matched port pairs · ${node.data.throughPortLossDb.toFixed(2)} dB through reference`,
      };
    }
    if (isNapNode(node)) {
      return {
        profile: getHardwareProfileForNode('nap'),
        configurationLabel: `Outdoor fixed 1:8 · ${node.data.splitLossDb.toFixed(2)} dB reference`,
      };
    }
    if (isAttenuatorNode(node)) {
      return {
        profile: getHardwareProfileForNode('attenuator'),
        configurationLabel: `Fixed ${computeAttenuatorLoss(node.data).toFixed(0)} dB pad · ${node.data.polish}`,
      };
    }
    if (isGatewayNode(node)) {
      return {
        profile: getHardwareProfileForNode('gateway'),
        configurationLabel: `Wi-Fi 6 · ${node.data.ssid} · GPON / XGS-PON capable`,
      };
    }
    return {
      profile: getHardwareProfileForNode('ont', 'indoor'),
      configurationLabel: `Subscriber · ${node.data.subscriber}`,
    };
  }, [node]);

  const beginnerSummary = useMemo(() => {
    if (!node) return null;
    if (isOltNode(node)) {
      return 'Headend optical transmitter in the central office. Sends laser light downstream into the feeder fiber.';
    }
    if (isSplitterNode(node)) {
      return `Passive glass waveguide that divides light 1:${node.data.ratio} without power, adding ${SPLITTER_LOSS_DB[node.data.ratio].toFixed(1)} dB insertion loss to each output.`;
    }
    if (isFiberNode(node)) {
      return isMultiModeProfile(node.data.fiberProfile)
        ? 'Multi-mode 50/125 µm span. Modal dispersion limits gigabit transmission to about 550 m, and 850 nm glass loses roughly ten times more per kilometre than single-mode.'
        : 'Single-mode optical cable span. Loss scales with distance (km × dB/km) plus fusion splices and SC/APC connectors.';
    }
    if (isAttenuatorNode(node)) {
      return 'Fixed inline attenuator pad: it removes a known amount of light so an ONT that sits very close to the OLT does not overload its receiver.';
    }
    if (isClosureNode(node)) {
      return 'Weatherproof outside-plant splice dome where feeder fibers are fusion-spliced to distribution branches.';
    }
    if (isOdfNode(node)) {
      return 'Rack-mounted optical patch panel providing clean bulkhead jumper test points at the central office.';
    }
    if (isNapNode(node)) {
      return 'Outdoor pole/wall box with an internal 1:8 splitter serving up to 8 subscriber drop cables.';
    }
    if (isGatewayNode(node)) {
      return 'Subscriber optical router combining a GPON/XGS-PON optical receiver with dual-band Wi-Fi 6.';
    }
    return 'Customer premises optical terminal. Needs −28 to −8 dBm of optical receive power to stay ONLINE.';
  }, [node]);

  const cardName = node
    ? isOntNode(node) || isGatewayNode(node)
      ? node.data.subscriber
      : isOltNode(node)
        ? node.data.portName
        : header.title
    : header.title;
  const cardStatus = telemetry ? STATUS_STYLES[telemetry.status] : null;
  const cardTone = !telemetry
    ? 'idle'
    : telemetry.status === 'ONLINE'
      ? ''
      : telemetry.status === 'WARNING' || telemetry.status === 'OVERLOAD'
        ? 'warn'
        : telemetry.status === 'LOS'
          ? 'bad'
          : 'idle';

  /* Phone sheet: drag up for full height, down for half height, then closed. */
  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartRef.current = event.clientY;
    dragDeltaRef.current = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    const delta = event.clientY - dragStartRef.current;
    dragDeltaRef.current = delta;
    setSheetDrag(delta);
  };
  const onHandlePointerEnd = () => {
    const delta = dragDeltaRef.current;
    dragStartRef.current = null;
    dragDeltaRef.current = 0;
    setSheetDrag(0);
    if (delta <= -40) {
      setSheetFull(true);
    } else if (delta >= 40) {
      if (sheetFull) setSheetFull(false);
      else onClose();
    }
  };

  return (
    <aside
      className={`fiberlab-inspector flex h-full shrink-0 flex-col border-l border-slate-200 bg-white${sheetFull ? ' is-sheet-full' : ''}`}
      style={sheetDrag ? { transform: `translateY(${Math.max(-24, sheetDrag)}px)` } : undefined}
      aria-label="Selected component"
    >
      <div
        className="pu-sheet-handle pu-insp-handle"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerEnd}
        onPointerCancel={onHandlePointerEnd}
        aria-hidden="true"
      >
        <span className="pu-sheet-grip" />
      </div>

      <div className="pu-insp-head">
        <span>Selected Component</span>
        <button type="button" className="pu-insp-close" onClick={onClose} aria-label="Close inspector" title="Close">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="pu-insp-card">
        <div className="pic">
          {hardwareInfo ? (
            <img
              src={
                artForNode(node?.type, node && isSplitterNode(node) ? node.data.ratio : undefined) ??
                hardwareInfo.profile.thumbnailSvg
              }
              alt={`${hardwareInfo.profile.modelName} illustration`}
              draggable={false}
            />
          ) : (
            <span style={{ color: header.accent }}>{header.icon}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <h4 className="truncate">{cardName}</h4>
          {cardStatus ? (
            <span className={`pu-badge ${cardTone}`}>● {cardStatus.label}</span>
          ) : (
            <div className="pu-mut" style={{ fontSize: 'var(--fs-xs)' }}>
              {node?.id ?? edge?.id ?? ''}
            </div>
          )}
          <div className="pu-insp-type">{typeSummary}</div>
        </div>
      </div>

      <div className="pu-itabs" role="tablist" aria-label="Inspector sections">
        {(
          [
            { id: 'properties', label: 'Properties' },
            { id: 'optical', label: 'Optical Power' },
            { id: 'info', label: 'Info' },
          ] as Array<{ id: InspectorTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="fiberlab-inspector-content flex-1 overflow-y-auto px-3 py-2">
        {beginnerSummary ? <p className="pu-insp-summary">{beginnerSummary}</p> : null}

        {hardwareInfo && showInfo ? (
          <FieldHardwareCard profile={hardwareInfo.profile} configurationLabel={hardwareInfo.configurationLabel} />
        ) : null}

        {!node && edge && showInfo ? (
          <p className="mb-3 text-body leading-relaxed text-slate-500">
            Patch cords and connectors are the graph&apos;s links: they add no loss of their own, so there is no
            hardware record for this connection. Delete it to break the optical path.
          </p>
        ) : null}

        {/* ------------------------------------------------------------ Properties */}
        {node && isOltNode(node) && showProperties ? (
          <>
            <Row label="PON port name">
              <input
                className="input"
                value={node.data.portName}
                onChange={(event) => onPatchNode(node.id, { portName: event.target.value })}
              />
            </Row>
            <Row label="PON standard">
              <select
                className="select"
                aria-label="PON standard"
                value={node.data.ponStandard ?? 'GPON'}
                onChange={(event) => {
                  const ponStandard = event.target.value as PonStandard;
                  onPatchNode(node.id, {
                    ponStandard,
                    wavelength: PON_STANDARD_SPECS[ponStandard].downstreamWavelength,
                  });
                }}
              >
                <option value="GPON">GPON · 2.488 / 1.244 Gbps</option>
                <option value="XGS-PON">XGS-PON · 9.953 / 9.953 Gbps</option>
              </select>
            </Row>
            <Row label="Operating wavelength">
              {(node.data.ponStandard ?? 'GPON') === 'GPON' ? (
                <select
                  className="select"
                  aria-label="Operating wavelength"
                  value={node.data.wavelength}
                  onChange={(event) => onPatchNode(node.id, { wavelength: Number(event.target.value) as Wavelength })}
                >
                  <option value={1310}>{WAVELENGTH_LABEL[1310]}</option>
                  <option value={1490}>{WAVELENGTH_LABEL[1490]}</option>
                </select>
              ) : (
                <div className="rounded-md border border-[var(--pu-line)] bg-[var(--pu-pri-soft)] px-2 py-2 font-mono text-label text-[var(--pu-ink)]">
                  Downstream 1577 nm · {ATTENUATION_DB_PER_KM[1577].toFixed(2)} dB/km
                  <br />
                  Upstream 1270 nm · {ATTENUATION_DB_PER_KM[1270].toFixed(2)} dB/km (not simulated)
                </div>
              )}
            </Row>
            <Row label="Transceiver class">
              <select
                className="select"
                aria-label="Transceiver class"
                value={node.data.oltClass}
                onChange={(event) => {
                  const oltClass = event.target.value as OltClass;
                  onPatchNode(node.id, {
                    oltClass,
                    txPowerDbm: OLT_CLASS_SPECS[oltClass].txPowerDbm,
                  });
                }}
              >
                {(Object.keys(OLT_CLASS_SPECS) as OltClass[]).map((key) => (
                  <option key={key} value={key}>
                    {OLT_CLASS_SPECS[key].label}
                  </option>
                ))}
              </select>
            </Row>
            <div className="mb-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
              <div>
                <div className="text-label font-medium text-slate-800">Laser transmitter</div>
                <div className="font-mono text-label text-slate-500">
                  {node.data.laserOn ? 'Emitting — downstream live' : 'Disabled — all ONTs go dark'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={node.data.laserOn}
                onClick={() => onPatchNode(node.id, { laserOn: !node.data.laserOn })}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  node.data.laserOn ? 'bg-emerald-600' : 'bg-slate-400'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    node.data.laserOn ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <SliderRow
                label="Tx launch power"
                value={node.data.txPowerDbm}
                min={-5}
                max={10}
                step={0.1}
                unit="dBm"
                onChange={(value) => onPatchNode(node.id, { txPowerDbm: value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="Class budget"
                  value={`${OLT_CLASS_SPECS[node.data.oltClass].linkBudgetDb.toFixed(0)} dB`}
                />
                <Metric
                  label="Rx sensitivity"
                  value={`${OLT_CLASS_SPECS[node.data.oltClass].rxSensitivityDbm.toFixed(0)} dBm`}
                />
              </div>
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-body leading-relaxed text-slate-600">
                Nominal PON line rate: {PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].downstreamGbps.toFixed(3)}{' '}
                Gbps downstream / {PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].upstreamGbps.toFixed(3)} Gbps
                upstream. These are shared line rates, not guaranteed subscriber throughput.
                {(node.data.ponStandard ?? 'GPON') === 'XGS-PON'
                  ? ' XGS-PON launch-class budgets are not separately modeled.'
                  : ''}
              </div>
            </Advanced>
          </>
        ) : null}

        {node && isSplitterNode(node) && showProperties ? (
          <>
            <Row label="Split ratio">
              <select
                className="select"
                aria-label="Split ratio"
                value={node.data.ratio}
                onChange={(event) => onPatchNode(node.id, { ratio: Number(event.target.value) as SplitRatio })}
              >
                {SPLIT_RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    1:{ratio}
                  </option>
                ))}
              </select>
            </Row>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Metric
                label="Insertion loss"
                value={`${SPLITTER_LOSS_DB[node.data.ratio].toFixed(1)} dB`}
                accent="var(--pu-pri)"
              />
              <Metric
                label="Branch ports"
                value={`${splitterBranchPortCount(node.data.ratio)} / ${MAX_BRANCH_PORTS}`}
              />
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <SliderRow
                label="Excess / uniformity loss"
                value={node.data.excessLossDb}
                min={0}
                max={3}
                step={0.05}
                unit="dB"
                onChange={(value) => onPatchNode(node.id, { excessLossDb: value })}
              />
              <div className="mb-3 overflow-hidden rounded-md border border-slate-200">
                <table className="w-full font-mono text-label">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="px-2 py-1 text-left font-medium">Ratio</th>
                      <th className="px-2 py-1 text-right font-medium">Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SPLIT_RATIOS.map((ratio) => (
                      <tr
                        key={ratio}
                        className={`border-t border-slate-200/80 ${
                          ratio === node.data.ratio
                            ? 'bg-[var(--pu-pri-soft)] font-semibold text-[var(--pu-pri)]'
                            : 'text-slate-700'
                        }`}
                      >
                        <td className="px-2 py-1">1:{ratio}</td>
                        <td className="px-2 py-1 text-right">{SPLITTER_LOSS_DB[ratio].toFixed(1)} dB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Metric label="Total modeled insertion loss" value={`${computeSplitterLoss(node.data).toFixed(2)} dB`} />
              <PortNote>
                1 × SC/APC input (`in`) → {splitterBranchPortCount(node.data.ratio)} × SC/APC branch outputs (`out-0` ..
                `out-{splitterBranchPortCount(node.data.ratio) - 1}`)
                {node.data.ratio > splitterBranchPortCount(node.data.ratio) ? (
                  <div className="mt-1 text-[#85695A]">
                    A 1:{node.data.ratio} cassette terminates {splitterBranchPortCount(node.data.ratio)} branch ports
                    here; the remaining fan-out stays a ribbon trunk and is spliced downstream.
                  </div>
                ) : null}
              </PortNote>
            </Advanced>
          </>
        ) : null}

        {node && isFiberNode(node) && showProperties ? (
          <>
            <Row label="Fibre profile">
              <select
                className="select"
                aria-label="Fibre profile"
                value={node.data.fiberProfile ?? 'singlemode'}
                onChange={(event) => {
                  const fiberProfile = event.target.value as FiberProfile;
                  onPatchNode(node.id, {
                    fiberProfile,
                    // The profile owns the valid windows, so move to its first
                    // one and drop any override that was set for the old glass.
                    wavelength: wavelengthsForProfile(fiberProfile)[0],
                    attenuationOverrideDbPerKm: null,
                  });
                }}
              >
                {FIBER_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {FIBER_PROFILE_SPECS[profile].label} · {FIBER_PROFILE_SPECS[profile].coreCladding}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Cable preset">
              <select
                className="select"
                aria-label="Cable preset"
                value={node.data.cableType}
                onChange={(event) => {
                  const cableType = event.target.value as CableType;
                  const spec = CABLE_SPECS[cableType];
                  onPatchNode(node.id, {
                    cableType,
                    lengthKm: spec.defaultLengthKm,
                    splices: spec.defaultSplices,
                    connectors: spec.defaultConnectors,
                  });
                }}
              >
                {(Object.keys(CABLE_SPECS) as CableType[]).map((cable) => (
                  <option key={cable} value={cable}>
                    {CABLE_SPECS[cable].label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Span length (km)">
              <input
                className="input"
                aria-label="Span length (km)"
                type="number"
                min={0}
                step={0.05}
                value={node.data.lengthKm}
                onChange={(event) => onPatchNode(node.id, { lengthKm: Math.max(0, Number(event.target.value) || 0) })}
              />
            </Row>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Metric label="Span total loss" value={`${computeFiberLoss(node.data).totalDb.toFixed(2)} dB`} />
              <Metric
                label="Attenuation"
                value={`${computeFiberLoss(node.data).attenuationDbPerKm.toFixed(2)} dB/km`}
              />
            </div>
            {isMultiModeProfile(node.data.fiberProfile) && node.data.lengthKm > MODAL_DISPERSION_LIMIT_KM ? (
              <p
                className="mb-3 rounded-md border px-2 py-2 text-body leading-relaxed"
                style={{
                  borderColor: 'var(--pu-warn)',
                  background: 'var(--pu-warn-soft)',
                  color: 'var(--pu-warn-text)',
                }}
              >
                {MODAL_DISPERSION_WARNING}
              </p>
            ) : null}
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <SliderRow
                label="Span length"
                value={node.data.lengthKm}
                min={0}
                max={40}
                step={0.05}
                unit="km"
                onChange={(value) => onPatchNode(node.id, { lengthKm: value })}
              />
              <Row label="Operating wavelength">
                <select
                  className="select"
                  aria-label="Fiber wavelength"
                  value={node.data.wavelength}
                  onChange={(event) => {
                    onPatchNode(node.id, {
                      wavelength: Number(event.target.value) as Wavelength,
                      attenuationOverrideDbPerKm: null,
                    });
                  }}
                >
                  {wavelengthsForProfile(node.data.fiberProfile).map((wavelength) => (
                    <option key={wavelength} value={wavelength}>
                      {WAVELENGTH_LABEL[wavelength]} — {ATTENUATION_DB_PER_KM[wavelength].toFixed(2)} dB/km
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Attenuation coefficient (dB/km)">
                <div className="flex gap-2">
                  <input
                    className="input"
                    aria-label="Attenuation override"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder={computeFiberLoss(node.data).attenuationDbPerKm.toFixed(2)}
                    value={node.data.attenuationOverrideDbPerKm ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      onPatchNode(node.id, {
                        attenuationOverrideDbPerKm: raw === '' ? null : Math.max(0, Number(raw)),
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    onClick={() => onPatchNode(node.id, { attenuationOverrideDbPerKm: null })}
                    title="Reset to the wavelength default"
                  >
                    Auto
                  </button>
                </div>
              </Row>
              <SliderRow
                label="Fusion splices"
                value={node.data.splices}
                min={0}
                max={20}
                step={1}
                unit={`× ${SPLICE_LOSS_DB} dB`}
                onChange={(value) => onPatchNode(node.id, { splices: value })}
              />
              <SliderRow
                label="SC/APC connectors"
                value={node.data.connectors}
                min={0}
                max={12}
                step={1}
                unit={`× ${CONNECTOR_LOSS_DB} dB`}
                onChange={(value) => onPatchNode(node.id, { connectors: value })}
              />
              <div className="mb-3">
                <div className="field-label">Field fault injection · learning allowances</div>
                <FaultToggle
                  label="Macro-bend fault (<15 mm)"
                  description="Pinched cable / tight bend"
                  penaltyDb={MACRO_BEND_PENALTY_DB}
                  active={Boolean(node.data.macroBendActive)}
                  onChange={(macroBendActive) => onPatchNode(node.id, { macroBendActive })}
                />
                <FaultToggle
                  label="Dirty SC/APC ferrule"
                  description="Dust or oil on ceramic end-face"
                  penaltyDb={DIRTY_CONNECTOR_PENALTY_DB}
                  active={Boolean(node.data.dirtyConnectorActive)}
                  onChange={(dirtyConnectorActive) => onPatchNode(node.id, { dirtyConnectorActive })}
                />
                <p className="mt-2 text-body leading-relaxed text-noc-500">
                  The +3.50 dB bend and +2.00 dB contamination penalties are simplified training values, not universal
                  field measurements.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Cable loss" value={`${computeFiberLoss(node.data).cableDb.toFixed(2)} dB`} />
                <Metric label="Span total" value={`${computeFiberLoss(node.data).totalDb.toFixed(2)} dB`} />
              </div>
              <PortNote>
                Left SC/APC termination (`in`) → {node.data.lengthKm.toFixed(3)} km span → Right SC/APC termination
                (`out`)
              </PortNote>
            </Advanced>
          </>
        ) : null}

        {node && isClosureNode(node) && showProperties ? (
          <>
            <SpliceTrayView
              channels={node.data.activeSpliceChannels}
              onChange={(activeSpliceChannels) => onPatchNode(node.id, { activeSpliceChannels })}
            />
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <SliderRow
                label="Modeled through-splice allowance"
                value={computeClosureSpliceLoss(node.data)}
                min={CLOSURE_SPLICE_LOSS_MIN_DB}
                max={CLOSURE_SPLICE_LOSS_MAX_DB}
                step={0.01}
                unit="dB per active branch"
                onChange={(spliceLossDb) => onPatchNode(node.id, { spliceLossDb })}
              />
              <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-body leading-relaxed text-slate-700">
                The closure passes one modeled fiber per active branch and adds one adjustable fusion-splice allowance.
                Tray occupancy is strand-level reference data, not a measured splice-loss value.
              </div>
              <PortNote>2 × cable gland inputs (`in-0`, `in-1`) → 4 × branch outputs (`out-A` .. `out-D`)</PortNote>
            </Advanced>
          </>
        ) : null}

        {node && isOdfNode(node) && showProperties ? (
          <>
            <SliderRow
              label="Modeled through-port loss"
              value={node.data.throughPortLossDb}
              min={0}
              max={3}
              step={0.05}
              unit="dB per pair"
              onChange={(throughPortLossDb) => onPatchNode(node.id, { throughPortLossDb })}
            />
            <div className="mb-3 rounded-md border border-[var(--pu-line)] bg-[var(--pu-pri-soft)] px-2 py-2 text-body leading-relaxed text-[var(--pu-ink)]">
              Two matched independent through-pairs: input 1 → output 1, input 2 → output 2. Patch cords remain graph
              edges.
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Optical inputs" value={ODF_INPUT_PORTS} />
                <Metric label="Matched outputs" value={ODF_OUTPUT_PORTS} />
              </div>
              <p className="mt-2 text-body leading-relaxed text-slate-500">
                Default {DEFAULT_ODF_THROUGH_PORT_LOSS_DB.toFixed(2)} dB is an educational adapter/through allowance,
                not a measured loss or vendor guarantee.
              </p>
              <PortNote>2 × SC/APC inputs (`in-0`, `in-1`) → 2 × matched SC/APC outputs (`out-0`, `out-1`)</PortNote>
            </Advanced>
          </>
        ) : null}

        {node && isNapNode(node) && showProperties ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Metric label="Split ratio" value={`1:${NAP_SPLIT_RATIO}`} accent="#c2410c" />
              <Metric label="Branch insertion loss" value={`${node.data.splitLossDb.toFixed(2)} dB`} accent="#c2410c" />
            </div>
            <div className="mb-3 rounded-md border border-orange-300 bg-orange-50 px-2 py-2 text-body leading-relaxed text-orange-900">
              Outdoor NAP/FAT model: one feeder input, eight drop outputs, and an internal fixed 1:8 split.
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Optical inputs" value={1} />
                <Metric label="Drop outputs" value={NAP_OUTPUT_PORTS} />
              </div>
              <p className="mt-2 text-body leading-relaxed text-slate-500">
                The {NAP_SPLIT_LOSS_DB.toFixed(1)} dB default is a fixed learning reference; real insertion loss and
                weather rating depend on the exact product and installation.
              </p>
              <PortNote>1 × feeder gland input (`in`) → 8 × outdoor SC/APC drop ports (`out-0` .. `out-7`)</PortNote>
            </Advanced>
          </>
        ) : null}

        {node && isAttenuatorNode(node) && showProperties ? (
          <>
            <Row label="Pad value">
              <select
                className="select"
                aria-label="Pad value"
                value={computeAttenuatorLoss(node.data)}
                onChange={(event) => onPatchNode(node.id, { attenuationDb: Number(event.target.value) })}
              >
                {ATTENUATOR_VALUES_DB.map((value) => (
                  <option key={value} value={value}>
                    {value} dB fixed
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Connector polish">
              <select
                className="select"
                aria-label="Attenuator polish"
                value={node.data.polish}
                onChange={(event) =>
                  onPatchNode(node.id, { polish: event.target.value as AttenuatorNodeData['polish'] })
                }
              >
                <option value="SC/APC">SC/APC (green, angled)</option>
                <option value="SC/UPC">SC/UPC (blue, flat)</option>
              </select>
            </Row>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Metric
                label="Insertion loss"
                value={`${computeAttenuatorLoss(node.data).toFixed(0)} dB`}
                accent="#b45309"
              />
              <Metric label="Overload limit" value={formatDbm(ONT_THRESHOLDS.overloadDbm)} accent="#b45309" />
            </div>
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2 py-2 text-body leading-relaxed text-amber-900">
              Add a pad only when the receiver would sit above the overload limit. The pad is wavelength-independent and
              adds no reflection to the OTDR trace.
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <p className="text-body leading-relaxed text-slate-500">
                Inline SC/APC barrel: the graph stays a straight through-path, so the pad simply subtracts a known
                number of decibels between the plant and the subscriber.
              </p>
              <PortNote>1 × input (`in`) → 1 × output (`out`)</PortNote>
            </Advanced>
          </>
        ) : null}

        {node && isOntNode(node) && showProperties ? (
          <>
            <Row label="Subscriber">
              <input
                className="input"
                aria-label="Subscriber"
                value={node.data.subscriber}
                onChange={(event) => onPatchNode(node.id, { subscriber: event.target.value })}
              />
            </Row>
            <Row label="ONT serial number">
              <input
                className="input"
                aria-label="Serial number"
                value={node.data.serial}
                onChange={(event) => onPatchNode(node.id, { serial: event.target.value })}
              />
            </Row>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Metric label="Rx power" value={formatDbm(telemetry?.rxPowerDbm ?? null)} />
              <Metric
                label="Link margin"
                value={telemetry?.rxPowerDbm === null || !telemetry ? '—' : `${telemetry.marginDb.toFixed(2)} dB`}
              />
            </div>
            <p className="text-body leading-relaxed text-slate-500">
              Open <strong>Optical Power</strong> for the full link budget breakdown.
            </p>
          </>
        ) : null}

        {node && isGatewayNode(node) && showProperties ? (
          <>
            <Row label="Subscriber">
              <input
                className="input"
                aria-label="Subscriber"
                value={node.data.subscriber}
                onChange={(event) => onPatchNode(node.id, { subscriber: event.target.value })}
              />
            </Row>
            <Row label="Gateway serial number">
              <input
                className="input"
                aria-label="Serial number"
                value={node.data.serial}
                onChange={(event) => onPatchNode(node.id, { serial: event.target.value })}
              />
            </Row>
            <Row label="Wi-Fi SSID">
              <input
                className="input"
                aria-label="Wi-Fi SSID"
                value={node.data.ssid}
                onChange={(event) => onPatchNode(node.id, { ssid: event.target.value })}
              />
            </Row>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Metric label="Optical Rx" value={formatDbm(telemetry?.rxPowerDbm ?? null)} />
              <Metric label="PON standard" value={gatewayTelemetry?.ponStandard ?? 'No active link'} />
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-body leading-relaxed text-slate-500">
                Representative interfaces: dual-band Wi-Fi 6, four Gigabit Ethernet LAN ports, and one FXS voice port.
                Exact radio streams, Ethernet options, and voice features vary by SKU.
              </div>
              <PortNote>1 × SC/APC subscriber optical receptacle (`in`)</PortNote>
            </Advanced>
          </>
        ) : null}

        {!node && edge && showProperties ? (
          <>
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-label text-slate-600">
              <div className="mb-1 font-semibold text-slate-800">Patch cord</div>
              <div className="break-all">
                {edge.source} → {edge.target}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Power at far end" value={formatDbm(simulation.edgeTelemetry[edge.id]?.powerDbm ?? null)} />
              <Metric label="State" value={(simulation.edgeTelemetry[edge.id]?.edgeState ?? 'idle').toUpperCase()} />
            </div>
            <Advanced open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
              <p className="text-body leading-relaxed text-slate-500">
                A patch cord adds no loss of its own — its attenuation belongs to the fiber span it terminates on.
                Delete it to break the optical path.
              </p>
            </Advanced>
          </>
        ) : null}

        {/* -------------------------------------------------------- Optical Power */}
        {showOptical ? (
          <div className="pu-optical">
            {node && isOltNode(node) ? (
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Tx launch power" value={`${node.data.txPowerDbm.toFixed(1)} dBm`} />
                <Metric label="Laser" value={node.data.laserOn ? 'Emitting' : 'Disabled'} />
                <Metric
                  label="Class budget"
                  value={`${OLT_CLASS_SPECS[node.data.oltClass].linkBudgetDb.toFixed(0)} dB`}
                />
                <Metric
                  label="Rx sensitivity"
                  value={`${OLT_CLASS_SPECS[node.data.oltClass].rxSensitivityDbm.toFixed(0)} dBm`}
                />
                <Metric label="Wavelength" value={`${node.data.wavelength} nm`} />
                <Metric
                  label="Downstream rate"
                  value={`${PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].downstreamGbps.toFixed(3)} Gbps`}
                />
              </div>
            ) : null}

            {node && isSplitterNode(node) ? (
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Split ratio" value={`1:${node.data.ratio}`} />
                <Metric
                  label="Insertion loss"
                  value={`${SPLITTER_LOSS_DB[node.data.ratio].toFixed(1)} dB`}
                  accent="var(--pu-pri)"
                />
                <Metric label="Excess / uniformity" value={`${node.data.excessLossDb.toFixed(2)} dB`} />
                <Metric label="Total loss" value={`${computeSplitterLoss(node.data).toFixed(2)} dB`} />
                <Metric label="Branch ports" value={splitterBranchPortCount(node.data.ratio)} />
                <Metric label="Fan-out per port" value={`1/${node.data.ratio}`} />
              </div>
            ) : null}

            {node && isFiberNode(node) ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Span length" value={`${node.data.lengthKm.toFixed(2)} km`} />
                  <Metric label="Cable loss" value={`${computeFiberLoss(node.data).cableDb.toFixed(2)} dB`} />
                  <Metric
                    label="Attenuation"
                    value={`${computeFiberLoss(node.data).attenuationDbPerKm.toFixed(2)} dB/km`}
                  />
                  <Metric
                    label="Span total"
                    value={`${computeFiberLoss(node.data).totalDb.toFixed(2)} dB`}
                    accent="var(--pu-ok)"
                  />
                  <Metric label="Fusion splices" value={`${node.data.splices} × ${SPLICE_LOSS_DB} dB`} />
                  <Metric label="SC/APC connectors" value={`${node.data.connectors} × ${CONNECTOR_LOSS_DB} dB`} />
                </div>
                {node.data.macroBendActive || node.data.dirtyConnectorActive ? (
                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-body leading-relaxed text-amber-900">
                    Field faults active:
                    {node.data.macroBendActive ? ` macro-bend +${MACRO_BEND_PENALTY_DB.toFixed(2)} dB.` : ''}
                    {node.data.dirtyConnectorActive
                      ? ` dirty ferrule +${DIRTY_CONNECTOR_PENALTY_DB.toFixed(2)} dB.`
                      : ''}
                  </div>
                ) : null}
              </>
            ) : null}

            {node && isClosureNode(node) ? (
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Active branches" value={node.data.activeSpliceChannels.filter(Boolean).length} />
                <Metric
                  label="Splice allowance"
                  value={`${computeClosureSpliceLoss(node.data).toFixed(2)} dB`}
                  accent="var(--pu-pri)"
                />
                <Metric label="Tray channels" value={SPLICE_TRAY_CHANNELS.length} />
                <Metric
                  label="Spare channels"
                  value={node.data.activeSpliceChannels.filter((active) => !active).length}
                />
              </div>
            ) : null}

            {node && isOdfNode(node) ? (
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="Through-port loss"
                  value={`${node.data.throughPortLossDb.toFixed(2)} dB`}
                  accent="var(--pu-pri)"
                />
                <Metric label="Inputs" value={ODF_INPUT_PORTS} />
                <Metric label="Matched outputs" value={ODF_OUTPUT_PORTS} />
                <Metric label="Reference default" value={`${DEFAULT_ODF_THROUGH_PORT_LOSS_DB.toFixed(2)} dB`} />
              </div>
            ) : null}

            {node && isNapNode(node) ? (
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Split ratio" value={`1:${NAP_SPLIT_RATIO}`} />
                <Metric label="Branch loss" value={`${node.data.splitLossDb.toFixed(2)} dB`} accent="var(--pu-pri)" />
                <Metric label="Drop outputs" value={NAP_OUTPUT_PORTS} />
                <Metric label="Reference default" value={`${NAP_SPLIT_LOSS_DB.toFixed(1)} dB`} />
              </div>
            ) : null}

            {node && isOntNode(node) && telemetry ? (
              <>
                <StatusBanner status={telemetry.status} detail={describeStatus(telemetry.status)} />
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Metric
                    label="Rx power"
                    value={formatDbm(telemetry.rxPowerDbm)}
                    accent={STATUS_STYLES[telemetry.status].hex}
                  />
                  <Metric
                    label="Link margin"
                    value={telemetry.rxPowerDbm === null ? '—' : `${telemetry.marginDb.toFixed(2)} dB`}
                  />
                  <Metric
                    label="Feeder route"
                    value={telemetry.rxPowerDbm === null ? '—' : `${telemetry.fiberKm.toFixed(2)} km`}
                  />
                  <Metric
                    label="Split ratio"
                    value={telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}
                  />
                </div>
                <div className="eyebrow mb-2">Link budget breakdown</div>
                <SegmentTable telemetry={telemetry} />
                <div className="mt-2 rounded-md border border-noc-700/60 bg-noc-950/50 p-2 font-mono text-label leading-relaxed text-noc-400">
                  <div className="mb-1 text-noc-300">P_rx = P_tx − ΣL − margin</div>
                  <div>
                    P_rx ={' '}
                    {formatDbm(telemetry.rxPowerDbm !== null ? telemetry.rxPowerDbm + telemetry.totalLossDb : null)} −{' '}
                    {telemetry.totalLossDb.toFixed(2)} dB
                  </div>
                  <div className="mt-1 text-noc-500">
                    Window: overload &gt; {ONT_THRESHOLDS.overloadDbm} · optimal ≥ {ONT_THRESHOLDS.optimalFloorDbm} ·
                    warn ≥ {ONT_THRESHOLDS.warningFloorDbm} dBm
                  </div>
                </div>
                {telemetry.candidatePaths.length > 1 ? (
                  <div className="mt-2 rounded-md border border-noc-700/60 bg-noc-950/50 p-2 font-mono text-label text-noc-400">
                    {telemetry.candidatePaths.length} OLT paths reach this ONT — showing the best (
                    {formatDbm(telemetry.rxPowerDbm)}).
                  </div>
                ) : null}
              </>
            ) : null}

            {node && isOntNode(node) && !telemetry ? (
              <p className="text-body leading-relaxed text-slate-500">
                This ONT has no live path to an OLT yet. Patch it to a splitter output to populate the optical budget.
              </p>
            ) : null}

            {node && isGatewayNode(node) && telemetry && gatewayTelemetry ? (
              <>
                <StatusBanner
                  status={telemetry.status}
                  detail={`${describeStatus(telemetry.status, gatewayTelemetry.ponStandard ?? undefined)} · SSID ${node.data.ssid}`}
                />
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Metric
                    label="Optical Rx"
                    value={formatDbm(telemetry.rxPowerDbm)}
                    accent={STATUS_STYLES[telemetry.status].hex}
                  />
                  <Metric
                    label="Link margin"
                    value={telemetry.rxPowerDbm === null ? '—' : `${telemetry.marginDb.toFixed(2)} dB`}
                  />
                  <Metric
                    label="PON standard"
                    value={gatewayTelemetry.ponStandard ?? 'No active link'}
                    accent="var(--pu-pri)"
                  />
                  <Metric
                    label="Split ratio"
                    value={telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}
                  />
                  <Metric
                    label="Down / up line rate"
                    value={
                      gatewayTelemetry.downstreamLineRateGbps === null
                        ? '—'
                        : `${gatewayTelemetry.downstreamLineRateGbps.toFixed(3)} / ${gatewayTelemetry.upstreamLineRateGbps?.toFixed(3)} Gbps`
                    }
                  />
                  <Metric
                    label="Estimated down / up"
                    value={
                      gatewayTelemetry.estimatedDownMbps === null
                        ? '—'
                        : `${gatewayTelemetry.estimatedDownMbps.toFixed(0)} / ${gatewayTelemetry.estimatedUpMbps?.toFixed(0)} Mbps`
                    }
                    accent="#047857"
                  />
                  <Metric
                    label="Internet IP (simulated)"
                    value={telemetry.status === 'ONLINE' ? gatewayTelemetry.serviceIpAddress : 'Not assigned'}
                  />
                </div>
                <p className="mb-3 text-body text-slate-500">
                  TEST-NET placeholder only; DHCP, routing, and live Internet reachability are not modeled.
                </p>
                <div className="eyebrow mb-2">Optical path &amp; service audit</div>
                <SegmentTable telemetry={telemetry} />
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-body leading-relaxed text-amber-900">
                  Speed estimate divides the nominal shared PON line rate by the modeled cumulative split ratio. It does
                  not model contention, protocol overhead, Wi-Fi conditions, a service plan, or a measured speed test.
                </div>
              </>
            ) : null}

            {node && isGatewayNode(node) && !telemetry ? (
              <p className="text-body leading-relaxed text-slate-500">
                Gateway supports GPON and XGS-PON in this reference model. Connect its optical input to a live OLT path
                to populate optical and service telemetry.
              </p>
            ) : null}

            {!node && edge ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="Power at far end"
                    value={formatDbm(simulation.edgeTelemetry[edge.id]?.powerDbm ?? null)}
                  />
                  <Metric
                    label="State"
                    value={(simulation.edgeTelemetry[edge.id]?.edgeState ?? 'idle').toUpperCase()}
                  />
                </div>
                <p className="mt-2 text-body leading-relaxed text-slate-500">
                  A patch cord adds no loss of its own — its attenuation belongs to the fiber span it terminates on.
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Destructive action: a two-step confirm, so a stray tap cannot delete. */}
      {node || edge ? (
        <div className="pu-insp-foot">
          {confirmingDelete ? (
            <div className="pu-confirm" role="alertdialog" aria-label="Confirm removal">
              <p>
                Remove <strong>{node ? cardName : 'this patch cord'}</strong>?
              </p>
              <div className="pu-confirm-actions">
                <button type="button" className="pu-btn pu-btn-quiet" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="pu-btn pu-btn-danger"
                  onClick={() => {
                    setConfirmingDelete(false);
                    if (node) onDeleteNode(node.id);
                    else if (edge) onDeleteEdge(edge.id);
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="pu-btn pu-btn-danger pu-btn-block"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={14} aria-hidden="true" />
              {node ? 'Remove component' : 'Delete patch cord'}
            </button>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function PortNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-[#EED8BF] bg-[#FFF4E6] p-2 text-label text-[#2B1A14]">
      <div className="mb-1 font-mono text-caption font-bold uppercase tracking-label text-[#C8502B]">
        Physical Optical Interface Ports
      </div>
      <div>{children}</div>
    </div>
  );
}

export default Inspector;
