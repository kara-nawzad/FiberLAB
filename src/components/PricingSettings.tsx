import type { CableType, SplitRatio } from '../types';
import { SPLIT_RATIOS } from '../types';
import type { UnitCostProfile } from '../data/pricingCatalogue';

interface PricingSettingsProps {
  unitCosts: UnitCostProfile;
  onChange: (unitCosts: UnitCostProfile) => void;
  onReset: () => void;
}

function RateInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="pricing-rate-row">
      <span>{label}</span>
      <span className="pricing-rate-input-wrap">
        <span aria-hidden="true">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          aria-label={label}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.max(0, next) : 0);
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  );
}

const CABLE_LABELS: Record<CableType, string> = {
  feeder: 'Feeder / OSP cable',
  distribution: 'Distribution cable',
  drop: 'Drop cable',
};

export function PricingSettings({ unitCosts, onChange, onReset }: PricingSettingsProps) {
  const changeCableRate = (type: CableType, value: number) => {
    onChange({ ...unitCosts, cablePerKm: { ...unitCosts.cablePerKm, [type]: value } });
  };
  const changeSplitterRate = (ratio: SplitRatio, value: number) => {
    onChange({
      ...unitCosts,
      splitterByRatio: { ...unitCosts.splitterByRatio, [`1:${ratio}`]: value },
    });
  };

  return (
    <details className="local-pricing-settings">
      <summary>
        <span>Local unit pricing</span>
        <small>EDIT USD RATES</small>
      </summary>
      <div className="local-pricing-body">
        <p className="local-pricing-note">
          Reference planning rates in USD. Local edits affect CAPEX and the budget mission only—not optical loss or status.
        </p>

        <div className="pricing-rate-group">
          <h3>Cables · per km</h3>
          {(Object.keys(CABLE_LABELS) as CableType[]).map((type) => (
            <RateInput
              key={type}
              label={CABLE_LABELS[type]}
              unit="/ km"
              value={unitCosts.cablePerKm[type]}
              onChange={(value) => changeCableRate(type, value)}
            />
          ))}
        </div>

        <div className="pricing-rate-group">
          <h3>PLC splitters · each</h3>
          {SPLIT_RATIOS.map((ratio) => (
            <RateInput
              key={ratio}
              label={`Splitter 1:${ratio}`}
              unit="/ each"
              value={unitCosts.splitterByRatio[`1:${ratio}`] ?? 0}
              onChange={(value) => changeSplitterRate(ratio, value)}
            />
          ))}
        </div>

        <div className="pricing-rate-group">
          <h3>Equipment &amp; field labor</h3>
          <RateInput label="Dome closure (FOSC)" unit="/ each" value={unitCosts.foscClosure} onChange={(foscClosure) => onChange({ ...unitCosts, foscClosure })} />
          <RateInput label="ODF rack / patch panel" unit="/ each" value={unitCosts.odfRackPanel} onChange={(odfRackPanel) => onChange({ ...unitCosts, odfRackPanel })} />
          <RateInput label="Outdoor NAP/FAT 1:8" unit="/ each" value={unitCosts.napFat} onChange={(napFat) => onChange({ ...unitCosts, napFat })} />
          <RateInput label="OLT PON port module" unit="/ each" value={unitCosts.oltPortModule} onChange={(oltPortModule) => onChange({ ...unitCosts, oltPortModule })} />
          <RateInput label="Customer ONT terminal" unit="/ each" value={unitCosts.ontTerminal} onChange={(ontTerminal) => onChange({ ...unitCosts, ontTerminal })} />
          <RateInput label="Wi-Fi 6 PON gateway" unit="/ each" value={unitCosts.wifi6Gateway} onChange={(wifi6Gateway) => onChange({ ...unitCosts, wifi6Gateway })} />
          <RateInput label="Fusion splice labor" unit="/ splice" value={unitCosts.laborPerSplice} onChange={(laborPerSplice) => onChange({ ...unitCosts, laborPerSplice })} />
          <RateInput label="SC/APC termination" unit="/ connector" value={unitCosts.connectorPerEnd} onChange={(connectorPerEnd) => onChange({ ...unitCosts, connectorPerEnd })} />
        </div>

        <button type="button" className="btn-ghost mt-2 w-full" onClick={onReset}>
          Restore reference pricing
        </button>
      </div>
    </details>
  );
}
