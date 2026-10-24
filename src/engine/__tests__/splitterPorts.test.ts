import { describe, expect, it } from 'vitest';
import { SPLIT_RATIOS, SPLITTER_OUTPUT_PORTS, splitterBranchPortCount, type SplitRatio } from '../../types';

/* The canvas must be able to patch every output the physics charges for — a
 * 1:8 cassette that only exposes four handles makes the model unusable. */

describe('splitter branch port model', () => {
  it('exposes one patchable branch per output up to 1:16', () => {
    for (const ratio of [2, 4, 8, 16] as const) {
      expect(splitterBranchPortCount(ratio)).toBe(ratio);
    }
  });

  it('caps 1:32 and 1:64 cassettes at sixteen branch ports', () => {
    expect(splitterBranchPortCount(32)).toBe(16);
    expect(splitterBranchPortCount(64)).toBe(16);
  });

  it('keeps the exported port table in sync with the helper', () => {
    for (const ratio of SPLIT_RATIOS as readonly SplitRatio[]) {
      expect(SPLITTER_OUTPUT_PORTS[ratio]).toBe(splitterBranchPortCount(ratio));
    }
  });
});
