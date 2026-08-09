export interface SheetRow {
  id: number;
  merchantName: string;
  amount: number;
  currency: string;
  subscriberName: string;
  status: string;
  billingCycle: string;
  nextBillingDate: string;
  isMustKeep: boolean;
  directKillLink: string | null;
  confidenceScore: number;
  lastSynced: string;
}

export interface IGoogleSheetsClient {
  appendRow(row: SheetRow): Promise<void>;
  updateRow(rowIndex: number, row: SheetRow): Promise<void>;
  readAllRows(): Promise<SheetRow[]>;
  readColumnA(): Promise<number[]>;
  findRowIndexBySubscriptionId(id: number): Promise<number | null>;
}
