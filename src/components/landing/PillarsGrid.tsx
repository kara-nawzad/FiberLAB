import { Activity, ArrowUpRight, Cable, ClipboardCheck, FileSpreadsheet } from 'lucide-react';

interface PillarsGridProps {
  onStartVillaMission: () => void;
  onOpenStudio: () => void;
}

function FormulaGraphic() {
  return (
    <div className="landing-formula-graphic" role="group" aria-label="Receive-power link-budget formula">
      <div className="landing-formula-main">
        <span>
          P<sub>rx</sub>
        </span>
        <b>=</b>
        <span>
          P<sub>tx</sub>
        </span>
        <b>−</b>
        <span>ΣL</span>
      </div>
      <div className="landing-formula-terms">
        <span>α · km</span>
        <span>+</span>
        <span>0.10 · splices</span>
        <span>+ 0.50 · connectors</span>
        <span>+ split + margin</span>
      </div>
    </div>
  );
}

function RouteGraphic() {
  return (
    <svg className="landing-route-graphic" viewBox="0 0 360 100" aria-hidden="true">
      <path
        d="M24 48H108M138 48H205M237 48C266 48 269 18 301 18M237 48C266 48 269 78 301 78"
        fill="none"
        stroke="#b18c72"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <circle cx="24" cy="48" r="12" fill="#fff0df" stroke="#e4673f" strokeWidth="1.5" />
      <path d="M18 48h12m-6-6v12" stroke="#e4673f" strokeWidth="1.4" />
      <rect x="108" y="34" width="30" height="28" rx="5" fill="#f4e8d8" stroke="#85695a" />
      <path d="M113 48h8m5-8v16" stroke="#705443" strokeWidth="1.3" />
      <rect x="205" y="34" width="32" height="28" rx="5" fill="#f5e8d7" stroke="#b4502c" />
      <path d="M210 48h7m5-8v16" stroke="#b4502c" strokeWidth="1.3" />
      <circle cx="313" cy="18" r="10" fill="#eaf8f1" stroke="#0f8a5f" strokeWidth="1.5" />
      <circle cx="313" cy="78" r="10" fill="#fff5e2" stroke="#a85a12" strokeWidth="1.5" />
      <text x="24" y="91" textAnchor="middle" fill="#705443" fontSize="8" fontFamily="ui-monospace,monospace">
        OLT
      </text>
      <text x="123" y="91" textAnchor="middle" fill="#705443" fontSize="8" fontFamily="ui-monospace,monospace">
        SPAN
      </text>
      <text x="221" y="91" textAnchor="middle" fill="#705443" fontSize="8" fontFamily="ui-monospace,monospace">
        PLC
      </text>
      <text x="342" y="21" textAnchor="end" fill="#705443" fontSize="8" fontFamily="ui-monospace,monospace">
        ONLINE
      </text>
      <text x="342" y="81" textAnchor="end" fill="#705443" fontSize="8" fontFamily="ui-monospace,monospace">
        MARGINAL
      </text>
    </svg>
  );
}

function AuditGraphic() {
  return (
    <div className="landing-audit-graphic" role="group" aria-label="Bill of materials preview">
      <div className="landing-audit-row">
        <span>
          <Cable size={12} /> Single-mode plant
        </span>
        <strong>km</strong>
      </div>
      <div className="landing-audit-row">
        <span>
          <span className="landing-audit-dot landing-audit-dot--green" /> Fusion splices
        </span>
        <strong>0.10 dB ea.</strong>
      </div>
      <div className="landing-audit-row">
        <span>
          <span className="landing-audit-dot landing-audit-dot--accent" /> SC/APC connector pairs
        </span>
        <strong>0.50 dB ea.</strong>
      </div>
      <div className="landing-audit-row">
        <span>
          <Activity size={12} /> Per-subscriber budget
        </span>
        <strong>CSV / JSON</strong>
      </div>
    </div>
  );
}

export function PillarsGrid({ onStartVillaMission, onOpenStudio }: PillarsGridProps) {
  return (
    <section className="landing-pillars-section" id="capabilities" aria-labelledby="landing-pillars-title">
      <div className="landing-section-heading">
        <p className="landing-section-eyebrow">THREE INSTRUMENTS · ONE DETERMINISTIC MODEL</p>
        <h2 id="landing-pillars-title">Built for the route, not the pitch.</h2>
        <p>The graph is editable. The loss terms are visible. The result can be audited.</p>
      </div>

      <div className="landing-pillars-grid">
        <article className="landing-pillar landing-pillar--physics">
          <div className="landing-pillar-topline">
            <span>01 / BUDGET</span>
            <Activity size={16} aria-hidden="true" />
          </div>
          <h3>Deterministic Link Budgets</h3>
          <p>
            Every modeled dB is accounted for. The engine walks active OLT paths to subscriber ONTs and totals fiber
            attenuation, fusion splices (0.1 dB), connector counts (0.5 dB), PLC insertion loss, and the system margin.
          </p>
          <FormulaGraphic />
          <span className="landing-pillar-footnote">Explicit terms · fixed assumptions · inspectable path</span>
        </article>

        <article className="landing-pillar landing-pillar--missions">
          <div className="landing-pillar-topline">
            <span>02 / FIELDWORK</span>
            <ClipboardCheck size={16} aria-hidden="true" />
          </div>
          <h3>Field Troubleshooting Missions</h3>
          <p>
            Trace a marginal drop, a disabled source, an unpatched subscriber, or a budget-constrained build. Live
            objectives check optical quality, design margin, and quoted CAPEX against the active network graph.
          </p>
          <RouteGraphic />
          <button type="button" className="landing-pillar-link" onClick={onStartVillaMission}>
            Open The Marginal Villa mission <ArrowUpRight size={14} aria-hidden="true" />
          </button>
          <span className="landing-pillar-footnote">
            Dirty-ferrule training toggle adds an illustrative +2.00 dB scenario penalty.
          </span>
        </article>

        <article className="landing-pillar landing-pillar--audit">
          <div className="landing-pillar-topline">
            <span>03 / INVENTORY</span>
            <FileSpreadsheet size={16} aria-hidden="true" />
          </div>
          <h3>Instant Bill of Materials</h3>
          <p>
            Audit optical budgets beside materials, splicing labor, total CAPEX, and cost per connected home. Export a
            commercial quotation with its optical parameters as CSV or JSON.
          </p>
          <AuditGraphic />
          <button type="button" className="landing-pillar-link" onClick={onOpenStudio}>
            Open the design canvas in Studio <ArrowUpRight size={14} aria-hidden="true" />
          </button>
          <span className="landing-pillar-footnote">Totals come from the visible node graph and current settings.</span>
        </article>
      </div>
    </section>
  );
}

export default PillarsGrid;
