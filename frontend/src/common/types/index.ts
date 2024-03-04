export interface IConfigValue {
  maxUploadFileSize: number;
  reportEditDurationInDays: number;
}

export interface IReport {
  report_id: string;
  report_start_date: string;
  report_end_date: string;
  create_date: string;
  is_unlocked: boolean;
}
