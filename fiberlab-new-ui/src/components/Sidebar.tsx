import { useState, type DragEvent, type ReactNode } from 'react';
import { Activity, ChevronDown, Gauge, LayoutDashboard, PlayCircle, Search, Settings2, FileText } from 'lucide-react';
import type { CableType, SplitRatio } from '../types';
import { CABLE_SPECS, SPLIT_RATIOS, SPLITTER_LOSS_DB } from '../types';
import { getHardwareProfileForNode } from '../data/componentCatalogue';
import { artDataUri, FIBER_ART, OLT_ART, ONU_ART, SPLITTER_ART } from './hardware/hardwareArt';

/* ========================================================================== *
 * Left side: icon rail (Design / Simulation / Reports / Settings) +
 * searchable, collapsible Components library. Same drag/drop contract as before.
 * ========================================================================== */

export const DND_MIME = 'application/x-ftth-component';

export interface ToolboxPayload {
  component: 'olt' | 'splitter' | 'fiber' | 'closure' | 'ont' | 'odf' | 'nap' | 'gateway';
  ratio?: SplitRatio;
  cableType?: CableType;
}

interface SidebarProps {
  onQuickAdd: (payload: ToolboxPayload) => void;
  onToggleOpm?: () => void;
  onOpenOtdr?: () => void;
  onRunSimulation?: () => void;
  onOpenReports?: () => void;
  onOpenSettings?: () => void;
  onOpenOverview?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function startDrag(event: DragEvent<HTMLButtonElement>, payload: ToolboxPayload) {
  event.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

function ToolItem({
  icon,
  title,
  subtitle,
  thumbnail,
  payload,
  onQuickAdd,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  subtitle: string;
  thumbnail?: { src: string; alt: string };
  payload?: ToolboxPayload;
  onQuickAdd?: (payload: ToolboxPayload) => void;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="pu-tool"
      draggable={Boolean(payload)}
      onDragStart={payload ? (event) => startDrag(event, payload) : undefined}
      onDoubleClick={payload && onQuickAdd ? () => onQuickAdd(payload) : undefined}
      onClick={onClick}
      title={payload ? `${title} — drag onto the canvas, or double-click to place` : title}
    >
      <span className="th">{thumbnail ? <img src={thumbnail.src} alt={thumbnail.alt} draggable={false} /> : icon}</span>
      <span style={{ minWidth: 0 }}>
        <b>{title}</b>
        <small>{subtitle}</small>
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="pu-sec">
      <summary>
        {title}
        <ChevronDown size={14} className="pu-mut" />
      </summary>
      {children}
    </details>
  );
}

export function Sidebar({
  onQuickAdd,
  onToggleOpm,
  onOpenOtdr,
  onRunSimulation,
  onOpenReports,
  onOpenSettings,
  onOpenOverview,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [ratioDraft, setRatioDraft] = useState<SplitRatio>(8);
  const [cableDraft, setCableDraft] = useState<CableType>('distribution');
  const [searchQuery, setSearchQuery] = useState('');

  const closure = getHardwareProfileForNode('closure');
  const odf = getHardwareProfileForNode('odf');
  const nap = getHardwareProfileForNode('nap');
  const gateway = getHardwareProfileForNode('gateway');

  const query = searchQuery.trim().toLowerCase();
  const matches = (keywords: string) => !query || keywords.toLowerCase().includes(query);
  const art = (svg: string, alt: string) => ({ src: artDataUri(svg), alt });
  const thumb = (profile: { thumbnailSvg: string; modelName: string }) => ({
    src: profile.thumbnailSvg,
    alt: `${profile.modelName} illustration`,
  });

  return (
    <>
      <nav className="pu-rail" aria-label="Workbench sections">
        <button type="button" className={collapsed ? '' : 'is-active'} onClick={onToggleCollapse} aria-label="Design" title="Show or hide the component library">
          <LayoutDashboard size={20} /> Design
        </button>
        <button type="button" onClick={onRunSimulation} aria-label="Simulation" title="Run the optical simulation">
          <PlayCircle size={20} /> Simulation
        </button>
        <button type="button" onClick={onOpenReports} aria-label="Reports" title="Bill of materials & optical budget audit">
          <FileText size={20} /> Reports
        </button>
        <button type="button" onClick={onOpenSettings} aria-label="Settings" title="Safety margin, OPM, OTDR and more">
          <Settings2 size={20} /> Settings
        </button>
      </nav>

      <aside className="fiberlab-sidebar pu-comp" style={collapsed ? { display: 'none' } : undefined} aria-label="Component library">
        <h3>Components</h3>
        <label className="pu-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search components…"
            aria-label="Search components"
          />
        </label>

        <div className="pu-comp-scroll">
          <Section title="OLT / Headend">
            {matches('olt transceiver headend gpon xgs-pon chassis') ? (
              <ToolItem title="OLT" subtitle="Class B+" thumbnail={art(OLT_ART, 'OLT illustration')} payload={{ component: 'olt' }} onQuickAdd={onQuickAdd} />
            ) : null}
            {matches('odf rack panel patch frame adapter') ? (
              <ToolItem title="ODF Rack Panel" subtitle="1U SC/APC patch field" thumbnail={thumb(odf)} payload={{ component: 'odf' }} onQuickAdd={onQuickAdd} />
            ) : null}
          </Section>

          <Section title="Passive Splitting">
            <select className="pu-sel" aria-label="Splitter ratio" value={ratioDraft} onChange={(event) => setRatioDraft(Number(event.target.value) as SplitRatio)}>
              {SPLIT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>1:{ratio} — {SPLITTER_LOSS_DB[ratio].toFixed(1)} dB</option>
              ))}
            </select>
            {matches(`plc splitter passive cassette 1:${ratioDraft}`) ? (
              <ToolItem
                title={`Splitter 1:${ratioDraft}`}
                subtitle={`${SPLITTER_LOSS_DB[ratioDraft].toFixed(1)} dB insertion loss`}
                thumbnail={art(SPLITTER_ART[ratioDraft] ?? SPLITTER_ART[8], 'Splitter illustration')}
                payload={{ component: 'splitter', ratio: ratioDraft }}
                onQuickAdd={onQuickAdd}
              />
            ) : null}
            <div className="pu-chips">
              {SPLIT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  draggable
                  className={ratioDraft === ratio ? 'is-active' : ''}
                  onDragStart={(event) => startDrag(event, { component: 'splitter', ratio })}
                  onClick={() => {
                    setRatioDraft(ratio);
                    onQuickAdd({ component: 'splitter', ratio });
                  }}
                >
                  1:{ratio}
                </button>
              ))}
            </div>
            {matches('dome splice closure osp joint fosc') ? (
              <ToolItem title="Dome Splice Closure" subtitle="OSP IP68 · 48-splice tray" thumbnail={thumb(closure)} payload={{ component: 'closure' }} onQuickAdd={onQuickAdd} />
            ) : null}
            {matches('outdoor nap fat access box 1:8 drop') ? (
              <ToolItem title="Outdoor NAP / FAT" subtitle="1:8 pole / wall box" thumbnail={thumb(nap)} payload={{ component: 'nap' }} onQuickAdd={onQuickAdd} />
            ) : null}
          </Section>

