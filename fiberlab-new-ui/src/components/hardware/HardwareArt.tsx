import { OLT_ART, ONU_ART, FIBER_ART, CONNECTOR_ART, SPLICE_ART, SPLITTER_ART } from './hardwareArt';

export type HardwareArtKind = 'olt' | 'onu' | 'fiber' | 'connector' | 'splice' | 'splitter';

const SOURCES: Record<Exclude<HardwareArtKind, 'splitter'>, string> = {
  olt: OLT_ART,
  onu: ONU_ART,
  fiber: FIBER_ART,
  connector: CONNECTOR_ART,
  splice: SPLICE_ART,
};

/** Renders a realistic vector hardware illustration scaled to `width` px. */
export function HardwareArt({ kind, width, ratio = 8 }: { kind: HardwareArtKind; width: number; ratio?: number }) {
  const svg = kind === 'splitter' ? SPLITTER_ART[ratio] ?? SPLITTER_ART[8] : SOURCES[kind];
  return <span className="hw-art" aria-hidden="true" style={{ display: 'block', width }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default HardwareArt;
