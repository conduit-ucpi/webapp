import type { ReactNode } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useT } from '../../i18n';

interface PayWithCryptoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  /** `ask`: where is your money? `elsewhere`: the payment address, its QR and "I have paid". */
  view: 'ask' | 'elsewhere';
  onViewChange: (view: 'ask' | 'elsewhere') => void;
  /** Topping up the signed-in wallet, when it is short and the token can be bought into it. */
  topUp?: { note: string; onClick: () => void };
  /** The address, QR and "I have paid" panel; absent when the payment cannot be paid that way. */
  elsewhere?: ReactNode;
  /** Present when paying by card is on offer: for the buyer who turns out to hold none. */
  onUseCard?: () => void;
  /** A seller's preview: it can be looked through, and nothing in the address view can be pressed. */
  lookOnly?: boolean;
}

/**
 * Behind "Pay with crypto": one question, "Where is your USDC?", and what follows from the answer.
 *
 * The address, QR code and "I have paid" used to sit at the foot of the pay screen for everyone,
 * which is most of what made it look technical to a buyer paying by card. They are here now, for
 * the buyer who said they hold the token somewhere else.
 */
export default function PayWithCryptoModal({
  isOpen,
  onClose,
  tokenSymbol,
  view,
  onViewChange,
  topUp,
  elsewhere,
  onUseCard,
  lookOnly = false,
}: PayWithCryptoModalProps) {
  const t = useT();
  const option = 'w-full rounded-lg justify-center h-auto flex-col gap-1 py-3 text-center';
  const note = 'text-xs font-normal leading-snug text-secondary-500 dark:text-secondary-400';
  // With nothing to choose between, the question is not asked.
  const showElsewhere = !!elsewhere && (view === 'elsewhere' || (!topUp && !onUseCard));

  return (
    <Modal
      // Written with dark: classes, and holding the page's own address panel.
      themed
      isOpen={isOpen}
      onClose={onClose}
      size={showElsewhere ? 'large' : 'medium'}
      title={showElsewhere ? t('payWithCryptoModal.elsewhereTitle', { token: tokenSymbol }) : t('payWithCryptoModal.title')}
    >
      {showElsewhere ? (
        <div>
          <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">{t('pay.elsewhereLead')}</p>
          {/* A disabled fieldset turns off every control inside it. */}
          {lookOnly ? <fieldset disabled className="min-w-0 border-0 p-0">{elsewhere}</fieldset> : elsewhere}
          {(topUp || onUseCard) && (
            <button
              type="button"
              onClick={() => onViewChange('ask')}
              className="mt-4 text-sm underline text-secondary-600 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-white"
            >
              {t('payWithCryptoModal.back')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-secondary-900 dark:text-white">{t('payWithCryptoModal.question', { token: tokenSymbol })}</p>
          {topUp && (
            <Button type="button" variant="outline" size="lg" onClick={topUp.onClick} className={option}>
              <span className="font-medium">{t('payWithCryptoModal.inThisWallet')}</span>
              <span className={note}>{topUp.note}</span>
            </Button>
          )}
          {elsewhere && (
            <Button type="button" variant="outline" size="lg" onClick={() => onViewChange('elsewhere')} className={option}>
              <span className="font-medium">{t('payWithCryptoModal.inAnotherWallet')}</span>
              <span className={note}>{t('payWithCryptoModal.inAnotherWalletNote', { token: tokenSymbol })}</span>
            </Button>
          )}
          {onUseCard && (
            <Button type="button" variant="outline" size="lg" onClick={onUseCard} className={option}>
              <span className="font-medium">{t('payWithCryptoModal.haveNone')}</span>
              <span className={note}>{t('payWithCryptoModal.haveNoneNote')}</span>
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
