import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import type { NetworkSummary, PonNode, SimulationResult } from '../types';
import { STATUS_STYLES } from '../types';
import { formatDbm } from '../engine/opticalSimulator';

/* ========================================================================== *
 * Status bar — the whole bottom of the design view.
 *
 * One slim always-on bar carries four numbers (loss, distance, subscribers OK,
 * network status). Expanding it upward reveals just two views: the optical
 * power levels as bars, and the warnings/recent events. Clicking a warning
 * focuses the component it belongs to on the canvas.
 * ========================================================================== */

export interface PowerBar {
  label: string;
  valueDbm: number | null;
  color: string;
}

interface StatusBarProps {
  summary: NetworkSummary;
  simulation: SimulationResult;
  nodes: PonNode[];
  powerBars: PowerBar[];
  worstLossDb: number | null;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onOpenReports: () => void;
  onFocusNode: (nodeId: string) => void;
}

type Tone = 'ok' | 'warn' | 'bad' | 'idle';
type DetailTab = 'budget' | 'events';

/** −35 … +7 dBm maps across the bar track, matching the optical window. */
const barWidth = (value: number | null): number =>
  value === null ? 0 : Math.max(4, Math.min(100, ((value + 35) / 42) * 100));

function deriveStatus(summary: NetworkSummary): { tone: Tone; label: string } {
  if (summary.subscriberCount === 0) return { tone: 'idle', label: 'No subscribers' };
  if (summary.byStatus.LOS > 0 || summary.byStatus.DISCONNECTED > 0) return { tone: 'bad', label: 'Fail' };
  if (
    summary.byStatus.WARNING > 0 ||
    summary.byStatus.OVERLOAD > 0 ||
    summary.upstreamDynamicRangeWarning ||
    summary.modalDispersionWarnings.length > 0
  )
    return { tone: 'warn', label: 'Marginal' };
  return { tone: 'ok', label: 'OK' };
}

interface StatusEvent {
  key: string;
  tone: 'warn' | 'bad' | 'ok';
  title: string;
  detail: string;
  nodeId?: string;
}

