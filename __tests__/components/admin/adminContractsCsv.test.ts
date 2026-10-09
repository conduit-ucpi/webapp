/**
 * The admin Local Database Contracts export: one line per row the list is showing.
 */

import { buildAdminContractsCsv, adminContractsCsvFilename } from '@/components/admin/adminContractsCsv';

const contract: any = {
  id: '6ac66e0008ac42286623973d',
  sellerEmail: 'seller@stabledrop.me',
  buyerEmail: 'buyer@example.com',
  amount: 1_500_000,
  currency: 'microUSDC',
  sellerAddress: '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD',
  buyerAddress: '0xD36698991EF328275c8F9598A33B2378D7ecE183',
  arbiterAddress: '0xa123f4464044115FDA6d642CabaB5702D39e019c',
  arbiterEmail: 'charlie@pank.org.uk',
  expiryTimestamp: 1791504230,
  chainId: '8453',
  chainAddress: '0xa46c6c37956414bad8c40d8972ef0f59da35a2a5',
  description: '=cmd, "quoted"',
  createdAt: 1791388160,
  createdBy: 'x',
  state: 'OK'
};

describe('buildAdminContractsCsv', () => {
  it('writes a header and one line per contract, in the order given', () => {
    const lines = buildAdminContractsCsv([contract, { ...contract, id: 'second' }], () => 'DEPLOYED').split('\r\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^"Payment ID","Created \(UTC\)","Status","Amount","Token"/);
    expect(lines[1]).toMatch(/^"6ac66e0008ac42286623973d"/);
    expect(lines[2]).toMatch(/^"second"/);
  });

  it('gives whole-token amounts, UTC dates, the status it is told, and every party', () => {
    const line = buildAdminContractsCsv([contract], () => 'DEPLOYED').split('\r\n')[1];

    expect(line).toContain(',"DEPLOYED",1.5,"USDC",');
    expect(line).toContain('"2026-10-07T15:49:20Z"');
    for (const v of [contract.sellerEmail, contract.buyerEmail, contract.buyerAddress, contract.arbiterAddress, contract.arbiterEmail, contract.chainAddress]) {
      expect(line).toContain(`"${v}"`);
    }
  });

  it('keeps a description that looks like a formula as text', () => {
    expect(buildAdminContractsCsv([contract], () => 'X')).toContain(`"'=cmd, ""quoted"""`);
  });

  it('leaves optional fields blank rather than writing "undefined"', () => {
    const bare = { ...contract, buyerEmail: undefined, buyerAddress: undefined, arbiterAddress: undefined, arbiterEmail: null, chainAddress: undefined };

    expect(buildAdminContractsCsv([bare], () => 'PENDING')).not.toMatch(/undefined|null/);
  });
});

it('names the file after the range and the day', () => {
  expect(adminContractsCsvFilename('MONTH', new Date('2026-10-09T12:00:00Z'))).toBe('stabledrop-contracts-month-2026-10-09.csv');
});
