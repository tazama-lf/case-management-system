import React from 'react';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';

const CustomerProfileTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold text-gray-900">Customer Information</div>

      {/* Personal Details and Account Details Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Personal Details Section */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Personal Details</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Customer ID</label>
              <p className="mt-1 text-sm text-gray-900">CUST-7613</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Name</label>
              <p className="mt-1 text-sm text-gray-900">John Smith</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Date of Birth</label>
              <p className="mt-1 text-sm text-gray-900">15-05-1985</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Email Address</label>
              <p className="mt-1 text-sm text-gray-900">j.smith@example.com</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Phone Number</label>
              <p className="mt-1 text-sm text-gray-900">+1 (555) 123-4567</p>
            </div>
          </div>
        </section>

        {/* Account Details Section */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Account Details</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Account Number</label>
              <p className="mt-1 text-sm text-gray-900">XXXX-XXXX-2939</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Account Type</label>
              <p className="mt-1 text-sm text-gray-900">Checking</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Opened On</label>
              <p className="mt-1 text-sm text-gray-900">10-01-2020</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Current Balance</label>
              <p className="mt-1 text-sm text-gray-900">$12,345.67</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Risk Rating</label>
              <p className="mt-1 text-sm text-gray-900">Medium</p>
            </div>
          </div>
        </section>
      </div>

      {/* Address Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500">Street Address</label>
            <p className="mt-1 text-sm text-gray-900">—</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">City</label>
            <p className="mt-1 text-sm text-gray-900">—</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">State/Province</label>
            <p className="mt-1 text-sm text-gray-900">—</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Postal Code</label>
            <p className="mt-1 text-sm text-gray-900">—</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Country</label>
            <p className="mt-1 text-sm text-gray-900">—</p>
          </div>
        </div>
      </section>

      {/* Customer Since Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Customer Since</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500">Account Opening Date</label>
            <p className="mt-1 text-sm text-gray-900">—</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CustomerProfileTab;
