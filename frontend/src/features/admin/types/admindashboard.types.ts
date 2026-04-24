export interface ReferenceIdsData {
  id: number;
  txTp: string;
  referenceIdName: string;
  createdAt: string;
}

export interface ReferenceIdsRequest {
  txTp: string;
  referenceIdName: string;
}
