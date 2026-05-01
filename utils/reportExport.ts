import { fromMicroUSDC } from './currency';
import { formatDateTimeWithTZ } from './datetime';

export interface ReportRow {
  contractid: string;
  chainAddress: string | null;
  sellerWalletId: string;
  amount: number;
  description: string;
  currency: string;
  state: string;
  chainId: string | null;
  createdate: number;
}

const HEADER = 'contractid,chainAddress,sellerWalletId,amount_USDC,description,currency,state,chainId,createdate';

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildReportCsv(rows: ReportRow[]): string {
  const dataLines = rows.map((row) => {
    const amountUsdc = fromMicroUSDC(row.amount).toFixed(4);
    return [
      row.contractid,
      row.chainAddress ?? '',
      row.sellerWalletId,
      amountUsdc,
      escapeCsvField(row.description ?? ''),
      row.currency,
      row.state,
      row.chainId ?? '',
      formatDateTimeWithTZ(row.createdate),
    ].join(',');
  });

  return [HEADER, ...dataLines].join('\n');
}
