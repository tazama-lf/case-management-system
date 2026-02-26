export interface GoldLakehouseConfig {
  apiUrl: string;
  timeout: number;
  cacheTtl: number;
}

export interface GoldLakehouseQueryRequest {
  table_name: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  limit?: number;
}

export interface GoldLakehouseQueryResponse {
  status: string;
  code: number;
  table: string;
  row_count: number;
  data: Array<Record<string, unknown>>;
}

export interface HudiMetadata {
  _hoodie_commit_time?: string;
  _hoodie_partition_path?: string;
  _hoodie_record_key?: string;
  _hoodie_file_name?: string;
}
