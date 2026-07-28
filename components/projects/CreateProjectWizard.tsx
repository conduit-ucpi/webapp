import { useState } from 'react';
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
  toChecksumAddress,
  isValidDescription,
  isValidAmount,
} from '@/utils/validation';

const steps: Step[] = [
  { id: 'details', title: 'Project details', description: 'Supplier, verifier, description' },
  { id: 'recipients', title: 'Recipients & split', description: 'Who gets paid what' },
  { id: 'review', title: 'Review & save', description: 'Save — deploy and fund later' },
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
  /** The supplier's own share of the split; empty = supplier not paid directly. */
  supplierShare?: string;
  /** Additional recipients beyond the supplier. */
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
  const { state, createDraft } = useProjectCreation();

  // Session wallet addresses arrive lower-cased; checksum them so anything we
  // pass on (verifier default, on-chain calls) survives downstream validation.
  const buyerAddress = toChecksumAddress(user?.walletAddress || address || '');
  const decimals = config?.usdcDetails?.decimals ?? 6;
  const chainId = config?.chainId ? String(config.chainId) : '';
  const currencySymbol = config?.tokenSymbol || 'USDC';

  const [currentStep, setCurrentStep] = useState(0);
  const [sellerAddress, setSellerAddress] = useState(prefill?.sellerAddress || '');
  const [verifierAddress, setVerifierAddress] = useState(prefill?.verifierAddress || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [totalAmount, setTotalAmount] = useState(prefill?.totalAmount || '');
  const [splitMode, setSplitMode] = useState<'amount' | 'percent'>(prefill?.splitMode || 'amount');
  const [supplierShare, setSupplierShare] = useState(prefill?.supplierShare || '');
  const [rows, setRows] = useState<RecipientRow[]>(prefill?.recipients || []);
  const [sellerEmail, setSellerEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [feeQuote, setFeeQuote] = useState<FeeQuote | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  // The verifier is deliberately NOT pre-filled with the buyer. On-chain an unset
  // verifier already defaults to the buyer, so pre-filling changes nothing mechanically
  // but hides a real choice: nominating someone else is what keeps the escrow
  // completable if the buyer goes silent.

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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateRecipients(): boolean {
    const re: Record<number, string> = {};
    rows.forEach((r, i) => {
      if (!isValidWalletAddress(r.address)) re[i] = 'Invalid wallet address';
      else if (!(parseFloat(r.value) > 0)) re[i] = 'Share must be positive';
    });
    const supplierPaid = parseFloat(supplierShare) > 0;
    const e: Record<string, string> = {};
    if (supplierShare && !supplierPaid) e.supplierShare = 'Share must be positive (or leave it empty)';
    if (!supplierPaid && rows.length === 0)
      e.supplierShare = 'Give the supplier a share or add a recipient';
    if (rows.some((r) => r.address.toLowerCase() === sellerAddress.toLowerCase()))
      showToast({ type: 'warning', title: 'Duplicate recipient', message: 'The supplier already has their own row above.' });
    const dupes = rows.filter((r, i) => rows.findIndex((o) => o.address.toLowerCase() === r.address.toLowerCase()) !== i);
    if (dupes.length) showToast({ type: 'warning', title: 'Duplicate recipient', message: 'The same wallet appears more than once.' });
    setRowErrors(re);
    if (!isValidAmount(totalAmount)) e.totalAmount = 'Enter a valid total amount';
    setErrors((s) => ({ ...s, totalAmount: '', supplierShare: '', ...e }));
    return Object.keys(re).length === 0 && Object.keys(e).length === 0;
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
      sellerAddress: toChecksumAddress(sellerAddress),
      sellerEmail: sellerEmail || null,
      buyerEmail: user?.email || null,
      buyerAddress,
      // Blank means "the buyer verifies" — send the buyer's address explicitly rather
      // than null. On-chain it makes no difference (an unset verifier defaults to the
      // buyer), but contractfanoutservice's isParty() matches the caller's wallet
      // against sellerAddress/buyerAddress/verifierAddress/recipients, and buyerAddress
      // is null on a node until deploy. Sending null here locks the buyer out of their
      // own tree with a 403 unless their account happens to carry a matching email.
      verifierAddress: toChecksumAddress(verifierAddress || buyerAddress),
      totalAmount: parseFloat(totalAmount),
      currency: currencySymbol,
      currencySymbol,
      chainId,
      description,
      splitMode,
      // The supplier is the first payout slice whenever they take a share.
      recipients: [
        ...(parseFloat(supplierShare) > 0
          ? [{ address: toChecksumAddress(sellerAddress), value: parseFloat(supplierShare), email: sellerEmail || null }]
          : []),
        ...rows.map((r) => ({
          address: toChecksumAddress(r.address),
          value: parseFloat(r.value),
          email: r.email || null,
        })),
      ],
      serviceLink: typeof window !== 'undefined' ? window.location.origin : '',
    };
  }

  async function handleSave() {
    try {
      const groupId = await createDraft(buildDraft(), subcontract);
      showToast({
        type: 'success',
        title: 'Project saved',
        message: 'Deploy it on-chain when you are ready.',
      });
      router.push(`/projects/${groupId}`);
    } catch (e) {
      showToast({ type: 'error', title: 'Could not save', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  const busy = state.stage === 'creating';

  return (
    <Wizard steps={steps} currentStep={currentStep} className="px-4">
      {intent !== 'create' && (
        <div className="max-w-2xl mx-auto mb-6 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
          {intent === 'clone'
            ? 'Cloning an existing project — parties and splits are pre-filled. Set a new amount (try a small "test run" first to prove the flow).'
            : 'Subcontracting a slice — this creates a new linked project you fund yourself. The parent payout is unchanged.'}
        </div>
      )}

      {currentStep === 0 && (
        <WizardStep className="dark:bg-secondary-900 dark:border-secondary-700">
          <div className="space-y-5 max-w-2xl mx-auto">
            <div className="rounded-md bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 p-3 text-sm text-secondary-700 dark:text-secondary-300">
              You are the <strong>buyer</strong>: this project will be funded from your connected
              wallet ({buyerAddress.slice(0, 6)}…{buyerAddress.slice(-4)}). Nothing is committed
              yet — this wizard saves the project, and you deploy it on-chain and deposit the funds
              afterwards, from the project&apos;s own page.
            </div>
            <Input
              label="Supplier (seller) wallet address"
              placeholder="0x… — who does or coordinates the work"
              value={sellerAddress}
              onChange={(e) => setSellerAddress(e.target.value)}
              error={errors.sellerAddress}
            />
            <Input
              label="Verifier wallet address (optional)"
              placeholder={`Defaults to you (${buyerAddress.slice(0, 6)}…${buyerAddress.slice(-4)})`}
              helpText="Who signs off that the work is done. Leave blank to do it yourself. Naming someone else means the project can still complete if you are unavailable. Cannot be the supplier."
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
          </div>
        </WizardStep>
      )}

      {currentStep === 1 && (
        <WizardStep className="dark:bg-secondary-900 dark:border-secondary-700">
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
              supplierAddress={sellerAddress}
              supplierValue={supplierShare}
              onSupplierValueChange={setSupplierShare}
              supplierError={errors.supplierShare || undefined}
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
        <WizardStep className="dark:bg-secondary-900 dark:border-secondary-700">
          <div className="space-y-4 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold">Review</h3>
            <dl className="divide-y divide-secondary-200 dark:divide-secondary-700 text-sm">
              <Row label="Funded by" value={`You (buyer) — ${buyerAddress}`} />
              <Row label="Supplier" value={sellerAddress} />
              <Row label="Verifier" value={verifierAddress || buyerAddress} />
              <Row label="Description" value={description} />
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
            <div className="rounded-md bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 p-3 text-sm text-secondary-700 dark:text-secondary-300">
              Saving records this project off-chain only — no gas, no deposit, nothing on-chain
              yet. From the project page you can then deploy the escrow and fund it.
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
              Once funded, money is released only when the verifier confirms completion — never
              automatically, and never on a timer. You can raise a dispute at any point until that
              happens.
            </div>
            {state.stage !== 'idle' && (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">Status: {stageLabel(state.stage)}</p>
            )}
          </div>
        </WizardStep>
      )}

      <div className="mt-8 max-w-3xl mx-auto">
        <WizardNavigation
          currentStep={currentStep}
          totalSteps={steps.length}
          onPrevious={() => setCurrentStep((s) => Math.max(s - 1, 0))}
          onNext={currentStep < steps.length - 1 ? goNext : handleSave}
          nextLabel={currentStep < steps.length - 1 ? 'Continue' : 'Save project'}
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
      <dt className="text-secondary-500 dark:text-secondary-400">{label}</dt>
      <dd className="text-secondary-900 dark:text-secondary-100 text-right break-all">{value}</dd>
    </div>
  );
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'creating': return 'Saving project…';
    case 'done': return 'Saved';
    case 'error': return 'Error — you can retry';
    default: return stage;
  }
}

// Client-side unit helper: DISPLAY ONLY (review figures). The authoritative
// conversions run server-side in projectMath.
function fromBaseUnitsClient(units: string, decimals: number): string {
  const s = units.padStart(decimals + 1, '0');
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return `${whole}${frac ? '.' + frac : ''}`;
}
