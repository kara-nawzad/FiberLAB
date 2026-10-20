import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Route, Ruler, Users } from 'lucide-react';
import type { NetworkSummary, PonNode, SimulationResult } from '../types';
import { STATUS_STYLES } from '../types';
import { formatDbm } from '../engine/opticalSimulator';

/* ========================================================================== *
 * Bottom panel: Network Overview · Optical Budget · Components · Topology.
 * Everything is derived live from the simulator — no mock values.
 * ========================================================================== */

export interface PowerBar {
  label: string;
  valueDbm: number | null;
  color: string;
}

interface BottomPanelProps {
  summary: NetworkSummary;
  simulation: SimulationResult;
  nodes: PonNode[];
  edgeCount: number;
  powerBars: PowerBar[];
  worstLossDb: number | null;
  onOpenReports: () => void;
  onSelectNode: (nodeId: string) => void;
}

type Tab = 'overview' | 'budget' | 'components' | 'topology';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Network Overview' },
  { id: 'budget', label: 'Optical Budget' },
  { id: 'components', label: 'Components' },
  { id: 'topology', label: 'Topology' },
];

const barWidth = (value: number | null): number =>
  value === null ? 0 : Math.max(6, Math.min(100, ((value + 35) / 42) * 100));

export function BottomPanel({
  summary,
  simulation,
  nodes,
  edgeCount,
  powerBars,
  worstLossDb,
  onOpenReports,
  onSelectNode,
}: BottomPanelProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [minimized, setMinimized] = useState(false);

  const endpoints = useMemo(
    () =>
      nodes
        .filter(
          (node): node is Extract<PonNode, { type: 'ont' | 'gateway' }> =>
            node.type === 'ont' || node.type === 'gateway',
        )
        .map((node) => {
          const reading = node.type === 'ont' ? simulation.ontTelemetry[node.id] : simulation.gatewayTelemetry[node.id];
          return { node, reading };
        }),
    [nodes, simulation],
  );

  const events = useMemo(() => {
    const list: Array<{ key: string; tone: 'warn' | 'bad' | 'ok'; title: string; detail: string }> = [];
    for (const { node, reading } of endpoints) {
      if (!reading || reading.status === 'ONLINE') continue;
      list.push({
        key: node.id,
        tone: reading.status === 'LOS' || reading.status === 'DISCONNECTED' ? 'bad' : 'warn',
        title: node.data.subscriber,
        detail: `${STATUS_STYLES[reading.status].label} · ${formatDbm(reading.rxPowerDbm)}`,
      });
    }
    for (const node of nodes) {
      if (node.type !== 'fiber') continue;
      if (node.data.macroBendActive)
        list.push({
          key: `${node.id}-bend`,
          tone: 'warn',
          title: 'Fiber span',
          detail: 'Macro-bend loss injected on this span',
        });
      if (node.data.dirtyConnectorActive)
        list.push({
          key: `${node.id}-dust`,
          tone: 'warn',
          title: 'Fiber span',
          detail: 'Dirty connector ferrule loss injected',
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
  }, [endpoints, nodes, summary]);

  const online = summary.byStatus.ONLINE;
  const attention = summary.subscriberCount - online;
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const node of nodes) result[node.type ?? 'other'] = (result[node.type ?? 'other'] ?? 0) + 1;
    return result;
  }, [nodes]);

  return (
    <section
      className={`pu-bottom ${minimized ? 'is-min' : ''}`}
      data-testid="network-summary-strip"
      aria-label="Network summary"
    >
      <div className="pu-btabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => {
              setTab(item.id);
              setMinimized(false);
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          style={{ marginLeft: 'auto' }}
          onClick={() => setMinimized((value) => !value)}
          aria-label={minimized ? 'Expand summary' : 'Minimize summary'}
        >
          {minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!minimized && tab === 'overview' ? (
        <div className="pu-bottom-grid">
          <div className="pu-stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div className="pu-stat">
              <i>
                <Ruler size={16} />
              </i>
              <div>
                <small>Total Distance</small>
                <b>{summary.totalFiberKm.toFixed(1)} km</b>
                <em>fiber plant</em>
              </div>
            </div>
            <div className="pu-stat">
              <i>
                <Info size={16} />
              </i>
              <div>
                <small>Total Loss (max)</small>
                <b>{worstLossDb !== null ? `${worstLossDb.toFixed(1)} dB` : '—'}</b>
                <em>(worst path)</em>
              </div>
            </div>
            <div className="pu-stat">
              <i>
                <Users size={16} />
              </i>
              <div>
                <small>Subscribers</small>
                <b>{summary.subscriberCount}</b>
                <em>(ONUs / gateways)</em>
              </div>
            </div>
            <div className="pu-stat">
              <i
                style={{
                  background: attention === 0 ? 'var(--pu-ok-soft)' : 'var(--pu-warn-soft)',
                  color: attention === 0 ? 'var(--pu-ok)' : 'var(--pu-warn)',
                }}
              >
                {attention === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </i>
              <div>
                <small>Network Status</small>
                <b>
                  {online} / {summary.subscriberCount} OK
                </b>
                <em style={{ color: attention === 0 ? 'var(--pu-ok)' : '#B36B00' }}>
                  {attention === 0 ? 'all within thresholds' : `${attention} require attention`}
                </em>
              </div>
            </div>
          </div>
          <div className="pu-card">
            <h6>Optical Power (dBm)</h6>
            {powerBars.map((bar) => (
              <div className="pu-bar" key={bar.label}>
                <span>{bar.label}</span>
                <span className="track">
                  <i style={{ width: `${barWidth(bar.valueDbm)}%` }} />
                </span>
                <span>{bar.valueDbm === null ? '—' : `${bar.valueDbm >= 0 ? '+' : ''}${bar.valueDbm.toFixed(1)}`}</span>
              </div>
            ))}
          </div>
          <div className="pu-card" style={{ maxHeight: 150, overflowY: 'auto' }}>
            <h6>Recent Events</h6>
            {events.length === 0 ? (
              <div className="pu-mut" style={{ fontSize: 11 }}>
                Add an OLT and a subscriber to begin.
              </div>
            ) : null}
            {events.map((event) => (
              <div className="pu-event" key={event.key}>
                <u className={event.tone === 'ok' ? 'ok' : event.tone === 'bad' ? 'bad' : ''}>
                  {event.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                </u>
                <div>
                  <b>{event.title}</b>
                  <small>{event.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!minimized && tab === 'budget' ? (
        <div className="pu-bottom-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="pu-card" style={{ maxHeight: 170, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11 }}>
              <thead className="pu-mut">
                <tr style={{ textAlign: 'left' }}>
                  <th>Subscriber</th>
                  <th>Rx power</th>
                  <th>Path loss</th>
                  <th>Margin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(({ node, reading }) => (
                  <tr key={node.id} onClick={() => onSelectNode(node.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '4px 0', fontWeight: 600 }}>{node.data.subscriber}</td>
                    <td>{formatDbm(reading?.rxPowerDbm ?? null)}</td>
                    <td>{reading ? `${reading.totalLossDb.toFixed(1)} dB` : '—'}</td>
                    <td>{reading?.rxPowerDbm != null ? `${reading.marginDb.toFixed(1)} dB` : '—'}</td>
                    <td style={{ fontWeight: 700, color: STATUS_STYLES[reading?.status ?? 'DISCONNECTED'].hex }}>
                      {STATUS_STYLES[reading?.status ?? 'DISCONNECTED'].label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="pu-btn" style={{ marginTop: 8 }} onClick={onOpenReports}>
              Open full audit &amp; quotation
            </button>
          </div>
        </div>
      ) : null}

      {!minimized && tab === 'components' ? (
        <div className="pu-bottom-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {Object.entries(counts).map(([kind, count]) => (
            <div className="pu-stat" key={kind}>
              <div>
                <small style={{ textTransform: 'uppercase' }}>{kind}</small>
                <b>{count}</b>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!minimized && tab === 'topology' ? (
        <div className="pu-bottom-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="pu-stat">
            <i>
              <Route size={16} />
            </i>
            <div>
              <small>Patch cords</small>
              <b>{edgeCount}</b>
            </div>
          </div>
          <div className="pu-stat">
            <div>
              <small>Splitters</small>
              <b>{summary.splitterTotal}</b>
            </div>
          </div>
          <div className="pu-stat">
            <div>
              <small>Splices</small>
              <b>{summary.totalSplices}</b>
            </div>
          </div>
          <div className="pu-stat">
            <div>
              <small>Connectors</small>
              <b>{summary.totalConnectors}</b>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default BottomPanel;
