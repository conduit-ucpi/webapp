import { apiFetch } from '@/lib/apiFetch';

/**
 * MoonPay on-ramp, funding an escrow directly.
 *
 * Shaped like coinbaseOnramp deliberately — both buy stablecoin and have the
 * provider deliver it straight to the escrow, which accepts a plain transfer
 * that the "I have paid" panel then sweeps in. The differences are that
 * MoonPay's URL must be signed server-side, and that MoonPay renders in an
 * overlay on our page rather than a popup.
 *
 * We never build the URL here. The signature covers the query string, so the
 * parameters have to be decided and signed by the box (see
 * pages/api/moonpay/sign.ts) — a URL assembled in the browser could not be
 * signed without shipping the secret key, which is the thing that must not
 * happen.
 */

interface SignedWidget {
  url: string;
  quoteCurrencyAmount: string;
  escrowAddress: string;
  environment: 'sandbox' | 'production';
}

interface OpenMoonPayParams {
  /** The payment request being funded. The only thing the caller chooses. */
  contractId: string;
  /**
   * Called when the widget closes, however it closed — completed, cancelled or
   * dismissed. Money may have landed either way, so the caller should show the
   * panel that can check the escrow balance and sweep.
   */
  onClose?: () => void;
}

async function fetchSignedWidget(contractId: string): Promise<SignedWidget> {
  const response = await apiFetch('/api/moonpay/sign', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || `Failed to prepare MoonPay (HTTP ${response.status})`);
  }

  return data as SignedWidget;
}

/**
 * Loads MoonPay's SDK and shows the widget.
 *
 * The import is dynamic so the SDK is fetched only when someone actually
 * chooses this route — it is a sizeable dependency behind a feature flag that
 * is off by default, and every other payer would otherwise pay for it on first
 * load.
 */
export async function openMoonPayOnramp(params: OpenMoonPayParams): Promise<void> {
  const signed = await fetchSignedWidget(params.contractId);

  const { loadMoonPay } = await import('@moonpay/moonpay-js');
  const moonPay = await loadMoonPay();
  if (!moonPay) throw new Error('Could not load MoonPay');

  // The signed URL already carries every parameter, so it is parsed back out
  // rather than restated here: anything added, removed or reordered at this
  // point would no longer match the signature and MoonPay would refuse to load.
  const query = Object.fromEntries(new URL(signed.url).searchParams.entries());

  const widget = moonPay({
    flow: 'buy',
    environment: signed.environment,
    variant: 'overlay',
    params: query as any,
    handlers: {
      async onCloseOverlay() {
        params.onClose?.();
      },
    },
  });

  if (!widget) throw new Error('Could not open MoonPay');
  widget.show();
}
