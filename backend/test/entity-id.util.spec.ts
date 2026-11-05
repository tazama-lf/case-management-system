import { ENTITY_ID_SUFFIX, toAccountHolderSource } from '../src/modules/gold-lakehouse/utils/entity-id.util';

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
