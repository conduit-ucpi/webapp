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
  state: 'OK',
  status: i === 99 ? 'DISPUTED' : 'ACTIVE'
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

it('shows and exports the status contractservice computed, in words, and filters by it', async () => {
  render(<AdminDatabaseList />);
  expect((await screen.findAllByText('Active (funded)')).length).toBeGreaterThan(0);

  fireEvent.change(screen.getByDisplayValue('All Status'), { target: { value: 'DISPUTED' } });
  fireEvent.click(await screen.findByRole('button', { name: /Export CSV \(1\)/ }));

  const csv: string = (downloadCsv as jest.Mock).mock.calls[0][1];
  expect(csv).toContain('"Disputed"');
  expect(csv).toContain('bob@example.com');
});

it('says Unknown, not a guess, when contractservice has not sent a status', async () => {
  (apiFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{ ...row(1, 'a@b.com'), status: undefined, chainAddress: '0xabc' }] });

  render(<AdminDatabaseList />);

  expect(await screen.findAllByText('Unknown')).not.toHaveLength(0);
  expect(screen.queryByText('DEPLOYED')).not.toBeInTheDocument();
});

it('explains every status, in a key on the page and on each badge', async () => {
  render(<AdminDatabaseList />);
  fireEvent.click(await screen.findByText('What the statuses mean'));

  for (const label of ['Awaiting buyer', 'Awaiting funding', 'Active (funded)', 'Disputed', 'Resolved', 'Expired', 'Paid out', 'Error', 'Unknown']) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.getByText(/two of the three votes/)).toBeInTheDocument();
  const badge = screen.getAllByText('Active (funded)').find((el) => el.closest('td'));
  expect(badge?.getAttribute('title')).toMatch(/money is held on chain/);
});