          <Section title="Access">
            {matches('ont onu subscriber terminal endpoint') ? (
              <ToolItem title="ONU / ONT" subtitle="GPON / XGS-PON" thumbnail={art(ONU_ART, 'ONU illustration')} payload={{ component: 'ont' }} onQuickAdd={onQuickAdd} />
            ) : null}
            {matches('wi-fi 6 pon gateway router xgs-pon') ? (
              <ToolItem title="Wi-Fi 6 Gateway" subtitle="Dual-band optical router" thumbnail={thumb(gateway)} payload={{ component: 'gateway' }} onQuickAdd={onQuickAdd} />
            ) : null}
          </Section>

          <Section title="Fiber Plant">
            <select className="pu-sel" aria-label="Cable type" value={cableDraft} onChange={(event) => setCableDraft(event.target.value as CableType)}>
              {(Object.keys(CABLE_SPECS) as CableType[]).map((cable) => (
                <option key={cable} value={cable}>{CABLE_SPECS[cable].label} ({CABLE_SPECS[cable].defaultLengthKm} km)</option>
              ))}
            </select>
            {matches(`fiber cable span ${CABLE_SPECS[cableDraft].label}`) ? (
              <ToolItem
                title="Fiber Cable"
                subtitle={`${CABLE_SPECS[cableDraft].label} · single mode (G.657.A1)`}
                thumbnail={art(FIBER_ART, 'Fiber cable illustration')}
                payload={{ component: 'fiber', cableType: cableDraft }}
                onQuickAdd={onQuickAdd}
              />
            ) : null}
          </Section>

          <Section title="Tools">
            {onToggleOpm ? <ToolItem icon={<Gauge size={22} />} title="Power Meter" subtitle="Probe a port or patch cord" onClick={onToggleOpm} /> : null}
            {onOpenOtdr ? <ToolItem icon={<Activity size={22} />} title="OTDR Trace" subtitle="Find events and breaks" onClick={onOpenOtdr} /> : null}
          </Section>
        </div>

        <div className="pu-foot">
          Need help?{' '}
          <button type="button" onClick={onOpenOverview} style={{ color: 'var(--pu-pri)', fontWeight: 600 }}>Learn</button> · Docs · GitHub
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
