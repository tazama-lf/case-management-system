export interface WorkQueue {
  id: string;
  name: string;
  type: string;
}

export interface CreateCandidateGroupRequest {
  groupId: string;
  groupName: string;
  groupType: string;
}

export interface CandidateGroupData {
  id: string;
  url: string;
  name: string;
  type: string;
}
