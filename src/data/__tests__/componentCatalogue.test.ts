import { describe, expect, it } from 'vitest';
import {
  HARDWARE_CATALOGUE,
  getHardwareProfileForNode,
} from '../componentCatalogue';

describe('static hardware catalogue', () => {
  it('contains the six requested representative hardware profiles', () => {
    expect(Object.keys(HARDWARE_CATALOGUE)).toEqual(
      expect.arrayContaining([
        'olt-standard',
        'splitter-plc',
        'fiber-feeder',
        'fiber-distribution',
        'fiber-drop',
        'ont-indoor',
      ]),
    );
  });

  it('provides self-contained SVG data URIs and complete field information', () => {
    for (const profile of Object.values(HARDWARE_CATALOGUE)) {
      expect(profile.thumbnailSvg).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/);
      expect(profile.heroSvg).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/);
      expect(decodeURIComponent(profile.thumbnailSvg.split(',')[1] ?? '')).toContain('<svg');
      expect(decodeURIComponent(profile.heroSvg.split(',')[1] ?? '')).toContain('<svg');
      expect(profile.modelName.length).toBeGreaterThan(0);
      expect(profile.vendorCategory.length).toBeGreaterThan(0);
      expect(profile.description.length).toBeGreaterThan(0);
      expect(profile.physicalPorts.length).toBeGreaterThan(0);
      expect(profile.fieldNotes.length).toBeGreaterThan(0);
      expect(profile.datasheetSnippet.operatingTemp.length).toBeGreaterThan(0);
      expect(profile.datasheetSnippet.wavelengths.length).toBeGreaterThan(0);
      expect(profile.datasheetSnippet.standards.length).toBeGreaterThan(0);
    }
  });

  it('resolves the OLT, splitter, and indoor ONT profiles from node kinds', () => {
    expect(getHardwareProfileForNode('olt').id).toBe('olt-standard');
    expect(getHardwareProfileForNode('splitter', '32').id).toBe('splitter-plc');
    expect(getHardwareProfileForNode('ont').id).toBe('ont-indoor');
  });

  it('selects the correct fiber profile for each cable subtype', () => {
    expect(getHardwareProfileForNode('fiber', 'feeder').id).toBe('fiber-feeder');
    expect(getHardwareProfileForNode('fiber', 'distribution').id).toBe('fiber-distribution');
    expect(getHardwareProfileForNode('fiber', 'drop').id).toBe('fiber-drop');
    expect(getHardwareProfileForNode('fiber').id).toBe('fiber-distribution');
  });

  it('rejects unsupported component kinds instead of showing unrelated hardware', () => {
    expect(() => getHardwareProfileForNode('amplifier')).toThrow(RangeError);
  });
});
