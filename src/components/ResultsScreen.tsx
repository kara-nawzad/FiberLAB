import { useMemo, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, Loader2, Play, TriangleAlert } from 'lucide-react';
import type { NetworkSummary, PonNode, SimulationResult } from '../types';
import { STATUS_STYLES } from '../types';
import { formatDbm } from '../engine/opticalSimulator';
import type { PowerBar } from './StatusBar';
import { useSectionFocus } from '../hooks/useSectionFocus';

/* ========================================================================== *
 * Results — the read-out step between Design and the quotation.
 *
 * Three tabs, one screen: Summary (the budget anchors), Subscribers (one row
 * per endpoint) and Quotation (the commercial document, rendered by the caller
 * so this file never has to know how the BOM is built). Nothing is
 * recalculated here; every number is a read-out of the existing simulator.
 * ========================================================================== */

interface ResultsScreenProps {
  summary: NetworkSummary;
  simulation: SimulationResult;
  nodes: PonNode[];
  powerBars: PowerBar[];
  worstLossDb: number | null;
  testing: boolean;
  stale: boolean;
  autoRun: boolean;
  onRun: () => void;
  onFocusNode: (nodeId: string) => void;
  /** The Quotation tab body (the bill of materials, rendered by the caller). */
  quotation: ReactNode;
  /** Which tab opens first (the quotaion button on the Summary card, or a deep open). */
  initialTab?: 'summary' | 'subscribers' | 'quotation';
}

type ResultsTab = 'summary' | 'subscribers' | 'quotation';

const RESULT_TABS: Array<{ id: ResultsTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'quotation', label: 'Quotation' },
];

const barWidth = (value: number | null): number =>
  value === null ? 0 : Math.max(4, Math.min(100, ((value + 35) / 42) * 100));

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="pu-stat-card">
      <span className="pu-stat-card-label">{label}</span>
      <b className={`pu-stat-card-value${tone ? ` is-${tone}` : ''}`}>{value}</b>
      {sub ? <small className="pu-stat-card-sub">{sub}</small> : null}
    </div>
  );
}

