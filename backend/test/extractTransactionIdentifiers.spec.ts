import { extractTransactionIdentifiers } from '../src/modules/repository/utils/extractTransactionIdentifiers';

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
});
