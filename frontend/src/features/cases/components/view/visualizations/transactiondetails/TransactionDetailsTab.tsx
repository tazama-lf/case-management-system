import React from 'react';
import { UserCircleIcon, BuildingOfficeIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import transactionDetailsService from './services/service';
import type { TransactionDetailsDto } from './types/types';

interface TransactionDetailsTabProps {
  caseId?: string;
  transactionId?: string;
}

const TransactionDetailsTab: React.FC<TransactionDetailsTabProps> = ({
  caseId: _caseId,
  transactionId,
}) => {
  const [data, setData] = React.useState<TransactionDetailsDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!transactionId) {
      setLoading(false);
      console.log('No transactionId provided');
      return;
    }

    console.log('Fetching transaction details for:', transactionId);
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await transactionDetailsService.getTransactionDetails(transactionId);
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load transaction details';
        console.error('Error fetching transaction:', message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!transactionId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Select a transaction to view details</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-700 font-medium">⚠️ Transaction Data Unavailable</p>
        <p className="text-sm text-yellow-600 mt-1">{error}</p>
        {transactionId && (
          <p className="text-xs text-yellow-500 mt-2">Transaction ID: <span className="font-mono">{transactionId}</span></p>
        )}
        <p className="text-xs text-yellow-600 mt-3 italic">The backend transaction details service may not have seeded data for this transaction.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">No data available</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Transaction Detail View</h3>
        <p className="text-sm text-gray-600 mt-1">
          Comprehensive transaction information and fund flow analysis
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Transaction Overview</h4>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Transaction ID
            </div>
            <div className="text-sm font-medium text-gray-900">
              {data.transactionOverview.transactionId}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Timestamp
            </div>
            <div className="text-sm font-medium text-gray-900">
              {new Date(data.transactionOverview.timestamp).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Type
            </div>
            <div className="text-sm font-medium text-gray-900">
              {data.transactionOverview.transactionType}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Status
            </div>
            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
              Completed
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Flow */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Transaction Flow</h4>
        <div className="flex items-center justify-between gap-6">
          {/* Debtor */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <UserCircleIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Debtor</div>
                <div className="text-sm font-semibold text-gray-900">{data.transactionFlow.debtor.name}</div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-gray-500">Account:</span>
                <span className="ml-2 text-gray-900 font-medium">{data.transactionFlow.debtor.account.iban}</span>
              </div>
              <div>
                <span className="text-gray-500">Bank:</span>
                <span className="ml-2 text-gray-900">{data.transactionFlow.debtor.bank}</span>
              </div>
            </div>
          </div>

          {/* Arrow and Amount */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-blue-400 to-purple-400"></div>
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                <ArrowRightIcon className="h-5 w-5 text-white" />
              </div>
              <div className="h-px w-16 bg-gradient-to-r from-blue-400 to-purple-400"></div>
            </div>
            <div className="text-xl font-bold text-gray-900">${data.transactionFlow.amount.amount.toLocaleString()}</div>
          </div>

          {/* Creditor */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <BuildingOfficeIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Creditor</div>
                <div className="text-sm font-semibold text-gray-900">{data.transactionFlow.creditor.name}</div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-gray-500">Account:</span>
                <span className="ml-2 text-gray-900 font-medium">{data.transactionFlow.creditor.account.iban}</span>
              </div>
              <div>
                <span className="text-gray-500">Bank:</span>
                <span className="ml-2 text-gray-900">{data.transactionFlow.creditor.bankName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debtor and Creditor Profiles */}
      <div className="grid grid-cols-2 gap-4">
        {/* Debtor Profile */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCircleIcon className="h-5 w-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">Debtor Profile</h4>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Name</div>
              <div className="text-sm text-gray-900">{data.debtorProfile.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Account Number</div>
              <div className="text-sm text-gray-900 font-mono">{data.debtorProfile.account.iban}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Account Type</div>
              <div className="text-sm text-gray-900">{data.debtorProfile.accountType}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Bank</div>
              <div className="text-sm text-gray-900">{data.debtorProfile.bank}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Swift Code</div>
              <div className="text-sm text-gray-900 font-mono">{data.debtorProfile.swiftCode}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Address</div>
              <div className="text-sm text-gray-900">{data.debtorProfile.address}</div>
            </div>
          </div>
        </div>

        {/* Creditor Profile */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BuildingOfficeIcon className="h-5 w-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">Creditor Profile</h4>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Name</div>
              <div className="text-sm text-gray-900">{data.creditorProfile.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Account Number</div>
              <div className="text-sm text-gray-900 font-mono">{data.creditorProfile.account.iban}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Account Type</div>
              <div className="text-sm text-gray-900">{data.creditorProfile.accountType}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Bank</div>
              <div className="text-sm text-gray-900">{data.creditorProfile.bank}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Swift Code</div>
              <div className="text-sm text-gray-900 font-mono">{data.creditorProfile.swiftCode}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Address</div>
              <div className="text-sm text-gray-900">{data.creditorProfile.address}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount & Currency and Settlement Details */}
      <div className="grid grid-cols-2 gap-4">
        {/* Amount & Currency */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-sm font-semibold text-gray-900">Amount & Currency</h4>
          </div>
          <div className="space-y-2.5">
            {data.amountAndCurrency.map((amountItem, idx) => (
              <div key={idx}>
                {amountItem.originalAmount && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Original Amount:</span>
                      <span className="text-sm font-medium text-gray-900">USD ${amountItem.originalAmount.toLocaleString()}</span>
                    </div>
                    {amountItem.exchangeRate && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Exchange Rate:</span>
                        <span className="text-sm font-medium text-gray-900">{amountItem.exchangeRate}</span>
                      </div>
                    )}
                    {amountItem.convertedAmount && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Converted Amount:</span>
                        <span className="text-sm font-medium text-gray-900">${amountItem.convertedAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}
                {(amountItem.senderCharges || amountItem.intermediaryCharges || amountItem.receiverCharges) && (
                  <>
                    <div className="border-t border-gray-200 my-2"></div>
                    {amountItem.senderCharges && amountItem.senderCharges.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Sender Charges:</span>
                        <span className="text-sm font-medium text-gray-900">${amountItem.senderCharges[0].amount}</span>
                      </div>
                    )}
                    {amountItem.intermediaryCharges && amountItem.intermediaryCharges.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Intermediary Charges:</span>
                        <span className="text-sm font-medium text-gray-900">${amountItem.intermediaryCharges[0].amount}</span>
                      </div>
                    )}
                    {amountItem.receiverCharges && amountItem.receiverCharges.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Receiver Charges:</span>
                        <span className="text-sm font-medium text-gray-900">${amountItem.receiverCharges[0].amount}</span>
                      </div>
                    )}
                  </>
                )}
                {amountItem.totalCharges && (
                  <>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold text-gray-900">Total Charges:</span>
                      <span className="text-sm font-bold text-gray-900">${amountItem.totalCharges}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Settlement Details */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-sm font-semibold text-gray-900">Settlement Details</h4>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                Transaction Timestamp
              </div>
              <div className="text-sm text-gray-900">{new Date(data.transactionOverview.timestamp).toLocaleString()}</div>
            </div>
            {data.settlementDetails.settlementDate && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                  Settlement Date
                </div>
                <div className="text-sm text-gray-900">{data.settlementDetails.settlementDate}</div>
              </div>
            )}
            {data.settlementDetails.reference && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                  Reference
                </div>
                <div className="text-sm text-gray-900">{data.settlementDetails.reference}</div>
              </div>
            )}
            {data.settlementDetails.purpose && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                  Purpose
                </div>
                <div className="text-sm text-gray-900">{data.settlementDetails.purpose}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailsTab;
