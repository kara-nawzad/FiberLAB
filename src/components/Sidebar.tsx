import { useState, type DragEvent } from 'react';
import {
  Cable,
  PackageOpen,
  PanelsTopLeft,
  Radio,
  Router,
  Split,
  Network,
  Wifi,
} from 'lucide-react';
import type { CableType, SplitRatio } from '../types';
import { ATTENUATION_DB_PER_KM, CABLE_SPECS, SPLIT_RATIOS, SPLITTER_LOSS_DB } from '../types';
import { getHardwareProfileForNode } from '../data/componentCatalogue';

/* ========================================================================== *
 * Component toolbox — HTML5 drag source for every PON element.
 * ========================================================================== */

export const DND_MIME = 'application/x-ftth-component';

export interface ToolboxPayload {
  component: 'olt' | 'splitter' | 'fiber' | 'closure' | 'ont' | 'odf' | 'nap' | 'gateway';
  ratio?: SplitRatio;
  cableType?: CableType;
}

interface SidebarProps {
  onQuickAdd: (payload: ToolboxPayload) => void;
}

function startDrag(event: DragEvent<HTMLButtonElement>, payload: ToolboxPayload) {
  event.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  // Firefox also needs a plain-text flavour to start the drag.
  event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

interface ToolItemProps {
  icon: React.ReactNode;
  accent: string;
  title: string;
  subtitle: string;
  thumbnail?: { src: string; alt: string };
  payload: ToolboxPayload;
  onQuickAdd: (payload: ToolboxPayload) => void;
}

function ToolItem({ icon, accent, title, subtitle, thumbnail, payload, onQuickAdd }: ToolItemProps) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => startDrag(event, payload)}
      onDoubleClick={() => onQuickAdd(payload)}
      title={`${title} — drag onto the canvas, or double-click to place`}
      className="tool-card group w-full"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white"
        style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
      >
        {thumbnail ? (
          <img src={thumbnail.src} alt={thumbnail.alt} draggable={false} className="h-full w-full object-contain" />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-noc-200">{title}</span>
        <span className="block truncate text-[10px] text-noc-400">{subtitle}</span>
      </span>
      <span className="text-noc-500 opacity-0 transition-opacity group-hover:opacity-100">⠿</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-1.5 mt-3 first:mt-0">{children}</div>;
}

export function Sidebar({ onQuickAdd }: SidebarProps) {
  const [ratioDraft, setRatioDraft] = useState<SplitRatio>(8);
  const [cableDraft, setCableDraft] = useState<CableType>('distribution');
  const oltHardware = getHardwareProfileForNode('olt');
  const splitterHardware = getHardwareProfileForNode('splitter');
  const fiberHardware = getHardwareProfileForNode('fiber', cableDraft);
  const closureHardware = getHardwareProfileForNode('closure');
  const odfHardware = getHardwareProfileForNode('odf');
  const napHardware = getHardwareProfileForNode('nap');
  const ontHardware = getHardwareProfileForNode('ont');
  const gatewayHardware = getHardwareProfileForNode('gateway');

  return (
    <aside className="fiberlab-sidebar flex h-full w-[248px] shrink-0 flex-col border-r border-noc-700/70 bg-noc-900/70">
      <div className="fiberlab-sidebar-header panel-header">
        <div>
          <div className="text-[13px] font-semibold text-noc-200">Component Toolbox</div>
          <div className="text-[10px] text-noc-400">Drag onto the canvas</div>
        </div>
        <span className="rounded border border-noc-600 px-1.5 py-0.5 font-mono text-[9px] text-noc-400">
          8 TYPES
        </span>
      </div>

      <div className="fiberlab-sidebar-content flex-1 overflow-y-auto px-3 py-3">
        <SectionLabel>Headend</SectionLabel>
        <ToolItem
          icon={<Radio size={16} />}
          accent="#2563eb"
          title="OLT Transceiver"
          subtitle="Class B+ / C+ · +3.0 dBm default"
          thumbnail={{ src: oltHardware.thumbnailSvg, alt: `${oltHardware.modelName} illustration` }}
          payload={{ component: 'olt' }}
          onQuickAdd={onQuickAdd}
        />
        <ToolItem
          icon={<PanelsTopLeft size={16} />}
          accent="#0f766e"
          title="ODF Rack Panel"
          subtitle="2 matched through-pairs · 0.5 dB reference"
          thumbnail={{ src: odfHardware.thumbnailSvg, alt: `${odfHardware.modelName} illustration` }}
          payload={{ component: 'odf' }}
          onQuickAdd={onQuickAdd}
        />

        <SectionLabel>Passive Splitting</SectionLabel>
        <div className="fiberlab-sidebar-settings mb-2 flex items-center gap-1.5">
          <label htmlFor="toolbox-ratio" className="text-[10px] text-noc-400">
            Ratio
          </label>
          <select
            id="toolbox-ratio"
            className="select flex-1 !py-1 !text-[11px]"
            value={ratioDraft}
            onChange={(event) => setRatioDraft(Number(event.target.value) as SplitRatio)}
          >
            {SPLIT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                1:{ratio} — {SPLITTER_LOSS_DB[ratio].toFixed(1)} dB
              </option>
            ))}
          </select>
        </div>
        <ToolItem
          icon={<Split size={16} />}
          accent="#7c3aed"
          title={`PLC Splitter 1:${ratioDraft}`}
          subtitle={`${SPLITTER_LOSS_DB[ratioDraft].toFixed(1)} dB insertion loss`}
          thumbnail={{ src: splitterHardware.thumbnailSvg, alt: `${splitterHardware.modelName} illustration` }}
          payload={{ component: 'splitter', ratio: ratioDraft }}
          onQuickAdd={onQuickAdd}
        />
        <div className="fiberlab-sidebar-shortcuts mt-1.5 grid grid-cols-3 gap-1">
          {([2, 4, 8, 16, 32, 64] as SplitRatio[]).map((ratio) => (
            <button
              key={ratio}
              type="button"
              draggable
              onDragStart={(event) => startDrag(event, { component: 'splitter', ratio })}
              onClick={() => onQuickAdd({ component: 'splitter', ratio })}
              className={`rounded border py-1 font-mono text-[10px] transition-colors ${
                ratioDraft === ratio
                  ? 'border-purple-400/70 bg-purple-500/20 text-purple-200'
                  : 'border-noc-700/70 bg-noc-850/70 text-noc-300 hover:border-purple-400/40'
              }`}
            >
              1:{ratio}
            </button>
          ))}
        </div>

        <SectionLabel>Fiber Plant</SectionLabel>
        <div className="fiberlab-sidebar-settings mb-2 flex items-center gap-1.5">
          <label htmlFor="toolbox-cable" className="text-[10px] text-noc-400">
            Type
          </label>
          <select
            id="toolbox-cable"
            className="select flex-1 !py-1 !text-[11px]"
            value={cableDraft}
            onChange={(event) => setCableDraft(event.target.value as CableType)}
          >
            {(Object.keys(CABLE_SPECS) as CableType[]).map((cable) => (
              <option key={cable} value={cable}>
                {CABLE_SPECS[cable].label} ({CABLE_SPECS[cable].defaultLengthKm} km)
              </option>
            ))}
          </select>
        </div>
        <ToolItem
          icon={<Cable size={16} />}
          accent={CABLE_SPECS[cableDraft].accent}
          title={`${CABLE_SPECS[cableDraft].label} span`}
          subtitle={`${CABLE_SPECS[cableDraft].defaultLengthKm} km · ${CABLE_SPECS[cableDraft].defaultSplices} splice · ${CABLE_SPECS[cableDraft].defaultConnectors} conn`}
          thumbnail={{ src: fiberHardware.thumbnailSvg, alt: `${fiberHardware.modelName} illustration` }}
          payload={{ component: 'fiber', cableType: cableDraft }}
          onQuickAdd={onQuickAdd}
        />
        <div className="fiberlab-sidebar-shortcuts mt-1.5 grid grid-cols-3 gap-1">
          {(Object.keys(CABLE_SPECS) as CableType[]).map((cable) => (
            <button
              key={cable}
              type="button"
              draggable
              onDragStart={(event) => startDrag(event, { component: 'fiber', cableType: cable })}
              onClick={() => onQuickAdd({ component: 'fiber', cableType: cable })}
              className="rounded border border-noc-700/70 bg-noc-850/70 py-1 font-mono text-[10px] font-semibold text-amber-800 transition-colors hover:border-amber-500/60"
              style={{ boxShadow: `inset 0 2px 0 ${CABLE_SPECS[cable].accent}` }}
            >
              {CABLE_SPECS[cable].short}
            </button>
          ))}
        </div>

        <SectionLabel>Outside Plant</SectionLabel>
        <ToolItem
          icon={<PackageOpen size={16} />}
          accent="#2b3033"
          title="Dome Splice Closure"
          subtitle="OSP joint box · 48-splice reference"
          thumbnail={{ src: closureHardware.thumbnailSvg, alt: `${closureHardware.modelName} illustration` }}
          payload={{ component: 'closure' }}
          onQuickAdd={onQuickAdd}
        />
        <ToolItem
          icon={<Network size={16} />}
          accent="#c2410c"
          title="Outdoor NAP / FAT"
          subtitle="1 input · 8 drops · 10.5 dB reference 1:8"
          thumbnail={{ src: napHardware.thumbnailSvg, alt: `${napHardware.modelName} illustration` }}
          payload={{ component: 'nap' }}
          onQuickAdd={onQuickAdd}
        />

        <SectionLabel>Premises</SectionLabel>
        <ToolItem
          icon={<Router size={16} />}
          accent="#16a34a"
          title="ONT / ONU"
          subtitle="Subscriber endpoint · −28 dBm sensitivity"
          thumbnail={{ src: ontHardware.thumbnailSvg, alt: `${ontHardware.modelName} illustration` }}
          payload={{ component: 'ont' }}
          onQuickAdd={onQuickAdd}
        />
        <ToolItem
          icon={<Wifi size={16} />}
          accent="#2563eb"
          title="Wi-Fi 6 PON Gateway"
          subtitle="GPON / XGS-PON · SSID and service telemetry"
          thumbnail={{ src: gatewayHardware.thumbnailSvg, alt: `${gatewayHardware.modelName} illustration` }}
          payload={{ component: 'gateway' }}
          onQuickAdd={onQuickAdd}
        />

        <SectionLabel>Reference</SectionLabel>
        <div className="fiberlab-sidebar-reference rounded-lg border border-noc-700/60 bg-noc-950/50 p-2">
          <table className="w-full font-mono text-[10px] text-noc-300">
            <tbody>
              <tr className="text-noc-500">
                <td className="py-0.5">λ</td>
                <td className="py-0.5 text-right">dB/km</td>
              </tr>
              <tr>
                <td className="py-0.5">1270 nm</td>
                <td className="py-0.5 text-right text-sky-300">{ATTENUATION_DB_PER_KM[1270].toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-0.5">1310 nm</td>
                <td className="py-0.5 text-right text-sky-300">
                  {ATTENUATION_DB_PER_KM[1310].toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5">1490 nm</td>
                <td className="py-0.5 text-right text-emerald-300">
                  {ATTENUATION_DB_PER_KM[1490].toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5">1550 nm</td>
                <td className="py-0.5 text-right text-violet-300">{ATTENUATION_DB_PER_KM[1550].toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-0.5">1577 nm</td>
                <td className="py-0.5 text-right text-emerald-300">{ATTENUATION_DB_PER_KM[1577].toFixed(2)}</td>
              </tr>
              <tr className="border-t border-noc-700/60 text-noc-500">
                <td className="py-0.5">fusion splice</td>
                <td className="py-0.5 text-right">0.10 dB</td>
              </tr>
              <tr className="text-noc-500">
                <td className="py-0.5">SC/APC</td>
                <td className="py-0.5 text-right">0.50 dB</td>
              </tr>
            </tbody>
          </table>
        </div>

        <section aria-label="Optical interface colour key" className="fiberlab-sidebar-color-key mt-2 rounded-md border border-noc-700/60 bg-white px-2 py-2">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-noc-400">Field colour cues</div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 text-[9px] text-noc-300">
            <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2 w-2 rounded-sm bg-[#FACC15]" />Cable</span>
            <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2 w-2 rounded-sm bg-[#16A34A]" />SC/APC</span>
            <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2 w-2 rounded-sm bg-[#2563EB]" />SC/UPC</span>
          </div>
        </section>

        <p className="mt-3 text-[10px] leading-relaxed text-noc-500">
          Drag a handle from one element to another to patch them. Every drop cable, splice and
          connector you add is counted in the live link budget.
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
