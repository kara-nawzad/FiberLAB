/* ========================================================================== *
 * Plain-language glossary.
 *
 * Every entry is one sentence a beginner can act on and an engineer cannot
 * call wrong. The HelpTip component and the Learn screen both read this list,
 * so a definition is never written twice.
 * ========================================================================== */

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'los',
    term: 'LOS',
    short: 'Loss of signal',
    definition:
      'Loss of signal: the receiver sees no usable light, so the subscriber is offline rather than merely weak.',
  },
  {
    id: 'margin-to-los',
    term: 'Margin to LOS',
    short: 'How much light you can lose before the link drops',
    definition:
      'The dB still left between the received power and the receiver’s sensitivity floor. Smaller numbers mean the link is closer to dropping out.',
  },
  {
    id: 'path-loss',
    term: 'Path loss',
    short: 'What the glass and hardware take away',
    definition:
      'Fiber attenuation plus splices, connectors and splitter insertion loss along one route — everything subtracted before the margin is added.',
  },
  {
    id: 'safety-margin',
    term: 'Safety margin',
    short: 'Headroom reserved on purpose',
    definition:
      'Spare dB set aside for ageing, dirty connectors and repair splices. It is added to the budget, never to a measured reading.',
  },
  {
    id: 'splice',
    term: 'Fusion splice',
    short: 'Two fibers joined end to end',
    definition:
      'A permanent joint between two fibers. The model charges 0.1 dB each, the usual planning figure rather than a measured value.',
  },
  {
    id: 'splitter-ratio',
    term: 'Splitter ratio',
    short: '1:8 means one input feeds eight outputs',
    definition:
      'The ratio divides the light: 1:8 keeps an eighth per port and costs about 10.5 dB of insertion loss in this model.',
  },
  {
    id: 'opm',
    term: 'OPM',
    short: 'Optical power meter',
    definition:
      'A meter that reads light on a port. Here it probes the simulated budget at 1310, 1490 or 1550 nm and stores a reference for relative readings.',
  },
  {
    id: 'otdr',
    term: 'OTDR',
    short: 'Sees where the fiber breaks',
    definition:
      'An optical time-domain reflectometer sends a pulse and draws the backscatter. Spikes and steps in that trace mark connectors, splices and breaks.',
  },
  {
    id: 'pon-class',
    term: 'PON class',
    short: 'How much light the OLT can launch',
    definition:
      'The laser budget class (B+, C+) of the OLT port: it sets the launch power the rest of the design is spent against.',
  },
  {
    id: 'receive-window',
    term: 'Receive window',
    short: 'Power the ONT can accept',
    definition:
      'The band between the receiver’s sensitivity floor (−28 dBm here) and its overload point (−8 dBm). Outside it, service degrades or drops.',
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((entry) => [entry.id, entry]),
);
