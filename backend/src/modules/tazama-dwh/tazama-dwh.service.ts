import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaDWHService } from '../../../prismaDWH/prismaDWH.service';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { ProfileResponseDto, DetectedAnomalyDto } from './dto/profile-response.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';

@Injectable()
export class TazamaDwhService {
  constructor(
    private readonly prismaDwh: PrismaDWHService,
    private readonly logger: LoggerService,
  ) {}
  private formatTransactionForTable(tx: any) {
    return {
      date: tx.cre_dt_tm,
      transactionId: tx.end_to_end_id,
      type: tx.tx_tp,
      account: tx.source,
      counterparty: tx.destination,
      role: tx.role,
      amount: tx.amt?.toNumber() ?? 0,
    };
  }

  async generateProfile(dto: GenerateProfileDto, userId: string): Promise<ProfileResponseDto> {
    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const filter: any = {
      cre_dt_tm: { gte: dateFrom, lte: dateTo },
    };

    if (dto.filters?.creditorId) {
      filter.destination = dto.filters.creditorId;
    }
    if (dto.filters?.debtorId) {
      filter.source = dto.filters.debtorId;
    }

    if (dto.filters?.type) filter.tx_tp = dto.filters.type;
    if (dto.filters?.account) filter.OR = [{ source: dto.filters.account }, { destination: dto.filters.account }];
    if (dto.filters?.role) filter.role = dto.filters.role;

    const transactions = await this.prismaDwh.transaction.findMany({
      where: filter,
    });
    const transactionTable = transactions.map(this.formatTransactionForTable);

    const peerTransactions = await this.prismaDwh.transaction.findMany({
      where: {
        cre_dt_tm: { gte: dateFrom, lte: dateTo },
      },
    });
    const getGeography = (tx: any) => tx.geography ?? tx.transaction?.geography ?? tx.transaction?.TxTp ?? '';
    const peerBaseline = {
      avgVolume: peerTransactions.length,
      avgValue: peerTransactions.reduce((sum, tx) => sum + (tx.amt?.toNumber() || 0), 0) / (peerTransactions.length || 1),
      avgCrossBorder: peerTransactions.filter((tx) => getGeography(tx) === 'Cross-border').length,
    };
    const metrics = {
      totalVolume: transactions.length,
      totalValue: transactions.reduce((sum, tx) => sum + (tx.amt?.toNumber() ?? 0), 0),
      avgTicketSize: transactions.length ? transactions.reduce((sum, tx) => sum + (tx.amt?.toNumber() ?? 0), 0) / transactions.length : 0,
      crossBorderCount: transactions.filter((tx) => getGeography(tx) === 'Cross-border').length,
    };
    const outliers = transactions.filter(
      (tx) =>
        (tx.amt?.toNumber() ?? 0) > peerBaseline.avgValue ||
        (getGeography(tx) === 'Cross-border' && (tx.amt?.toNumber() ?? 0) > peerBaseline.avgCrossBorder),
    );
    const summaryTable = {
      totalVolume: metrics.totalVolume,
      totalValue: metrics.totalValue,
      avgTicketSize: metrics.avgTicketSize,
      deviationPercent: outliers.length ? ((outliers.length / metrics.totalVolume) * 100).toFixed(2) : '0.00',
    };
    const visualization = 'trend-chart-placeholder';
    const detectedAnomalies = outliers.map((tx) => ({
      date: tx.cre_dt_tm ?? '',
      type: tx.tx_tp,
      amount: tx.amt?.toNumber() ?? 0,
      description: (tx.amt?.toNumber() ?? 0) > peerBaseline.avgValue ? 'Large transaction flagged' : 'Cross-border anomaly',
      risk: (tx.amt?.toNumber() ?? 0) > 5000 ? 'High' : (tx.amt?.toNumber() ?? 0) > 2000 ? 'Medium' : 'Low',
    }));
    return {
      tenantId: dto.tenantId,
      filters: dto.filters,
      metrics,
      outliers,
      summaryTable,
      notes: dto.notes,
      visualization,
      detectedAnomalies: detectedAnomalies as DetectedAnomalyDto[],
      transactionTable,
    };
  }

  async getTransactionsByDebtorId(tenantId: string, debtorId: string) {
    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where: any = {
      tenant_id: tenantId,
      source: debtorId,
      cre_dt_tm: { gte: dateFrom, lte: dateTo },
    };
    try {
      const transactions = await this.prismaDwh.transaction.findMany({
        where,
        orderBy: { cre_dt_tm: 'desc' },
      });
      if (!transactions.length) {
        throw new NotFoundException(`No transactions found for debtorId=${debtorId}`);
      }
      return transactions;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to fetch transactions from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch transactions from DWH');
    }
  }

