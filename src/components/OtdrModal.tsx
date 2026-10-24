import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Activity, ChevronDown, Radio, ScanLine, X } from 'lucide-react';
import type { PonEdge, PonNode, Wavelength } from '../types';
import {
  generateOtdrTrace,
  getReachableOtdrTargets,
  OTDR_PULSE_WIDTHS_NS,
  type OtdrAnalysisResult,
  type OtdrEvent,
  type OtdrPulseWidthNs,
} from '../engine/otdrSimulator';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface OtdrModalProps {
  open: boolean;
  onClose: () => void;
  nodes: PonNode[];
  edges: PonEdge[];
}

const CHART = {
  width: 960,
  height: 400,
  left: 66,
  right: 24,
  top: 26,
  bottom: 48,
  minPowerDb: -45,
  maxPowerDb: 5,
  maxDistanceKm: 35,
} as const;

const PLOT_WIDTH = CHART.width - CHART.left - CHART.right;
const PLOT_HEIGHT = CHART.height - CHART.top - CHART.bottom;
const WAVELENGTHS: readonly Wavelength[] = [1310, 1490, 1550, 1270, 1577];
const SCAN_DURATION_MS = 850;

type ChartCursor = { x: number; y: number; distanceKm: number; powerDb: number };

function xForDistance(distanceKm: number): number {
  return CHART.left + (distanceKm / CHART.maxDistanceKm) * PLOT_WIDTH;
}

function yForPower(powerDb: number): number {
  const clamped = Math.max(CHART.minPowerDb, Math.min(CHART.maxPowerDb, powerDb));
  return CHART.top + ((CHART.maxPowerDb - clamped) / (CHART.maxPowerDb - CHART.minPowerDb)) * PLOT_HEIGHT;
}

function interpolatePower(points: OtdrAnalysisResult['tracePoints'], distanceKm: number): number {
  if (points.length === 0) return CHART.minPowerDb;
  if (distanceKm <= points[0].distanceKm) return points[0].powerDb;
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    const left = points[index - 1];
    if (distanceKm <= right.distanceKm) {
      const span = right.distanceKm - left.distanceKm;
      if (span <= 0) return right.powerDb;
      const fraction = (distanceKm - left.distanceKm) / span;
      return left.powerDb + (right.powerDb - left.powerDb) * fraction;
    }
  }
  return points[points.length - 1].powerDb;
}

function sourceLabel(node: PonNode): string {
  if (node.type === 'olt') return `${node.data.portName} · OLT (${node.id})`;
  if (node.type === 'fiber') {
    return `${node.data.cableType} fiber · ${node.data.lengthKm.toFixed(2)} km (${node.id})`;
  }
  return `${node.type} · ${node.id}`;
}

function eventLabel(type: OtdrEvent['type']): string {
  switch (type) {
    case 'launch':
      return 'Launch';
    case 'fiber_span':
      return 'Fiber span';
    case 'splice':
      return 'Splice';
    case 'splitter':
      return 'Splitter';
    case 'odf':
      return 'ODF through-port';
    case 'nap':
      return 'NAP/FAT split';
    case 'connector':
      return 'Connector';
    case 'fault_bend':
      return 'Fault / bend';
    case 'end_of_fiber':
      return 'End of fiber';
  }
}

function markerColor(type: OtdrEvent['type']): string {
  switch (type) {
    case 'launch':
      return '#38bdf8';
    case 'fiber_span':
      return '#67e8f9';
    case 'splice':
      return '#34d399';
    case 'splitter':
      return '#fb923c';
    case 'odf':
      return '#2dd4bf';
    case 'nap':
      return '#fb7185';
    case 'connector':
      return '#c4b5fd';
    case 'fault_bend':
      return '#f87171';
    case 'end_of_fiber':
      return '#f8fafc';
  }
}