export function StatusBar({
  summary,
  simulation,
  nodes,
  powerBars,
  worstLossDb,
  expanded,
  onExpandedChange,
  onOpenReports,
  onFocusNode,
}: StatusBarProps) {
  const [tab, setTab] = useState<DetailTab>('budget');
  const [drag, setDrag] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  const status = deriveStatus(summary);
  const online = summary.byStatus.ONLINE;

  const events = useMemo<StatusEvent[]>(() => {
    const list: StatusEvent[] = [];
    for (const node of nodes) {
      if (node.type !== 'ont' && node.type !== 'gateway') continue;
      const reading = node.type === 'ont' ? simulation.ontTelemetry[node.id] : simulation.gatewayTelemetry[node.id];
      if (!reading || reading.status === 'ONLINE') continue;
      list.push({
        key: node.id,
        tone: reading.status === 'LOS' || reading.status === 'DISCONNECTED' ? 'bad' : 'warn',
        title: node.data.subscriber,
        detail: `${STATUS_STYLES[reading.status].label} · ${formatDbm(reading.rxPowerDbm)}`,
        nodeId: node.id,
      });
    }
    for (const node of nodes) {
      if (node.type !== 'fiber') continue;
      if (node.data.macroBendActive)
        list.push({
          key: `${node.id}-bend`,
          tone: 'warn',
          title: `${node.data.lengthKm.toFixed(1)} km span`,
          detail: 'Macro-bend loss injected on this span',
          nodeId: node.id,
        });
      if (node.data.dirtyConnectorActive)
        list.push({
          key: `${node.id}-dust`,
          tone: 'warn',
          title: `${node.data.lengthKm.toFixed(1)} km span`,
          detail: 'Dirty connector ferrule loss injected',
          nodeId: node.id,
        });
    }
    for (const warning of summary.modalDispersionWarnings) {
      list.push({
        key: `${warning.nodeId}-modal`,
        tone: 'warn',
        title: `${warning.lengthKm.toFixed(2)} km ${warning.fiberProfile.toUpperCase()} span`,
        detail: 'Exceeds the 550 m modal-dispersion reach for gigabit transmission',
        nodeId: warning.nodeId,
      });
    }
    if (summary.upstreamDynamicRangeWarning) {
      list.push({
        key: 'dyn',
        tone: 'warn',
        title: 'Upstream dynamic range',
        detail: `Δ ${summary.upstreamDeltaDb.toFixed(1)} dB exceeds the 15 dB limit`,
      });
    }
    if (list.length === 0 && summary.subscriberCount > 0) {
      list.push({ key: 'ok', tone: 'ok', title: 'All subscribers', detail: 'Within receive thresholds' });
    }
    return list;
  }, [nodes, simulation, summary]);

  const warningCount = events.filter((event) => event.tone !== 'ok').length;
  const summaryLabel = [
    `Network status: ${status.label}.`,
    `Total loss ${worstLossDb !== null ? `${worstLossDb.toFixed(1)} dB` : 'unavailable'}.`,
    `Total distance ${summary.totalFiberKm.toFixed(1)} km.`,
    `${online} of ${summary.subscriberCount} subscribers online.`,
    expanded ? 'Hide optical budget and events.' : 'Show optical budget and events.',
  ].join(' ');

  /* Phone sheet: drag down to close. */
  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    setDrag(event.clientY - dragStartRef.current);
  };
  const onHandlePointerEnd = () => {
    const delta = drag;
    dragStartRef.current = null;
    setDrag(0);
    if (delta >= 40) onExpandedChange(false);
  };

  return (
    <section
      className={`pu-statusbar${expanded ? ' is-open' : ''}`}
      data-testid="network-status-bar"
      aria-label="Network status bar"
    >
      <button
        type="button"
        className="pu-sb-main"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        aria-controls="status-bar-detail"
        aria-label={summaryLabel}
        title="Optical budget & events"
      >
        <span className={`pu-sb-dot ${status.tone}`} aria-hidden="true" />
        <span className="pu-sb-status" aria-live="polite">
          {status.label}
        </span>
        <span className="pu-sb-values">
          <span className="pu-sb-item">
            <small>Total loss</small>
            <b>{worstLossDb !== null ? `${worstLossDb.toFixed(1)} dB` : '—'}</b>
          </span>
          <span className="pu-sb-item">
            <small>Total distance</small>
            <b>{summary.totalFiberKm.toFixed(1)} km</b>
          </span>
          <span className="pu-sb-item">
            <small>Subscribers OK</small>
            <b>{`${online} / ${summary.subscriberCount}`}</b>
          </span>
        </span>
        <span className="pu-sb-spacer" />
        <span className="pu-sb-chevron" aria-hidden="true">
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {expanded ? (
        <div
          id="status-bar-detail"
          className="pu-sb-detail"
          style={drag ? { transform: `translateY(${Math.max(-16, drag)}px)` } : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onExpandedChange(false);
            }
          }}
        >
          <div
            className="pu-sheet-handle"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerEnd}
            onPointerCancel={onHandlePointerEnd}
            aria-hidden="true"
          >
            <span className="pu-sheet-grip" />
          </div>

          <div className="pu-sb-detail-head">
            <div className="pu-sb-tabs" role="tablist" aria-label="Network detail views">
              {(
                [
                  { id: 'budget', label: 'Optical Budget' },
                  { id: 'events', label: 'Events' },
                ] as Array<{ id: DetailTab; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'is-active' : ''}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                  {item.id === 'events' && warningCount > 0 ? (
                    <span className="pu-sb-count">{warningCount}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="pu-sb-detail-actions">
              <button type="button" className="pu-btn pu-sb-report" onClick={onOpenReports}>
                <Info size={14} aria-hidden="true" /> Reports
              </button>
              <button
                type="button"
                className="pu-insp-close"
                onClick={() => onExpandedChange(false)}
                aria-label="Hide network details"
                title="Hide"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="pu-sb-body">
            {tab === 'budget' ? (
              <>
                <div className="pu-sb-bars">
                  {powerBars.map((bar) => (
                    <div className="pu-sb-bar" key={bar.label}>
                      <span className="pu-sb-bar-label">{bar.label}</span>
                      <span className="pu-sb-bar-track">
                        <i style={{ width: `${barWidth(bar.valueDbm)}%`, background: bar.color }} />
                      </span>
                      <b className="pu-sb-bar-value">
                        {bar.valueDbm === null ? '—' : `${bar.valueDbm >= 0 ? '+' : ''}${bar.valueDbm.toFixed(1)} dBm`}
                      </b>
                    </div>
                  ))}
                </div>
                <p className="pu-sb-note">
                  Receive window −28 to −8 dBm. The farthest ONT decides the status colour in the bar above.
                </p>
                <button type="button" className="pu-btn" onClick={onOpenReports}>
                  Open full audit &amp; quotation
                </button>
              </>
            ) : (
              <>
                {events.length === 0 ? <p className="pu-sb-note">Add an OLT and a subscriber to begin.</p> : null}
                <div className="pu-sb-events">
                  {events.map((event) =>
                    event.nodeId ? (
                      <button
                        key={event.key}
                        type="button"
                        className="pu-event is-clickable"
                        onClick={() => onFocusNode(event.nodeId as string)}
                        title="Select and show this component on the canvas"
                      >
                        <u className={event.tone === 'ok' ? 'ok' : event.tone === 'bad' ? 'bad' : ''}>
                          {event.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        </u>
                        <span className="pu-event-copy">
                          <b>{event.title}</b>
                          <small>{event.detail}</small>
                        </span>
                        <span className="pu-event-go" aria-hidden="true">
                          →
                        </span>
                      </button>
                    ) : (
                      <div className="pu-event" key={event.key}>
                        <u className={event.tone === 'ok' ? 'ok' : event.tone === 'bad' ? 'bad' : ''}>
                          {event.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        </u>
                        <span className="pu-event-copy">
                          <b>{event.title}</b>
                          <small>{event.detail}</small>
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default StatusBar;