  async getTransactionsByCreditorId(tenantId: string, creditorId: string) {
    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where: any = {
      tenant_id: tenantId,
      destination: creditorId,
      cre_dt_tm: { gte: dateFrom, lte: dateTo },
    };
    try {
      const transactions = await this.prismaDwh.transaction.findMany({
        where,
        orderBy: { cre_dt_tm: 'desc' },
      });
      if (!transactions.length) {
        throw new NotFoundException(`No transactions found for creditorId=${creditorId}`);
      }
      return transactions;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to fetch transactions from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch transactions from DWH');
    }
  }

  async getCustomerProfileByTransaction(transactionId: string) {
    try {
      const transaction = await this.prismaDwh.transaction.findFirst({
        where: { end_to_end_id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      const senderAccount = await this.prismaDwh.account.findFirst({
        where: { id: transaction.source },
        include: { customer: true },
      });

      const receiverAccount = await this.prismaDwh.account.findFirst({
        where: { id: transaction.destination },
        include: { customer: true },
      });

      if (!senderAccount || !receiverAccount) {
        throw new NotFoundException(`Account not found for transaction: ${transactionId}`);
      }

      const senderCustomer = senderAccount.customer;
      const receiverCustomer = receiverAccount.customer;

      const senderAddress = senderCustomer?.address as Record<string, string> | null;
      const sender = {
        id: senderAccount.id,
        accountType: senderAccount.account_type ?? undefined,
        openedDate: senderAccount.opened_date ?? undefined,
        balance: senderAccount.balance?.toNumber() ?? undefined,
        riskRating: senderAccount.risk_rating ?? undefined,
        amount: transaction.amt?.toNumber() ?? undefined,
        currency: transaction.ccy ?? undefined,
      };

      const receiverAddress = receiverCustomer?.address as Record<string, string> | null;
      const receiver = {
        id: receiverAccount.id,
        accountType: receiverAccount.account_type ?? undefined,
        openedDate: receiverAccount.opened_date ?? undefined,
        balance: receiverAccount.balance?.toNumber() ?? undefined,
        riskRating: receiverAccount.risk_rating ?? undefined,
        amount: transaction.amt?.toNumber() ?? undefined,
        currency: transaction.ccy ?? undefined,
      };

      return {
        customerDetails: [
          {
            customerId: senderCustomer?.id ?? transaction.source,
            tenantId: transaction.tenant_id,
            name: senderCustomer?.name ?? undefined,
            dateOfBirth: senderCustomer?.date_of_birth ?? undefined,
            email: senderCustomer?.email ?? undefined,
            phone: senderCustomer?.phone ?? undefined,
          },
        ],
        address: senderAddress
          ? [
              {
                street: senderAddress.street,
                city: senderAddress.city,
                state: senderAddress.state,
                postalCode: senderAddress.postalCode,
                country: senderAddress.country,
              },
            ]
          : [],
        accountDetails: {
          sender: [sender],
          receiver: [receiver],
        },
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to fetch customer profile by transaction from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch customer profile by transaction from DWH');
    }
  }

  async getCustomerProfileById(id: string) {
    try {
      const customer = await this.prismaDwh.customer.findFirst({
        where: { id },
        include: { accounts: true },
      });

      if (customer) {
        const accountsWithRoles = await Promise.all(
          customer.accounts.map(async (acc) => {
            const transactions = await this.prismaDwh.transaction.findMany({
              where: {
                OR: [{ source: acc.id }, { destination: acc.id }],
              },
            });

            let debtorCount = 0;
            let creditorCount = 0;
            transactions.forEach((tx) => {
              if (tx.source === acc.id) debtorCount++;
              if (tx.destination === acc.id) creditorCount++;
            });

            const role =
              debtorCount > creditorCount
                ? 'Debtor (Sender/Payer)'
                : creditorCount > debtorCount
                  ? 'Creditor (Receiver/Payee)'
                  : debtorCount === creditorCount && debtorCount > 0
                    ? 'Both (Sender & Receiver)'
                    : undefined;

            return {
              id: acc.id,
              accountType: acc.account_type ?? undefined,
              openedDate: acc.opened_date ?? undefined,
              balance: acc.balance?.toNumber() ?? undefined,
              riskRating: acc.risk_rating ?? undefined,
              role,
            };
          }),
        );

        const addressData = customer.address as Record<string, string> | null;

        return {
          customerId: customer.id,
          tenantId: customer.tenant_id,
          name: customer.name ?? undefined,
          dateOfBirth: customer.date_of_birth ?? undefined,
          email: customer.email ?? undefined,
          phone: customer.phone ?? undefined,
          address: addressData
            ? {
                street: addressData.street,
                city: addressData.city,
                state: addressData.state,
                postalCode: addressData.postalCode,
                country: addressData.country,
              }
            : undefined,
          accounts: accountsWithRoles,
        };
      }

      return this.getCustomerByAccountId(id);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to fetch customer profile from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch customer profile from DWH');
    }
  }

  async getCustomerProfile(customerId: string, tenantId?: string) {
    try {
      const customer = tenantId
        ? await this.prismaDwh.customer.findUnique({
            where: {
              id_tenant_id: {
                id: customerId,
                tenant_id: tenantId,
              },
            },
            include: {
              accounts: true,
            },
          })
        : await this.prismaDwh.customer.findFirst({
            where: {
              id: customerId,
            },
            include: {
              accounts: true,
            },
          });

      if (!customer) {
        throw new NotFoundException(`Customer not found: ${customerId}`);
      }

      const addressData = customer.address as Record<string, string> | null;

      return {
        customerId: customer.id,
        tenantId: customer.tenant_id,
        name: customer.name ?? undefined,
        dateOfBirth: customer.date_of_birth ?? undefined,
        email: customer.email ?? undefined,
        phone: customer.phone ?? undefined,
        address: addressData
          ? {
              street: addressData.street,
              city: addressData.city,
              state: addressData.state,
              postalCode: addressData.postalCode,
              country: addressData.country,
            }
          : undefined,
        accounts: customer.accounts.map((acc) => ({
          id: acc.id,
          accountType: acc.account_type ?? undefined,
          openedDate: acc.opened_date ?? undefined,
          balance: acc.balance?.toNumber() ?? undefined,
          riskRating: acc.risk_rating ?? undefined,
        })),
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to fetch customer profile from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch customer profile from DWH');
    }
  }

  async getCustomerByAccountId(accountId: string) {
    try {
      const account = await this.prismaDwh.account.findFirst({
        where: {
          id: accountId,
        },
        include: {
          customer: true,
        },
      });

      if (!account) {
        throw new NotFoundException(`Account not found: ${accountId}`);
      }

      const dwhTenantId = account.tenant_id;

      const transactions = await this.prismaDwh.transaction.findMany({
        where: {
          OR: [{ source: accountId }, { destination: accountId }],
        },
      });

      let debtorCount = 0;
      let creditorCount = 0;
      transactions.forEach((tx) => {
        if (tx.source === accountId) debtorCount++;
        if (tx.destination === accountId) creditorCount++;
      });

      const role =
        debtorCount > creditorCount
          ? 'Debtor (Sender/Payer)'
          : creditorCount > debtorCount
            ? 'Creditor (Receiver/Payee)'
            : 'Both (Sender & Receiver)';

      const extendedAccount = account as typeof account & {
        customer?: { id: string } | null;
        customer_id?: string | null;
        account_type?: string | null;
        opened_date?: string | null;
        balance?: { toNumber: () => number } | null;
        risk_rating?: string | null;
      };

      if (!extendedAccount.customer) {
        return {
          customerId: extendedAccount.customer_id ?? accountId,
          tenantId: dwhTenantId,
          name: undefined,
          dateOfBirth: undefined,
          email: undefined,
          phone: undefined,
          address: undefined,
          accounts: [
            {
              id: account.id,
              accountType: extendedAccount.account_type ?? undefined,
              openedDate: extendedAccount.opened_date ?? undefined,
              balance: extendedAccount.balance?.toNumber() ?? undefined,
              riskRating: extendedAccount.risk_rating ?? undefined,
              role,
            },
          ],
        };
      }

      const customerProfile = await this.getCustomerProfile(extendedAccount.customer_id!, dwhTenantId);

      if (role && customerProfile.accounts) {
        customerProfile.accounts = customerProfile.accounts.map((acc) => (acc.id === accountId ? { ...acc, role } : acc));
      }

      return customerProfile;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to fetch customer by account from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch customer by account from DWH');
    }
  }
}
