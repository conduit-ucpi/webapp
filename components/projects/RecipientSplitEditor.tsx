import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export interface RecipientRow {
  address: string;
  /** Dollar amount or percentage, per the active mode. */
  value: string;
  email: string;
}

interface RecipientSplitEditorProps {
  mode: 'amount' | 'percent';
  onModeChange: (mode: 'amount' | 'percent') => void;
  total: string;
  currencySymbol: string;
  rows: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
  errors?: Record<number, string>;
}

const MAX_RECIPIENTS = 10;

/**
 * Editor for a node's recipient split. Users enter either dollar amounts or
 * percentages (toggle); this component only renders the running totals for
 * fast feedback — the authoritative $→bps conversion happens server-side at
 * submit (thin-frontend rule). It never blocks submission on its own math.
 */
export default function RecipientSplitEditor({
  mode,
  onModeChange,
  total,
  currencySymbol,
  rows,
  onChange,
  errors = {},
}: RecipientSplitEditorProps) {
  const totalNum = parseFloat(total) || 0;
  const sum = rows.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);

  const target = mode === 'percent' ? 100 : totalNum;
  const targetLabel = mode === 'percent' ? '100%' : `${currencySymbol} ${totalNum.toFixed(2)}`;
  const sumLabel = mode === 'percent' ? `${sum.toFixed(2)}%` : `${currencySymbol} ${sum.toFixed(2)}`;
  const balanced = Math.abs(sum - target) < 0.005 && target > 0;

  const update = (i: number, patch: Partial<RecipientRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (rows.length >= MAX_RECIPIENTS) return;
    onChange([...rows, { address: '', value: '', email: '' }]);
  };

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
          Recipients ({rows.length}/{MAX_RECIPIENTS})
        </h3>
        <div className="inline-flex rounded-md border border-secondary-200 dark:border-secondary-700 overflow-hidden">
          {(['amount', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1.5 text-sm ${
                mode === m
                  ? 'bg-secondary-900 text-white dark:bg-white dark:text-secondary-900'
                  : 'bg-transparent text-secondary-600 dark:text-secondary-300'
              }`}
            >
              {m === 'amount' ? `${currencySymbol} amount` : 'Percent'}
            </button>
          ))}
        </div>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
          <div className="sm:col-span-6">
            <Input
              placeholder="Recipient wallet address (0x…)"
              value={row.address}
              onChange={(e) => update(i, { address: e.target.value })}
              error={errors[i]}
            />
          </div>
          <div className="sm:col-span-3">
            <Input
              type="number"
              inputMode="decimal"
              placeholder={mode === 'percent' ? '%' : currencySymbol}
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              placeholder="Email (optional)"
              value={row.email}
              onChange={(e) => update(i, { email: e.target.value })}
            />
          </div>
          <div className="sm:col-span-1 flex justify-end">
            {rows.length > 1 && (
              <Button variant="ghost" onClick={() => removeRow(i)} className="min-h-[40px] px-2" aria-label="Remove recipient">
                ✕
              </Button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={addRow} disabled={rows.length >= MAX_RECIPIENTS}>
          + Add recipient
        </Button>
        <p className={`text-sm ${balanced ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {sumLabel} of {targetLabel}
          {!balanced && target > 0 && ' — must match'}
        </p>
      </div>
    </div>
  );
}
