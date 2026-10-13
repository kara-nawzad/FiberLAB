import { describe, expect, it } from 'vitest';
import {
  HARDWARE_CATALOGUE,
  getHardwareProfileForNode,
} from '../componentCatalogue';

describe('static hardware catalogue', () => {
  it('contains the representative OLT, passive, fiber, closure, ONT, and gateway profiles', () => {
    expect(Object.keys(HARDWARE_CATALOGUE)).toEqual(
      expect.arrayContaining([
        'olt-standard',
        'splitter-plc',
        'fiber-feeder',
        'fiber-distribution',
        'fiber-drop',
        'closure-dome',
        'ont-indoor',
        'odf-rack',
        'nap-fat-1x8',
        'wifi6-gateway',
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
    expect(getHardwareProfileForNode('closure').id).toBe('closure-dome');
    expect(getHardwareProfileForNode('ont').id).toBe('ont-indoor');
  });

  it('resolves the ODF, 1:8 NAP/FAT, and Wi-Fi 6 gateway reference profiles', () => {
    expect(getHardwareProfileForNode('odf').id).toBe('odf-rack');
    expect(getHardwareProfileForNode('nap').id).toBe('nap-fat-1x8');
    expect(getHardwareProfileForNode('gateway').id).toBe('wifi6-gateway');
    expect(HARDWARE_CATALOGUE['nap-fat-1x8'].physicalPorts.join(' ')).toMatch(/eight subscriber\/drop outputs/i);
    expect(HARDWARE_CATALOGUE['wifi6-gateway'].physicalPorts.join(' ')).toMatch(/Wi-Fi 6/i);
    expect(HARDWARE_CATALOGUE['wifi6-gateway'].physicalPorts.join(' ')).toMatch(/FXS RJ-11/i);
  });

  it('selects the correct fiber profile for each cable subtype', () => {
    expect(getHardwareProfileForNode('fiber', 'feeder').id).toBe('fiber-feeder');
    expect(getHardwareProfileForNode('fiber', 'distribution').id).toBe('fiber-distribution');
    expect(getHardwareProfileForNode('fiber', 'drop').id).toBe('fiber-drop');
    expect(getHardwareProfileForNode('fiber').id).toBe('fiber-distribution');
  });

  it('describes the dome closure as an illustrative 48-splice, IP68 reference', () => {
    const closure = HARDWARE_CATALOGUE['closure-dome'];
    expect(closure.kind).toBe('closure');
    expect(closure.modelName).toContain('FOSC-style reference');
    expect(closure.physicalPorts.join(' ')).toMatch(/48 single fusion splices/);
    expect(closure.physicalPorts.join(' ')).toContain('IP68');
    expect(decodeURIComponent(closure.heroSvg.split(',')[1] ?? '')).toContain('BASE CLAMP');
  });

  it('rejects unsupported component kinds instead of showing unrelated hardware', () => {
    expect(() => getHardwareProfileForNode('amplifier')).toThrow(RangeError);
  });
});