export function ResultsScreen({
  summary,
  simulation,
  nodes,
  powerBars,
  worstLossDb,
  testing,
  stale,
  autoRun,
  onRun,
  onFocusNode,
  quotation,
  initialTab = 'summary',
}: ResultsScreenProps) {
  const headingRef = useSectionFocus<HTMLHeadingElement>();
  const [tab, setTab] = useState<ResultsTab>(initialTab);

  const rows = useMemo(
    () =>
      nodes
        .filter((node) => node.type === 'ont' || node.type === 'gateway')
        .map((node) => ({
          node,
          reading: node.type === 'ont' ? simulation.ontTelemetry[node.id] : simulation.gatewayTelemetry[node.id],
        }))
        .filter((row) => row.reading !== undefined)
        .sort((a, b) => (b.reading?.rxPowerDbm ?? -999) - (a.reading?.rxPowerDbm ?? -999)),
    [nodes, simulation],
  );

  const online = summary.byStatus.ONLINE;
  const failing = summary.byStatus.LOS + summary.byStatus.DISCONNECTED;
  const marginal = summary.byStatus.WARNING + summary.byStatus.OVERLOAD;

  const subscriberTable = (
    <section className="pu-screen-card" aria-labelledby="results-subs-title">
      <div className="pu-screen-card-head">
        <h2 id="results-subs-title">Subscriber endpoints</h2>
        <span className="pu-screen-card-note">{rows.length} provisioned</span>
      </div>
      {rows.length === 0 ? (
        <p className="pu-screen-empty">
          No subscriber endpoints yet. Add an ONU or a Wi-Fi gateway on the Design canvas to see its budget here.
        </p>
      ) : (
        <div className="pu-sim-table-wrap">
          <table className="pu-sim-table">
            <caption className="sr-only">Subscriber optical results</caption>
            <thead>
              <tr>
                <th scope="col">Endpoint</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Rx power</th>
                <th scope="col">Loss + margin</th>
                <th scope="col">
                  <span className="sr-only">Show on canvas</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, reading }) => {
                const status = reading?.status ?? 'DISCONNECTED';
                const style = STATUS_STYLES[status];
                return (
                  <tr key={node.id}>
                    <td className="pu-sim-name" data-label="Endpoint">
                      {node.data.subscriber}
                    </td>
                    <td className="pu-sim-type" data-label="Type">
                      {node.type === 'ont' ? 'ONU / ONT' : 'Wi-Fi 6 gateway'}
                    </td>
                    <td data-label="Status">
                      <span className="pu-sim-status" style={{ color: style.hex }}>
                        <span className="pu-sim-dot" style={{ background: style.hex }} aria-hidden="true" />
                        {style.label}
                      </span>
                    </td>
                    <td className="pu-sim-num" data-label="Rx power">
                      {formatDbm(reading?.rxPowerDbm ?? null)}
                    </td>
                    <td className="pu-sim-num" data-label="Loss + margin">
                      {reading?.totalLossDb !== undefined ? `${reading.totalLossDb.toFixed(2)} dB` : '—'}
                    </td>
                    <td className="pu-sim-action">
                      <button
                        type="button"
                        className="pu-btn"
                        onClick={() => onFocusNode(node.id)}
                        aria-label={`Show ${node.data.subscriber} on the canvas`}
                        title="Go to this component on the Design canvas"
                      >
                        Design <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {summary.upstreamDynamicRangeWarning ? (
        <p className="pu-screen-warn">
          <TriangleAlert size={14} aria-hidden="true" /> Upstream burst differential of{' '}
          {summary.upstreamDeltaDb.toFixed(1)} dB exceeds the 15 dB dynamic-range limit.
        </p>
      ) : null}
    </section>
  );

  const budgetCard = (
    <section className="pu-screen-card" aria-labelledby="results-budget-title">
      <div className="pu-screen-card-head">
        <h2 id="results-budget-title">
          <Activity size={16} aria-hidden="true" /> Optical budget
        </h2>
        <span className="pu-screen-card-note">OLT launch → splitter → nearest and farthest subscriber</span>
      </div>
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
      {worstLossDb !== null ? (
        <div className="pu-budget-rows">
          <div>
            <span>Path loss · worst subscriber</span>
            <b>{worstLossDb.toFixed(2)} dB</b>
          </div>
          <div>
            <span>Safety margin · design allowance</span>
            <b>{simulation.safetyMarginDb.toFixed(2)} dB</b>
          </div>
          <div className="is-total">
            <span>Total · loss + margin</span>
            <b>{(worstLossDb + simulation.safetyMarginDb).toFixed(2)} dB</b>
          </div>
        </div>
      ) : null}
      <p className="pu-sb-note">Receive window −28 to −8 dBm. The farthest subscriber decides the status colour.</p>
      <button type="button" className="pu-btn" onClick={() => setTab('quotation')}>
        Open the quotation
      </button>
    </section>
  );

  return (
    <section className="pu-screen" aria-labelledby="results-title">
      <header className="pu-screen-head">
        <div className="pu-screen-head-copy">
          <h1 id="results-title" ref={headingRef} tabIndex={-1}>
            Results
          </h1>
          <p>
            The live budget, every subscriber and the quotation. Change the network on the Design canvas and this screen
            follows it.
          </p>
        </div>
        <div className="pu-screen-actions">
          <button type="button" className="pu-btn pri" onClick={onRun} disabled={testing} aria-label="Run Simulation">
            {testing ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={16} fill="currentColor" aria-hidden="true" />
            )}
            <span>Run Simulation</span>
          </button>
          <span className={`pu-run-badge${autoRun ? ' is-live' : ''}`}>
            {autoRun ? 'Auto-run on' : stale ? 'Budget out of date' : 'Auto-run off'}
          </span>
        </div>
      </header>

      <div role="tablist" aria-label="Result views" className="pu-result-tabs">
        {RESULT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`results-${item.id}-tab`}
            aria-controls={`results-${item.id}-panel`}
            aria-selected={tab === item.id}
            className={`pu-result-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'quotation' ? (
        <div
          role="tabpanel"
          id="results-quotation-panel"
          aria-labelledby="results-quotation-tab"
          className="pu-result-panel"
        >
          {quotation}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`results-${tab}-panel`}
          aria-labelledby={`results-${tab}-tab`}
          className="pu-screen-body"
        >
          {tab === 'summary' ? (
            <>
              <div className="pu-stat-grid">
                <Stat
                  label="Loss + margin"
                  value={worstLossDb !== null ? `${(worstLossDb + simulation.safetyMarginDb).toFixed(1)} dB` : '—'}
                  sub="Worst path, allowance included"
                />
                <Stat
                  label="Fiber on canvas"
                  value={`${summary.totalFiberKm.toFixed(1)} km`}
                  sub="Every span, patched or not"
                />
                <Stat
                  label="Subscribers online"
                  value={`${online} / ${summary.subscriberCount}`}
                  sub={`${marginal} warning · ${failing} LOS`}
                  tone={failing > 0 ? 'bad' : marginal > 0 ? 'warn' : 'ok'}
                />
                <Stat
                  label="Upstream Δ"
                  value={summary.subscriberCount > 0 ? `${summary.upstreamDeltaDb.toFixed(1)} dB` : '—'}
                  sub={summary.upstreamDynamicRangeWarning ? 'Above the 15 dB limit' : 'Within the 15 dB limit'}
                  tone={summary.upstreamDynamicRangeWarning ? 'warn' : 'ok'}
                />
              </div>
              <div className="pu-screen-cards">{budgetCard}</div>
            </>
          ) : (
            <div className="pu-screen-cards">{subscriberTable}</div>
          )}
        </div>
      )}
    </section>
  );
}

export default ResultsScreen;
