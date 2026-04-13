import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  dwhService,
  type CustomerProfileResponse,
} from '../../services/dwhService';

interface CustomerProfileTabProps {
  transactionId?: string;
}

const CustomerProfileTab: React.FC<CustomerProfileTabProps> = ({
  transactionId,
}) => {
  const [profile, setProfile] = React.useState<CustomerProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manualId, setManualId] = React.useState('');

  React.useEffect(() => {
    console.log('=== CustomerProfileTab Effect ===');
    console.log('Received transactionId:', transactionId);

    if (!transactionId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    dwhService
      .getCustomerProfile(transactionId)
      .then((data) => {
        setProfile(data);
        setError(null);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ?? 'Failed to load customer profile',
        );
        setProfile(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [transactionId]);

  const handleManualSearch = () => {
    if (!manualId.trim()) return;

    setLoading(true);
    setError(null);
    setProfile(null);

    dwhService
      .getCustomerProfile(manualId.trim())
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ?? 'Failed to load customer profile',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const customerDetails = profile?.customerDetails?.[0];
  const address = profile?.address?.[0];
  const senderAccount = profile?.accountDetails?.sender?.[0];
  const receiverAccount = profile?.accountDetails?.receiver?.[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-600">
            Loading customer profile...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Failed to load customer profile
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              {transactionId && (
                <p className="mt-1 text-xs text-red-600">
                  Transaction ID: {transactionId}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => {
              setManualId(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="Try a different transaction ID (e.g., TXN-002-02)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleManualSearch}
            disabled={!manualId.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                No transaction ID available
              </p>
              <p className="mt-1 text-sm text-yellow-700">
                Customer profile data requires a transaction ID. Enter one
                manually to search.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => {
              setManualId(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="Enter transaction ID (e.g., TXN-002-02)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleManualSearch}
            disabled={!manualId.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">
          Customer Information
        </div>
        {transactionId && (
          <span className="text-xs text-gray-500">
            DWH Transaction ID: {transactionId}
          </span>
        )}
      </div>

      {/* Personal Details and Sender Account Side by Side */}
      <div className="grid grid-cols-1 gap-4">
        {/* Personal Details Section */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Personal Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Customer ID
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {customerDetails?.customerId ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Name
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {customerDetails?.name ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Date of Birth
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {customerDetails?.dateOfBirth
                  ? new Date(customerDetails.dateOfBirth).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Email Address
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {customerDetails?.email ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Phone Number
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {customerDetails?.phone ?? '—'}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Sender and Receiver Account Details Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sender Account Details Section */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Sender Account
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Account ID
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {senderAccount?.id ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Account Type
              </label>
              <p className="mt-1 text-sm text-gray-900 capitalize">
                {senderAccount?.accountType ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Opened On
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {senderAccount?.openedDate
                  ? new Date(senderAccount.openedDate).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Balance
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {senderAccount?.balance !== undefined
                  ? `${senderAccount.currency ?? 'USD'} ${senderAccount.balance.toFixed(2)}`
                  : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Risk Rating
              </label>
              <p className="mt-1 text-sm text-gray-900 capitalize">
                {senderAccount?.riskRating ?? '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Receiver Account Details Section */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Receiver Account
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Account ID
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {receiverAccount?.id ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Account Type
              </label>
              <p className="mt-1 text-sm text-gray-900 capitalize">
                {receiverAccount?.accountType ?? '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Opened On
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {receiverAccount?.openedDate
                  ? new Date(receiverAccount.openedDate).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Balance
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {receiverAccount?.balance !== undefined
                  ? `${receiverAccount.currency ?? 'USD'} ${receiverAccount.balance.toFixed(2)}`
                  : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Risk Rating
              </label>
              <p className="mt-1 text-sm text-gray-900 capitalize">
                {receiverAccount?.riskRating ?? '—'}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Address Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500">
              Street Address
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {address?.street ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">
              City
            </label>
            <p className="mt-1 text-sm text-gray-900">{address?.city ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">
              State/Province
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {address?.state ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Postal Code
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {address?.postalCode ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Country
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {address?.country ?? '—'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CustomerProfileTab;
