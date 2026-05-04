import { buildReportCsv, ReportRow } from '@/components/dashboard/reportExport';
import { formatDateTimeWithTZ } from '@/utils/datetime';

describe('reportExport', () => {
  describe('buildReportCsv', () => {
    it('produces a header row followed by one row per result', () => {
      const rows: ReportRow[] = [
        {
          contractid: '693544074f28877405b2ec41',
          chainAddress: '0x623cd9bf88732ed7dd90d18d19725090d84c8bdb',
          sellerWalletId: '0xb9c90dbede265181083f1a7159a6ca20d06ce699',
          amount: 1500000,
          description: 'normal description',
          currency: 'microUSDC',
          state: 'CLAIMED',
          chainId: '8453',
          createdate: 1765098503,
        },
      ];

      const csv = buildReportCsv(rows);
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'contractid,chainAddress,sellerWalletId,amount_USDC,description,currency,state,chainId,createdate'
      );
      expect(lines).toHaveLength(2);
    });

    it('renders a normal row with expected columns', () => {
      const rows: ReportRow[] = [
        {
          contractid: 'abc123',
          chainAddress: '0xchain',
          sellerWalletId: '0xseller',
          amount: 1500000,
          description: 'simple',
          currency: 'microUSDC',
          state: 'CLAIMED',
          chainId: '8453',
          createdate: 1765098503,
        },
      ];

      const csv = buildReportCsv(rows);
      const dataRow = csv.split('\n')[1];
      const expectedDate = formatDateTimeWithTZ(1765098503);

      expect(dataRow).toBe(
        `abc123,0xchain,0xseller,1.5000,"simple",microUSDC,CLAIMED,8453,${expectedDate}`
      );
    });

    it('renders empty strings for null chainAddress and chainId', () => {
      const rows: ReportRow[] = [
        {
          contractid: 'abc123',
          chainAddress: null,
          sellerWalletId: '0xseller',
          amount: 1000,
          description: 'something instant',
          currency: 'microUSDC',
          state: 'CREATED',
          chainId: null,
          createdate: 1765098503,
        },
      ];

      const csv = buildReportCsv(rows);
      const dataRow = csv.split('\n')[1];
      const expectedDate = formatDateTimeWithTZ(1765098503);

      expect(dataRow).toBe(
        `abc123,,0xseller,0.0010,"something instant",microUSDC,CREATED,,${expectedDate}`
      );
    });

    it('escapes descriptions containing commas, quotes, and newlines', () => {
      const rows: ReportRow[] = [
        {
          contractid: 'abc123',
          chainAddress: '0xchain',
          sellerWalletId: '0xseller',
          amount: 2000000,
          description: 'has "quoted" text, a comma, and\nnewline',
          currency: 'microUSDC',
          state: 'ACTIVE',
          chainId: '8453',
          createdate: 1765098503,
        },
      ];

      const csv = buildReportCsv(rows);
      const dataRow = csv.split('\n').slice(1).join('\n');
      const expectedDate = formatDateTimeWithTZ(1765098503);

      expect(dataRow).toBe(
        `abc123,0xchain,0xseller,2.0000,"has ""quoted"" text, a comma, and\nnewline",microUSDC,ACTIVE,8453,${expectedDate}`
      );
    });

    it('converts microUSDC to USDC with 4 decimal places', () => {
      const rows: ReportRow[] = [
        { contractid: 'a', chainAddress: '', sellerWalletId: '', amount: 1, description: '', currency: 'microUSDC', state: '', chainId: '', createdate: 1 },
        { contractid: 'b', chainAddress: '', sellerWalletId: '', amount: 1000, description: '', currency: 'microUSDC', state: '', chainId: '', createdate: 1 },
        { contractid: 'c', chainAddress: '', sellerWalletId: '', amount: 1000000, description: '', currency: 'microUSDC', state: '', chainId: '', createdate: 1 },
        { contractid: 'd', chainAddress: '', sellerWalletId: '', amount: 1234567, description: '', currency: 'microUSDC', state: '', chainId: '', createdate: 1 },
      ];

      const lines = buildReportCsv(rows).split('\n');
      const amountFor = (line: string) => line.split(',')[3];

      expect(amountFor(lines[1])).toBe('0.0000');
      expect(amountFor(lines[2])).toBe('0.0010');
      expect(amountFor(lines[3])).toBe('1.0000');
      expect(amountFor(lines[4])).toBe('1.2346');
    });
  });
});
