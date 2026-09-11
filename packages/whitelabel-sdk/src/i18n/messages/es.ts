import type { Catalogue } from './en';

/**
 * Spanish (Latin American).
 *
 * Typed as Catalogue, so omitting a key the English catalogue defines is a
 * compile error rather than a string that silently renders in English.
 *
 * Register conventions, chosen to match how partners in the region address
 * customers: second person informal ("tú"), "billetera" rather than "cartera",
 * and "depósito en garantía" for escrow, which is more widely understood than
 * leaving the English term in place.
 *
 * ⚠️ Written without a native reviewer. Financial wording carries real
 *    consequences and regional vocabulary varies — have a native speaker from
 *    the target market read this before it goes in front of customers.
 */
export const es: Catalogue = {
  'create.title': 'Solicitud de pago con liberación programada',
  'create.subtitle':
    'Crea un depósito en garantía con liberación diferida y resolución de disputas automática',
  'create.getStarted': 'Empieza con {brand}',
  'create.walletBlurb': 'Usamos una billetera para enviar y recibir tus pagos de forma segura.',
  'create.howThisWorks': 'Cómo funciona',
  'create.step.amount': 'Defines el monto, la stablecoin y las condiciones de liberación',
  'create.step.escrow':
    'El comprador paga al depósito en garantía: los fondos quedan retenidos y aún no se te envían',
  'create.step.release':
    'Los fondos se liberan automáticamente a tu billetera según las condiciones que definiste',
  'steps.connect.title': 'Conectar',
  'steps.connect.detail': 'Conecta tu billetera de forma segura o continúa con tu correo',
  'steps.terms.title': 'Condiciones de pago',
  'steps.terms.detail': 'Ingresa los datos del pago',
  'steps.complete.title': 'Completar y enviar',
  'steps.complete.detail': 'Elige cómo quieres enviar tu solicitud de pago',
  'steps.addFunds.title': 'Agregar fondos',
  'steps.addFunds.detail': 'Agrega USDC a tu billetera',
  'steps.confirmSend.title': 'Confirmar y enviar',
  'steps.confirmSend.detail':
    'Confirma el pago; quedará retenido de forma segura en depósito en garantía',
  'steps.completePayment.title': 'Completar el pago',
  'steps.completePayment.detail':
    'Los fondos en garantía se liberan al vendedor una vez confirmado tu pago',
  'wallet.signInTitle': 'Inicia sesión para configurar tu billetera',
  'wallet.signInBlurb':
    'Crearemos una billetera segura que solo tú controlas, o reconectaremos la que ya tienes. No hay nada que instalar.',
  'wallet.continueSocial': 'Continuar con correo o redes sociales',
  'wallet.advanced': 'Conexión avanzada de billetera',
  'amount.requested': 'Monto solicitado',
  'amount.receiving': 'Monto a recibir',
  'amount.requestedAria': 'Monto solicitado',
  'amount.requestedCurrencyAria': 'Moneda solicitada',
  'amount.receivingAria': 'Monto a recibir',
  'amount.receivingTokenAria': 'Token a recibir',
  'amount.swapAria': 'Cambiar qué monto ingresas',
  'amount.yourCurrency': 'Tu moneda (referencia):',
  'amount.label': 'Monto',
  'amount.fee': 'Comisión',
  'amount.youReceive': 'Recibes',
  'amount.minimum': 'Mínimo {min}',
  'amount.feeSuffix': '· comisión {rate}%, mínimo {min}',
  'amount.feeRate': '— {rate}%',
  'amount.feeRateWithMin': '— {rate}%, mínimo {min}',
  'amount.testFree': 'Envía una prueba gratis',
  'amount.testWaived': 'Pago de prueba: sin comisiones',
  'release.label': '¿Cuándo deben liberarse los fondos?',
  'release.timezone': '(Tu zona horaria: {tz})',
  'release.auto': 'Los fondos se liberarán automáticamente a esta hora',
  'terms.description': 'Descripción',
  'terms.descriptionPlaceholder': '¿Para qué es este pago?',
  'wizard.title': 'Solicitar un pago',
  'wizard.previous': 'Anterior',
  'wizard.stepTerms': 'Condiciones de pago',
  'wizard.stepTermsDetail': 'Monto, fecha y descripción',
  'wizard.stepReview': 'Revisar y enviar',
  'wizard.stepReviewDetail': 'Confirma los datos',
  'wizard.submit': 'Crear solicitud de pago',
  'wizard.linkCopied': '¡Enlace copiado!',
  'wizard.linkCopiedDetail': 'Enlace de pago copiado al portapapeles',
  'wizard.copyFailed': 'No se pudo copiar',
  'wizard.copyFailedDetail': 'No se pudo copiar al portapapeles',
  'wizard.created': '¡Solicitud de pago creada!',
  'wizard.createFailed': 'No se pudo crear la solicitud de pago',
  'wizard.errDescription': 'La descripción debe tener entre 1 y 160 caracteres',
  'wizard.errArbiter': 'La dirección de billetera del árbitro no es válida',
  'wizard.errAmount': 'Ingresa un monto válido',
  'wizard.errDate': 'Selecciona una fecha y hora válidas',
  'wizard.errPast': 'La fecha de liberación debe ser futura',
  'wizard.errTooFar': 'La fecha de liberación debe ser dentro de un año',
  'review.title': 'Confirma los datos de la solicitud',
  'review.release': 'Liberación',
  'review.description': 'Descripción',
  'review.next': '¿Qué pasa después?',
  'review.backAria': 'Volver a las condiciones de pago',
  'wizard.messageCopied': '¡Mensaje copiado!',
  'wizard.messageCopiedDetail':
    'Pégalo a tu comprador: incluye el enlace y el motivo del pago',
  'wizard.creating': 'Creando...',
  'wizard.qrReady': '¡Código QR listo!',
  'wizard.linkReady': '¡Enlace de pago listo para compartir!',
  'wizard.emailWillReceive': '{email} recibirá una notificación por correo.',
  'wizard.genericError': 'Ocurrió un error. Inténtalo de nuevo.',
};
