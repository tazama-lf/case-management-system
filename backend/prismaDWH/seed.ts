require('dotenv').config();

import { PrismaClient } from '../../node_modules/@prisma/client-dwh';

const prisma = new PrismaClient();

async function main() {
  // Create sample accounts
    await prisma.account.createMany({
      data: [
        { id: 'A1001', tenant_id: 'T001' },
        { id: 'A1002', tenant_id: 'T001' },
        { id: 'A2001', tenant_id: 'T002' },
        { id: 'A2002', tenant_id: 'T002' },
        { id: 'A3001', tenant_id: 'T003' },
        { id: 'A3002', tenant_id: 'T003' },
        { id: 'A4001', tenant_id: 'T004' },
        { id: 'A4002', tenant_id: 'T004' },
        { id: 'A5001', tenant_id: 'T005' },
        { id: 'A5002', tenant_id: 'T005' },
      ],
      skipDuplicates: true,
    });
    await prisma.transaction.createMany({
      data: [
        // T001
        {
          end_to_end_id: 'TX10001',
          tx_tp: 'Transfer',
          tenant_id: 'T001',
          transaction: {
            EndToEndId: 'TX10001',
            Amt: '1000.00',
            Ccy: 'USD',
            MsgId: 'MSG10001',
            CreDtTm: '2025-10-01T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T001',
          },
          amt: 1000.00,
          ccy: 'USD',
          msg_id: 'MSG10001',
          cre_dt_tm: '2025-10-01T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A1001',
          destination: 'A1002',
          // ...removed geography and channel fields
          role: 'Debtor',
        },
        {
          end_to_end_id: 'TX10002',
          tx_tp: 'Transfer',
          tenant_id: 'T001',
          transaction: {
            EndToEndId: 'TX10002',
            Amt: '5000.00',
            Ccy: 'USD',
            MsgId: 'MSG20002',
            CreDtTm: '2025-10-15T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T001',
          },
          amt: 5000.00,
          ccy: 'USD',
          msg_id: 'MSG10002',
          cre_dt_tm: '2025-10-15T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A1002',
          destination: 'A1001',
          // ...removed geography and channel fields
          role: 'Creditor',
        },
        {
          end_to_end_id: 'TX10003',
          tx_tp: 'Transfer',
          tenant_id: 'T001',
          transaction: {
            EndToEndId: 'TX10003',
            Amt: '250.00',
            Ccy: 'USD',
            MsgId: 'MSG10003',
            CreDtTm: '2025-11-01T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T001',
          },
          amt: 250.00,
          ccy: 'USD',
          msg_id: 'MSG10003',
          cre_dt_tm: '2025-11-01T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A1001',
          destination: 'A1002',
          // ...removed geography and channel fields
          role: 'Debtor',
        },
        // T002
        {
          end_to_end_id: 'TX20001',
          tx_tp: 'Transfer',
          tenant_id: 'T002',
          transaction: {
            EndToEndId: 'TX20001',
            Amt: '2000.00',
            Ccy: 'EUR',
            MsgId: 'MSG20001',
            CreDtTm: '2025-10-05T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T002',
          },
          amt: 2000.00,
          ccy: 'EUR',
          msg_id: 'MSG20001',
          cre_dt_tm: '2025-10-05T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A2001',
          destination: 'A2002',
          // ...removed geography and channel fields
          role: 'Debtor',
        },
        {
          end_to_end_id: 'TX20002',
          tx_tp: 'Transfer',
          tenant_id: 'T002',
          transaction: {
            EndToEndId: 'TX20002',
            Amt: '3500.00',
            Ccy: 'EUR',
            MsgId: 'MSG20002',
            CreDtTm: '2025-10-20T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T002',
          },
          amt: 3500.00,
          ccy: 'EUR',
          msg_id: 'MSG20002',
          cre_dt_tm: '2025-10-20T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A2002',
          destination: 'A2001',
          // ...removed geography and channel fields
          role: 'Creditor',
        },
        // T003
        {
          end_to_end_id: 'TX30001',
          tx_tp: 'Transfer',
          tenant_id: 'T003',
          transaction: {
            EndToEndId: 'TX30001',
            Amt: '1500.00',
            Ccy: 'GBP',
            MsgId: 'MSG30001',
            CreDtTm: '2025-09-15T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T003',
          },
          amt: 1500.00,
          ccy: 'GBP',
          msg_id: 'MSG30001',
          cre_dt_tm: '2025-09-15T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A3001',
          destination: 'A3002',
          // ...removed geography and channel fields
          role: 'Debtor',
        },
        // T004
        {
          end_to_end_id: 'TX40001',
          tx_tp: 'Transfer',
          tenant_id: 'T004',
          transaction: {
            EndToEndId: 'TX40001',
            Amt: '2200.00',
            Ccy: 'USD',
            MsgId: 'MSG40001',
            CreDtTm: '2025-11-10T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T004',
          },
          amt: 2200.00,
          ccy: 'USD',
          msg_id: 'MSG40001',
          cre_dt_tm: '2025-11-10T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A4001',
          destination: 'A4002',
          
          role: 'Debtor',
        },
       
        {
          end_to_end_id: 'TX50001',
          tx_tp: 'Transfer',
          tenant_id: 'T005',
          transaction: {
            EndToEndId: 'TX50001',
            Amt: '3000.00',
            Ccy: 'USD',
            MsgId: 'MSG50001',
            CreDtTm: '2025-09-25T00:00:00.000Z',
            TxTp: 'Transfer',
            TxSts: 'COMPLETED',
            TenantId: 'T005',
          },
          amt: 3000.00,
          ccy: 'USD',
          msg_id: 'MSG50001',
          cre_dt_tm: '2025-09-25T00:00:00.000Z',
          tx_sts: 'COMPLETED',
          source: 'A5001',
          destination: 'A5002',
          
          role: 'Debtor',
        }
      ],
      skipDuplicates: true,
    });
}

main()
  .then(() => {
    console.log('Seeding completed!');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
