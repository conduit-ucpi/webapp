import type { PageCatalogue } from '@conduit-ucpi/whitelabel-sdk';
import type { pagesEn } from './en';

/**
 * Spanish (Latin American) for this deployment's own pages.
 *
 * Same register as the SDK catalogue, so the two do not read as different
 * voices on one screen: second person informal ("tú"), "billetera" rather than
 * "cartera", "depósito en garantía" for escrow.
 *
 * ⚠️ Written without a native reviewer. Have a native speaker from the target
 *    market read this before it goes in front of customers — COBRO's own site
 *    is the register to match.
 */
export const pagesEs: PageCatalogue<typeof pagesEn> = {
  'wl.badge': 'Respaldado por depósito en garantía · liquidado en USDC sobre Base',
  'wl.dashboard': 'Panel',

  'wl.loadingTitle': 'Crear una solicitud de pago',
  'wl.loadingSubtitle': 'Preparando todo…',

  'wl.connectTitle': 'Comienza con {brand}',
  'wl.connectSubtitle':
    'Usamos una billetera para enviar y recibir tus pagos de forma segura. Inicia sesión con Google o con un correo electrónico y creamos una por ti.',

  'wl.createTitle': 'Solicitud de pago con liberación programada',
  'wl.createSubtitle':
    'Define un monto y una fecha de liberación. El comprador paga al depósito en garantía, las disputas siguen abiertas hasta esa fecha, y después los fondos pasan a ti automáticamente.',

  'wl.howTitle': 'Cómo funciona',
  'wl.howStep1': 'Tú defines el monto, la stablecoin y las condiciones de liberación',
  'wl.howStep2':
    'El comprador paga al depósito en garantía: los fondos quedan retenidos, todavía no se te envían',
  'wl.howStep3':
    'Los fondos se liberan a tu billetera automáticamente según las condiciones que fijaste',

  'wl.assuranceFee': 'Comisión fija del 1 %',
  'wl.assuranceChargebacks': 'Sin contracargos',
  'wl.assuranceGas': 'Pagamos el gas por ti',
  'wl.assuranceCustody': 'Sin custodia',

  'wl.footerTerms': 'Términos',
  'wl.footerPrivacy': 'Privacidad',
  'wl.footerDisputes': 'Disputas',

  'wl.seoTitle': '{brand} — crea una solicitud de pago',
  'wl.seoDescription':
    'Define un monto y una fecha de pago. El comprador paga al depósito en garantía y los fondos se liberan automáticamente en la fecha que ambos acordaron.',
};
