export interface UploadReportDto {
  file: File;
  caseId: number;
  reportType: string;
  description?: string;
  outcome?: string;
  investigatorInputs?: string;
  supervisorRemarks?: string;

}

export interface UploadReportResponse {
  id: string;
  caseId: number;
  fileName: string;
  reportType: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  uploadedBy: string;
  uploadedAt: Date;
  filePath: string;
}