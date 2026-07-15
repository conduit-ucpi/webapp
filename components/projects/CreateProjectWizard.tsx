import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useToast } from '@/components/ui/Toast';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Wizard, WizardStep, WizardNavigation, WizardStep as Step } from '@/components/ui/Wizard';
import RecipientSplitEditor, { RecipientRow } from '@/components/projects/RecipientSplitEditor';
import { useProjectCreation, SubcontractContext } from '@/hooks/useProjectCreation';
import { ProjectDraft } from '@/types/projects';
import {
  isValidWalletAddress,
  isValidDescription,
  isValidAmount,
  datetimeLocalToTimestamp,
  timestampToDatetimeLocal,
  getDefaultTimestamp,
  getCurrentLocalDatetime,
  formatDateTimeWithTZ,
  getRelativeTime,
} from '@/utils/validation';

const steps: Step[] = [
  { id: 'details', title: 'Project details', description: 'Supplier, verifier, deadline' },
  { id: 'recipients', title: 'Recipients & split', description: 'Who gets paid what' },
  { id: 'review', title: 'Review & fund', description: 'Confirm and deposit' },
];

interface FeeQuote {
  fee: string;
  netAmount: string;
}

/** Optional prefill (used by the clone flow). */
export interface ProjectPrefill {
  sellerAddress?: string;
  verifierAddress?: string;
  description?: string;
  totalAmount?: string;
  splitMode?: 'amount' | 'percent';
  recipients?: RecipientRow[];
}

interface WizardProps {
  prefill?: ProjectPrefill;
  /** Present when subcontracting an existing node's slice (loose tree). */
  subcontract?: SubcontractContext;
  /** "clone" and "subcontract" tweak copy and the completion banner. */
  intent?: 'create' | 'clone' | 'subcontract';
}

