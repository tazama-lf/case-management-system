import React from 'react';
import { CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline';
import VoilaFrame from '../network-analysis/VoilaFrame';

interface ConditionsTabProps {
  caseId?: number;
  transactionId?: string;
  tenantId: string;
}

/** Which moment the conditions are classified against: the current time, or the time of the transaction. */
export type ConditionsAsOf = 'now' | 'transaction';

interface AsOfOption {
  value: ConditionsAsOf;
  label: string;
  description: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const AS_OF_OPTIONS: AsOfOption[] = [
  {
    value: 'now',
    label: 'As of now',
    description: 'Showing the conditions that are in force right now.',
    Icon: ClockIcon,
  },
  {
    value: 'transaction',
    label: 'At transaction time',
    description:
      'Showing the conditions as they stood when the transaction was made.',
    Icon: CalendarDaysIcon,
  },
];

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  tenantId: _tenantId,
}) => {
  // What matters to the reviewer is what is in force today, so that is the default
  const [asOf, setAsOf] = React.useState<ConditionsAsOf>('now');
  const selected =
    AS_OF_OPTIONS.find((option) => option.value === asOf) ?? AS_OF_OPTIONS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Conditions</h3>
          <p
            className="mt-1 flex items-center gap-1.5 text-sm text-gray-600"
            aria-live="polite"
            data-testid="conditions-as-of-description"
          >
            <selected.Icon
              className="h-4 w-4 shrink-0 text-blue-500"
              aria-hidden="true"
            />
            {selected.description}
          </p>
        </div>

        <fieldset>
          <legend className="sr-only">Show conditions as of</legend>
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            {AS_OF_OPTIONS.map(({ value, label, Icon }) => (
              <label key={value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="conditions-as-of"
                  value={value}
                  checked={asOf === value}
                  onChange={() => {
                    setAsOf(value);
                  }}
                  className="peer sr-only"
                />
                {/* The selected look comes from state, like the other toggles in the case view: the app's own
                    stylesheet sets text-gray-600 outside Tailwind's layers, so a peer-checked colour would never win */}
                <span
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1 ${
                    asOf === value
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Remounted when the choice changes, so the notebook is re-run for the new moment */}
      <VoilaFrame
        key={asOf}
        notebookPath="conditions-timeline.ipynb"
        title="Conditions Timeline"
        queryParams={{
          transactionId: _transactionId || '',
          tenantId: _tenantId || '',
          asOf,
        }}
      />
    </div>
  );
};

export default ConditionsTab;
