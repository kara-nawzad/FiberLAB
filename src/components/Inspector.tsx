import { useMemo } from 'react';
import {
  Cable,
  AlertTriangle,
  CircleSlash,
  Link2,
  Network,
  PackageOpen,
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
    <div className="overflow-hidden rounded-md border border-noc-700/60">
      <table className="w-full font-mono text-[10px]">
        <thead>
          <tr className="bg-noc-800/80 text-noc-400">
            <th className="px-2 py-1 text-left font-medium">Element</th>
            <th className="px-2 py-1 text-right font-medium">Loss</th>
          </tr>
        </thead>
        <tbody>
          {telemetry.segments.length === 0 ? (
            <tr>
              <td className="px-2 py-1.5 text-noc-500" colSpan={2}>
                No active path
              </td>
            </tr>
          ) : (
            telemetry.segments.map((segment, index) => (
              <tr key={`${segment.component}-${index}`} className="border-t border-noc-700/50">
                <td className="px-2 py-1 text-noc-300">{segment.label}</td>
                <td className="px-2 py-1 text-right text-amber-300">
                  −{segment.lossDb.toFixed(2)}
                </td>
              </tr>
            ))
          )}
          <tr className="border-t border-noc-600 bg-noc-800/60 font-semibold text-noc-200">
            <td className="px-2 py-1">Total path loss</td>
            <td className="px-2 py-1 text-right">−{telemetry.totalLossDb.toFixed(2)} dB</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

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
}: InspectorProps) {
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

  return (
    <aside className="fiberlab-inspector flex h-full w-[300px] shrink-0 flex-col border-l border-noc-700/70 bg-noc-900/70">
      <div className="fiberlab-inspector-header panel-header">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${header.accent}22`, color: header.accent }}
          >
            {header.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-noc-200">{header.title}</div>
            <div className="truncate font-mono text-[10px] text-noc-500">
              {node?.id ?? edge?.id ?? '—'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost !p-1.5"
          onClick={onClose}
          aria-label="Close inspector"
          title="Close inspector"
        >
          <X size={14} />
        </button>
      </div>

      <div className="fiberlab-inspector-content flex-1 overflow-y-auto px-3 py-3">
        {hardwareInfo ? (
          <FieldHardwareCard
            profile={hardwareInfo.profile}
            configurationLabel={hardwareInfo.configurationLabel}
          />
        ) : null}

        {node && isClosureNode(node) ? (
          <SpliceTrayView
            channels={node.data.activeSpliceChannels}
            onChange={(activeSpliceChannels) => onPatchNode(node.id, { activeSpliceChannels })}
          />
        ) : null}

        {!node && !edge ? (
          <div className="mt-10 px-4 text-center">
            <CircleSlash size={28} className="mx-auto mb-3 text-noc-600" />
            <p className="text-[12px] font-medium text-noc-300">Nothing selected</p>
            <p className="mt-1 text-[11px] leading-relaxed text-noc-500">
              Click any element or patch cord on the canvas to inspect and edit its physical
              parameters.
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------------------ OLT */}
        {node && isOltNode(node) ? (
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
                <div className="rounded-md border border-sky-500/25 bg-sky-500/[0.06] px-2 py-2 font-mono text-[10px] text-sky-100">
                  Downstream 1577 nm · {ATTENUATION_DB_PER_KM[1577].toFixed(2)} dB/km<br />
                  Upstream 1270 nm · {ATTENUATION_DB_PER_KM[1270].toFixed(2)} dB/km (not simulated)
                </div>
              )}
            </Row>
            <div className="mb-3 rounded-md border border-noc-700/60 bg-noc-950/45 px-2 py-2 text-[9px] leading-relaxed text-noc-400">
              Nominal PON line rate: {PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].downstreamGbps.toFixed(3)} Gbps downstream / {PON_STANDARD_SPECS[node.data.ponStandard ?? 'GPON'].upstreamGbps.toFixed(3)} Gbps upstream. These are shared line rates, not guaranteed subscriber throughput.
              {(node.data.ponStandard ?? 'GPON') === 'XGS-PON' ? ' XGS-PON launch-class budgets are not separately modeled.' : ''}
            </div>
            <div className="mb-3 flex items-center justify-between rounded-md border border-noc-700/60 bg-noc-950/50 px-2 py-2">
              <div>
                <div className="text-[11px] font-medium text-noc-300">Laser transmitter</div>
                <div className="font-mono text-[10px] text-noc-500">
                  {node.data.laserOn ? 'Emitting — downstream live' : 'Disabled — all ONTs go dark'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={node.data.laserOn}
                onClick={() => onPatchNode(node.id, { laserOn: !node.data.laserOn })}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  node.data.laserOn ? 'bg-emerald-500/80' : 'bg-noc-600'
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
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Class budget</div>
                <div className="metric-value">
                  {OLT_CLASS_SPECS[node.data.oltClass].linkBudgetDb.toFixed(0)} dB
                </div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Rx sensitivity</div>
                <div className="metric-value">
                  {OLT_CLASS_SPECS[node.data.oltClass].rxSensitivityDbm.toFixed(0)} dBm
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* -------------------------------------------------------- Splitter */}
        {node && isSplitterNode(node) ? (
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
            <div className="mb-3 overflow-hidden rounded-md border border-noc-700/60">
              <table className="w-full font-mono text-[10px]">
                <thead>
                  <tr className="bg-noc-800/80 text-noc-400">
                    <th className="px-2 py-1 text-left font-medium">Ratio</th>
                    <th className="px-2 py-1 text-right font-medium">Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {SPLIT_RATIOS.map((ratio) => (
                    <tr
                      key={ratio}
                      className={`border-t border-noc-700/50 ${
                        ratio === node.data.ratio ? 'bg-purple-500/10 text-purple-200' : 'text-noc-300'
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
              <div className="text-[9px] uppercase tracking-wide text-noc-400">Total insertion loss</div>
              <div className="metric-value text-purple-300">
                {computeSplitterLoss(node.data).toFixed(2)} dB
              </div>
            </div>
          </>
        ) : null}

        {/* --------------------------------------------------------------- ODF */}
        {node && isOdfNode(node) ? (
          <>
            <div className="mb-3 rounded-md border border-teal-500/25 bg-teal-500/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-teal-100">
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
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Optical inputs</div>
                <div className="metric-value">{ODF_INPUT_PORTS}</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Matched outputs</div>
                <div className="metric-value">{ODF_OUTPUT_PORTS}</div>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-noc-500">
              Default {DEFAULT_ODF_THROUGH_PORT_LOSS_DB.toFixed(2)} dB is an educational adapter/through allowance, not a measured loss or vendor guarantee.
            </p>
          </>
        ) : null}

        {/* --------------------------------------------------------------- NAP */}
        {node && isNapNode(node) ? (
          <>
            <div className="mb-3 rounded-md border border-orange-500/25 bg-orange-500/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-orange-100">
              Outdoor NAP/FAT model: one feeder input, eight drop outputs, and an internal fixed 1:8 split.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Split ratio</div>
                <div className="metric-value text-orange-200">1:{NAP_SPLIT_RATIO}</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Branch insertion loss</div>
                <div className="metric-value text-orange-200">{node.data.splitLossDb.toFixed(2)} dB</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Optical inputs</div>
                <div className="metric-value">1</div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Drop outputs</div>
                <div className="metric-value">{NAP_OUTPUT_PORTS}</div>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-noc-500">
              The {NAP_SPLIT_LOSS_DB.toFixed(1)} dB default is a fixed learning reference; real insertion loss and weather rating depend on the exact product and installation.
            </p>
          </>
        ) : null}

        {/* --------------------------------------------------------- Closure */}
        {node && isClosureNode(node) ? (
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
            <div className="mb-3 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2 text-[9px] leading-relaxed text-stone-700">
              The closure passes one modeled fiber per active branch and adds one adjustable fusion-splice allowance. Tray occupancy is strand-level reference data, not a measured splice-loss value.
            </div>
          </>
        ) : null}

        {/* ----------------------------------------------------------- Fiber */}
        {node && isFiberNode(node) ? (
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
        {node && isOntNode(node) ? (
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
        {node && isGatewayNode(node) ? (
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
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">PON standard</div>
                    <div className="metric-value text-sky-200">{gatewayTelemetry.ponStandard ?? 'No active link'}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Split ratio</div>
                    <div className="metric-value">{telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Down / up line rate</div>
                    <div className="metric-value">{gatewayTelemetry.downstreamLineRateGbps === null ? '—' : `${gatewayTelemetry.downstreamLineRateGbps.toFixed(3)} / ${gatewayTelemetry.upstreamLineRateGbps?.toFixed(3)} Gbps`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Estimated down / up</div>
                    <div className="metric-value text-emerald-200">{gatewayTelemetry.estimatedDownMbps === null ? '—' : `${gatewayTelemetry.estimatedDownMbps.toFixed(0)} / ${gatewayTelemetry.estimatedUpMbps?.toFixed(0)} Mbps`}</div>
                  </div>
                  <div className="metric">
                    <div className="text-[9px] uppercase tracking-wide text-noc-400">Internet IP (simulated)</div>
                    <div className="metric-value">{telemetry.status === 'ONLINE' ? gatewayTelemetry.serviceIpAddress : 'Not assigned'}</div>
                  </div>
                </div>
                <p className="mb-3 text-[9px] text-noc-500">TEST-NET placeholder only; DHCP, routing, and live Internet reachability are not modeled.</p>
                <div className="eyebrow mb-1.5">Optical path &amp; service audit</div>
                <SegmentTable telemetry={telemetry} />
                <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.05] p-2 text-[9px] leading-relaxed text-amber-100">
                  Speed estimate divides the nominal shared PON line rate by the modeled cumulative split ratio. It does not model contention, protocol overhead, Wi-Fi conditions, a service plan, or a measured speed test.
                </div>
              </>
            ) : (
              <div className="rounded-md border border-noc-700/60 bg-noc-950/50 p-2 text-[10px] leading-relaxed text-noc-400">
                Gateway supports GPON and XGS-PON in this reference model. Connect its optical input to a live OLT path to populate optical and service telemetry.
              </div>
            )}
            <div className="mt-2 rounded-md border border-noc-700/60 bg-noc-950/50 p-2 text-[9px] leading-relaxed text-noc-500">
              Representative interfaces: dual-band Wi-Fi 6, four Gigabit Ethernet LAN ports, and one FXS voice port. Exact radio streams, Ethernet options, and voice features vary by SKU.
            </div>
          </>
        ) : null}

        {/* ------------------------------------------------------------ Edge */}
        {!node && edge ? (
          <>
            <div className="mb-3 rounded-md border border-noc-700/60 bg-noc-950/50 p-2 font-mono text-[10px] text-noc-400">
              <div className="mb-1 text-noc-300">Patch cord</div>
              <div className="break-all">{edge.source} → {edge.target}</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">Power at far end</div>
                <div className="metric-value">
                  {formatDbm(simulation.edgeTelemetry[edge.id]?.powerDbm ?? null)}
                </div>
              </div>
              <div className="metric">
                <div className="text-[9px] uppercase tracking-wide text-noc-400">State</div>
                <div className="metric-value uppercase">
                  {simulation.edgeTelemetry[edge.id]?.edgeState ?? 'idle'}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-noc-500">
              A patch cord adds no loss of its own — its attenuation belongs to the fiber span it
              terminates on. Delete it to break the optical path.
            </p>
            <button type="button" className="btn-danger mt-3 w-full" onClick={() => onDeleteEdge(edge.id)}>
              <Trash2 size={13} /> Delete patch cord
            </button>
          </>
        ) : null}

        <PricingSettings
          unitCosts={unitCosts}
          onChange={onUnitCostsChange}
          onReset={onResetUnitCosts}
        />
      </div>

      {node ? (
        <div className="border-t border-noc-700/70 p-3">
          <button type="button" className="btn-danger w-full" onClick={() => onDeleteNode(node.id)}>
            <Trash2 size={13} /> Remove element
          </button>
        </div>
      ) : null}
    </aside>
  );
}

export default Inspector;
