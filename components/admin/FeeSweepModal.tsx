import { apiFetch } from '@/lib/apiFetch';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface FeeSweepPayment {
  target: string;
  bps: number;
  amount: string;
}

interface SweepFeesResult {
  success: boolean;
  feeSweeper?: string;
  tokenAddress?: string;
  feeAmount?: string;
  payments?: FeeSweepPayment[];
  transactionHash?: string;
  error?: string;
}

interface ScreenedSubject {
  roles: string;
  type: string;
  value: string;
  risk: number;
  source?: string;
}

interface ScreenResult {
  clean: boolean;
  complete?: boolean;
  hits?: number;
  subjects?: ScreenedSubject[];
  warnings?: string[];
  fundersFromBlock?: string;
  fundersToBlock?: string;
  error?: string;
}

interface FeeSweepModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Collects the sweepFees arguments for one escrow and shows what chainservice did with them.
 * Amounts in the result are the token's smallest unit, exactly as the escrow paid them.
 */
export default function FeeSweepModal({ isOpen, onClose }: FeeSweepModalProps) {
  const [contractAddress, setContractAddress] = useState('');
  const [target1, setTarget1] = useState('');
  const [bps1, setBps1] = useState('10000');
  const [target2, setTarget2] = useState('');
  const [bps2, setBps2] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SweepFeesResult | null>(null);
  const [isScreening, setIsScreening] = useState(false);
  const [screen, setScreen] = useState<ScreenResult | null>(null);
  const [trace, setTrace] = useState(false);

  const handleClose = () => {
    setContractAddress('');
    setTarget1('');
    setBps1('10000');
    setTarget2('');
    setBps2('0');
    setResult(null);
    setScreen(null);
    setTrace(false);
    onClose();
  };

  // chainservice screens and decides what is clean; this only shows its answer.
  const handleScreen = async () => {
    setIsScreening(true);
    setScreen(null);
    try {
      const response = await apiFetch('/api/admin/sweep-fees-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: contractAddress.trim(), target1, target2, trace })
      });
      const data = await response.json().catch(() => ({}));
      setScreen({ ...data, clean: response.ok && data.clean === true, error: data.error ?? (response.ok ? undefined : `Request failed (${response.status})`) });
    } catch (error) {
      setScreen({ clean: false, error: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setIsScreening(false);
    }
  };

  const handleSubmit = async () => {
    const split = target2.trim() ? `\n${target2.trim()}: ${bps2} bps` : '';
    if (!window.confirm(`Sweep the fee held by ${contractAddress}?\n\n${target1}: ${bps1} bps${split}\n\nThis cannot be undone.`)) {
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const response = await apiFetch('/api/admin/sweep-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: contractAddress.trim(), target1: target1.trim(), bps1, target2, bps2 })
      });
      const data = await response.json().catch(() => ({}));
      setResult({ success: response.ok && data.success === true, ...data, error: data.error ?? (response.ok ? undefined : `Request failed (${response.status})`) });
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sweep Platform Fee" size="large">
      <div className="space-y-4 text-left">
        <Input
          label="Escrow contract address"
          value={contractAddress}
          onChange={(e) => { setContractAddress(e.target.value); setScreen(null); }}
          placeholder="0x..."
          className="font-mono"
        />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-3">
            <Input label="Address 1" value={target1} onChange={(e) => setTarget1(e.target.value)} placeholder="0x..." className="font-mono" />
          </div>
          <Input label="BPS 1" type="number" min="1" max="10000" value={bps1} onChange={(e) => setBps1(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-3">
            <Input
              label="Address 2 (optional)"
              value={target2}
              onChange={(e) => setTarget2(e.target.value)}
              placeholder="Leave blank to send the whole fee to address 1"
              className="font-mono"
            />
          </div>
          <Input label="BPS 2" type="number" min="0" max="10000" value={bps2} onChange={(e) => setBps2(e.target.value)} />
        </div>
        <p className="text-sm text-secondary-500 dark:text-secondary-400">
          BPS are basis points of the escrow&apos;s fee and must sum to 10000. Address 2 receives any rounding dust.
        </p>
        <label className="flex items-start gap-2 text-sm text-gray-900 cursor-pointer">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={trace} onChange={(e) => { setTrace(e.target.checked); setScreen(null); }} />
          <span>
            Trace wallets
            <span className="block text-xs text-secondary-500">
              Also trace every wallet that is not on a sanctions list; its trace score replaces the 0.
            </span>
          </span>
        </label>

        {screen && (
          <div className={`rounded-md border border-gray-200 border-l-4 p-3 text-sm text-gray-900 space-y-2 ${screen.clean ? 'border-l-success-500' : 'border-l-error-500'}`}>
            <p className={`font-medium ${screen.clean ? 'text-success-600' : 'text-error-600'}`}>
              {screen.error
                ? `Sanctions check failed: ${screen.error}`
                : screen.hits
                  ? `${screen.hits} sanctions hit${screen.hits === 1 ? '' : 's'}. Do not sweep.`
                  : screen.clean
                    ? `No sanctions hits across ${screen.subjects?.length ?? 0} wallets, emails and domains.`
                    : 'No hits, but the check was incomplete:'}
            </p>
            {screen.warnings && screen.warnings.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {screen.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            {screen.subjects && screen.subjects.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {screen.subjects.map((s) => (
                      <tr key={`${s.type}:${s.value}`} className={s.risk > 0 ? 'font-bold text-error-600' : ''}>
                        <td className="pr-2 py-0.5 whitespace-nowrap">{s.risk > 0 ? `HIT ${s.risk}` : 'clear'}</td>
                        <td className="pr-2 py-0.5 whitespace-nowrap">{s.type}</td>
                        <td className="pr-2 py-0.5 whitespace-nowrap">{s.source?.toLowerCase() ?? ''}</td>
                        <td className="pr-2 py-0.5 font-mono break-all">{s.value}</td>
                        <td className="py-0.5">{s.roles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {screen.fundersFromBlock && (
              <p className="text-xs">Funders scanned in blocks {screen.fundersFromBlock}–{screen.fundersToBlock}.</p>
            )}
          </div>
        )}

        {result && (
          result.success ? (
            <div className="rounded-md border border-gray-200 border-l-4 border-l-success-500 p-3 text-sm text-gray-900 space-y-1">
              <p className="font-medium text-success-600">Fee swept: {result.feeAmount} (token {result.tokenAddress})</p>
              {result.payments?.map((p) => (
                <p key={p.target} className="font-mono text-xs">{p.target}: {p.amount} ({p.bps} bps)</p>
              ))}
              <p className="font-mono text-xs break-all">Tx: {result.transactionHash}</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 border-l-4 border-l-error-500 p-3 text-sm text-gray-900">
              <p className="text-error-600">{result.error}</p>
              {result.transactionHash && <p className="font-mono text-xs break-all mt-1">Tx: {result.transactionHash}</p>}
            </div>
          )
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-secondary-200 dark:border-secondary-700">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Close
          </Button>
          <Button variant="outline" onClick={handleScreen} disabled={isScreening || isSubmitting || !contractAddress.trim()}>
            {isScreening ? <LoadingSpinner size="sm" /> : 'Check Sanctions'}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !contractAddress.trim() || !target1.trim()}>
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Sweep Fee'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