function tracePath(points: OtdrAnalysisResult['tracePoints']): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${xForDistance(point.distanceKm).toFixed(2)} ${yForPower(point.powerDb).toFixed(2)}`,
    )
    .join(' ');
}

function reflectionBasePower(trace: OtdrAnalysisResult, event: OtdrEvent): number {
  if (event.type === 'launch') return interpolatePower(trace.tracePoints, 0);
  if (event.type === 'end_of_fiber' && trace.tracePoints.length > 1) {
    return trace.tracePoints[Math.max(0, trace.tracePoints.length - 2)].powerDb;
  }
  if (event.type === 'connector' && trace.tracePoints.length > 1) {
    const sampleStepKm = trace.totalDistanceKm / (trace.tracePoints.length - 1);
    return interpolatePower(trace.tracePoints, Math.max(0, event.distanceKm - sampleStepKm * 1.25));
  }
  return interpolatePower(trace.tracePoints, event.distanceKm);
}

function OtdrMarker({ event, trace }: { event: OtdrEvent; trace: OtdrAnalysisResult }) {
  const x = xForDistance(event.distanceKm);
  const basePower = reflectionBasePower(trace, event);
  const postEventPower = interpolatePower(trace.tracePoints, event.distanceKm);
  const markerPower =
    event.reflectionPeakDb === undefined
      ? postEventPower
      : Math.min(CHART.maxPowerDb, basePower + event.reflectionPeakDb);
  const y = yForPower(markerPower);
  const baseY = yForPower(basePower);
  const postEventY = yForPower(postEventPower);
  const pulseLengthKm = (299792.458 * trace.pulseWidthNs * 1e-9) / (2 * 1.468);
  const pulseHalfWidthPx = Math.max(0.5, ((pulseLengthKm / CHART.maxDistanceKm) * PLOT_WIDTH) / 2);
  const color = markerColor(event.type);
  const title = `${eventLabel(event.type)} at ${event.distanceKm.toFixed(3)} km · ${event.description}`;

  return (
    <g aria-hidden="true">
      {event.reflectionPeakDb !== undefined ? (
        <line x1={x} y1={baseY} x2={x} y2={y} stroke={color} strokeWidth={event.type === 'end_of_fiber' ? 2.5 : 1.5} />
      ) : null}
      {event.reflectionPeakDb !== undefined ? (
        <line
          x1={x - pulseHalfWidthPx}
          y1={y}
          x2={x + pulseHalfWidthPx}
          y2={y}
          stroke={color}
          strokeWidth={2.5}
          opacity={0.74}
        />
      ) : null}
      {event.reflectionPeakDb !== undefined && event.type !== 'end_of_fiber' ? (
        <line x1={x} y1={y} x2={x} y2={postEventY} stroke={color} strokeWidth={1.2} />
      ) : null}
      {event.type === 'end_of_fiber' ? (
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={yForPower(CHART.minPowerDb)}
          stroke={color}
          strokeWidth={1.4}
          strokeDasharray="3 2"
        />
      ) : null}
      {event.type === 'launch' ? (
        <circle cx={x} cy={y} r={5.5} fill={color} stroke="#082f49" strokeWidth={1.5} />
      ) : null}
      {event.type === 'splice' ? (
        <rect x={x - 4} y={y - 4} width={8} height={8} rx={1} fill={color} stroke="#064e3b" strokeWidth={1} />
      ) : null}
      {event.type === 'splitter' ? (
        <rect
          x={x - 4.5}
          y={y - 4.5}
          width={9}
          height={9}
          transform={`rotate(45 ${x} ${y})`}
          fill={color}
          stroke="#7c2d12"
          strokeWidth={1}
        />
      ) : null}
      {event.type === 'odf' ? (
        <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1} fill={color} stroke="#134e4a" strokeWidth={1} />
      ) : null}
      {event.type === 'nap' ? (
        <path
          d={`M ${x - 5} ${y} L ${x - 2.5} ${y - 4.5} L ${x + 2.5} ${y - 4.5} L ${x + 5} ${y} L ${x + 2.5} ${y + 4.5} L ${x - 2.5} ${y + 4.5} Z`}
          fill={color}
          stroke="#881337"
          strokeWidth={1}
        />
      ) : null}
      {event.type === 'fault_bend' ? (
        <path
          d={`M ${x} ${y - 5.5} L ${x + 5} ${y + 4.5} L ${x - 5} ${y + 4.5} Z`}
          fill={color}
          stroke="#7f1d1d"
          strokeWidth={1}
        />
      ) : null}
      {event.type === 'connector' ? (
        <circle cx={x} cy={y} r={3.5} fill={color} stroke="#4c1d95" strokeWidth={1} />
      ) : null}
      {event.type === 'fiber_span' ? <circle cx={x} cy={y} r={2.2} fill={color} /> : null}
      {event.type === 'end_of_fiber' ? (
        <path
          d={`M ${x} ${y - 6} L ${x + 1.8} ${y - 1.8} L ${x + 6} ${y} L ${x + 1.8} ${y + 1.8} L ${x} ${y + 6} L ${x - 1.8} ${y + 1.8} L ${x - 6} ${y} L ${x - 1.8} ${y - 1.8} Z`}
          fill={color}
          stroke="#64748b"
          strokeWidth={1}
        />
      ) : null}
      <title>{title}</title>
    </g>
  );
}

function OtdrChart({
  trace,
  cursor,
  onCursorChange,
  onCursorLeave,
  acquiring,
}: {
  trace: OtdrAnalysisResult | null;
  cursor: ChartCursor | null;
  onCursorChange: (cursor: ChartCursor) => void;
  onCursorLeave: () => void;
  acquiring: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const yTicks = Array.from({ length: 11 }, (_, index) => CHART.maxPowerDb - index * 5);
  const xTicks = Array.from({ length: 8 }, (_, index) => index * 5);

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!trace || !svgRef.current) return;
    const bounds = svgRef.current.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * CHART.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * CHART.height;
    const distanceKm = Math.max(
      0,
      Math.min(CHART.maxDistanceKm, ((x - CHART.left) / PLOT_WIDTH) * CHART.maxDistanceKm),
    );
    onCursorChange({
      x: Math.max(CHART.left, Math.min(CHART.width - CHART.right, x)),
      y: Math.max(CHART.top, Math.min(CHART.height - CHART.bottom, y)),
      distanceKm,
      powerDb: interpolatePower(trace.tracePoints, distanceKm),
    });
  };

  return (
    <div className="otdr-chart-shell" aria-busy={acquiring} data-acquiring={acquiring}>
      <svg
        ref={svgRef}
        className="otdr-chart"
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="OTDR backscatter trace, power from plus 5 to minus 45 dB over 0 to 35 kilometres"
        onPointerMove={handlePointerMove}
        onPointerLeave={onCursorLeave}
      >
        <defs>
          <linearGradient id="otdr-trace-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#67e8f9" stopOpacity="0.26" />
            <stop offset="1" stopColor="#0e7490" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="otdr-plot-clip">
            <rect x={CHART.left} y={CHART.top} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
          </clipPath>
        </defs>

        <rect x={CHART.left} y={CHART.top} width={PLOT_WIDTH} height={PLOT_HEIGHT} rx="5" fill="#07111a" />
        {yTicks.map((tick) => {
          const y = yForPower(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={CHART.left}
                y1={y}
                x2={CHART.width - CHART.right}
                y2={y}
                stroke="#334454"
                strokeWidth={tick === 0 ? 1 : 0.65}
                strokeDasharray={tick === 0 ? undefined : '3 5'}
              />
              <text x={CHART.left - 11} y={y + 3.5} textAnchor="end" className="otdr-axis-tick">
                {tick > 0 ? `+${tick}` : tick}
              </text>
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const x = xForDistance(tick);
          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={CHART.top}
                x2={x}
                y2={CHART.height - CHART.bottom}
                stroke="#263746"
                strokeWidth={0.65}
                strokeDasharray="3 5"
              />
              <text x={x} y={CHART.height - CHART.bottom + 18} textAnchor="middle" className="otdr-axis-tick">
                {tick}
              </text>
            </g>
          );
        })}
        <text x={CHART.left + PLOT_WIDTH / 2} y={CHART.height - 7} textAnchor="middle" className="otdr-axis-label">
          Distance (km)
        </text>
        <text
          x={15}
          y={CHART.top + PLOT_HEIGHT / 2}
          textAnchor="middle"
          className="otdr-axis-label"
          transform={`rotate(-90 15 ${CHART.top + PLOT_HEIGHT / 2})`}
        >
          Power (dB)
        </text>

        {trace ? (
          <g clipPath="url(#otdr-plot-clip)">
            <path d={tracePath(trace.tracePoints)} fill="none" stroke="#164e63" strokeWidth={5} opacity={0.45} />
            <path
              d={tracePath(trace.tracePoints)}
              fill="none"
              stroke="#67e8f9"
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {trace.events.map((event) => (
              <OtdrMarker key={event.id} event={event} trace={trace} />
            ))}
          </g>
        ) : (
          <text
            x={CHART.left + PLOT_WIDTH / 2}
            y={CHART.top + PLOT_HEIGHT / 2}
            textAnchor="middle"
            className="otdr-chart-empty"
          >
            Select a reachable subscriber, then acquire a trace
          </text>
        )}

        {cursor && trace ? (
          <g aria-hidden="true" className="otdr-crosshair">
            <line x1={cursor.x} y1={CHART.top} x2={cursor.x} y2={CHART.height - CHART.bottom} />
            <line x1={CHART.left} y1={cursor.y} x2={CHART.width - CHART.right} y2={cursor.y} />
            <circle cx={cursor.x} cy={yForPower(cursor.powerDb)} r={3.6} />
          </g>
        ) : null}

        <rect
          x={CHART.left}
          y={CHART.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="transparent"
          pointerEvents="none"
        />
      </svg>

      <div className="otdr-chart-legend" aria-label="Event marker legend">
        <span>
          <i className="otdr-legend-dot launch" />
          Launch
        </span>
        <span>
          <i className="otdr-legend-square splice" />
          Splice
        </span>
        <span>
          <i className="otdr-legend-diamond splitter" />
          Splitter
        </span>
        <span>
          <i className="otdr-legend-square odf" />
          ODF / NAP
        </span>
        <span>
          <i className="otdr-legend-triangle fault" />
          Fault
        </span>
        <span>
          <i className="otdr-legend-star end" />
          End of fiber
        </span>
        <span>
          <i className="otdr-legend-dot connector" />
          Connector
        </span>
      </div>
    </div>
  );
}

export function OtdrModal({ open, onClose, nodes, edges }: OtdrModalProps) {
  const initialSourceId =
    nodes.find((node) => node.type === 'olt')?.id ?? nodes.find((node) => node.type === 'fiber')?.id ?? '';
  const [startNodeId, setStartNodeId] = useState(initialSourceId);
  const [targetOntId, setTargetOntId] = useState('');
  const [wavelengthNm, setWavelengthNm] = useState<Wavelength>(1490);
  const [pulseWidthNs, setPulseWidthNs] = useState<OtdrPulseWidthNs>(100);
  const [trace, setTrace] = useState<OtdrAnalysisResult | null>(null);
  const [acquiring, setAcquiring] = useState(false);
  const [cursor, setCursor] = useState<ChartCursor | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const sources = useMemo(() => nodes.filter((node) => node.type === 'olt' || node.type === 'fiber'), [nodes]);
  const reachableTargets = useMemo(
    () => getReachableOtdrTargets(nodes, edges, startNodeId),
    [nodes, edges, startNodeId],
  );

  useEffect(() => {
    if (!sources.some((node) => node.id === startNodeId)) {
      setStartNodeId(sources[0]?.id ?? '');
    }
  }, [sources, startNodeId]);

  useEffect(() => {
    if (!reachableTargets.some((node) => node.id === targetOntId)) {
      setTargetOntId(reachableTargets[0]?.id ?? '');
    }
  }, [reachableTargets, targetOntId]);

  useEffect(() => {
    setTrace(null);
    setCursor(null);
    setAcquiring(false);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [startNodeId, targetOntId, wavelengthNm, pulseWidthNs, nodes, edges]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const acquireTrace = () => {
    if (!startNodeId || !targetOntId || acquiring) return;
    setCursor(null);
    setAcquiring(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setTrace(generateOtdrTrace(nodes, edges, startNodeId, targetOntId, wavelengthNm, pulseWidthNs));
      setAcquiring(false);
      timeoutRef.current = null;
    }, SCAN_DURATION_MS);
  };

  const handleClose = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAcquiring(false);
    onClose();
  };

  // Clear a pending acquisition whenever the analyzer is dismissed, including
  // the Escape path handled by the shared dialog hook.
  useEffect(() => {
    if (open) return;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAcquiring(false);
  }, [open]);

  const { dialogRef } = useDialogA11y({ open, onClose: handleClose, initialFocusRef: closeButtonRef });

  if (!open) return null;

  const eventCount = trace?.events.length ?? 0;

  return (
    <div
      className="otdr-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        ref={dialogRef}
        className="otdr-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="otdr-modal-title"
        aria-describedby="otdr-modal-description"
      >
        <header className="otdr-modal-header">
          <div className="otdr-title-group">
            <span className="otdr-title-icon">
              <Activity size={16} aria-hidden="true" />
            </span>
            <div>
              <div className="otdr-eyebrow">FIBERLAB · FIELD DIAGNOSTICS</div>
              <h2 id="otdr-modal-title">OTDR Trace Analyzer</h2>
              <p id="otdr-modal-description">Interactive backscatter profile · {eventCount} detected events</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="otdr-close"
            onClick={handleClose}
            aria-label="Close OTDR Trace Analyzer"
            title="Close analyzer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="otdr-modal-scroll">
          <div className="otdr-instrument-panel">
            <label className="otdr-control-field">
              <span>Launch source</span>
              <span className="otdr-select-wrap">
                <select
                  value={startNodeId}
                  onChange={(event) => setStartNodeId(event.target.value)}
                  disabled={acquiring || sources.length === 0}
                  aria-label="OTDR source node"
                >
                  {sources.length === 0 ? <option value="">No source nodes</option> : null}
                  {sources.map((node) => (
                    <option value={node.id} key={node.id}>
                      {sourceLabel(node)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>

            <label className="otdr-control-field">
              <span>Target branch</span>
              <span className="otdr-select-wrap">
                <select
                  value={targetOntId}
                  onChange={(event) => setTargetOntId(event.target.value)}
                  disabled={acquiring || reachableTargets.length === 0}
                  aria-label="OTDR target subscriber"
                >
                  {reachableTargets.length === 0 ? <option value="">No reachable subscriber branches</option> : null}
                  {reachableTargets.map((node) => (
                    <option value={node.id} key={node.id}>
                      {node.data.subscriber} · {node.id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>

            <fieldset className="otdr-segment-control">
              <legend>Wavelength</legend>
              <div>
                {WAVELENGTHS.map((wavelength) => (
                  <button
                    type="button"
                    key={wavelength}
                    aria-pressed={wavelengthNm === wavelength}
                    disabled={acquiring}
                    onClick={() => setWavelengthNm(wavelength)}
                  >
                    {wavelength} nm
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="otdr-segment-control pulse-control">
              <legend>Pulse width</legend>
              <div>
                {OTDR_PULSE_WIDTHS_NS.map((pulse) => (
                  <button
                    type="button"
                    key={pulse}
                    aria-pressed={pulseWidthNs === pulse}
                    disabled={acquiring}
                    onClick={() => setPulseWidthNs(pulse)}
                  >
                    {pulse} ns
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              className="otdr-acquire-button"
              type="button"
              onClick={acquireTrace}
              disabled={acquiring || !targetOntId}
            >
              {acquiring ? (
                <ScanLine size={16} className="otdr-acquire-icon is-pulsing" aria-hidden="true" />
              ) : (
                <Radio size={16} aria-hidden="true" />
              )}
              {acquiring ? 'PULSING FIBER…' : 'ACQUIRE TRACE / PULSE LASER'}
            </button>
          </div>

          <div className={`otdr-chart-card ${acquiring ? 'is-acquiring' : ''}`}>
            <div className="otdr-chart-heading">
              <div>
                <strong>Rayleigh backscatter</strong>
                <span>{trace ? `${trace.pulseWidthNs} ns pulse · ` : ''}0 to 35 km · +5 to −45 dB</span>
              </div>
              <output className="otdr-cursor-readout" aria-live="polite" data-testid="otdr-cursor-readout">
                {cursor
                  ? `${cursor.distanceKm.toFixed(3)} km  ·  ${cursor.powerDb.toFixed(2)} dB`
                  : trace
                    ? `${trace.totalDistanceKm.toFixed(3)} km  ·  ${trace.totalLossDb.toFixed(2)} dB total loss`
                    : 'CROSSHAIR READOUT · HOVER TRACE'}
              </output>
            </div>
            <OtdrChart
              trace={trace}
              cursor={cursor}
              onCursorChange={setCursor}
              onCursorLeave={() => setCursor(null)}
              acquiring={acquiring}
            />
            {acquiring ? (
              <div className="otdr-scanline" aria-hidden="true">
                <span />
              </div>
            ) : null}
          </div>

          <section className="otdr-event-section" aria-labelledby="otdr-event-heading">
            <div className="otdr-table-header">
              <div>
                <h3 id="otdr-event-heading">Automated event table</h3>
                <p>One-way loss estimates · reflection peaks shown relative to local backscatter</p>
              </div>
              {trace ? <span className="otdr-event-count">{eventCount} EVENTS</span> : null}
            </div>
            <div className="otdr-table-scroll">
              <table className="otdr-event-table" aria-label="OTDR detected events">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type / event</th>
                    <th className="is-num">Location</th>
                    <th className="is-num">Loss step</th>
                    <th className="is-num">Cumulative loss</th>
                    <th className="is-num">Reflectance peak</th>
                    <th>Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {trace?.events.map((event, index) => (
                    <tr key={event.id}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <span className={`otdr-table-marker ${event.type}`} />
                        {eventLabel(event.type)}
                        <small>{event.description}</small>
                      </td>
                      <td className="is-num">{event.distanceKm.toFixed(3)} km</td>
                      <td className={`is-num ${event.relativeLossDb < 0 ? 'is-loss' : ''}`}>
                        {event.relativeLossDb > 0 ? '+' : ''}
                        {event.relativeLossDb.toFixed(2)} dB
                      </td>
                      <td className="is-num">{event.cumulativeLossDb.toFixed(2)} dB</td>
                      <td className="is-num">
                        {event.reflectionPeakDb === undefined ? '—' : `+${event.reflectionPeakDb.toFixed(2)} dB`}
                      </td>
                      <td>
                        <span className={`otdr-status ${event.passFail.toLowerCase()}`}>{event.passFail}</span>
                      </td>
                    </tr>
                  ))}
                  {!trace ? (
                    <tr>
                      <td colSpan={7} className="otdr-table-empty">
                        No acquisition yet. Pulse the selected subscriber branch to analyze its trace.
                      </td>
                    </tr>
                  ) : null}
                  {trace && trace.events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="otdr-table-empty">
                        No directed optical route reaches the selected target from this source.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <p className="otdr-model-note">
            Learning trace model: wavelength selects reference fiber attenuation, while splice/connector locations are
            distributed along each span because the canvas stores span totals rather than measured event coordinates.
            Loss steps and reflectance peaks are illustrative; this is not a calibrated OTDR or a change to the optical
            link-budget simulator.
          </p>
        </div>
      </section>
    </div>
  );
}
