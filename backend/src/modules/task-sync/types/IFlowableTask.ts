export interface IFlowableTask {
  id: string;
  name: string;
  assignee: string | null;
  category: string;
  processInstanceId: string;
  variableMappings: Record<string, unknown>;
}
