import { Cable, Info, Lightbulb, ShieldCheck, Thermometer, Waves } from 'lucide-react';
import type { HardwareProfile } from '../data/componentCatalogue';

interface FieldHardwareCardProps {
  profile: HardwareProfile;
  configurationLabel?: string;
}

/**
 * A compact field-reference card for the selected canvas node. The catalogue's
 * SVGs are representative technical illustrations, not photos of a specific SKU.
 */
export function FieldHardwareCard({ profile, configurationLabel }: FieldHardwareCardProps) {
  const constructionLabel = profile.kind === 'fiber' ? 'Construction details' : 'Ports & interfaces';

  return (
    <section
      aria-label="Field hardware reference"
      className="mb-3 overflow-hidden rounded-lg border border-sky-500/25 bg-noc-950/65"
    >
      <div className="flex items-center justify-between border-b border-noc-700/60 bg-sky-500/[0.07] px-2 py-2">
        <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.12em] text-sky-200">
          <Info size={12} /> Field hardware
        </div>
        <span className="rounded border border-noc-600/80 bg-noc-900/70 px-2 py-1 font-mono text-caption uppercase tracking-wide text-noc-400">
          Reference illustration
        </span>
      </div>

      <figure className="border-b border-noc-700/60">
        <div className="bg-[#0b1220] p-2">
          <img
            src={profile.heroSvg}
            alt={`${profile.modelName}: representative hardware and port-layout illustration`}
            draggable={false}
            loading="lazy"
            decoding="async"
            className="block aspect-[16/9] w-full rounded-md object-contain"
          />
        </div>
        <figcaption className="px-2 pb-2 pt-2">
          <div className="text-label font-semibold leading-snug text-noc-100">{profile.modelName}</div>
          <div className="mt-1 text-caption uppercase tracking-[0.1em] text-noc-500">{profile.vendorCategory}</div>
          {configurationLabel ? (
            <div className="mt-1 truncate font-mono text-label text-sky-300" title={configurationLabel}>
              {configurationLabel}
            </div>
          ) : null}
          <div className="mt-1 text-body leading-relaxed text-noc-400">{profile.description}</div>
          <div className="mt-2 flex items-start gap-1 text-label leading-snug text-amber-900">
            <Info size={10} className="mt-px shrink-0" />
            <span>Illustrative hardware reference—not a product photograph or exact vendor model.</span>
          </div>
        </figcaption>
      </figure>

      <div className="space-y-2 p-2">
        <section aria-label={constructionLabel}>
          <h3 className="mb-2 flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.12em] text-noc-300">
            <Cable size={11} className="text-sky-300" /> {constructionLabel}
          </h3>
          <ul className="space-y-1">
            {profile.physicalPorts.map((port) => (
              <li key={port} className="flex gap-2 text-body leading-relaxed text-noc-400">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                <span>{port}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Field tips" className="border-t border-noc-700/50 pt-2">
          <h3 className="mb-2 flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.12em] text-noc-300">
            <Lightbulb size={11} className="text-amber-300" /> Field tips
          </h3>
          <ul className="space-y-2">
            {profile.fieldNotes.map((note, index) => (
              <li key={note} className="flex gap-2 text-body leading-relaxed text-noc-400">
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-mono text-caption text-amber-200">
                  {index + 1}
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>

        <details className="border-t border-noc-700/50 pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-caption font-semibold uppercase tracking-[0.12em] text-noc-300 marker:hidden">
            <ShieldCheck size={11} className="text-emerald-300" /> Datasheet context
          </summary>
          <dl className="mt-2 space-y-2">
            <div className="flex gap-2 text-body leading-relaxed">
              <dt className="flex w-[76px] shrink-0 items-start gap-1 text-noc-500">
                <Thermometer size={10} className="mt-1" /> Temperature
              </dt>
              <dd className="text-noc-400">{profile.datasheetSnippet.operatingTemp}</dd>
            </div>
            <div className="flex gap-2 text-body leading-relaxed">
              <dt className="flex w-[76px] shrink-0 items-start gap-1 text-noc-500">
                <Waves size={10} className="mt-1" /> Wavelengths
              </dt>
              <dd className="text-noc-400">{profile.datasheetSnippet.wavelengths}</dd>
            </div>
            <div className="flex gap-2 text-body leading-relaxed">
              <dt className="w-[76px] shrink-0 text-noc-500">Standards</dt>
              <dd>
                <ul className="space-y-1 text-noc-400">
                  {profile.datasheetSnippet.standards.map((standard) => (
                    <li key={standard}>{standard}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <p className="mt-2 border-t border-noc-700/40 pt-2 text-body leading-relaxed text-noc-500">
            Values are generic learning context. Verify operating limits, optical specifications, and compliance against
            the exact product datasheet before deployment.
          </p>
        </details>
      </div>
    </section>
  );
}

export default FieldHardwareCard;
