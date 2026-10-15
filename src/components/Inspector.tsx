import { useMemo, useState } from 'react';
import { artForNode } from './hardware/hardwareArt';
import {
  Cable,
  AlertTriangle,
  CircleSlash,
  Link2,
  Network,
  PackageOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelsTopLeft,
  Radio,
  Router,
  Split,
  Wifi,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CableType,
  GatewayTelemetry,
  OltClass,
  PonEdge,
  PonStandard,
  SubscriberOpticalTelemetry,
  PonNode,
  SimulationResult,
  SplitRatio,
  Wavelength,
} from '../types';
import {
  ATTENUATION_DB_PER_KM,
  CABLE_SPECS,
  DEFAULT_ODF_THROUGH_PORT_LOSS_DB,
  NAP_OUTPUT_PORTS,
  NAP_SPLIT_LOSS_DB,
  NAP_SPLIT_RATIO,
  ODF_INPUT_PORTS,
  ODF_OUTPUT_PORTS,
  PON_STANDARD_SPECS,
  CLOSURE_SPLICE_LOSS_MAX_DB,
  CLOSURE_SPLICE_LOSS_MIN_DB,
  CONNECTOR_LOSS_DB,
  DIRTY_CONNECTOR_PENALTY_DB,
  MACRO_BEND_PENALTY_DB,
  OLT_CLASS_SPECS,
  ONT_THRESHOLDS,
  SPLICE_TRAY_CHANNELS,
  SPLIT_RATIOS,
  SPLITTER_LOSS_DB,
  SPLICE_LOSS_DB,
  STATUS_STYLES,
  WAVELENGTH_LABEL,
} from '../types';
import {
  computeClosureSpliceLoss,
  computeFiberLoss,
  computeSplitterLoss,
  describeStatus,
  formatDbm,
  isClosureNode,
  isFiberNode,
  isGatewayNode,
  isNapNode,
  isOdfNode,
  isOltNode,
  isOntNode,
  isSplitterNode,
} from '../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../data/componentCatalogue';
import type { UnitCostProfile } from '../data/pricingCatalogue';
import { FieldHardwareCard } from './FieldHardwareCard';
import { PricingSettings } from './PricingSettings';

/* ========================================================================== *
 * Properties Inspector — live editing of every physical parameter.
 * ========================================================================== */

