import React from "react";
// import JupyterVisualization from "../shared/JupyterVisualization";
import VoilaFrame from "../network-analysis/VoilaFrame";

interface ConditionsTabProps {
  caseId?: number;
  transactionId?: string;
  tenantId: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  tenantId: _tenantId,
}) =>
(
  <VoilaFrame
    notebookPath="conditions-timeline.ipynb"
    title="Conditions Timeline"
    queryParams={{
      transactionId: _transactionId || '',
      tenantId: _tenantId || '',
    }}
  />
);
//   {
//   const fallbackTransactionId = "257758";
//   const effectiveTransactionId = transactionId || fallbackTransactionId;

//   return (
//     <div className="p-4">
//       <div className="h-[900px]">
//         <JupyterVisualization
//           notebook="conditions-timeline"
//           params={{
//             transactionId: effectiveTransactionId,
//             tenantId: "DEFAULT",
//           }}
//           title="Conditions Timeline"
//           height="100%"
//         />
//       </div>
//     </div>
//   );
// };

export default ConditionsTab;
