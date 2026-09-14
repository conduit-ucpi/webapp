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
 * The signing dance is MoonPay's, not ours. Their signature covers the query
 * string exactly as transmitted, and only the SDK knows what it will transmit —
 * so the SDK builds the URL (generateUrlForSigning), the box signs that exact
 * string, and the SDK applies it (updateSignature). Building the URL ourselves
 * and handing the parts to the SDK looks equivalent and is not: the SDK
 * re-serialises, the bytes differ, and MoonPay answers 400 on
 * verify_widget_signature.
 *
 * We never choose the parameters here. They come from the box, which reads the
 * destination and the amount off the contract and re-checks them before
 * signing — a URL assembled in the browser could not be signed without
 * shipping the secret key, which is the thing that must not happen.
 */

interface WidgetParams {
  apiKey: string;
  currencyCode: string;
  quoteCurrencyAmount: string;
  externalTransactionId: string;
  walletAddress?: string;
}

interface PreparedWidget {
  params: WidgetParams;
  environment: 'sandbox' | 'production';
  quoteCurrencyAmount: string;
  /** Null in preview, where nothing is being sent anywhere. */
  escrowAddress: string | null;
  /**
   * True when MOONPAY_API_SECRET_KEY is unset, so the widget is unsigned and
   * carries no destination. It opens, but MoonPay asks the buyer for their own
   * address and the escrow is NOT funded. Sandbox only — the endpoint refuses
   * to do this in production.
   */
  preview: boolean;
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

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await apiFetch('/api/moonpay/sign', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `MoonPay request failed (HTTP ${response.status})`);
  }
  return data as T;
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
  const prepared = await post<PreparedWidget>({ contractId: params.contractId });

  if (prepared.preview) {
    // Loud, because the flow looks identical from here and ends somewhere
    // completely different: the buyer's own wallet, with the escrow left
    // unfunded. Anyone testing needs to know which of the two they just saw.
    console.warn(
      '[MoonPay] PREVIEW MODE — unsigned URL, no destination address. The widget ' +
        'will open but the escrow will NOT be funded. Set MOONPAY_API_SECRET_KEY ' +
        'to enable the real payment flow.'
    );
  }

  const { loadMoonPay } = await import('@moonpay/moonpay-js');
  const moonPay = await loadMoonPay();
  if (!moonPay) throw new Error('Could not load MoonPay');

  const widget = moonPay({
    flow: 'buy',
    environment: prepared.environment,
    variant: 'overlay',
    params: prepared.params as any,
    handlers: {
      async onCloseOverlay() {
        // Nothing can have reached the escrow in preview, so do not send the
        // caller to a panel that offers to check for it.
        if (!prepared.preview) params.onClose?.();
      },
    },
  });

  if (!widget) throw new Error('Could not open MoonPay');

  if (!prepared.preview) {
    // The SDK's own URL, signed by the box, applied back to the SDK.
    // Round-tripping the string it built is what makes the signature match the
    // one it sends.
    const { signature } = await post<{ signature: string }>({
      contractId: params.contractId,
      url: widget.generateUrlForSigning(),
    });
    widget.updateSignature(signature);
  }

  widget.show();
}
