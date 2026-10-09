/**
 * The Export CSV button saves what the list is showing: search and status applied, all pages.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDatabaseList from '@/components/admin/AdminDatabaseList';
import { downloadCsv } from '@/utils/csv';

jest.mock('@/utils/csv', () => ({ ...jest.requireActual('@/utils/csv'), downloadCsv: jest.fn() }));
jest.mock('@/lib/apiFetch', () => ({ apiFetch: jest.fn() }));
jest.mock('@/components/ui/ExpandableHash', () => ({ __esModule: true, default: ({ hash }: any) => <span>{hash}</span> }));
import { apiFetch } from '@/lib/apiFetch';

const row = (i: number, sellerEmail: string): any => ({
  id: `id-${i}`,
  sellerEmail,
  amount: 1_000_000,
  currency: 'microUSDC',
  sellerAddress: '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD',
  expiryTimestamp: 4102444800,
  description: `Job ${i}`,
  createdAt: 1791388160 + i,
  createdBy: 'x',
  state: 'OK'
});

beforeEach(() => {
  (downloadCsv as jest.Mock).mockClear();
  // 30 of alice's and 1 of bob's: more than one page of 25.
  const rows = [...Array.from({ length: 30 }, (_, i) => row(i, 'alice@example.com')), row(99, 'bob@example.com')];
  (apiFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => rows });
});

it('exports every matching row across pages, not just the page on screen', async () => {
  render(<AdminDatabaseList />);
  fireEvent.click(await screen.findByRole('button', { name: /Export CSV \(31\)/ }));

  const [filename, csv] = (downloadCsv as jest.Mock).mock.calls[0];
  expect(filename).toMatch(/^stabledrop-contracts-.*\.csv$/);
  expect(csv.split('\r\n')).toHaveLength(32);
});

it('exports only what the search leaves', async () => {
  render(<AdminDatabaseList />);
  fireEvent.change(await screen.findByPlaceholderText('Search contracts...'), { target: { value: 'bob@' } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Export CSV \(1\)/ })).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /Export CSV \(1\)/ }));

  const csv: string = (downloadCsv as jest.Mock).mock.calls[0][1];
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('bob@example.com');
});