interface InspectorProps {
  node: PonNode | null;
  edge: PonEdge | null;
  simulation: SimulationResult;
  unitCosts: UnitCostProfile;
  onUnitCostsChange: (unitCosts: UnitCostProfile) => void;
  onResetUnitCosts: () => void;
  onPatchNode: (nodeId: string, patch: Partial<PonNode['data']>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <label className="field-label">{label}</label>
      {children}
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
        <label className="text-[11px] font-medium text-noc-300">{label}</label>
        <span className="font-mono text-[11px] font-semibold text-sky-300">
          {value.toFixed(step < 1 ? 2 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
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
      <AlertTriangle size={15} className={active ? 'text-orange-700' : 'text-stone-400'} aria-hidden="true" />
      <span className="fiber-fault-control-copy">
        <strong>{label}</strong>
        <small>{description} · {active ? `+${penaltyDb.toFixed(2)} dB active` : 'no added loss'}</small>
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

function SpliceTrayView({
  channels,
  onChange,
}: {
  channels: boolean[];
  onChange: (channels: boolean[]) => void;
}) {
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
        Green heat-shrink sleeves mark active joints. Branches A–D map to channels 1–4 in this simplified cable-level graph; channels 5–12 are reserve tray positions.
      </p>
    </section>
  );
}

function SegmentTable({ telemetry }: { telemetry: SubscriberOpticalTelemetry }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full font-mono text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="px-2 py-1 text-left font-medium">Element</th>
            <th className="px-2 py-1 text-right font-medium">Loss</th>
          </tr>
        </thead>
        <tbody>
          {telemetry.segments.length === 0 ? (
            <tr>
              <td className="px-2 py-1.5 text-slate-500" colSpan={2}>
                No active path
              </td>
            </tr>
          ) : (
            telemetry.segments.map((segment, index) => (
              <tr key={`${segment.component}-${index}`} className="border-t border-slate-200/80">
                <td className="px-2 py-1 text-slate-700">{segment.label}</td>
                <td className="px-2 py-1 text-right font-semibold text-amber-700">
                  −{segment.lossDb.toFixed(2)}
                </td>
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

type InspectorTab = 'all' | 'properties' | 'optical' | 'ports' | 'info';

export function Inspector({
  node,
  edge,
  simulation,
  unitCosts,
  onUnitCostsChange,
  onResetUnitCosts,
  onPatchNode,
  onDeleteNode,
  onDeleteEdge,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('properties');
  const showProperties = activeTab === 'properties';
  const showOptical = activeTab === 'optical';
  const showPorts = activeTab === 'properties';
  const showInfo = activeTab === 'info';
  const telemetry: SubscriberOpticalTelemetry | undefined = node
    ? isOntNode(node)
      ? simulation.ontTelemetry[node.id]
      : isGatewayNode(node)
        ? simulation.gatewayTelemetry[node.id]
        : undefined
    : undefined;
  const gatewayTelemetry: GatewayTelemetry | undefined = node && isGatewayNode(node)
    ? simulation.gatewayTelemetry[node.id]
    : undefined;

  const header = useMemo(() => {
    if (node) {
      if (isOltNode(node)) return { icon: <Radio size={14} />, title: 'OLT Transceiver', accent: '#2563eb' };
      if (isSplitterNode(node)) return { icon: <Split size={14} />, title: 'Optical Splitter', accent: '#7c3aed' };
      if (isFiberNode(node)) return { icon: <Cable size={14} />, title: 'Fiber Cable Span', accent: '#a16207' };
      if (isClosureNode(node)) return { icon: <PackageOpen size={14} />, title: 'Dome Splice Closure', accent: '#2b3033' };
      if (isOdfNode(node)) return { icon: <PanelsTopLeft size={14} />, title: 'ODF Rack Panel', accent: '#0f766e' };
      if (isNapNode(node)) return { icon: <Network size={14} />, title: 'Outdoor NAP / FAT', accent: '#c2410c' };
      if (isGatewayNode(node)) return { icon: <Wifi size={14} />, title: 'Wi-Fi 6 PON Gateway', accent: '#2563eb' };
      if (isOntNode(node)) return { icon: <Router size={14} />, title: 'ONT / ONU', accent: '#16a34a' };
    }
    return { icon: <Link2 size={14} />, title: 'Optical Patch Cord', accent: '#64748b' };
  }, [node]);

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
      return {
        profile: getHardwareProfileForNode('fiber', node.data.cableType),
        configurationLabel: `${CABLE_SPECS[node.data.cableType].label} · ${node.data.lengthKm.toFixed(3)} km`,
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
      return 'Single-mode optical cable span. Loss scales with distance (km × dB/km) plus fusion splices and SC/APC connectors.';
    }
    if (isClosureNode(node)) {
      return 'Weatherproof outside-plant splice dome where feeder fibers are fusion-spliced to distribution branches.';
    }
    if (isOdfNode(node)) {
      return 'Rack-mounted optical patch panel providing clean bulkhead jumper test points at the central office.';
    }
    if (isNapNode(node)) {
      return 'Outdoor pole/wall distribution box with an internal 1:8 splitter serving up to 8 subscriber drop cables.';
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

  return (
    <aside
      className={`fiberlab-inspector flex h-full shrink-0 flex-col border-l border-slate-200 bg-white transition-[width] duration-200 ${
        collapsed ? 'is-collapsed w-[40px]' : 'w-[300px]'
      }`}
    >
      {collapsed ? (
        <div className="flex h-full flex-col items-center py-2.5 gap-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn-ghost !p-1.5"
            aria-label="Expand inspector"
            title="Expand Inspector"
          >
            <PanelRightOpen size={15} />
          </button>
          <span
            className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400"
            style={{ writingMode: 'vertical-rl' }}
          >
            Inspector
          </span>
        </div>
      ) : null}

      <div className={collapsed ? 'sr-only' : 'flex h-full flex-col overflow-hidden'}>
      <div className="pu-insp-head">
        <span>Selected Component</span>
        <div className="flex items-center gap-1">
          {onToggleCollapse ? (
            <button type="button" className="btn-ghost !p-1" onClick={onToggleCollapse} aria-label="Collapse inspector" title="Collapse Inspector">
              <PanelRightClose size={14} />
            </button>
          ) : null}
          <button type="button" className="btn-ghost !p-1" onClick={onClose} aria-label="Close inspector" title="Clear selection">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="pu-insp-card">
        <div className="pic">
          {hardwareInfo ? (
            <img src={artForNode(node?.type, node && isSplitterNode(node) ? node.data.ratio : undefined) ?? hardwareInfo.profile.thumbnailSvg} alt={`${hardwareInfo.profile.modelName} illustration`} draggable={false} />
          ) : (
            <span style={{ color: header.accent }}>{header.icon}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <h4 className="truncate">{cardName}</h4>
          {cardStatus ? (
            <span className={`pu-badge ${cardTone}`}>● {cardStatus.label}</span>
          ) : (
            <div className="pu-mut" style={{ fontSize: 11 }}>{node?.id ?? edge?.id ?? 'Workbench Guide'}</div>
          )}
          {telemetry ? <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDbm(telemetry.rxPowerDbm)}</div> : null}
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

      <div className="fiberlab-inspector-content flex-1 overflow-y-auto px-3 py-2.5">
        {beginnerSummary ? (
          <div className="mb-2.5 rounded-lg border border-[#F0D1B1] bg-[#FFF0DF]/80 px-2.5 py-1.5 text-[10.5px] leading-snug text-[#2B1A14]">
            {beginnerSummary}
          </div>
        ) : null}

        {hardwareInfo && showInfo ? (
          <FieldHardwareCard
            profile={hardwareInfo.profile}
            configurationLabel={hardwareInfo.configurationLabel}
          />
        ) : null}

        {node && isClosureNode(node) && showPorts ? (
          <SpliceTrayView
            channels={node.data.activeSpliceChannels}
            onChange={(activeSpliceChannels) => onPatchNode(node.id, { activeSpliceChannels })}
          />
        ) : null}

        {node && !isClosureNode(node) && activeTab === 'ports' ? (
          <div className="mb-3 rounded-lg border border-[#EED8BF] bg-[#FFF4E6] p-2.5 text-[11px] text-[#2B1A14]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#C8502B] mb-1">
              Physical Optical Interface Ports
            </div>
            {isOltNode(node) ? (
              <div>1 × SC/UPC headend output port (`out`) on SFP cage 1 · {node.data.portName}</div>
            ) : isSplitterNode(node) ? (
              <div>1 × SC/APC input (`in`) → {node.data.ratio} × SC/APC fanout outputs (`out-0` .. `out-{node.data.ratio - 1}`)</div>
            ) : isOdfNode(node) ? (
              <div>2 × SC/APC inputs (`in-0`, `in-1`) → 2 × matched SC/APC outputs (`out-0`, `out-1`)</div>
            ) : isNapNode(node) ? (
              <div>1 × feeder gland input (`in`) → 8 × outdoor SC/APC drop ports (`out-0` .. `out-7`)</div>
            ) : isFiberNode(node) ? (
              <div>Left SC/APC termination (`in`) → {node.data.lengthKm.toFixed(3)} km span → Right SC/APC termination (`out`)</div>
            ) : (
              <div>1 × SC/APC subscriber optical receptacle (`in`)</div>
            )}
          </div>
        ) : null}

        {!node && !edge ? (
          <div className="mb-3 rounded-xl border border-[#EED8BF] bg-[#FFFFFF] p-3">
            <div className="flex items-center gap-2 mb-2">
              <CircleSlash size={16} className="text-[#E4673F] shrink-0" />
              <span className="text-[12px] font-bold text-[#231712]">Nothing selected</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#6E5649] mb-2.5">
              Click any hardware unit or fiber cable on the canvas to configure its optical ports, loss parameters, and link budget.
            </p>
            <div className="space-y-1.5 text-[10.5px] text-[#6E5649] border-t border-[#EED8BF] pt-2">
              <div><strong className="text-[#231712]">1. Add Hardware:</strong> Drag from the left Component Toolbox or double-click an item.</div>
              <div><strong className="text-[#231712]">2. Patch Ports:</strong> Drag between green SC/APC or blue SC/UPC port handles.</div>
              <div><strong className="text-[#231712]">3. Simulate &amp; Test:</strong> Click <span className="font-semibold text-[#C8502B]">Run Simulation</span>, <span className="font-semibold text-[#231712]">OPM Tool</span>, or <span className="font-semibold text-[#231712]">OTDR Trace</span>.</div>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------------------ OLT */}
        {node && isOltNode(node) && (showProperties || showOptical) ? (
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
            <Row label="Transceiver class">
              <select
                className="select"
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
            <SliderRow
              label="Tx launch power"
              value={node.data.txPowerDbm}
              min={-5}
              max={10}
              step={0.1}
              unit="dBm"
              onChange={(value) => onPatchNode(node.id, { txPowerDbm: value })}
            />
            <Row label="Operating wavelength">
              {(node.data.ponStandard ?? 'GPON') === 'GPON' ? (
                <select
                  className="select"
                  value={node.data.wavelength}
                  onChange={(event) =>
                    onPatchNode(node.id, { wavelength: Number(event.target.value) as Wavelength })
                  }
                >
                  <option value={1310}>{WAVELENGTH_LABEL[1310]}</option>
                  <option value={1490}>{WAVELENGTH_LABEL[1490]}</option>
                </select>
              ) : (
                <div className="rounded-md border border-sky-300 bg-sky-50 px-2 py-2 font-mono text-[10px] text-sky-900">
                  Downstream 1577 nm · {ATTENUATION_DB_PER_KM[1577].toFixed(2)} dB/km<br />
                  Upstream 1270 nm · {ATTENUATION_DB_PER_KM[1270].toFixed(2)} dB/km (not simulated)
                </div>
              )}
            </Row>
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[9px] leading-relaxed text-slate-600">
              Nominal PON line rate: {PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].downstreamGbps.toFixed(3)} Gbps downstream / {PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].upstreamGbps.toFixed(3)} Gbps upstream. These are shared line rates, not guaranteed subscriber throughput.
              {(node.data.ponStandard ?? 'GPON') === 'XGS-PON' ? ' XGS-PON launch-class budgets are not separately modeled.' : ''}
            </div>
            <div className="mb-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
              <div>
                <div className="text-[11px] font-medium text-slate-800">Laser transmitter</div>
                <div className="font-mono text-[10px] text-slate-500">
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
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Class budget</div>
                <div className="metric-value">
                  {OLT_CLASS_SPECS[node.data.oltClass].linkBudgetDb.toFixed(0)} dB
                </div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Rx sensitivity</div>
                <div className="metric-value">
                  {OLT_CLASS_SPECS[node.data.oltClass].rxSensitivityDbm.toFixed(0)} dBm
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* -------------------------------------------------------- Splitter */}
        {node && isSplitterNode(node) && (showProperties || showOptical) ? (
          <>
            <Row label="Split ratio">
              <select
                className="select"
                value={node.data.ratio}
                onChange={(event) =>
                  onPatchNode(node.id, { ratio: Number(event.target.value) as SplitRatio })
                }
              >
                {SPLIT_RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    1:{ratio}
                  </option>
                ))}
              </select>
            </Row>
            <div className="mb-3 overflow-hidden rounded-md border border-slate-200">
              <table className="w-full font-mono text-[10px]">
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
                        ratio === node.data.ratio ? 'bg-violet-50 font-semibold text-violet-800' : 'text-slate-700'
                      }`}
                    >
                      <td className="px-2 py-0.5">1:{ratio}</td>
                      <td className="px-2 py-0.5 text-right">{SPLITTER_LOSS_DB[ratio].toFixed(1)} dB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SliderRow
              label="Excess / uniformity loss"
              value={node.data.excessLossDb}
              min={0}
              max={3}
              step={0.05}
              unit="dB"
              onChange={(value) => onPatchNode(node.id, { excessLossDb: value })}
            />
            <div className="metric">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Total insertion loss</div>
              <div className="metric-value text-violet-700">
                {computeSplitterLoss(node.data).toFixed(2)} dB
              </div>
            </div>
          </>
        ) : null}

        {/* --------------------------------------------------------------- ODF */}
        {node && isOdfNode(node) && (showProperties || showOptical) ? (
          <>
            <div className="mb-3 rounded-md border border-teal-300 bg-teal-50 px-2.5 py-2 text-[10px] leading-relaxed text-teal-900">
              Two matched independent through-pairs: input 1 → output 1, input 2 → output 2. Patch cords remain graph edges.
            </div>
            <SliderRow
              label="Modeled through-port loss"
              value={node.data.throughPortLossDb}
              min={0}
              max={3}
              step={0.05}
              unit="dB per pair"
              onChange={(throughPortLossDb) => onPatchNode(node.id, { throughPortLossDb })}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Optical inputs</div>
                <div className="metric-value">{ODF_INPUT_PORTS}</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Matched outputs</div>
                <div className="metric-value">{ODF_OUTPUT_PORTS}</div>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
              Default {DEFAULT_ODF_THROUGH_PORT_LOSS_DB.toFixed(2)} dB is an educational adapter/through allowance, not a measured loss or vendor guarantee.
            </p>
          </>
        ) : null}

        {/* --------------------------------------------------------------- NAP */}
        {node && isNapNode(node) && (showProperties || showOptical) ? (
          <>
            <div className="mb-3 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-2 text-[10px] leading-relaxed text-orange-900">
              Outdoor NAP/FAT model: one feeder input, eight drop outputs, and an internal fixed 1:8 split.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Split ratio</div>
                <div className="metric-value text-orange-800">1:{NAP_SPLIT_RATIO}</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Branch insertion loss</div>
                <div className="metric-value text-orange-800">{node.data.splitLossDb.toFixed(2)} dB</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Optical inputs</div>
                <div className="metric-value">1</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Drop outputs</div>
                <div className="metric-value">{NAP_OUTPUT_PORTS}</div>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
              The {NAP_SPLIT_LOSS_DB.toFixed(1)} dB default is a fixed learning reference; real insertion loss and weather rating depend on the exact product and installation.
            </p>
          </>
        ) : null}

        {/* --------------------------------------------------------- Closure */}
        {node && isClosureNode(node) && (showProperties || showOptical) ? (
          <>
            <SliderRow
              label="Modeled through-splice allowance"
              value={computeClosureSpliceLoss(node.data)}
              min={CLOSURE_SPLICE_LOSS_MIN_DB}
              max={CLOSURE_SPLICE_LOSS_MAX_DB}
              step={0.01}
              unit="dB per active branch"
              onChange={(spliceLossDb) => onPatchNode(node.id, { spliceLossDb })}
            />
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[9px] leading-relaxed text-slate-700">
              The closure passes one modeled fiber per active branch and adds one adjustable fusion-splice allowance. Tray occupancy is strand-level reference data, not a measured splice-loss value.
            </div>
          </>
        ) : null}

        {/* ----------------------------------------------------------- Fiber */}
        {node && isFiberNode(node) && (showProperties || showOptical) ? (
          <>
            <Row label="Cable preset">
              <select
                className="select"
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
                type="number"
                min={0}
                step={0.05}
                value={node.data.lengthKm}
                onChange={(event) =>
                  onPatchNode(node.id, { lengthKm: Math.max(0, Number(event.target.value) || 0) })
                }
              />
            </Row>
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
                value={node.data.wavelength}
                onChange={(event) => {
                  onPatchNode(node.id, {
                    wavelength: Number(event.target.value) as Wavelength,
                    attenuationOverrideDbPerKm: null,
                  });
                }}
              >
                <option value={1270}>
                  {WAVELENGTH_LABEL[1270]} — {ATTENUATION_DB_PER_KM[1270].toFixed(2)} dB/km
                </option>
                <option value={1310}>
                  {WAVELENGTH_LABEL[1310]} — {ATTENUATION_DB_PER_KM[1310].toFixed(2)} dB/km
                </option>
                <option value={1490}>
                  {WAVELENGTH_LABEL[1490]} — {ATTENUATION_DB_PER_KM[1490].toFixed(2)} dB/km
                </option>
                <option value={1550}>
                  {WAVELENGTH_LABEL[1550]} — {ATTENUATION_DB_PER_KM[1550].toFixed(2)} dB/km
                </option>
                <option value={1577}>
                  {WAVELENGTH_LABEL[1577]} — {ATTENUATION_DB_PER_KM[1577].toFixed(2)} dB/km
                </option>
              </select>
            </Row>
            <Row label="Attenuation coefficient (dB/km)">
              <div className="flex gap-1.5">
                <input
                  className="input"
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
              <p className="mt-1.5 text-[9px] leading-relaxed text-noc-500">
                The +3.50 dB bend and +2.00 dB contamination penalties are simplified training values, not universal field measurements.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Cable loss</div>
                <div className="metric-value">{computeFiberLoss(node.data).cableDb.toFixed(2)} dB</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Span total</div>
                <div className="metric-value text-emerald-300">
                  {computeFiberLoss(node.data).totalDb.toFixed(2)} dB
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* ------------------------------------------------------------- ONT */}
        {node && isOntNode(node) && (showProperties || showOptical) ? (
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
            {telemetry ? (
              <>
                <div
                  className="mb-3 flex items-center gap-2 rounded-md border px-2.5 py-2"
                  style={{
                    borderColor: `${STATUS_STYLES[telemetry.status].hex}66`,
                    background: `${STATUS_STYLES[telemetry.status].hex}14`,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: STATUS_STYLES[telemetry.status].hex,
                      boxShadow: `0 0 8px ${STATUS_STYLES[telemetry.status].hex}`,
                    }}
                  />
                  <div className="min-w-0">
                    <div
                      className="font-mono text-[12px] font-bold"
                      style={{ color: STATUS_STYLES[telemetry.status].hex }}
                    >
                      {STATUS_STYLES[telemetry.status].label}
                    </div>
                    <div className="truncate text-[10px] text-noc-400">
                      {describeStatus(telemetry.status)}
                    </div>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Rx power</div>
                    <div
                      className="metric-value"
                      style={{ color: STATUS_STYLES[telemetry.status].hex }}
                    >
                      {formatDbm(telemetry.rxPowerDbm)}
                    </div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Link margin</div>
                    <div className="metric-value">
                      {telemetry.rxPowerDbm === null ? '—' : `${telemetry.marginDb.toFixed(2)} dB`}
                    </div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Feeder route</div>
                    <div className="metric-value">
                      {telemetry.rxPowerDbm === null ? '—' : `${telemetry.fiberKm.toFixed(2)} km`}
                    </div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Split ratio</div>
                    <div className="metric-value">
                      {telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}
                    </div>
                  </div>
                </div>
                <div className="eyebrow mb-1.5">Link budget breakdown</div>
                <SegmentTable telemetry={telemetry} />
                <div className="mt-2 rounded-md border border-noc-700/60 bg-noc-950/50 p-2 font-mono text-[10px] leading-relaxed text-noc-400">
                  <div className="mb-1 text-noc-300">
                    P_rx = P_tx − ΣL − margin
                  </div>
                  <div>
                    P_rx = {formatDbm(telemetry.rxPowerDbm !== null
                      ? telemetry.rxPowerDbm + telemetry.totalLossDb
                      : null)}{' '}
                    − {telemetry.totalLossDb.toFixed(2)} dB
                  </div>
                  <div className="mt-1 text-noc-500">
                    Window: overload &gt; {ONT_THRESHOLDS.overloadDbm} · optimal ≥{' '}
                    {ONT_THRESHOLDS.optimalFloorDbm} · warn ≥ {ONT_THRESHOLDS.warningFloorDbm} dBm
                  </div>
                </div>
                {telemetry.candidatePaths.length > 1 ? (
                  <div className="mt-2 rounded-md border border-noc-700/60 bg-noc-950/50 p-2 font-mono text-[10px] text-noc-400">
                    {telemetry.candidatePaths.length} OLT paths reach this ONT — showing the best (
                    {formatDbm(telemetry.rxPowerDbm)}).
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {/* --------------------------------------------------------- Gateway */}
        {node && isGatewayNode(node) && (showProperties || showOptical) ? (
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
            {telemetry && gatewayTelemetry ? (
              <>
                <div
                  className="mb-3 flex items-center gap-2 rounded-md border px-2.5 py-2"
                  style={{
                    borderColor: `${STATUS_STYLES[telemetry.status].hex}66`,
                    background: `${STATUS_STYLES[telemetry.status].hex}14`,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: STATUS_STYLES[telemetry.status].hex,
                      boxShadow: `0 0 8px ${STATUS_STYLES[telemetry.status].hex}`,
                    }}
                  />
                  <div>
                    <div className="font-mono text-[12px] font-bold" style={{ color: STATUS_STYLES[telemetry.status].hex }}>
                      {STATUS_STYLES[telemetry.status].label}
                    </div>
                    <div className="text-[10px] text-noc-400">{describeStatus(telemetry.status, gatewayTelemetry.ponStandard ?? undefined)} · SSID {node.data.ssid}</div>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Optical Rx</div>
                    <div className="metric-value" style={{ color: STATUS_STYLES[telemetry.status].hex }}>{formatDbm(telemetry.rxPowerDbm)}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Link margin</div>
                    <div className="metric-value">{telemetry.rxPowerDbm === null ? '—' : `${telemetry.marginDb.toFixed(2)} dB`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">PON standard</div>
                    <div className="metric-value text-blue-700">{gatewayTelemetry.ponStandard ?? 'No active link'}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Split ratio</div>
                    <div className="metric-value">{telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Down / up line rate</div>
                    <div className="metric-value">{gatewayTelemetry.downstreamLineRateGbps === null ? '—' : `${gatewayTelemetry.downstreamLineRateGbps.toFixed(3)} / ${gatewayTelemetry.upstreamLineRateGbps?.toFixed(3)} Gbps`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Estimated down / up</div>
                    <div className="metric-value text-emerald-700">{gatewayTelemetry.estimatedDownMbps === null ? '—' : `${gatewayTelemetry.estimatedDownMbps.toFixed(0)} / ${gatewayTelemetry.estimatedUpMbps?.toFixed(0)} Mbps`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Internet IP (simulated)</div>
                    <div className="metric-value">{telemetry.status === 'ONLINE' ? gatewayTelemetry.serviceIpAddress : 'Not assigned'}</div>
                  </div>
                </div>
                <p className="mb-3 text-[9px] text-slate-500">TEST-NET placeholder only; DHCP, routing, and live Internet reachability are not modeled.</p>
                <div className="eyebrow mb-1.5">Optical path &amp; service audit</div>
                <SegmentTable telemetry={telemetry} />
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[9px] leading-relaxed text-amber-900">
                  Speed estimate divides the nominal shared PON line rate by the modeled cumulative split ratio. It does not model contention, protocol overhead, Wi-Fi conditions, a service plan, or a measured speed test.
                </div>
              </>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600">
                Gateway supports GPON and XGS-PON in this reference model. Connect its optical input to a live OLT path to populate optical and service telemetry.
              </div>
            )}
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[9px] leading-relaxed text-slate-500">
              Representative interfaces: dual-band Wi-Fi 6, four Gigabit Ethernet LAN ports, and one FXS voice port. Exact radio streams, Ethernet options, and voice features vary by SKU.
            </div>
          </>
        ) : null}

        {/* ------------------------------------------------------------ Edge */}
        {!node && edge ? (
          <>
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[10px] text-slate-600">
              <div className="mb-1 text-slate-800 font-semibold">Patch cord</div>
              <div className="break-all">{edge.source} → {edge.target}</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Power at far end</div>
                <div className="metric-value">
                  {formatDbm(simulation.edgeTelemetry[edge.id]?.powerDbm ?? null)}
                </div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">State</div>
                <div className="metric-value uppercase">
                  {simulation.edgeTelemetry[edge.id]?.edgeState ?? 'idle'}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              A patch cord adds no loss of its own — its attenuation belongs to the fiber span it
              terminates on. Delete it to break the optical path.
            </p>
            <button type="button" className="btn-danger mt-3 w-full" onClick={() => onDeleteEdge(edge.id)}>
              <Trash2 size={13} /> Delete patch cord
            </button>
          </>
        ) : null}

        {showInfo ? (
          <PricingSettings
            unitCosts={unitCosts}
            onChange={onUnitCostsChange}
            onReset={onResetUnitCosts}
          />
        ) : null}
      </div>

      {node ? (
        <div className="border-t border-slate-200 p-2.5">
          <button type="button" className="btn-danger w-full" onClick={() => onDeleteNode(node.id)}>
            <Trash2 size={13} /> Remove component
          </button>
        </div>
      ) : null}
      </div>
    </aside>
  );
}

export default Inspector;
