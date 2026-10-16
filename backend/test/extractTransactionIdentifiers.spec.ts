import { extractTransactionIdentifiers } from '../src/modules/repository/utils/extractTransactionIdentifiers';
import type { JsonValue } from '../src/modules/repository/utils/types/JsonValue';

describe('extractTransactionIdentifiers', () => {
  it('extracts account ids from the DataCache enrichment object (actual production shape)', () => {
    const transaction = {
      TxTp: 'pacs.002.001.12',
      TenantId: 'DEFAULT',
      DataCache: {
        cdtrId: 'cdtr_7b2eaa3ffeca4976a928c8b37fb0ddfaTAZAMA_EID',
        dbtrId: 'dbtr_fe92163e15264808a5d61006eb7ee23fTAZAMA_EID',
        creDtTm: '2026-09-29T06:26:08.900Z',
        cdtrAcctId: 'cdtrAcct_4c4c4b1624774ccd940a5a4af898886cMSISDNfsp002',
        dbtrAcctId: 'dbtrAcct_fd4eaf0fd150458886b37182f0b4a2b0MSISDNfsp001',
      },
      FIToFIPmtSts: {
        GrpHdr: { MsgId: 'fb25ec33abbe45089f0928686a900843', CreDtTm: '2026-09-29T06:31:08.900Z' },
        TxInfAndSts: {
          TxSts: 'ACCC',
          InstdAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp002' } } },
          InstgAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp001' } } },
          OrgnlInstrId: '5ab4fc7355de4ef8a75b78b00a681ed2',
          OrgnlEndToEndId: '6d441508a422477cbe8139b873e2c232',
        },
      },
    };

    expect(extractTransactionIdentifiers(transaction)).toEqual({
      msgId: 'fb25ec33abbe45089f0928686a900843',
      orgnlEndToEndId: '6d441508a422477cbe8139b873e2c232',
      orgnlInstrId: '5ab4fc7355de4ef8a75b78b00a681ed2',
      dbtrAcctId: 'dbtrAcct_fd4eaf0fd150458886b37182f0b4a2b0MSISDNfsp001',
      cdtrAcctId: 'cdtrAcct_4c4c4b1624774ccd940a5a4af898886cMSISDNfsp002',
    });
  });

  it('extracts msgId/orgnlEndToEndId/orgnlInstrId even when DataCache is absent (falls back to plain EndToEndId/InstrId)', () => {
    const transaction = {
      TxTp: 'pacs.008.001.10',
      FIToFICstmrCdtTrf: {
        GrpHdr: { MsgId: 'MSG-002-01' },
        CdtTrfTxInf: {
          PmtId: { InstrId: 'INSTR-002-01', EndToEndId: 'TXN-002-01' },
        },
      },
    };

    expect(extractTransactionIdentifiers(transaction)).toEqual({
      msgId: 'MSG-002-01',
      orgnlEndToEndId: 'TXN-002-01',
      orgnlInstrId: 'INSTR-002-01',
      dbtrAcctId: null,
      cdtrAcctId: null,
    });
  });

  it('returns nulls for every field when the transaction carries none of the known fields (including no DataCache)', () => {
    const transaction = { TxTp: 'unknown.001', SomeField: { Nested: 'value' } };

    expect(extractTransactionIdentifiers(transaction)).toEqual({
      msgId: null,
      orgnlEndToEndId: null,
      orgnlInstrId: null,
      dbtrAcctId: null,
      cdtrAcctId: null,
    });
  });

  it('handles null/non-object input without throwing', () => {
    expect(extractTransactionIdentifiers(null)).toEqual({
      msgId: null,
      orgnlEndToEndId: null,
      orgnlInstrId: null,
      dbtrAcctId: null,
      cdtrAcctId: null,
    });
  });

  const empty = { msgId: null, orgnlEndToEndId: null, orgnlInstrId: null, dbtrAcctId: null, cdtrAcctId: null };

  it('extracts all fields from the full pacs.002 payload (ChrgsInf arrays, instdAmt, intrBkSttlmAmt present)', () => {
    const transaction = {
      TxTp: 'pacs.002.001.12',
      TenantId: 'DEFAULT',
      DataCache: {
        cdtrId: 'cdtr_b83c6e5525be40738d19ff09325b38fcTAZAMA_EID',
        dbtrId: 'dbtr_ed7570c281ed4b648055964105c9090aTAZAMA_EID',
        creDtTm: '2026-09-29T13:05:15.344Z',
        instdAmt: { amt: 847.56, ccy: 'XTS' },
        xchgRate: 1,
        cdtrAcctId: 'cdtrAcct_cd27591e04ba433486a212ea8c157fd3MSISDNfsp002',
        dbtrAcctId: 'dbtrAcct_b62123209d844785af6b2bbdd46d2f9fMSISDNfsp001',
        intrBkSttlmAmt: { amt: 847.56, ccy: 'XTS' },
      },
      FIToFIPmtSts: {
        GrpHdr: { MsgId: 'ee3fb15c73a74d7da77d37e9e6d7652a', CreDtTm: '2026-09-29T13:10:15.344Z' },
        TxInfAndSts: {
          TxSts: 'ACCC',
          ChrgsInf: [
            { Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp001' } } }, Amt: { Amt: 0, Ccy: 'USD' } },
            { Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp001' } } }, Amt: { Amt: 0, Ccy: 'USD' } },
            { Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp002' } } }, Amt: { Amt: 0, Ccy: 'USD' } },
          ],
          InstdAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp002' } } },
          InstgAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'fsp001' } } },
          AccptncDtTm: '2023-06-02T07:52:31.000Z',
          OrgnlInstrId: '5ab4fc7355de4ef8a75b78b00a681ed2',
          OrgnlEndToEndId: 'fbd9593f74ae4846809d3eb93bba143e',
        },
      },
    };

    expect(extractTransactionIdentifiers(transaction)).toEqual({
      msgId: 'ee3fb15c73a74d7da77d37e9e6d7652a',
      orgnlEndToEndId: 'fbd9593f74ae4846809d3eb93bba143e',
      orgnlInstrId: '5ab4fc7355de4ef8a75b78b00a681ed2',
      dbtrAcctId: 'dbtrAcct_b62123209d844785af6b2bbdd46d2f9fMSISDNfsp001',
      cdtrAcctId: 'cdtrAcct_cd27591e04ba433486a212ea8c157fd3MSISDNfsp002',
    });
  });

  it('finds keys on the root object itself (depth 0)', () => {
    expect(extractTransactionIdentifiers({ MsgId: 'root-msg', dbtrAcctId: 'root-dbtr' })).toEqual({
      ...empty,
      msgId: 'root-msg',
      dbtrAcctId: 'root-dbtr',
    });
  });

  it('finds keys inside objects nested within arrays', () => {
    const transaction: JsonValue = { list: [{ other: 1 }, { deeper: [{ MsgId: 'in-array' }] }] };
    expect(extractTransactionIdentifiers(transaction).msgId).toBe('in-array');
  });

  it('handles a top-level array and arrays containing primitives/null', () => {
    const transaction = [1, null, 'text', true, { cdtrAcctId: 'from-top-array' }];
    expect(extractTransactionIdentifiers(transaction as never)).toEqual({ ...empty, cdtrAcctId: 'from-top-array' });
  });

  it('returns nulls for an empty array and an array with no matching keys', () => {
    expect(extractTransactionIdentifiers([])).toEqual(empty);
    expect(extractTransactionIdentifiers([{ a: 1 }, [{ b: 2 }]])).toEqual(empty);
  });

  it('returns nulls for primitive input (string, number, boolean, undefined)', () => {
    expect(extractTransactionIdentifiers('MsgId')).toEqual(empty);
    expect(extractTransactionIdentifiers(42)).toEqual(empty);
    expect(extractTransactionIdentifiers(true)).toEqual(empty);
    expect(extractTransactionIdentifiers(undefined as never)).toEqual(empty);
  });

  it('skips empty-string values and keeps searching deeper', () => {
    const transaction = { MsgId: '', nested: { MsgId: 'real-msg' } };
    expect(extractTransactionIdentifiers(transaction).msgId).toBe('real-msg');
  });

  it('returns null when the only match is an empty string', () => {
    expect(extractTransactionIdentifiers({ MsgId: '' }).msgId).toBeNull();
  });

  it('ignores non-string values (number, boolean, null, object, array) for a matching key', () => {
    expect(extractTransactionIdentifiers({ MsgId: 123 }).msgId).toBeNull();
    expect(extractTransactionIdentifiers({ MsgId: true }).msgId).toBeNull();
    expect(extractTransactionIdentifiers({ MsgId: null }).msgId).toBeNull();
    expect(extractTransactionIdentifiers({ MsgId: ['a'] }).msgId).toBeNull();
    // non-string match value does not block a valid match deeper
    expect(extractTransactionIdentifiers({ MsgId: 123, nested: { MsgId: 'deep' } }).msgId).toBe('deep');
    // object value under the key is itself traversed
    expect(extractTransactionIdentifiers({ MsgId: { MsgId: 'inner' } }).msgId).toBe('inner');
  });

  it('prefers the earlier key in the keys list when both exist on the same object', () => {
    const transaction = { EndToEndId: 'plain-e2e', OrgnlEndToEndId: 'orgnl-e2e', InstrId: 'plain-instr', OrgnlInstrId: 'orgnl-instr' };
    const result = extractTransactionIdentifiers(transaction);
    expect(result.orgnlEndToEndId).toBe('orgnl-e2e');
    expect(result.orgnlInstrId).toBe('orgnl-instr');
  });

  it('falls back to the second key (EndToEndId / InstrId) when the first is absent on the same object', () => {
    const result = extractTransactionIdentifiers({ EndToEndId: 'plain-e2e', InstrId: 'plain-instr' });
    expect(result.orgnlEndToEndId).toBe('plain-e2e');
    expect(result.orgnlInstrId).toBe('plain-instr');
  });

  it('a shallower match wins over a deeper match, even when the deeper one uses the preferred key', () => {
    const transaction = { EndToEndId: 'shallow-plain', nested: { OrgnlEndToEndId: 'deep-orgnl' } };
    expect(extractTransactionIdentifiers(transaction).orgnlEndToEndId).toBe('shallow-plain');
  });

  it('returns the first match in document order when siblings both contain the key', () => {
    const transaction = { a: { MsgId: 'first' }, b: { MsgId: 'second' } };
    expect(extractTransactionIdentifiers(transaction).msgId).toBe('first');
  });

  it('is case-sensitive on key names', () => {
    expect(extractTransactionIdentifiers({ msgid: 'x', MSGID: 'y', msgId: 'z', DbtrAcctId: 'q' })).toEqual(empty);
  });

  describe('depth limit (maxDepth = 15)', () => {
    const wrap = (levels: number, leaf: Record<string, string>): Record<string, unknown> => {
      let node: Record<string, unknown> = leaf;
      for (let i = 0; i < levels; i++) node = { child: node };
      return node;
    };

    it('finds a key on an object at depth 14 (deepest searched level)', () => {
      expect(extractTransactionIdentifiers(wrap(14, { MsgId: 'depth-14' }) as never).msgId).toBe('depth-14');
    });

    it('does not find a key on an object at depth 15 (limit reached)', () => {
      expect(extractTransactionIdentifiers(wrap(15, { MsgId: 'depth-15' }) as never).msgId).toBeNull();
    });

    it('counts array nesting toward depth', () => {
      let node: unknown = { MsgId: 'in-arrays' };
      for (let i = 0; i < 15; i++) node = [node];
      expect(extractTransactionIdentifiers(node as never).msgId).toBeNull();

      let shallow: unknown = { MsgId: 'in-arrays' };
      for (let i = 0; i < 14; i++) shallow = [shallow];
      expect(extractTransactionIdentifiers(shallow as never).msgId).toBe('in-arrays');
    });
  });
});
