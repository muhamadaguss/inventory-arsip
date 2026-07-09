export interface RejectedRow {
  row: number;
  reason: string;
}

export interface ImportResult {
  importedCount: number;
  rejectedRows: RejectedRow[];
}