export default function CreateProjectWizard({ prefill, subcontract, intent = 'create' }: WizardProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { user, address } = useAuth();
  const { showToast } = useToast();
  const { state, createAndFund } = useProjectCreation();

  const buyerAddress = user?.walletAddress || address || '';
  const decimals = config?.usdcDetails?.decimals ?? 6;
  const tokenAddress = config?.usdcContractAddress || '';
  const chainId = config?.chainId ? String(config.chainId) : '';
  const currencySymbol = config?.tokenSymbol || 'USDC';

  const [currentStep, setCurrentStep] = useState(0);
  const [sellerAddress, setSellerAddress] = useState(prefill?.sellerAddress || '');
  const [verifierAddress, setVerifierAddress] = useState(prefill?.verifierAddress || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [expiryLocal, setExpiryLocal] = useState(timestampToDatetimeLocal(getDefaultTimestamp()));
  const [totalAmount, setTotalAmount] = useState(prefill?.totalAmount || '');
  const [splitMode, setSplitMode] = useState<'amount' | 'percent'>(prefill?.splitMode || 'amount');
  const [rows, setRows] = useState<RecipientRow[]>(
    prefill?.recipients || [{ address: '', value: '', email: '' }]
  );
  const [sellerEmail, setSellerEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [feeQuote, setFeeQuote] = useState<FeeQuote | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  // Default the verifier to the buyer (matches on-chain default; editable).
  useEffect(() => {
    if (!verifierAddress && buyerAddress) setVerifierAddress(buyerAddress);
  }, [buyerAddress, verifierAddress]);

  const expiryTimestamp = useMemo(() => datetimeLocalToTimestamp(expiryLocal), [expiryLocal]);

  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (!isValidWalletAddress(sellerAddress)) e.sellerAddress = 'Enter a valid wallet address';
    else if (sellerAddress.toLowerCase() === buyerAddress.toLowerCase())
      e.sellerAddress = 'Supplier must differ from you (the buyer)';
    if (verifierAddress && !isValidWalletAddress(verifierAddress))
      e.verifierAddress = 'Enter a valid wallet address';
    else if (verifierAddress && verifierAddress.toLowerCase() === sellerAddress.toLowerCase())
      e.verifierAddress = 'Verifier cannot be the supplier';
    if (!isValidDescription(description)) e.description = 'Enter a short description';
    if (!expiryTimestamp || expiryTimestamp * 1000 <= Date.now())
      e.expiry = 'Dispute deadline must be in the future';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateRecipients(): boolean {
    const re: Record<number, string> = {};
    rows.forEach((r, i) => {
      if (!isValidWalletAddress(r.address)) re[i] = 'Invalid wallet address';
      else if (!(parseFloat(r.value) > 0)) re[i] = 'Share must be positive';
    });
    const dupes = rows.filter((r, i) => rows.findIndex((o) => o.address.toLowerCase() === r.address.toLowerCase()) !== i);
    if (dupes.length) showToast({ type: 'warning', title: 'Duplicate recipient', message: 'The same wallet appears more than once.' });
    setRowErrors(re);
    if (!isValidAmount(totalAmount)) {
      setErrors((s) => ({ ...s, totalAmount: 'Enter a valid total amount' }));
      return false;
    }
    return Object.keys(re).length === 0;
  }

  async function goNext() {
    if (currentStep === 0 && !validateDetails()) return;
    if (currentStep === 1) {
      if (!validateRecipients()) return;
      await loadFeeQuote();
    }
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function loadFeeQuote() {
    setFeeLoading(true);
    try {
      const res = await fetch(
        `/api/projects/fee-quote?amount=${encodeURIComponent(totalAmount)}&decimals=${decimals}`,
        { credentials: 'include' }
      );
      if (res.ok) setFeeQuote(await res.json());
      else setFeeQuote(null);
    } catch {
      setFeeQuote(null);
    } finally {
      setFeeLoading(false);
    }
  }

  function buildDraft(): ProjectDraft {
    return {
      sellerAddress,
      sellerEmail: sellerEmail || null,
      buyerEmail: user?.email || null,
      verifierAddress: verifierAddress || null,
      totalAmount: parseFloat(totalAmount),
      currency: currencySymbol,
      currencySymbol,
      expiryTimestamp,
      chainId,
      description,
      splitMode,
      recipients: rows.map((r) => ({
        address: r.address,
        value: parseFloat(r.value),
        email: r.email || null,
      })),
      serviceLink: typeof window !== 'undefined' ? window.location.origin : '',
    };
  }

  async function handleFund() {
    try {
      const amountBaseUnits = toBaseUnitsClient(parseFloat(totalAmount), decimals);
      const groupId = await createAndFund(
        buildDraft(),
        { tokenAddress, chainId, buyerAddress, tokenDecimals: decimals, amountBaseUnits },
        subcontract
      );
      showToast({ type: 'success', title: 'Project funded', message: 'Your project is live.' });
      router.push(`/projects/${groupId}`);
    } catch (e) {
      showToast({ type: 'error', title: 'Could not complete', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  const busy = ['creating', 'deploying', 'approving', 'funding'].includes(state.stage);

  return (
    <Wizard steps={steps} currentStep={currentStep} className="px-4">
      {intent !== 'create' && (
        <div className="max-w-2xl mx-auto mb-6 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
          {intent === 'clone'
            ? 'Cloning an existing project — parties and splits are pre-filled. Set a new amount (try a small "test run" first to prove the flow) and a new dispute deadline.'
            : 'Subcontracting a slice — this creates a new linked project you fund yourself. The parent payout is unchanged.'}
        </div>
      )}

      {currentStep === 0 && (
        <WizardStep>
          <div className="space-y-5 max-w-2xl mx-auto">
            <Input
              label="Supplier (seller) wallet address"
              placeholder="0x… — who does or coordinates the work"
              value={sellerAddress}
              onChange={(e) => setSellerAddress(e.target.value)}
              error={errors.sellerAddress}
            />
            <Input
              label="Verifier wallet address"
              helpText="Confirms completion on your behalf. Defaults to you; cannot be the supplier."
              value={verifierAddress}
              onChange={(e) => setVerifierAddress(e.target.value)}
              error={errors.verifierAddress}
            />
            <Input
              label="Description"
              placeholder="What is this project for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
            />
            <Input
              label="Dispute deadline"
              type="datetime-local"
              helpText="Your only window to raise a dispute. Funds do NOT auto-release at this time — after it, you can no longer dispute."
              value={expiryLocal}
              min={getCurrentLocalDatetime()}
              onChange={(e) => setExpiryLocal(e.target.value)}
              error={errors.expiry}
            />
            {expiryTimestamp > 0 && (
              <p className="text-sm text-secondary-500">
                {formatDateTimeWithTZ(expiryTimestamp)} ({getRelativeTime(expiryTimestamp)})
              </p>
            )}
          </div>
        </WizardStep>
      )}

      {currentStep === 1 && (
        <WizardStep>
          <div className="space-y-5 max-w-3xl mx-auto">
            <Input
              label={`Total amount (${currencySymbol})`}
              type="number"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              error={errors.totalAmount}
            />
            <RecipientSplitEditor
              mode={splitMode}
              onModeChange={setSplitMode}
              total={totalAmount}
              currencySymbol={currencySymbol}
              rows={rows}
              onChange={setRows}
              errors={rowErrors}
            />
            <Input
              label="Supplier email (optional)"
              value={sellerEmail}
              onChange={(e) => setSellerEmail(e.target.value)}
              helpText="If set, the supplier is emailed a link to this project."
            />
          </div>
        </WizardStep>
      )}

      {currentStep === 2 && (
        <WizardStep>
          <div className="space-y-4 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold">Review</h3>
            <dl className="divide-y divide-secondary-200 dark:divide-secondary-700 text-sm">
              <Row label="Supplier" value={sellerAddress} />
              <Row label="Verifier" value={verifierAddress || buyerAddress} />
              <Row label="Description" value={description} />
              <Row label="Dispute deadline" value={`${formatDateTimeWithTZ(expiryTimestamp)}`} />
              <Row label="Total" value={`${currencySymbol} ${parseFloat(totalAmount || '0').toFixed(2)}`} />
              <Row
                label="Platform fee (1%)"
                value={feeLoading ? 'Quoting…' : feeQuote ? `${currencySymbol} ${fromBaseUnitsClient(feeQuote.fee, decimals)}` : '—'}
              />
              <Row
                label="Net split among recipients"
                value={
                  feeQuote ? `${currencySymbol} ${fromBaseUnitsClient(feeQuote.netAmount, decimals)}` : '—'
                }
              />
            </dl>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
              Funds are released only when the verifier confirms completion. If the supplier goes
              silent after the dispute deadline, you can no longer dispute — set a comfortable deadline.
            </div>
            {state.stage !== 'idle' && (
              <p className="text-sm text-secondary-500">Status: {stageLabel(state.stage)}</p>
            )}
          </div>
        </WizardStep>
      )}

      <div className="mt-8 max-w-3xl mx-auto">
        <WizardNavigation
          currentStep={currentStep}
          totalSteps={steps.length}
          onPrevious={() => setCurrentStep((s) => Math.max(s - 1, 0))}
          onNext={currentStep < steps.length - 1 ? goNext : handleFund}
          nextLabel={currentStep < steps.length - 1 ? 'Continue' : 'Create & fund'}
          isNextLoading={busy || feeLoading}
          isNextDisabled={busy}
        />
      </div>
    </Wizard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-secondary-500">{label}</dt>
      <dd className="text-secondary-900 dark:text-secondary-100 text-right break-all">{value}</dd>
    </div>
  );
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'creating': return 'Saving project…';
    case 'deploying': return 'Deploying on-chain…';
    case 'approving': return 'Awaiting your approval signature…';
    case 'funding': return 'Depositing funds…';
    case 'done': return 'Done';
    case 'error': return 'Error — you can retry';
    default: return stage;
  }
}

// Client-side unit helpers: DISPLAY ONLY (approval amount + review figures).
// The authoritative conversions run server-side in projectMath.
function toBaseUnitsClient(amount: number, decimals: number): string {
  const fixed = amount.toFixed(decimals);
  const [whole, frac = ''] = fixed.split('.');
  return (BigInt(whole + frac.padEnd(decimals, '0'))).toString();
}
function fromBaseUnitsClient(units: string, decimals: number): string {
  const s = units.padStart(decimals + 1, '0');
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return `${whole}${frac ? '.' + frac : ''}`;
}
