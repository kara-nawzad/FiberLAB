import { useMemo, useState } from 'react';
import { Download, FileJson, Table2, X } from 'lucide-react';
import type { DesignSettings, PonEdge, PonNode, SimulationResult, SplitRatio, TopologyExport } from '../types';
import { SPLIT_RATIOS, SPLITTER_LOSS_DB, STATUS_STYLES } from '../types';
import { describeStatus, formatDbm } from '../engine/opticalSimulator';
import type { NetworkCostBreakdown, UnitCostProfile } from '../data/pricingCatalogue';
import { formatUsd } from '../data/pricingCatalogue';

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

function connectedSubscriberCount(nodes: PonNode[], simulation: SimulationResult): number {
  return nodes.filter(
    (node) => (node.type === 'ont' || node.type === 'gateway') && Boolean(simulation.bestPaths[node.id]),
  ).length;
}

export function buildQuotationExport(
  nodes: PonNode[],
  edges: PonEdge[],
  simulation: SimulationResult,
  settings: DesignSettings,
  unitCosts: UnitCostProfile,
  costBreakdown: NetworkCostBreakdown,
): TopologyExport {
  const connectedCount = connectedSubscriberCount(nodes, simulation);
  return {
    format: 'ftth-studio/topology',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    nodes,
    edges,
    simulation: {
      summary: simulation.summary,
      ontTelemetry: simulation.ontTelemetry,
      gatewayTelemetry: simulation.gatewayTelemetry,
    },
    commercial: {
      currency: 'USD',
      unitCosts,
      breakdown: costBreakdown,
      connectedSubscriberCount: connectedCount,
      costPerConnectedSubscriber:
        connectedCount === 0 ? 0 : Math.round((costBreakdown.totalCapex / connectedCount + Number.EPSILON) * 100) / 100,
    },
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** One quotation/summary section and the existing per-ONT optical audit in one CSV. */
export function buildCommercialCsv(
  nodes: PonNode[],
  simulation: SimulationResult,
  costBreakdown: NetworkCostBreakdown,
): string {
  const headers = [
    'record_type',
    'category',
    'item',
    'quantity',
    'unit',
    'unit_price_usd',
    'extended_price_usd',
    'materials_cost_usd',
    'labor_cost_usd',
    'total_capex_usd',
    'cost_per_home_passed_usd',
    'cost_per_connected_subscriber_usd',
    'ont_id',
    'subscriber',
    'serial',
    'ssid',
    'service_ip_address',
    'pon_standard',
    'estimated_down_mbps',
    'estimated_up_mbps',
    'status',
    'rx_power_dbm',
    'total_path_loss_db',
    'link_margin_db',
    'fiber_km',
    'split_stages',
    'cumulative_split_ratio',
    'splices',
    'connectors',
    'source_olt',
    'endpoint_type',
  ];
  const connectedCount = connectedSubscriberCount(nodes, simulation);
  const costPerConnected =
    connectedCount === 0 ? 0 : Math.round((costBreakdown.totalCapex / connectedCount + Number.EPSILON) * 100) / 100;
  const serialize = (record: Record<string, unknown>) => headers.map((header) => csvCell(record[header])).join(',');

  const rows = [
    serialize({
      record_type: 'quotation_summary',
      category: 'Summary',
      item: 'Project CAPEX summary',
      unit: 'USD',
      materials_cost_usd: costBreakdown.materialsCost,
      labor_cost_usd: costBreakdown.laborCost,
      total_capex_usd: costBreakdown.totalCapex,
      cost_per_home_passed_usd: costBreakdown.costPerHomePassed,
      cost_per_connected_subscriber_usd: costPerConnected,
    }),
    ...costBreakdown.lineItems.map((line) =>
      serialize({
        record_type: 'quotation_line',
        category: line.category,
        item: line.item,
        quantity: line.quantity,
        unit: line.unit,
        unit_price_usd: line.unitPrice,
        extended_price_usd: line.totalPrice,
      }),
    ),
    ...nodes
      .filter((node) => node.type === 'ont' || node.type === 'gateway')
      .map((node) => {
        const telemetry = node.type === 'ont' ? simulation.ontTelemetry[node.id] : simulation.gatewayTelemetry[node.id];
        const gatewayReading = node.type === 'gateway' ? simulation.gatewayTelemetry[node.id] : undefined;
        if (!telemetry) return null;
        return serialize({
          record_type: 'optical_budget',
          endpoint_type: node.type,
          ont_id: node.id,
          subscriber: node.data.subscriber,
          serial: node.data.serial,
          ssid: node.type === 'gateway' ? node.data.ssid : '',
          service_ip_address: gatewayReading?.serviceIpAddress ?? '',
          pon_standard: gatewayReading?.ponStandard ?? simulation.bestPaths[node.id]?.ponStandard ?? '',
          estimated_down_mbps: gatewayReading?.estimatedDownMbps ?? '',
          estimated_up_mbps: gatewayReading?.estimatedUpMbps ?? '',
          status: telemetry.status,
          rx_power_dbm: telemetry.rxPowerDbm,
          total_path_loss_db: telemetry.totalLossDb,
          link_margin_db: telemetry.rxPowerDbm === null ? '' : telemetry.marginDb,
          fiber_km: telemetry.fiberKm,
          split_stages: telemetry.splitStages,
          cumulative_split_ratio: telemetry.cumulativeSplitRatio,
          splices: telemetry.splices,
          connectors: telemetry.connectors,
          source_olt: telemetry.sourceOltId ?? '',
        });
      })
      .filter((row): row is string => row !== null),
  ];

  return [headers.map(csvCell).join(','), ...rows].join('\n');
}

function StatCard({
  label,
  value,
  sub,
  tone = 'text-noc-200',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-noc-700/60 bg-noc-950/50 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-noc-400">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-bold leading-tight ${tone}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-noc-500">{sub}</div> : null}
    </div>
  );
}

function CommercialQuotationView({
  nodes,
  simulation,
  costBreakdown,
}: {
  nodes: PonNode[];
  simulation: SimulationResult;
  costBreakdown: NetworkCostBreakdown;
}) {
  const connectedCount = connectedSubscriberCount(nodes, simulation);
  const costPerConnected =
    connectedCount === 0 ? 0 : Math.round((costBreakdown.totalCapex / connectedCount + Number.EPSILON) * 100) / 100;
  const homeCount = nodes.filter((node) => node.type === 'ont' || node.type === 'gateway').length;

  return (
    <section aria-label="Commercial quotation and CAPEX" data-testid="commercial-quotation">
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Total Materials Cost" value={formatUsd(costBreakdown.materialsCost)} tone="text-sky-300" />
        <StatCard
          label="Total Labor & Splicing Cost"
          value={formatUsd(costBreakdown.laborCost)}
          tone="text-amber-300"
        />
        <StatCard label="Total Project CAPEX" value={formatUsd(costBreakdown.totalCapex)} tone="text-emerald-300" />
        <StatCard
          label="CAPEX / Connected Subscriber"
          value={connectedCount === 0 ? '—' : formatUsd(costPerConnected)}
          sub={`${formatUsd(costBreakdown.costPerHomePassed)} per home passed · ${homeCount} homes / endpoints`}
          tone="text-orange-300"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-noc-700/60">
        <div className="flex items-center justify-between gap-2 bg-noc-800/80 px-3 py-2">
          <div>
            <h3 className="text-[11px] font-semibold text-noc-200">Detailed quotation</h3>
            <p className="text-[9px] text-noc-500">Deployed quantities · reference USD rates</p>
          </div>
          <span className="font-mono text-[10px] text-noc-400">{costBreakdown.lineItems.length} line items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] font-mono text-[10px]" data-testid="quotation-line-items">
            <thead>
              <tr className="border-t border-noc-700/60 bg-noc-950/70 text-[9px] uppercase tracking-wide text-noc-500">
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
                  <td colSpan={6} className="px-3 py-6 text-center text-noc-500">
                    No priced components on the canvas yet.
                  </td>
                </tr>
              ) : (
                costBreakdown.lineItems.map((line) => (
                  <tr key={`${line.category}-${line.item}`} className="border-t border-noc-700/40 text-noc-300">
                    <td className="px-2 py-2 text-noc-500">{line.category}</td>
                    <td className="px-2 py-2 text-noc-200">{line.item}</td>
                    <td className="px-2 py-2 text-right">
                      {line.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-2 py-2 text-noc-500">{line.unit}</td>
                    <td className="px-2 py-2 text-right">{formatUsd(line.unitPrice)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-emerald-300">
                      {formatUsd(line.totalPrice)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t border-noc-600 bg-noc-800/70 font-semibold text-noc-100">
                <td colSpan={4} className="px-2 py-2 text-right">
                  Total quoted CAPEX
                </td>
                <td className="px-2 py-2 text-right">—</td>
                <td className="px-2 py-2 text-right text-emerald-300">{formatUsd(costBreakdown.totalCapex)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-[9px] leading-relaxed text-amber-200/80">
        Educational USD planning rates only—not a supplier quote, installed-price guarantee, tax estimate, or market
        survey. Edit local reference rates in the Inspector before exporting a quotation.
      </p>
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
  costBreakdown,
}: BOMModalProps) {
  const [activeTab, setActiveTab] = useState<'optical' | 'commercial'>('optical');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="panel flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl shadow-panel">
        <div className="panel-header !py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
              <Table2 size={15} />
            </span>
            <div>
              <div className="text-[14px] font-semibold text-noc-200">Bill of Materials</div>
              <div className="text-[10px] text-noc-500">Optical audit &amp; commercial CAPEX quotation</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              <Download size={13} /> Quote CSV
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
              <FileJson size={13} /> Quote JSON
            </button>
            <button
              type="button"
              className="btn-ghost !p-1.5"
              onClick={onClose}
              aria-label="Close bill of materials"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Bill of materials views"
          className="flex shrink-0 gap-1 border-b border-noc-700/60 px-4 pt-2"
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
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {activeTab === 'commercial' ? (
            <CommercialQuotationView nodes={nodes} simulation={simulation} costBreakdown={costBreakdown} />
          ) : (
            <>
              {/* ------------------------- Headline metrics ------------------------- */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <StatCard
                  label="Fiber deployed"
                  value={`${summary.totalFiberKm.toFixed(2)}`}
                  sub="km of plant on canvas"
                  tone="text-sky-300"
                />
                <StatCard
                  label={summary.gatewayCount === 0 ? 'ONTs provisioned' : 'Subscriber endpoints'}
                  value={`${summary.subscriberCount}`}
                  sub={`${summary.oltActive}/${summary.oltCount} OLT lasers active`}
                />
                <StatCard
                  label="Online"
                  value={`${summary.byStatus.ONLINE + summary.byStatus.WARNING + summary.byStatus.OVERLOAD}`}
                  sub={`${summary.byStatus.ONLINE} optimal · ${summary.byStatus.WARNING} marginal`}
                  tone="text-emerald-300"
                />
                <StatCard
                  label="Offline"
                  value={`${summary.byStatus.LOS + summary.byStatus.DISCONNECTED}`}
                  sub={`${summary.byStatus.LOS} LOS · ${summary.byStatus.DISCONNECTED} unwired`}
                  tone={summary.byStatus.LOS + summary.byStatus.DISCONNECTED > 0 ? 'text-red-300' : 'text-noc-200'}
                />
              </div>

              {/* --------------------------- Passive plant -------------------------- */}
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-noc-700/60 bg-noc-950/50 p-3">
                  <div className="eyebrow mb-2">Splitters by ratio</div>
                  {summary.splitterTotal === 0 ? (
                    <p className="text-[11px] text-noc-500">No splitters deployed.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {SPLIT_RATIOS.filter((ratio: SplitRatio) => summary.splitterCountByRatio[ratio]).map((ratio) => (
                        <span
                          key={ratio}
                          className="rounded border border-purple-500/40 bg-purple-500/15 px-2 py-1 font-mono text-[11px] text-purple-200"
                        >
                          1:{ratio} × {summary.splitterCountByRatio[ratio]}
                          <span className="ml-1.5 text-purple-800">−{SPLITTER_LOSS_DB[ratio].toFixed(1)} dB each</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 border-t border-noc-700/50 pt-2 font-mono text-[11px] text-noc-400">
                    Total passive splitters: <span className="text-noc-200">{summary.splitterTotal}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-noc-700/60 bg-noc-950/50 p-3">
                  <div className="eyebrow mb-2">Termination &amp; splicing</div>
                  <table className="w-full font-mono text-[11px]">
                    <tbody className="text-noc-300">
                      <tr>
                        <td className="py-0.5 text-noc-400">Fusion splices</td>
                        <td className="py-0.5 text-right">{summary.totalSplices}</td>
                        <td className="py-0.5 pl-3 text-right text-noc-500">
                          {(summary.totalSplices * 0.1).toFixed(1)} dB worst case
                        </td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-noc-400">SC/APC connectors</td>
                        <td className="py-0.5 text-right">{summary.totalConnectors}</td>
                        <td className="py-0.5 pl-3 text-right text-noc-500">
                          {(summary.totalConnectors * 0.5).toFixed(1)} dB worst case
                        </td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-noc-400">Safety margin</td>
                        <td className="py-0.5 text-right">{settings.safetyMarginDb.toFixed(1)} dB</td>
                        <td className="py-0.5 pl-3 text-right text-noc-500">per subscriber</td>
                      </tr>
                      <tr className="border-t border-noc-700/50">
                        <td className="py-1 text-noc-400">Mean Rx power</td>
                        <td className="py-1 text-right text-noc-200" colSpan={2}>
                          {formatDbm(summary.meanRxDbm)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-noc-400">Worst Rx power</td>
                        <td className="py-0.5 text-right text-noc-200" colSpan={2}>
                          {formatDbm(summary.worstRxDbm)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ----------------------- Per-subscriber budget ---------------------- */}
              <div className="mt-4">
                <div className="eyebrow mb-2">Optical budget per subscriber</div>
                <div className="overflow-hidden rounded-lg border border-noc-700/60">
                  <table className="w-full font-mono text-[11px]">
                    <thead>
                      <tr className="bg-noc-800/80 text-[10px] uppercase tracking-wide text-noc-400">
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
                          <td className="px-2 py-3 text-noc-500" colSpan={11}>
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
                            <tr key={node.id} className="border-t border-noc-700/50 text-noc-300 hover:bg-noc-800/40">
                              <td className="px-2 py-1.5">
                                <div className="truncate font-sans text-[11px] text-noc-200">{data.subscriber}</div>
                                <div className="text-[9px] text-noc-500">
                                  {node.type === 'gateway'
                                    ? `Wi-Fi gateway · ${data.serial} · ${node.data.ssid}`
                                    : `ONT · ${data.serial}`}
                                  {node.type === 'gateway' &&
                                  simulation.gatewayTelemetry[node.id]?.estimatedDownMbps !== null
                                    ? ` · ${simulation.gatewayTelemetry[node.id]?.estimatedDownMbps?.toFixed(0)} Mbps down`
                                    : ''}
                                </div>
                              </td>
                              <td className="px-2 py-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-[9px] font-semibold ${style.badge}`}
                                  title={describeStatus(telemetry.status)}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.hex }} />
                                  {style.label}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold" style={{ color: style.hex }}>
                                {formatDbm(telemetry.rxPowerDbm)}
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                {telemetry.rxPowerDbm === null ? '—' : telemetry.totalLossDb.toFixed(2)}
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                {telemetry.rxPowerDbm === null ? '—' : `${telemetry.marginDb.toFixed(2)}`}
                              </td>
                              <td
                                className={`px-2 py-1.5 text-right ${
                                  telemetry.upstreamDeltaDb !== null && telemetry.upstreamDeltaDb > 15
                                    ? 'font-semibold text-amber-400'
                                    : ''
                                }`}
                              >
                                {telemetry.upstreamDeltaDb === null
                                  ? '—'
                                  : `${telemetry.upstreamDeltaDb.toFixed(2)} dB`}
                              </td>
                              <td className="px-2 py-1.5 text-right">{telemetry.fiberKm.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right">
                                {telemetry.rxPowerDbm === null ? '—' : `1:${telemetry.cumulativeSplitRatio}`}
                              </td>
                              <td className="px-2 py-1.5 text-right">{telemetry.splices}</td>
                              <td className="px-2 py-1.5 text-right">{telemetry.connectors}</td>
                              <td className="px-2 py-1.5 text-[10px] text-noc-400">
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

              {/* -------------------------- Status legend -------------------------- */}
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(STATUS_STYLES) as Array<keyof typeof STATUS_STYLES>).map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 rounded border border-noc-700/60 bg-noc-950/50 px-2 py-1"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: STATUS_STYLES[key].hex,
                        boxShadow: `0 0 6px ${STATUS_STYLES[key].hex}`,
                      }}
                    />
                    <span className="font-mono text-[10px] text-noc-300">{STATUS_STYLES[key].label}</span>
                    <span className="font-mono text-[10px] text-noc-500">{summary.byStatus[key]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BOMModal;
