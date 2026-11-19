import { ENTITY_ID_SUFFIX, stripEntityIdSuffix, toAccountHolderSource } from '../src/modules/gold-lakehouse/utils/entity-id.util';

describe('toAccountHolderSource', () => {
  it('adds the suffix to a bare entity id', () => {
    expect(toAccountHolderSource('entity6-0ac2dd23')).toBe('entity6-0ac2dd23TAZAMA_EID');
  });

  it('leaves an id that already ends in the suffix alone, so the suffix is never doubled', () => {
    expect(toAccountHolderSource('entity6-0ac2dd23TAZAMA_EID')).toBe('entity6-0ac2dd23TAZAMA_EID');
    expect(toAccountHolderSource(toAccountHolderSource('abc'))).toBe(`abc${ENTITY_ID_SUFFIX}`);
  });

  it('only treats the suffix at the end as already present', () => {
    expect(toAccountHolderSource('TAZAMA_EIDabc')).toBe('TAZAMA_EIDabcTAZAMA_EID');
  });
});

describe('stripEntityIdSuffix', () => {
  it('removes the suffix from the end of an entity id', () => {
    expect(stripEntityIdSuffix('4c9a2adb2ed14ca28c493f38f9f5dd15TAZAMA_EID')).toBe('4c9a2adb2ed14ca28c493f38f9f5dd15');
  });

  it('leaves a bare id alone and only strips once', () => {
    expect(stripEntityIdSuffix('entity1')).toBe('entity1');
    expect(stripEntityIdSuffix('entity1TAZAMA_EIDTAZAMA_EID')).toBe('entity1TAZAMA_EID');
  });

  it('does not strip the suffix from the middle of an id', () => {
    expect(stripEntityIdSuffix('TAZAMA_EIDabc')).toBe('TAZAMA_EIDabc');
  });
});
