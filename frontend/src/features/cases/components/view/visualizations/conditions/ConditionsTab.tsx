import React from "react";
import JupyterVisualization from "../shared/JupyterVisualization";

interface ConditionsTabProps {
  caseId?: string;
  transactionId?: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId,
  transactionId,
}) => {
  const fallbackTransactionId = "257758";
  const effectiveTransactionId = transactionId || fallbackTransactionId;

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Condition Timeline</h2>
          <p className="text-sm text-gray-600 mt-1">
            View blocks and overrides for transaction{' '}
            {caseId || transactionId || fallbackTransactionId}
          </p>
        </div>
      </div>

      <div className="h-[900px]">
        <JupyterVisualization
          notebook="conditions-timeline"
          params={{
            transactionId: effectiveTransactionId,
            tenantId: "DEFAULT",
          }}
          title="Conditions Timeline"
          height="100%"
        />
      </div>
    </div>
  );
};

export default ConditionsTab;
