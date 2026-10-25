import { useMemo, useState } from 'react';
import { ArrowLeft, Download, FileJson, Table2 } from 'lucide-react';
import type { DesignSettings, PonEdge, PonNode, SimulationResult, SplitRatio } from '../types';
import { SPLIT_RATIOS, SPLITTER_LOSS_DB, STATUS_STYLES } from '../types';
import { describeStatus, formatDbm } from '../engine/opticalSimulator';
import type { NetworkCostBreakdown, UnitCostProfile } from '../data/pricingCatalogue';
import { formatUsd } from '../data/pricingCatalogue';
import { useSectionFocus } from '../hooks/useSectionFocus';
import { buildCommercialCsv, buildQuotationExport, connectedSubscriberCount } from '../data/commercialQuoteExports';
import { PricingSettings } from './PricingSettings';

/* ========================================================================== *
 * Bill of Materials — deployment statistics + per-subscriber optical budget.
 * ========================================================================== */

interface BOMModalProps {
  open: boolean;
  onClose: () => void;
  nodes: PonNode[];
  edges: PonEdge[];
  simulation: SimulationResult;
  settings: DesignSettings;
  unitCosts: UnitCostProfile;
  onUnitCostsChange: (unitCosts: UnitCostProfile) => void;
  onResetUnitCosts: () => void;
  costBreakdown: NetworkCostBreakdown;
}

