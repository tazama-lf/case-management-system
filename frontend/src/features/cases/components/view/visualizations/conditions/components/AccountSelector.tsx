import React from 'react';

export interface AccountSelectorItem {
  id: string;
  name: string;
  numberMasked: string;
  type: string;
  activeCount: number;
}

interface AccountSelectorProps {
  accounts: AccountSelectorItem[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold text-gray-500">SELECT ACCOUNT</div>
      <div className="mt-3 space-y-2">
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              className={`w-full rounded-md border p-3 text-left ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-900">{acc.name}</div>
                    <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {acc.type}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{acc.numberMasked}</div>
                </div>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    acc.activeCount > 0
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  {acc.activeCount}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
