import { useCallback, useMemo, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { Activity, ChevronRight, Clock, Gauge, PanelLeftClose, Search } from 'lucide-react';
import type { CableType, SplitRatio } from '../types';
import { CABLE_SPECS, SPLIT_RATIOS, SPLITTER_LOSS_DB } from '../types';
import { getHardwareProfileForNode } from '../data/componentCatalogue';
import { artDataUri, FIBER_ART, OLT_ART, ONU_ART, SPLITTER_ART } from '../data/hardwareArtwork';

/* ========================================================================== *
 * Left side: icon rail (Design / Simulation / Reports / Settings) +
 * a categorised component library. One category is open at a time so the list
 * never becomes a wall of cards; search spans every category at once.
 * Drag/drop payloads are unchanged.
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  /** Variant shown on the card inside a selector-driven category. */
  variantLabel?: string;
  payload?: ToolboxPayload;
  onClick?: () => void;
  thumbnail?: { src: string; alt: string };
  icon?: ReactNode;
}

interface LibrarySection {
  id: string;
  label: string;
  items: LibraryItem[];
  /** Shown under the cards when a category needs a clarification. */
  note?: string;
}

type SectionId = LibrarySection['id'];

function startDrag(event: DragEvent<HTMLButtonElement>, payload: ToolboxPayload) {
  event.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

function ToolItem({
  item,
  onActivate,
  onDragStartItem,
}: {
  item: LibraryItem;
  onActivate: () => void;
  onDragStartItem: () => void;
}) {
  return (
    <button
      type="button"
      className="pu-tool"
      draggable={Boolean(item.payload)}
      onDragStart={
        item.payload
          ? (event) => {
              onDragStartItem();
              startDrag(event, item.payload as ToolboxPayload);
            }
          : undefined
      }
      onClick={onActivate}
      title={item.payload ? `${item.title} — click to place, or drag onto the canvas` : item.title}
    >
      <span className="th">
        {item.thumbnail ? (
          <img src={item.thumbnail.src} alt={item.thumbnail.alt} draggable={false} />
        ) : (
          (item.icon ?? null)
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <b>{item.title}</b>
        <small>{item.subtitle}</small>
      </span>
    </button>
  );
}

export function Sidebar({ onQuickAdd, onToggleOpm, onOpenOtdr, collapsed = false, onToggleCollapse }: SidebarProps) {
  const [ratioDraft, setRatioDraft] = useState<SplitRatio>(8);
  const [cableDraft, setCableDraft] = useState<CableType>('distribution');
  const [searchQuery, setSearchQuery] = useState('');
  const [openSection, setOpenSection] = useState<SectionId | null>('headend');
  const [recent, setRecent] = useState<string[]>([]);
  const [sheetFull, setSheetFull] = useState(false);
  const [sheetDrag, setSheetDrag] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);

  const art = (svg: string, alt: string) => ({ src: artDataUri(svg), alt });
  const thumb = (profile: { thumbnailSvg: string; modelName: string }) => ({
    src: profile.thumbnailSvg,
    alt: `${profile.modelName} illustration`,
  });

  const sections: LibrarySection[] = useMemo(() => {
    const closure = getHardwareProfileForNode('closure');
    const odf = getHardwareProfileForNode('odf');
    const nap = getHardwareProfileForNode('nap');
    const gateway = getHardwareProfileForNode('gateway');

    return [
      {
        id: 'headend',
        label: 'OLT / Headend',
        items: [
          {
            id: 'olt',
            title: 'OLT',
            subtitle: 'Class B+',
            keywords: 'olt transceiver headend gpon xgs-pon chassis laser',
            thumbnail: art(OLT_ART, 'OLT illustration'),
            payload: { component: 'olt' },
          },
          {
            id: 'odf',
            title: 'ODF Rack Panel',
            subtitle: '1U SC/APC patch field',
            keywords: 'odf rack panel patch frame adapter headend',
            thumbnail: thumb(odf),
            payload: { component: 'odf' },
          },
        ],
      },
      {
        id: 'fiber',
        label: 'Fiber Cables',
        items: (Object.keys(CABLE_SPECS) as CableType[]).map((cable) => ({
          id: `fiber-${cable}`,
          title: 'Fiber Cable',
          subtitle: `${CABLE_SPECS[cable].label} · single mode (G.657.A1)`,
          keywords: `fiber cable span ${CABLE_SPECS[cable].label} ${cable} single mode g657 aerial duct`,
          variantLabel: CABLE_SPECS[cable].short,
          thumbnail: art(FIBER_ART, 'Fiber cable illustration'),
          payload: { component: 'fiber', cableType: cable },
        })),
      },
      {
        id: 'splitters',
        label: 'Splitters',
        items: SPLIT_RATIOS.map((ratio) => ({
          id: `splitter-${ratio}`,
          title: `Splitter 1:${ratio}`,
          subtitle: `${SPLITTER_LOSS_DB[ratio].toFixed(1)} dB insertion loss`,
          keywords: `plc splitter passive cassette 1:${ratio} ratio optical power divider`,
          variantLabel: `1:${ratio}`,
          thumbnail: art(SPLITTER_ART[ratio] ?? SPLITTER_ART[8], 'Splitter illustration'),
          payload: { component: 'splitter', ratio },
        })),
      },
      {
        id: 'closures',
        label: 'Splices & Closures',
        note: 'Fusion splice trays live inside the closure. Patch cords and connectors are drawn as links between ports on the canvas.',
        items: [
          {
            id: 'closure',
            title: 'Dome Splice Closure',
            subtitle: 'OSP IP68 · 48-splice tray',
            keywords: 'dome splice closure osp joint fosc tray splicing',
            thumbnail: thumb(closure),
            payload: { component: 'closure' },
          },
          {
            id: 'nap',
            title: 'Outdoor NAP / FAT',
            subtitle: '1:8 pole / wall box',
            keywords: 'outdoor nap fat access box 1:8 drop terminal distribution',
            thumbnail: thumb(nap),
            payload: { component: 'nap' },
          },
        ],
      },
      {
        id: 'customer',
        label: 'Customer / ONT',
        items: [
          {
            id: 'ont',
            title: 'ONU / ONT',
            subtitle: 'GPON / XGS-PON',
            keywords: 'ont onu subscriber terminal endpoint customer home',
            thumbnail: art(ONU_ART, 'ONU illustration'),
            payload: { component: 'ont' },
          },
          {
            id: 'gateway',
            title: 'Wi-Fi 6 Gateway',
            subtitle: 'Dual-band optical router',
            keywords: 'wi-fi 6 pon gateway router xgs-pon subscriber customer',
            thumbnail: thumb(gateway),
            payload: { component: 'gateway' },
          },
        ],
      },
      {
        id: 'tools',
        label: 'Tools',
        items: [
          onToggleOpm
            ? {
                id: 'opm',
                title: 'Power Meter',
                subtitle: 'Probe a port or patch cord',
                keywords: 'power meter opm optical probe measure dbm tool',
                icon: <Gauge size={20} />,
                onClick: onToggleOpm,
              }
            : null,
          onOpenOtdr
            ? {
                id: 'otdr',
                title: 'OTDR Trace',
                subtitle: 'Find events and breaks',
                keywords: 'otdr trace reflectometer events breaks testing tool',
                icon: <Activity size={20} />,
                onClick: onOpenOtdr,
              }
            : null,
        ].filter((item) => item !== null) as LibraryItem[],
      },
    ];
  }, [onToggleOpm, onOpenOtdr]);

  const allItems = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => ({ item, section }))),
    [sections],
  );
  const itemById = useMemo(() => new Map(allItems.map(({ item }) => [item.id, item])), [allItems]);

  const query = searchQuery.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return [];
    return allItems.filter(({ item, section }) =>
      `${item.title} ${item.subtitle} ${section.label} ${item.keywords}`.toLowerCase().includes(query),
    );
  }, [allItems, query]);

  const recentItems = useMemo(
    () => recent.map((id) => itemById.get(id)).filter((item): item is LibraryItem => Boolean(item)),
    [itemById, recent],
  );

  const remember = useCallback((id: string) => {
    setRecent((current) => [id, ...current.filter((entry) => entry !== id)].slice(0, 4));
  }, []);

  /* One activation path for click, tap and drag: add the element and remember
   * it. (App closes the phone sheet once the part has landed.) */
  const activate = useCallback(
    (item: LibraryItem) => {
      remember(item.id);
      if (item.onClick) {
        item.onClick();
      } else if (item.payload) {
        onQuickAdd(item.payload);
      }
    },
    [onQuickAdd, remember],
  );

  const toggleSection = (id: SectionId) => setOpenSection((current) => (current === id ? null : id));

  /* Phone sheet: drag the handle up to expand, down to close. */
  const onHandlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = event.clientY;
    dragDeltaRef.current = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHandlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    const delta = event.clientY - dragStartRef.current;
    dragDeltaRef.current = delta;
    setSheetDrag(delta);
  };
  const onHandlePointerEnd = () => {
    const delta = dragDeltaRef.current;
    dragStartRef.current = null;
    dragDeltaRef.current = 0;
    setSheetDrag(0);
    if (delta <= -40) {
      setSheetFull(true);
      return;
    }
    if (delta >= 40) {
      if (sheetFull) setSheetFull(false);
      else onToggleCollapse?.();
    }
  };

  const renderCard = (item: LibraryItem) => (
    <ToolItem key={item.id} item={item} onActivate={() => activate(item)} onDragStartItem={() => remember(item.id)} />
  );

  return (
    <aside
      className={`fiberlab-sidebar pu-comp${sheetFull ? ' is-sheet-full' : ''}`}
      style={{
        display: collapsed ? 'none' : undefined,
        ...(sheetDrag ? { transform: `translateY(${Math.max(-24, sheetDrag)}px)` } : null),
      }}
      aria-label="Component library"
    >
      <div
        className="pu-sheet-handle"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerEnd}
        onPointerCancel={onHandlePointerEnd}
        aria-hidden="true"
      >
        <span className="pu-sheet-grip" />
      </div>

      <header className="pu-comp-head">
        <h3>Components</h3>
        <button
          type="button"
          className="pu-comp-collapse"
          onClick={onToggleCollapse}
          aria-label="Hide component library"
          title="Hide the component library"
        >
          <PanelLeftClose size={16} aria-hidden="true" />
        </button>
      </header>

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

      {recentItems.length > 0 && !query ? (
        <div className="pu-recent" role="group" aria-label="Recently used components">
          <span className="pu-recent-label">
            <Clock size={12} aria-hidden="true" /> Recent
          </span>
          <div className="pu-recent-row">
            {recentItems.map((item) => (
              <button
                key={`recent-${item.id}`}
                type="button"
                className="pu-recent-chip"
                onClick={() => activate(item)}
                aria-label={`Recently used: ${item.title}`}
                title={item.title}
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail.src} alt="" draggable={false} />
                ) : (
                  (item.icon ?? <Activity size={14} />)
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pu-comp-scroll">
        {query ? (
          <div className="pu-lib-results" role="group" aria-label="Search results">
            {results.length === 0 ? (
              <p className="pu-lib-empty">No components match “{searchQuery.trim()}”.</p>
            ) : (
              results.map(({ item, section }) => (
                <div key={`result-${item.id}`} className="pu-lib-result">
                  <span className="pu-lib-cat">{section.label}</span>
                  {renderCard(item)}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="pu-acc" role="group" aria-label="Component categories">
            {sections.map((section) => {
              const isOpen = openSection === section.id;
              const isVariantSection = section.id === 'splitters' || section.id === 'fiber';
              const activeVariant = section.id === 'splitters' ? `splitter-${ratioDraft}` : `fiber-${cableDraft}`;
              const activeItem = section.items.find((item) => item.id === activeVariant) ?? section.items[0] ?? null;

              return (
                <div key={section.id} className={`pu-acc-section${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="pu-acc-head"
                    aria-expanded={isOpen}
                    aria-controls={`lib-section-${section.id}`}
                    onClick={() => toggleSection(section.id)}
                  >
                    <ChevronRight size={14} className="pu-acc-chevron" aria-hidden="true" />
                    <span className="pu-acc-label">{section.label}</span>
                    <span className="pu-lib-count" aria-hidden="true">
                      {section.items.length}
                    </span>
                    <span className="sr-only">{section.items.length} components</span>
                  </button>

                  <div id={`lib-section-${section.id}`} className="pu-acc-body" hidden={!isOpen}>
                    {isOpen && isVariantSection ? (
                      <>
                        <div
                          className="pu-seg"
                          role="group"
                          aria-label={section.id === 'splitters' ? 'Splitter ratio' : 'Cable type'}
                        >
                          {section.items.map((item) => {
                            const selected = item.id === activeVariant;
                            return (
                              <button
                                key={`seg-${item.id}`}
                                type="button"
                                className={selected ? 'is-active' : ''}
                                aria-pressed={selected}
                                aria-label={
                                  section.id === 'splitters'
                                    ? `Splitter ratio ${item.variantLabel}`
                                    : `Cable type ${item.subtitle.split(' · ')[0]}`
                                }
                                title={item.subtitle}
                                onClick={() => {
                                  if (section.id === 'splitters')
                                    setRatioDraft(Number(item.payload?.ratio) as SplitRatio);
                                  else setCableDraft(item.payload?.cableType as CableType);
                                }}
                              >
                                {item.variantLabel}
                              </button>
                            );
                          })}
                        </div>
                        {activeItem ? renderCard(activeItem) : null}
                      </>
                    ) : null}
                    {isOpen && !isVariantSection ? section.items.map((item) => renderCard(item)) : null}
                    {isOpen && section.note ? <p className="pu-acc-note">{section.note}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