function triggerDownload(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function StatCard({
  label,
  value,
  sub,
  tone = 'text-[var(--pu-ink)]',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--pu-line)] bg-white px-3 py-2">
      <div className="text-caption font-medium uppercase tracking-eyebrow text-[var(--pu-mut)]">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold leading-tight ${tone}`}>{value}</div>
      {sub ? <div className="mt-1 text-caption text-[var(--pu-mut)]">{sub}</div> : null}
    </div>
  );
}

function CommercialQuotationView({
  nodes,
  simulation,
  costBreakdown,
  unitCosts,
  onUnitCostsChange,
  onResetUnitCosts,
}: {
  nodes: PonNode[];
  simulation: SimulationResult;
  costBreakdown: NetworkCostBreakdown;
  unitCosts: UnitCostProfile;
  onUnitCostsChange: (unitCosts: UnitCostProfile) => void;
  onResetUnitCosts: () => void;
}) {
  const connectedCount = connectedSubscriberCount(nodes, simulation);
  const costPerConnected =
    connectedCount === 0 ? 0 : Math.round((costBreakdown.totalCapex / connectedCount + Number.EPSILON) * 100) / 100;
  const homeCount = nodes.filter((node) => node.type === 'ont' || node.type === 'gateway').length;

  return (
    <section aria-label="Commercial quotation and CAPEX" data-testid="commercial-quotation">
      <h2 className="sr-only">Commercial quotation &amp; CAPEX</h2>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="Total Materials Cost"
          value={formatUsd(costBreakdown.materialsCost)}
          tone="text-[var(--pu-pri)]"
        />
        <StatCard
          label="Total Labor & Splicing Cost"
          value={formatUsd(costBreakdown.laborCost)}
          tone="text-[var(--pu-warn)]"
        />
        <StatCard label="Total Project CAPEX" value={formatUsd(costBreakdown.totalCapex)} tone="text-[var(--pu-ok)]" />
        <StatCard
          label="CAPEX / Connected Subscriber"
          value={connectedCount === 0 ? '—' : formatUsd(costPerConnected)}
          sub={`${formatUsd(costBreakdown.costPerHomePassed)} per home passed · ${homeCount} homes / endpoints`}
          tone="text-[var(--pu-pri)]"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--pu-line)]">
        <div className="flex items-center justify-between gap-2 bg-[var(--pu-elevated)] px-3 py-2">
          <div>
            <h3 className="text-label font-semibold text-[var(--pu-ink)]">Detailed quotation</h3>
            <p className="text-body text-[var(--pu-mut)]">Deployed quantities · reference USD rates</p>
          </div>
          <span className="font-mono text-caption text-[var(--pu-mut)]">
            {costBreakdown.lineItems.length} line items
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] font-mono text-label" data-testid="quotation-line-items">
            <thead>
              <tr className="border-t border-[var(--pu-line)] bg-white text-caption uppercase tracking-label text-[var(--pu-mut)]">
                <th className="px-2 py-2 text-left font-medium">Category</th>
                <th className="px-2 py-2 text-left font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="px-2 py-2 text-left font-medium">Unit</th>
                <th className="px-2 py-2 text-right font-medium">Unit price</th>
                <th className="px-2 py-2 text-right font-medium">Extended total</th>
              </tr>
            </thead>
            <tbody>
              {costBreakdown.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--pu-mut)]">
                    No priced components on the canvas yet.
                  </td>
                </tr>
              ) : (
                costBreakdown.lineItems.map((line) => (
                  <tr
                    key={`${line.category}-${line.item}`}
                    className="border-t border-[var(--pu-line)] text-[var(--pu-ink)]"
                  >
                    <td className="px-2 py-2 text-[var(--pu-mut)]">{line.category}</td>
                    <td className="px-2 py-2 text-[var(--pu-ink)]">{line.item}</td>
                    <td className="px-2 py-2 text-right">
                      {line.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-2 py-2 text-[var(--pu-mut)]">{line.unit}</td>
                    <td className="px-2 py-2 text-right">{formatUsd(line.unitPrice)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-[var(--pu-ok)]">
                      {formatUsd(line.totalPrice)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t border-[var(--pu-line)] bg-[var(--pu-elevated)] font-semibold text-[var(--pu-ink)]">
                <td colSpan={4} className="px-2 py-2 text-right">
                  Total quoted CAPEX
                </td>
                <td className="px-2 py-2 text-right">—</td>
                <td className="px-2 py-2 text-right text-[var(--pu-ok)]">{formatUsd(costBreakdown.totalCapex)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 rounded-md border border-[var(--pu-line)] bg-[var(--pu-elevated)] px-3 py-2 text-body leading-relaxed text-[var(--pu-mut)]">
        Educational USD planning rates only—not a supplier quote, installed-price guarantee, tax estimate, or market
        survey. Edit the local reference rates below before exporting a quotation.
      </p>

      {/* Unit pricing moved here from the Inspector: it is a quotation-wide
          setting, not a property of whichever component happens to be selected. */}
      <div className="mt-3">
        <PricingSettings unitCosts={unitCosts} onChange={onUnitCostsChange} onReset={onResetUnitCosts} />
      </div>
    </section>
  );
}

export function BOMModal({
  open,
  onClose,
  nodes,
  edges,
  simulation,
  settings,
  unitCosts,
  onUnitCostsChange,
  onResetUnitCosts,
  costBreakdown,
}: BOMModalProps) {
  const [activeTab, setActiveTab] = useState<'optical' | 'commercial'>('optical');
  /* Reports is a section: opening it puts the keyboard on the report title. */
  const titleRef = useSectionFocus<HTMLHeadingElement>();
  const summary = simulation.summary;

  const subscriberRows = useMemo(
    () =>
      nodes
        .filter((node) => node.type === 'ont' || node.type === 'gateway')
        .map((node) => ({
          node,
          telemetry: node.type === 'ont' ? simulation.ontTelemetry[node.id] : simulation.gatewayTelemetry[node.id],
        }))
        .filter((row) => row.telemetry !== undefined)
        .sort((a, b) => (b.telemetry?.rxPowerDbm ?? -999) - (a.telemetry?.rxPowerDbm ?? -999)),
    [nodes, simulation],
  );

  if (!open) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  /* Reports is a section screen, so the report *is* the page: <main> with an
   * <h1> title, over <h2> section headings. */
  return (
    <main className="pu-screen pu-reports-screen" aria-labelledby="bom-title" aria-describedby="bom-description">
      <div className="pu-reports-back">
        <button type="button" className="pu-btn" onClick={onClose}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Design
        </button>
      </div>

      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--pu-pri-soft)] text-[var(--pu-pri)]">
            <Table2 size={16} />
          </span>
          <div>
            <h1
              id="bom-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-section font-bold leading-tight text-[var(--pu-ink)]"
            >
              Bill of Materials
            </h1>
            <p id="bom-description" className="text-body text-[var(--pu-mut)]">
              Optical audit &amp; commercial CAPEX quotation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="pu-capex-banner"
            role="region"
            data-testid="capex-telemetry"
            aria-label={`Network CAPEX ${formatUsd(costBreakdown.totalCapex)}; ${formatUsd(costBreakdown.costPerHomePassed)} per home passed`}
          >
            CAPEX <strong>{formatUsd(costBreakdown.totalCapex, true)}</strong>
            <span className="pu-capex-detail">{formatUsd(costBreakdown.costPerHomePassed)} / Home Passed</span>
          </span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              triggerDownload(
                `fiberlab-quotation-${timestamp}.csv`,
                buildCommercialCsv(nodes, simulation, costBreakdown),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={14} /> Quote CSV
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              triggerDownload(
                `fiberlab-quotation-${timestamp}.json`,
                JSON.stringify(
                  buildQuotationExport(nodes, edges, simulation, settings, unitCosts, costBreakdown),
                  null,
                  2,
                ),
                'application/json',
              )
            }
          >
            <FileJson size={14} /> Quote JSON
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Bill of materials views"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--pu-line)] px-4 pt-2"
      >
        <button
          type="button"
          role="tab"
          id="optical-budget-tab"
          aria-controls="optical-budget-panel"
          aria-selected={activeTab === 'optical'}
          className={`bom-tab ${activeTab === 'optical' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('optical')}
        >
          Optical Budget Audit
        </button>
        <button
          type="button"
          role="tab"
          id="commercial-quotation-tab"
          aria-controls="commercial-quotation-panel"
          aria-selected={activeTab === 'commercial'}
          className={`bom-tab ${activeTab === 'commercial' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('commercial')}
        >
          Commercial Quotation &amp; CAPEX
        </button>
      </div>

      <div
        role="tabpanel"
        tabIndex={0}
        id={activeTab === 'optical' ? 'optical-budget-panel' : 'commercial-quotation-panel'}
        aria-labelledby={activeTab === 'optical' ? 'optical-budget-tab' : 'commercial-quotation-tab'}
        className="min-w-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {activeTab === 'commercial' ? (
          <CommercialQuotationView
            nodes={nodes}
            simulation={simulation}
            costBreakdown={costBreakdown}
            unitCosts={unitCosts}
            onUnitCostsChange={onUnitCostsChange}
            onResetUnitCosts={onResetUnitCosts}
          />
        ) : (
          <>
            {/* ------------------------- Headline metrics ------------------------- */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatCard
                label="Fiber deployed"
                value={`${summary.totalFiberKm.toFixed(2)}`}
                sub="km of plant on canvas"
                tone="text-[var(--pu-pri)]"
              />
              <StatCard
                label={summary.gatewayCount === 0 ? 'ONTs provisioned' : 'Subscriber endpoints'}
                value={`${summary.subscriberCount}`}
                sub={`${summary.oltActive}/${summary.oltCount} OLT lasers active`}
              />
              <StatCard
                label="Reachable"
                value={`${summary.byStatus.ONLINE + summary.byStatus.WARNING + summary.byStatus.OVERLOAD}`}
                sub={`${summary.byStatus.ONLINE} optimal · ${summary.byStatus.WARNING} marginal · ${summary.byStatus.OVERLOAD} overload`}
                tone="text-[var(--pu-ok)]"
              />
              <StatCard
                label="Offline"
                value={`${summary.byStatus.LOS + summary.byStatus.DISCONNECTED}`}
                sub={`${summary.byStatus.LOS} LOS · ${summary.byStatus.DISCONNECTED} unwired`}
                tone={
                  summary.byStatus.LOS + summary.byStatus.DISCONNECTED > 0
                    ? 'text-[var(--pu-bad)]'
                    : 'text-[var(--pu-ink)]'
                }
              />
            </div>

            {/* Deployed components: the old Components/Topology tabs now live here. */}
            <div className="mt-3 rounded-lg border border-[var(--pu-line)] bg-white p-3">
              <h2 className="eyebrow mb-2">Deployed components</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-label md:grid-cols-3">
                {(
                  [
                    ['olt', 'OLT'],
                    ['splitter', 'Splitters'],
                    ['fiber', 'Fiber spans'],
                    ['closure', 'Closures'],
                    ['odf', 'ODF panels'],
                    ['nap', 'NAP / FAT'],
                    ['ont', 'ONTs'],
                    ['gateway', 'Gateways'],
                    ['attenuator', 'Attenuator pads'],
                  ] as Array<[PonNode['type'], string]>
                ).map(([kind, label]) => {
                  const count = nodes.filter((node) => node.type === kind).length;
                  return (
                    <div key={kind} className="flex items-baseline justify-between gap-2">
                      <span className="text-[var(--pu-mut)]">{label}</span>
                      <span className={count === 0 ? 'text-[var(--pu-mut)]' : 'font-semibold text-[var(--pu-ink)]'}>
                        {count}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[var(--pu-mut)]">Patch cords</span>
                  <span className="font-semibold text-[var(--pu-ink)]">{edges.length}</span>
                </div>
              </div>
            </div>

            {/* --------------------------- Passive plant -------------------------- */}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--pu-line)] bg-white p-3">
                <h2 className="eyebrow mb-2">Splitters by ratio</h2>
                {summary.splitterTotal === 0 ? (
                  <p className="text-body text-[var(--pu-mut)]">No splitters deployed.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {SPLIT_RATIOS.filter((ratio: SplitRatio) => summary.splitterCountByRatio[ratio]).map((ratio) => (
                      <span
                        key={ratio}
                        className="rounded border border-[var(--pu-line)] bg-[var(--pu-pri-soft)] px-2 py-1 font-mono text-label text-[var(--pu-pri)]"
                      >
                        1:{ratio} × {summary.splitterCountByRatio[ratio]}
                        <span className="ml-2 text-[var(--pu-mut)]">−{SPLITTER_LOSS_DB[ratio].toFixed(1)} dB each</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 border-t border-[var(--pu-line)] pt-2 font-mono text-label text-[var(--pu-mut)]">
                  Total passive splitters: <span className="text-[var(--pu-ink)]">{summary.splitterTotal}</span>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--pu-line)] bg-white p-3">
                <h2 className="eyebrow mb-2">Termination &amp; splicing</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] font-mono text-label">
                    <tbody className="text-[var(--pu-ink)]">
                      <tr>
                        <td className="py-1 text-[var(--pu-mut)]">Fusion splices</td>
                        <td className="py-1 text-right">{summary.totalSplices}</td>
                        <td className="py-1 pl-3 text-right text-[var(--pu-mut)]">
                          {(summary.totalSplices * 0.1).toFixed(1)} dB worst case
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 text-[var(--pu-mut)]">SC/APC connectors</td>
                        <td className="py-1 text-right">{summary.totalConnectors}</td>
                        <td className="py-1 pl-3 text-right text-[var(--pu-mut)]">
                          {(summary.totalConnectors * 0.5).toFixed(1)} dB worst case
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 text-[var(--pu-mut)]">Safety margin</td>
                        <td className="py-1 text-right">{settings.safetyMarginDb.toFixed(1)} dB</td>
                        <td className="py-1 pl-3 text-right text-[var(--pu-mut)]">per subscriber</td>
                      </tr>
                      <tr className="border-t border-[var(--pu-line)]">
                        <td className="py-1 text-[var(--pu-mut)]">Mean Rx power</td>
                        <td className="py-1 text-right text-[var(--pu-ink)]" colSpan={2}>
                          {formatDbm(summary.meanRxDbm)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 text-[var(--pu-mut)]">Worst Rx power</td>
                        <td className="py-1 text-right text-[var(--pu-ink)]" colSpan={2}>
                          {formatDbm(summary.worstRxDbm)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ----------------------- Per-subscriber budget ---------------------- */}
            <div className="mt-4">
              <h2 className="eyebrow mb-2">Optical budget per subscriber</h2>
              <div className="overflow-hidden rounded-lg border border-[var(--pu-line)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] font-mono text-label" data-testid="subscriber-budget">
                    <thead>
                      <tr className="bg-[var(--pu-elevated)] text-caption uppercase tracking-label text-[var(--pu-mut)]">
                        <th className="px-2 py-2 text-left font-medium">Subscriber</th>
                        <th className="px-2 py-2 text-left font-medium">Status</th>
                        <th className="px-2 py-2 text-right font-medium">Rx dBm</th>
                        <th className="px-2 py-2 text-right font-medium">Loss dB</th>
                        <th className="px-2 py-2 text-right font-medium">Margin</th>
                        <th className="px-2 py-2 text-right font-medium">Upstream Δ</th>
                        <th className="px-2 py-2 text-right font-medium">Fiber km</th>
                        <th className="px-2 py-2 text-right font-medium">Split</th>
                        <th className="px-2 py-2 text-right font-medium">SPL</th>
                        <th className="px-2 py-2 text-right font-medium">CON</th>
                        <th className="px-2 py-2 text-left font-medium">OLT port</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriberRows.length === 0 ? (
                        <tr>
                          <td className="px-2 py-3 text-[var(--pu-mut)]" colSpan={11}>
                            No subscriber endpoints on the canvas yet — drag an ONT or gateway in from the toolbox.
                          </td>
                        </tr>
                      ) : (
                        subscriberRows.map(({ node, telemetry }) => {
                          if (!telemetry) return null;
                          const style = STATUS_STYLES[telemetry.status];
                          const data = node.data as { serial: string; subscriber: string };
                          const path = simulation.bestPaths[node.id];
                          return (
                            <tr
                              key={node.id}
                              className="border-t border-[var(--pu-line)] text-[var(--pu-ink)] hover:bg-[var(--pu-elevated)]"
                            >
                              <td className="px-2 py-2">
                                <div className="truncate font-sans text-label text-[var(--pu-ink)]">
                                  {data.subscriber}
                                </div>
                                <div className="text-label text-[var(--pu-mut)]">
                                  {node.type === 'gateway'
                                    ? `Wi-Fi gateway · ${data.serial} · ${node.data.ssid}`
                                    : `ONT · ${data.serial}`}
                                  {node.type === 'gateway' &&
                                  simulation.gatewayTelemetry[node.id]?.estimatedDownMbps !== null
                                    ? ` · ${simulation.gatewayTelemetry[node.id]?.estimatedDownMbps?.toFixed(0)} Mbps down`
                                    : ''}
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-caption font-semibold ${style.badge}`}
                                  title={describeStatus(telemetry.status)}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.hex }} />
                                  {style.label}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-right font-semibold" style={{ color: style.hex }}>
                                {formatDbm(telemetry.rxPowerDbm)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {telemetry.rxPowerDbm === null ? '—' : telemetry.totalLossDb.toFixed(2)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {telemetry.rxPowerDbm === null ? '—' : `${telemetry.marginDb.toFixed(2)}`}
                              </td>
                              <td
                                className={`px-2 py-2 text-right ${
                                  telemetry.upstreamDeltaDb !== null && telemetry.upstreamDeltaDb > 15
                                    ? 'font-semibold text-[var(--pu-warn)]'
                                    : ''
                                }`}
                              >
                                {telemetry.upstreamDeltaDb === null
                                  ? '—'
                                  : `${telemetry.upstreamDeltaDb.toFixed(2)} dB`}
                              </td>
                              <td className="px-2 py-2 text-right">{telemetry.fiberKm.toFixed(2)}</td>
                              <td className="px-2 py-2 text-right">
                                {telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}
                              </td>
                              <td className="px-2 py-2 text-right">{telemetry.splices}</td>
                              <td className="px-2 py-2 text-right">{telemetry.connectors}</td>
                              <td className="px-2 py-2 text-label text-[var(--pu-mut)]">
                                {path ? `${path.oltPort} @ ${path.txPowerDbm.toFixed(1)} dBm` : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* -------------------------- Status legend -------------------------- */}
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(STATUS_STYLES) as Array<keyof typeof STATUS_STYLES>).map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded border border-[var(--pu-line)] bg-white px-2 py-1"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: STATUS_STYLES[key].hex,
                      boxShadow: `0 0 6px ${STATUS_STYLES[key].hex}`,
                    }}
                  />
                  <span className="font-mono text-label text-[var(--pu-ink)]">{STATUS_STYLES[key].label}</span>
                  <span className="font-mono text-label text-[var(--pu-mut)]">{summary.byStatus[key]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default BOMModal;
