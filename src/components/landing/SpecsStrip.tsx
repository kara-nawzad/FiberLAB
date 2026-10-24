import { OLT_CLASS_SPECS, ONT_THRESHOLDS } from '../../types';

function dbm(value: number): string {
  return `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(1)} dBm`;
}

export function SpecsStrip() {
  const classes = [
    { label: 'Class B+', spec: OLT_CLASS_SPECS['B+'] },
    { label: 'Class C+', spec: OLT_CLASS_SPECS['C+'] },
  ];

  return (
    <section className="landing-specs-section" id="reference" aria-labelledby="landing-specs-title">
      <div className="landing-specs-intro">
        <p className="landing-section-eyebrow">REFERENCE PLATE / GPON</p>
        <h2 id="landing-specs-title">Power classes & receive limits.</h2>
        <p>Reference thresholds displayed in the FiberLAB learning model.</p>
      </div>

      <div className="landing-specs-content">
        <div className="landing-spec-table-wrap">
          <table className="landing-spec-table">
            <caption className="sr-only">GPON OLT optical class references</caption>
            <thead>
              <tr>
                <th scope="col">OLT class</th>
                <th scope="col">
                  Launch range · P<sub>tx</sub>
                </th>
                <th scope="col" className="is-num">
                  OLT Rx sensitivity
                </th>
                <th scope="col" className="is-num">
                  Nominal budget
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map(({ label, spec }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>
                    {dbm(spec.minTxDbm)} to {dbm(spec.maxTxDbm)}
                  </td>
                  <td className="is-num">{dbm(spec.rxSensitivityDbm)}</td>
                  <td className="is-num">{spec.linkBudgetDb.toFixed(1)} dB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="landing-receiver-limits" role="group" aria-label="ONT receive thresholds">
          <div className="landing-limit-card landing-limit-card--overload">
            <span className="landing-limit-symbol">&gt;</span>
            <span>
              <small>OVERLOAD</small>
              <strong>{dbm(ONT_THRESHOLDS.overloadDbm)}</strong>
            </span>
            <span className="landing-limit-caption">saturation threshold</span>
          </div>
          <div className="landing-limit-card landing-limit-card--los">
            <span className="landing-limit-symbol">&lt;</span>
            <span>
              <small>LOS FLOOR</small>
              <strong>{dbm(ONT_THRESHOLDS.losFloorDbm)}</strong>
            </span>
            <span className="landing-limit-caption">below modeled sensitivity</span>
          </div>
        </div>

        <p className="landing-specs-caveat">
          Class values and common GPON wavelength references are informational. Exact guaranteed ranges depend on the
          installed transceiver and ONT; verify their current datasheets before live-network design.
        </p>
      </div>
    </section>
  );
}

export default SpecsStrip;
