import React from "react";
import JupyterVisualization from "../shared/JupyterVisualization";

interface ConditionsTabProps {
  caseId?: string;
  transactionId?: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  transactionId,
}) => {
  const fallbackTransactionId = "257758";
  const effectiveTransactionId = transactionId || fallbackTransactionId;

  return (
    <div className="p-4">
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
