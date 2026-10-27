/* Shared test data for the copilot specs: a small money-mule case in CMS shape. */

export const SUBJECT = 'PK36DEMO1234567890123456';
export const T0 = new Date('2026-10-05T03:10:00Z');

export function pacs008(e2e: string, at: Date, amount: number, dbtr: [string, string, string], cdtr: [string, string, string], extra: { narrative?: string; channel?: string; dob?: string; lat?: string; long?: string } = {}): any {
  const side = (name: string, dob?: string): any => ({ Nm: name, Id: { PrvtId: { ...(dob ? { DtAndPlcOfBirth: { BirthDt: dob } } : {}), Othr: [{ Id: 'x' }] } } });
  return {
    TxTp: 'pacs.008.001.10',
    FIToFICstmrCdtTrf: {
      GrpHdr: { MsgId: e2e, CreDtTm: at.toISOString() },
      CdtTrfTxInf: {
        PmtId: { EndToEndId: e2e },
        IntrBkSttlmAmt: { Amt: { Amt: amount, Ccy: 'PKR' } },
        Dbtr: side(dbtr[0], dbtr[0] === 'Hamza Rafiq' ? extra.dob : undefined),
        DbtrAcct: { Id: { Othr: [{ Id: dbtr[1] }] } },
        DbtrAgt: { FinInstnId: { ClrSysMmbId: { MmbId: dbtr[2] } } },
        Cdtr: side(cdtr[0], cdtr[0] === 'Hamza Rafiq' ? extra.dob : undefined),
        CdtrAcct: { Id: { Othr: [{ Id: cdtr[1] }] } },
        CdtrAgt: { FinInstnId: { ClrSysMmbId: { MmbId: cdtr[2] } } },
      },
      RmtInf: { Ustrd: extra.narrative ?? '' },
      SplmtryData: { Envlp: { Doc: { Chnl: extra.channel ?? 'IBFT', InitgPty: { Glctn: { Lat: extra.lat ?? '24.8607', Long: extra.long ?? '67.0011' } } } } },
    },
  };
}

const ME: [string, string, string] = ['Hamza Rafiq', SUBJECT, 'fsp001'];
const hours = (h: number): Date => new Date(+T0 + h * 3_600_000);

/** Two months of small family support, then three unrelated credits each forwarded within minutes. */
export function muleHistory(): any[] {
  const out: any[] = [];
  for (let m = 1; m <= 3; m++) out.push(pacs008(`E2E-B${m}`, hours(-24 * 30 * m - 100), 30000, ['Rafiq Ahmed', 'PK11THAR0000000000000001', 'fsp004'], ME, { narrative: 'pocket money' }));
  out.push(pacs008('E2E-B9', hours(-24 * 40), 5000, ME, ['ATM', 'ATM-00000001', 'fsp001'], { channel: 'ATM withdrawal' }));
  const senders = [['Sana Javed', 'PK22KRKM0000000000000002'], ['Tariq Mehmood', 'PK33KRKM0000000000000003'], ['Ali Raza', 'PK44THAR0000000000000004']];
  senders.forEach(([name, acct], i) => {
    out.push(pacs008(`E2E-IN${i}`, hours(-20 + i * 6), 100000 + i * 50000, [name, acct, 'fsp002'], ME, { narrative: 'investment' }));
    out.push(pacs008(`E2E-OUT${i}`, hours(-20 + i * 6 + 0.5), (100000 + i * 50000) * 0.98, ME, ['Collector One', 'PK55SVRW0000000000000005', 'fsp003'], { narrative: 'transfer', channel: 'Wallet transfer' }));
  });
  return out;
}

export const TRIGGER_E2E = 'E2E-IN2';

export const ALERT_DATA = {
  tadpResult: {
    typologyResult: [
      {
        cfg: '101@1.0.0',
        result: 450,
        workflow: { alertThreshold: 300, interdictionThreshold: 600 },
        ruleResults: [
          { id: '001@1.0.0', wght: 100, subRuleRef: '.02' },
          { id: '016@1.0.0', wght: 150, subRuleRef: '.03' },
          { id: '024@1.0.0', wght: 150, subRuleRef: '.02' },
          { id: '045@1.0.0', wght: 50, subRuleRef: '.02' },
        ],
      },
    ],
  },
};

export const KYC = `KYC extract (core banking)
Name: Hamza Rafiq
Occupation: Student
Declared monthly income: PKR 30,000
Customer since: 14 Jul 2026
Risk rating: LOW`;
