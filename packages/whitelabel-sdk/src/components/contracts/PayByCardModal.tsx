import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useT } from '../../i18n';

export interface CardProvider {
  id: 'coinbase' | 'kraken' | 'link';
  /** As the buyer will see it on the provider's own screen. */
  name: string;
  /** The one fact that decides between providers: what it takes, and from how much. */
  fact: string;
  /** Why it cannot serve this buyer or this payment; absent when it can. */
  unavailable?: string;
  /** "Not in Venezuela?": the country is advice and can be wrong, so the buyer can overrule it. */
  overrule?: { label: string; onClick: () => void };
  onChoose: () => void;
}

interface PayByCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: CardProvider[];
  /** The id of the provider being opened, while it is. */
  opening?: string | null;
  error?: string | null;
  /** Present when paying with crypto is on offer: the way out when no provider can serve. */
  onUseCrypto?: () => void;
  /** A seller's preview: everything is shown and nothing can be continued with. */
  lookOnly?: boolean;
}

/**
 * Behind "Pay by card or bank transfer": who can take this payment from this buyer.
 *
 * ⚠️ ONLY WHAT CAN WORK IS A BUTTON. The main screen used to carry three providers' buttons at
 *    once, greyed out with a reason each when they could not serve: three "you can't" messages
 *    for a buyer who only wanted to pay by card. Here a provider that can serve is a button with
 *    the one fact that tells it from the others; one that cannot is a line saying why.
 */
export default function PayByCardModal({ isOpen, onClose, providers, opening, error, onUseCrypto, lookOnly = false }: PayByCardModalProps) {
  const t = useT();
  const able = providers.filter((provider) => !provider.unavailable);
  const unable = providers.filter((provider) => provider.unavailable);

  return (
    <Modal
      // Written with dark: classes, and holding the page's own address panel.
      themed isOpen={isOpen} onClose={onClose} title={t('payByCardModal.title')}>
      <div className="space-y-3">
        {able.length > 0 && (
          <p className="text-sm text-secondary-600 dark:text-secondary-300">
            {lookOnly
              ? t('payByCardModal.previewLead')
              : t(able.length === 1 ? 'payByCardModal.leadOne' : 'payByCardModal.leadMany')}
          </p>
        )}
        {able.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            size="lg"
            variant={provider === able[0] ? undefined : 'outline'}
            onClick={provider.onChoose}
            disabled={!!opening || lookOnly}
            className="w-full rounded-lg justify-center h-auto flex-col gap-1 py-3 text-center"
          >
            <span className="font-medium">
              {opening === provider.id
                ? t('payByCardModal.opening', { name: provider.name })
                : t('payByCardModal.continueWith', { name: provider.name })}
            </span>
            <span className="text-xs font-normal leading-snug opacity-80">{provider.fact}</span>
          </Button>
        ))}

        {able.length === 0 && (
          <>
            <p className="text-sm text-secondary-700 dark:text-secondary-200">{t('payByCardModal.none')}</p>
            {onUseCrypto && (
              <Button type="button" size="lg" onClick={onUseCrypto} className="w-full rounded-lg justify-center">
                {t('payByCardModal.useCrypto')}
              </Button>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* The list is worked out for whoever is looking: here the seller, not their customer. */}
        {lookOnly && <p className="text-xs text-secondary-500 dark:text-secondary-400">{t('payByCardModal.previewCountry')}</p>}

        {unable.length > 0 && (
          <div className="pt-2 border-t border-secondary-200 dark:border-secondary-700">
            <p className="text-xs font-medium text-secondary-600 dark:text-secondary-300">{t('payByCardModal.notAvailable')}</p>
            <ul className="mt-1 space-y-1">
              {unable.map((provider) => (
                <li key={provider.id} className="text-xs text-secondary-500 dark:text-secondary-400">
                  {provider.unavailable}
                  {provider.overrule && (
                    <>
                      {' '}
                      <button type="button" onClick={provider.overrule.onClick} className="underline hover:text-secondary-900 dark:hover:text-white">
                        {provider.overrule.label}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
