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
  'release.onDate': 'En una fecha',
  'release.instant': 'Al instante',
  'release.instantSummary': 'Se libera en cuanto el comprador paga',
  'release.instantNote':
    'Los fondos van directo a tu billetera en la misma transacción. No queda nada en depósito en garantía, así que ninguna de las partes puede abrir una disputa.',
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
  'common.amount': 'Monto:',
  'common.seller': 'Vendedor:',
  'common.payoutDate': 'Fecha de liberación:',
  'common.descriptionLabel': 'Descripción:',
  'common.loading': 'Cargando...',
  'common.cancel': 'Cancelar',
  'common.goToDashboard': 'Ir al panel',
  'common.unknownNetwork': 'Red desconocida',
  'status.verifying': 'Verificando la conexión de la billetera',
  'status.transferring': 'Transfiriendo los fondos al depósito en garantía',
  'status.confirming': 'Confirmando la transacción en la blockchain',
  'status.activating': 'Activando el contrato',
  'status.complete': 'Pago completado',
  'status.securing': 'Asegurando los fondos en depósito en garantía',
  'pay.loading': 'Cargando la solicitud de pago...',
  'pay.invalidLink': 'Enlace de pago inválido',
  'pay.noId': 'No se proporcionó un identificador de solicitud de pago.',
  'pay.checking': 'Buscando tu pago…',
  'pay.title': 'Completa tu pago',
  'pay.connectBlurb': 'Conecta una billetera para continuar o creamos una por ti',
  'pay.chooseHow': 'Elige cómo pagar',
  'pay.notSure':
    '¿No estás seguro? Si todavía no tienes USDC en una billetera cripto, elige la primera opción.',
  'pay.withBrand': 'Pagar con {brand}',
  'pay.withBrandDetail':
    'Inicia sesión con Google o correo, o conecta una billetera como MetaMask. Te ayudamos a conseguir USDC si aún no tienes.',
  'pay.ownWallet': 'Pagar desde mi propia billetera',
  'pay.ownWalletDetail':
    'Envía USDC directamente desde tu billetera usando un enlace de pago o un código QR.',
  'pay.alreadyComplete': 'Este pago ya está completo',
  'pay.alreadyCompleteDetail': 'Los fondos ya están retenidos en garantía para esta solicitud.',
  'pay.unableToProcess': 'No se pudo procesar el pago',
  'pay.notFound': 'Solicitud de pago no encontrada',
  'pay.notFoundDetail': 'No se encontró la solicitud de pago.',
  'pay.requestHeading': 'Solicitud de pago',
  'pay.changeMethod': 'Cambiar el método de pago',
  'checkout.initializing': 'Iniciando el sistema de pago seguro...',
  'checkout.secureEscrow': 'Pago con depósito en garantía',
  'checkout.protected': 'Tu pago está protegido por depósito en garantía',
  'checkout.canDispute': 'Puedes abrir una disputa si hay algún problema',
  'checkout.noGas': 'Sin comisiones de red: cubrimos los costos de la blockchain',
  'checkout.howPay': '¿Cómo quieres pagar?',
  'checkout.logout': 'Cerrar sesión',
  'checkout.orderId': 'N.º de pedido:',
  'checkout.completePayment': 'Completar el pago',
  'checkout.yourBalance': 'Tu saldo:',
  'checkout.walletTransfer': 'Transferencia desde billetera',
  'checkout.qrCode': 'Código QR',
  'checkout.insufficientBalance': 'Saldo insuficiente',
  'checkout.payDirectly': 'Paga directamente desde tu billetera cripto (MetaMask, Coinbase, etc.)',
  'checkout.sellerWalletAddress': 'Dirección de billetera del vendedor',
  'checkout.descPlaceholder': 'Breve descripción de la compra...',
  'checkout.transferDirectly': 'Transfiere directamente desde tu billetera conectada',
  'checkout.paymentAgreement': 'Acuerdo de pago',
  'checkout.feeNote': 'El monto incluye una comisión de $1, mínimo $1.001',
  'checkout.releaseNote':
    'Los fondos se liberarán al vendedor después de esta fecha si no hay disputa',
  'checkout.docTitle': 'Crear contrato - {brand}',
  'checkout.escrowProtected': 'Pago en stablecoin protegido por depósito en garantía, sin comisiones de red',
  'status.preparing': 'Preparando el contrato de garantía...',
  'status.confirmInWallet': 'Confirma la transferencia en tu billetera...',
  'status.creatingEscrow': 'Creando el contrato de garantía...',
  'status.completedRedirect': '¡Pago completado! Redirigiendo...',
  'err.paymentFailed': 'El pago falló',
  'err.prepareFailed': 'No se pudo preparar el contrato',
  'err.createFailed': 'No se pudo crear el contrato',
  'err.creationFailed': 'La creación del contrato falló',
  'err.connectFirst': 'Primero conecta tu billetera',
  'err.payYourself': 'No puedes pagarte a ti mismo: el comprador y el vendedor deben ser cuentas distintas.',
  'err.invalidBuyer': 'Identificador de comprador inválido',
  'err.noTokens': 'No hay tokens configurados',
  'err.noWalletAddress': 'No se encuentra la dirección de tu billetera. Vuelve a iniciar sesión.',
  'err.notAuthenticated': 'Sin autenticar',
  'err.rateUnavailable': 'Tipo de cambio no disponible',
  'pay.docTitle': 'Pagar contrato - {brand}',
  'pay.verifiedRedirectDashboard':
    'Tu pago fue verificado y el contrato ya está activo. Redirigiendo al panel.',
  'pay.verifiedRedirect': 'Tu pago fue verificado y el contrato ya está activo. Redirigiendo...',
  'pay.instantNoDelay': 'Inmediato (sin demora)',
  'pay.instantOnConfirm': 'Inmediato, al confirmar',
  'checkout.connectMyWallet': 'Conectar mi billetera',
  'checkout.releaseImmediate': 'Los fondos se liberarán inmediatamente después del pago',
  'checkout.createPayment': 'Crear pago',
  'checkout.payWithConnected': 'Pagar con la billetera conectada',
  'checkout.generateLink': 'Generar enlace de pago',
  'amount.paymentAmount': 'Monto del pago',
  'common.continue': 'Continuar',
  'common.back': 'Atrás',
  'common.skip': 'Omitir',
  'common.optional': 'Opcional',
  'terms.advancedOptions': 'Opciones avanzadas',
  'common.progress': 'Progreso',
  'pay.payButton': 'Pagar',
  'terms.arbiterAddress': 'Dirección de billetera del árbitro',
  'terms.arbiterHelp':
    'Opcional: reemplaza al resolutor de disputas. Déjalo en blanco para usar el predeterminado.',
  'review.nextBody':
    'Recibirás un código QR y un enlace para compartir. Cuando el comprador pague, los fondos quedan en depósito en garantía y se liberan a tu billetera automáticamente, sin que tengas que hacer nada más.',
  'send.title': 'Ahora envíaselo a tu comprador',
  'send.notNotified': 'Todavía no le avisamos a tu comprador',
  'send.notNotifiedBody':
    'No lo contactamos por ti. Envíale el enlace de abajo por correo, mensaje o como sueles escribirle: no puede pagar hasta que lo tenga.',
  'send.step1': 'Envíalo ahora',
  'send.step1Hint': 'Abre la app con el mensaje ya escrito.',
  'send.email': 'Correo',
  'send.whatsapp': 'WhatsApp',
  'send.text': 'Mensaje',
  'send.share': 'Compartir',
  'send.emailAria': 'Enviar la solicitud de pago por correo',
  'send.whatsappAria': 'Enviar la solicitud de pago por WhatsApp',
  'send.textAria': 'Enviar la solicitud de pago por mensaje de texto',
  'send.shareAria': 'Compartir la solicitud de pago',
  'send.step2': 'O pégalo tú mismo',
  'send.step2Hint':
    'Para cualquier app que no esté arriba. El mensaje incluye el monto, el motivo y el enlace.',
  'send.copyMessage': 'Copiar mensaje',
  'send.copied': 'Copiado',
  'send.copyLinkOnly': 'Copiar solo el enlace',
  'send.step3': 'En persona o en papel',
  'send.step3Hint': 'Código QR para escanear, o un PDF que puedes adjuntar o imprimir.',
  'send.qrCopied': 'QR copiado',
  'send.copyQr': 'Copiar imagen del QR',
  'send.downloadQr': 'Descargar QR',
  'send.preparing': 'Preparando…',
  'send.downloadPdf': 'Descargar PDF',
  'send.pdfHint':
    'Una solicitud de una página con el monto, el enlace y el QR, más una explicación del depósito en garantía para compradores que no hayan usado {brand} antes. No es una factura fiscal.',
  'send.done': 'Ya lo envié',
  'send.doneHint': '¿Todavía no lo enviaste? Copia el enlace antes de salir de esta pantalla.',
  'msg.subjectWithDesc': 'Solicitud de pago: {description}',
  'msg.subjectAmount': 'Solicitud de pago por {amount}',
  'msg.intro': 'Te solicité un pago de {amount} a través de {brand}.',
  'msg.whatFor': 'Motivo: {description}',
  'msg.payWithQr': 'Para pagar, abre el enlace de abajo o escanea el código QR adjunto:',
  'msg.payLink': 'Para pagar, abre este enlace:',
  'msg.escrowNote':
    'Tu pago queda retenido en depósito en garantía hasta la fecha acordada. Si algo sale mal, puedes abrir una disputa antes de esa fecha para congelar los fondos.',
  'emailPrompt.title': '¿Quieres notificaciones sobre tus contratos? (Opcional)',
  'emailPrompt.body':
    'Tu correo es privado y nunca se comparte. Agrégalo para recibir avisos sobre la actividad de tus contratos, disputas y vencimientos.',
  'emailPrompt.placeholder': 'Ingresa tu correo electrónico',
  'emailPrompt.submit': 'Agregar correo',
  'emailPrompt.saving': 'Guardando...',
  'emailPrompt.skip': 'Omitir',
  'emailPrompt.errRequired': 'Ingresa un correo electrónico',
  'emailPrompt.errInvalid': 'Ingresa un correo electrónico válido',
  'emailPrompt.errSave': 'No se pudo guardar el correo. Inténtalo de nuevo.',

  'emptyState.noMatchesFound': 'No se encontraron coincidencias',
  'emptyState.connectionTrouble': 'Problemas de conexión',
  'emptyState.noActiveContracts': 'No hay contratos activos',
  'emptyState.allCaughtUp': '¡Todo al día!',
  'emptyState.noCompletedContractsYet': 'Todavía no hay contratos completados',
  'emptyState.noDisputedContracts': 'No hay contratos en disputa',

  'expandableHash.copyToClipboard': 'Copiar al portapapeles',

  'mobileWalletPrompt.actionRequiredOnMobile': 'Acción requerida en el móvil',
  'mobileWalletPrompt.whenConnectingViaQr':
    'Al conectar con un código QR, la app de la billetera no se abre automáticamente para las siguientes acciones.',
  'mobileWalletPrompt.iVeCompletedThe': 'Ya completé la acción',
  'mobileWalletPrompt.cancel': 'Cancelar',

  'paymentQRModal.haveTheCustomerScan':
    'Pide al cliente que escanee este código QR para completar el pago',
  'paymentQRModal.paymentDetails': 'Detalles del pago',
  'paymentQRModal.amount': 'Monto:',
  'paymentQRModal.description': 'Descripción:',
  'paymentQRModal.paymentLinkForManual': 'Enlace de pago (para compartir manualmente)',
  'paymentQRModal.copy': 'Copiar',
  'paymentQRModal.howItWorks': 'Cómo funciona',
  'paymentQRModal.customerScansTheQr':
    'El cliente escanea el código QR con la cámara de su teléfono o su billetera',
  'paymentQRModal.theyLlBeTaken': 'Llegará a la página de pago con todos los datos ya completados',
  'paymentQRModal.customerConnectsTheirWallet':
    'El cliente conecta su billetera y confirma el pago',
  'paymentQRModal.paymentIsSecuredIn':
    'El pago queda protegido en depósito en garantía hasta la fecha de liberación',
  'paymentQRModal.youLlReceiveAn': 'Recibirás un correo cuando el pago se complete',
  'paymentQRModal.done': 'Listo',
  'paymentQRModal.inPersonPaymentQr': 'Código QR para pago en persona',

  'qRCodeModal.scanThisQrCode':
    'Escanea este código QR con tu billetera compatible con WalletConnect',
  'qRCodeModal.orCopyTheConnection': 'O copia el enlace de conexión:',
  'qRCodeModal.connectWithWalletconnect': 'Conectar con WalletConnect',
  'qRCodeModal.walletconnectQrCode': 'Código QR de WalletConnect',

  'statsCard.fromLastMonth': 'respecto al mes pasado',

  'tabs.tabs': 'Pestañas',

  'toast.close': 'Cerrar',

  'tokenGuide.buyUsdcWithCard': 'Compra USDC con tarjeta o banco',
  'tokenGuide.purchaseUsdcViaCoinbase':
    'Compra USDC con Coinbase usando tarjeta, transferencia bancaria o Apple Pay, sin comisiones sobre el USDC. Los fondos van directo a tu billetera conectada.',
  'tokenGuide.openingCoinbase': 'Abriendo Coinbase...',
  'tokenGuide.buyWithCoinbase': 'Comprar con Coinbase',
  'tokenGuide.checkYourNetwork': 'Verifica tu red:',
  'tokenGuide.yourWalletAddress': '2. Tu dirección de billetera:',
  'tokenGuide.fundYourWalletUsing': 'Agrega fondos a tu billetera con:',
  'tokenGuide.metamaskCoinbase': 'MetaMask/Coinbase:',
  'tokenGuide.majorExchanges': 'Exchanges principales:',
  'tokenGuide.coinbase': 'Coinbase',
  'tokenGuide.binance': 'Binance',
  'tokenGuide.kraken': 'Kraken',
  'tokenGuide.cryptoCom': 'Crypto.com',
  'tokenGuide.easycrypto': 'EasyCrypto',
  'tokenGuide.cashConversion': 'Conversión a efectivo:',
  'tokenGuide.important': 'Importante:',

  'walletInfo.yourWalletInformation': 'Datos de TU billetera',
  'walletInfo.walletAddress': 'Dirección de billetera:',
  'walletInfo.loading': 'Cargando...',
  'walletInfo.network': 'Red:',

  'walletRegistrationPrereq.prerequisites': 'Requisitos previos',
  'walletRegistrationPrereq.registerADifferentAddress': 'Registrar otra dirección',
  'walletRegistrationPrereq.firstTransactionsFree': 'Las primeras 100 transacciones son gratis',
  'walletRegistrationPrereq.registerMyWallet': 'Registrar mi billetera',
  'walletRegistrationPrereq.walletRegistration': 'Registro de billetera',

  'wizard.processing': 'Procesando...',

  'addFundsModal.transferFromAnotherWallet': 'Transferir desde otra billetera',
  'addFundsModal.orSendManuallyTo': 'O envía manualmente a esta dirección',
  'addFundsModal.back': 'Atrás',

  'arbiterPanel.readingTheArbiterSeat': 'Consultando el puesto de árbitro…',
  'arbiterPanel.arbiterSeat': 'Puesto de árbitro',
  'arbiterPanel.nominateAnArbiter': 'Nominar un árbitro',
  'arbiterPanel.namingTheSameAddress':
    'Nombrar la misma dirección que la otra parte lo designa de inmediato.',
  'arbiterPanel.thatIsNotA': 'Esa no es una dirección de billetera válida.',

  'connectPaymentStage.signInToProtect':
    'Inicia sesión para proteger tu pago: si alguna vez hay un problema, podrás abrir una disputa.',
  'connectPaymentStage.backToPaymentOptions': 'Volver a las opciones de pago',

  'contractAcceptance.contractAcceptedSuccessfully': '¡Contrato aceptado correctamente!',
  'contractAcceptance.contractBeingProcessed': 'Procesando el contrato',
  'contractAcceptance.amount': 'Monto:',
  'contractAcceptance.seller': 'Vendedor:',
  'contractAcceptance.description': 'Descripción:',
  'contractAcceptance.thisContractIsCurrently':
    'Este contrato se está procesando. Espera y actualiza la página para ver los cambios.',
  'contractAcceptance.processing': 'Procesando...',
  'contractAcceptance.makeTimeLockPayment': 'Realizar el pago con liberación programada',
  'contractAcceptance.yourBalance': 'Tu saldo:',
  'contractAcceptance.insufficientBalance': 'Saldo insuficiente:',

  'contractCard.blockchainError': 'Error de blockchain',
  'contractCard.buyer': 'Comprador:',
  'contractCard.payoutAt': 'Liberación:',
  'contractCard.viewContractOnExplorer': 'Ver el contrato en el explorador',

  'contractDetailsModal.timeRemaining': 'Tiempo restante',
  'contractDetailsModal.expires': 'Vence',
  'contractDetailsModal.participants': 'Participantes',
  'contractDetailsModal.pendingAcceptance': 'Pendiente de aceptación',
  'contractDetailsModal.contractInformation': 'Información del contrato',
  'contractDetailsModal.created': 'Creado',
  'contractDetailsModal.expiryDate': 'Fecha de vencimiento',
  'contractDetailsModal.expired': '⚠️ Vencido',
  'contractDetailsModal.contractAddress': 'Dirección del contrato',
  'contractDetailsModal.viewOnExplorer': 'Ver en el explorador ↗',
  'contractDetailsModal.fundingStatus': 'Estado de los fondos',
  'contractDetailsModal.funded': '✓ Con fondos',
  'contractDetailsModal.notFunded': '⚠️ Sin fondos',
  'contractDetailsModal.statusUnknown': '— Estado desconocido',
  'contractDetailsModal.state': 'Estado',
  'contractDetailsModal.disputeInformation': 'Información de la disputa',
  'contractDetailsModal.refundDetails': 'Detalles del reembolso:',
  'contractDetailsModal.refundPercentageNotYet':
    'Todavía no se determinó el porcentaje de reembolso',
  'contractDetailsModal.disputeResolutionNotes': 'Notas de la resolución de la disputa',
  'contractDetailsModal.resolutionDetails': 'Detalles de la resolución:',
  'contractDetailsModal.sharePaymentLink': 'Compartir el enlace de pago',
  'contractDetailsModal.sendThisLinkTo':
    'Envía este enlace al comprador para que pague de inmediato:',
  'contractDetailsModal.copied': '¡Copiado!',
  'contractDetailsModal.copy': 'Copiar',
  'contractDetailsModal.close': 'Cerrar',
  'contractDetailsModal.viewOnBlockchain': 'Ver en la blockchain ↗',
  'contractDetailsModal.copyContractId': 'Copiar el ID del contrato',
  'contractDetailsModal.contractDetails': 'Detalles del contrato',

  'contractList.tryAgain': 'Reintentar',
  'contractList.noContractsFound': 'No se encontraron contratos',
  'contractList.noContractsAreCurrently': 'Por ahora no hay contratos disponibles en el sistema.',
  'contractList.noContractsMatchYour': 'Ningún contrato coincide con tus filtros',
  'contractList.tryAdjustingYourFilter': 'Prueba ajustando los filtros.',
  'contractList.filterByStatus': 'Filtrar por estado',
  'contractList.allStatuses': 'Todos los estados',
  'contractList.pending': 'Pendiente',
  'contractList.active': 'Activo',
  'contractList.expired': 'Vencido',
  'contractList.disputed': 'En disputa',
  'contractList.resolved': 'Resuelto',
  'contractList.claimed': 'Reclamado',

  'contractListView.search': 'Buscar',
  'contractListView.status': 'Estado',
  'contractListView.clearFilters': 'Limpiar filtros',
  'contractListView.searchByDescriptionEmail': 'Busca por descripción, correo o dirección...',

  'createContract.includesFeeAmountMust':
    '(incluye la comisión de $1; el monto debe superar $1, o ser exactamente 0.001 para tus pruebas)',
  'createContract.yourLocalTime': '(Tu hora local)',
  'createContract.fundsWillBeReleased':
    'Los fondos se liberarán a esta hora (tu zona horaria local)',
  'createContract.requestPaymentFromBuyer': 'Solicitar el pago al comprador:',
  'createContract.searchFarcasterUserOr': 'Busca un usuario de Farcaster o ingresa un correo',
  'createContract.youCanSearchFor':
    'Puedes buscar usuarios de Farcaster o ingresar una dirección de correo',
  'createContract.briefDescriptionOfThe':
    'Breve descripción del acuerdo de depósito en garantía...',

  'customArbiterNotice.customDisputeResolver': 'Resolutor de disputas personalizado',
  'customArbiterNotice.thisContractUsesA':
    'Este contrato usa un árbitro no estándar elegido por el vendedor. Si surge una disputa, será él, y no el administrador de la aplicación, quien decida el resultado. Verifica que confías en este árbitro antes de pagar.',
  'customArbiterNotice.copyArbiterAddress': 'Copiar la dirección del árbitro',

  'disputeManagementModal.settleThisDispute': 'Resolver esta disputa',
  'disputeManagementModal.product': 'Producto:',
  'disputeManagementModal.discussion': 'Conversación',
  'disputeManagementModal.noDisputeEntriesYet': 'Todavía no hay mensajes en la disputa',
  'disputeManagementModal.adminNotes': 'Notas del administrador',
  'disputeManagementModal.submitYourSettlementFigure': 'Envía tu propuesta de acuerdo',
  'disputeManagementModal.whateverYouSubmitIs':
    'Lo que envíes es una oferta vinculante, no una propuesta.',
  'disputeManagementModal.youCanReviseYour':
    'Puedes cambiar tu cifra las veces que quieras hasta que dos coincidan.',
  'disputeManagementModal.yourCommentMaxCharacters': 'Tu comentario (máximo 160 caracteres)',
  'disputeManagementModal.settlementFigurePercentageTo':
    'Cifra del acuerdo: porcentaje para el comprador (0-100 %)',
  'disputeManagementModal.thisSettlesTheDispute': 'Esto resuelve la disputa.',
  'disputeManagementModal.cancel': 'Cancelar',
  'disputeManagementModal.sending': 'Enviando…',
  'disputeManagementModal.explainYourPositionIn': 'Explica tu posición en la disputa...',

  'disputeModal.raiseADispute': 'Abrir una disputa',
  'disputeModal.disputeReason': 'Motivo de la disputa',
  'disputeModal.suggestedSplitToBuyer': 'Reparto sugerido (% para el comprador)',
  'disputeModal.pleaseDescribeTheReason': 'Describe el motivo de esta disputa...',

  'enhancedContractCard.yourRole': 'Tu rol',
  'enhancedContractCard.funded': 'Con fondos',
  'enhancedContractCard.viewDetails': 'Ver detalles',

  'paymentActionPanel.connectedWallet': 'Billetera conectada',
  'paymentActionPanel.copied': 'Copiado',
  'paymentActionPanel.loading': 'Cargando…',
  'paymentActionPanel.addFundsToThis': 'Agregar fondos a esta billetera',
  'paymentActionPanel.payFromExternalWallet': 'Pagar desde una billetera externa',
  'paymentActionPanel.copyFullWalletAddress': 'Copiar la dirección completa de la billetera',

  'paymentMethodChoice.payByLinkQr': 'Pagar por enlace o código QR',
  'paymentMethodChoice.sendFromAnyWallet':
    'Envía desde cualquier billetera; no hace falta conectarla',

  'paymentProgress.paymentProgress': 'Progreso del pago',

  'paymentRequestIntro.paymentRequest': 'Solicitud de pago',
  'paymentRequestIntro.howThisWorks': 'Cómo funciona',

  'pendingContractCard.makePayment': 'Realizar el pago',

  'qrPaymentPanel.checkingForYourPayment': 'Buscando tu pago…',
  'qrPaymentPanel.creatingContract': 'Creando el contrato...',
  'qrPaymentPanel.openInWalletApp': 'Abrir en la app de la billetera',
  'qrPaymentPanel.tapToOpenYour': 'Toca para abrir tu app de billetera con el pago ya cargado',
  'qrPaymentPanel.payToAddress': 'Dirección de pago',
  'qrPaymentPanel.paymentInstructions': 'Instrucciones de pago',
  'qrPaymentPanel.checking': 'Comprobando...',
  'qrPaymentPanel.paymentConfirmed': '¡Pago confirmado!',

  'standingFiguresPanel.readingTheCurrentFigures': 'Leyendo las cifras actuales desde la cadena…',
  'standingFiguresPanel.theStandingFiguresCould':
    'No se pudieron leer las cifras vigentes desde la cadena. Enviar la tuya sigue siendo seguro (el contrato mismo comprueba si coinciden), pero no puedes ver qué cifra mantiene la otra parte.',
  'standingFiguresPanel.twoFiguresMatchedAnd':
    'Dos cifras coincidieron y los fondos se movieron en esa misma transacción. No hace falta nada más y aquí ya no se puede cambiar nada.',
  'standingFiguresPanel.figuresStandingOnChain': 'Cifras vigentes en la cadena',
  'standingFiguresPanel.anyTwoOfThese':
    'Si dos de estas cifras coinciden, la disputa se resuelve de inmediato. Enviar una cifra igual a alguna de las de abajo paga el depósito en esa misma transacción.',
  'standingFiguresPanel.nobodyHasSubmittedA': 'Todavía nadie ha enviado una cifra.',
  'standingFiguresPanel.noFigureSubmitted': 'Sin cifra enviada',
  'standingFiguresPanel.noArbiterIsSeated':
    'No hay árbitro designado, así que solo el comprador y el destinatario pueden resolverlo entre ellos.',

  'connectWalletEmbedded.emailSocialSignIn': 'Inicio de sesión con correo y redes no disponible',
  'connectWalletEmbedded.whichOurEmailSocial':
    ', del que depende nuestro inicio de sesión con correo o redes. Aún puedes conectarte con MetaMask, Coinbase Wallet o el QR de WalletConnect.',

  'emailCollection.settingUpYourAccount': 'Configurando tu cuenta...',

  'providerSelector.connectToGetStarted': 'Conéctate para empezar',
  'providerSelector.chooseHowYouD': 'Elige cómo quieres conectarte',
  'providerSelector.emailSocialLogin': 'Correo / redes sociales',
  'providerSelector.googleEmailOrMetamask': 'Google, correo o MetaMask',
  'providerSelector.connectWallet': 'Conectar billetera',
  'providerSelector.trustWalletCoinbaseAnd': 'Trust Wallet, Coinbase y más',

  'walletSignaturePrompt.checkYourWallet': 'Revisa tu billetera.',
  'walletSignaturePrompt.approveTheSignatureTo':
    'Aprueba la firma para mantener la sesión iniciada. No se mueven fondos ni se autoriza ningún pago.',
  'walletSignaturePrompt.thisOneMovesFunds': 'Esta sí mueve fondos.',

  'farcasterAuth.loadingConfiguration': 'Cargando la configuración...',
  'farcasterAuth.loadingFarcasterAuth': 'Cargando la autenticación de Farcaster...',
  'farcasterAuth.farcasterAuthData': 'Datos de autenticación de Farcaster:',
  'farcasterAuth.wallet': 'Billetera:',
  'farcasterAuth.fid': 'FID:',
  'farcasterAuth.username': 'Nombre de usuario:',
  'farcasterAuth.displayName': 'Nombre para mostrar:',
  'farcasterAuth.ensName': 'Nombre ENS:',
  'farcasterAuth.profileImage': 'Imagen de perfil:',
  'farcasterAuth.authToken': 'Token de autenticación:',

  'enhancedDashboard.demoModeActive': 'Modo demostración activo',
  'enhancedDashboard.youReViewingSample':
    'Estás viendo datos de ejemplo para explorar la interfaz.',
  'enhancedDashboard.exitDemo': 'Salir de la demostración',
  'enhancedDashboard.yourPaymentAgreements': 'Tus acuerdos de pago',
  'enhancedDashboard.refreshing': 'Actualizando...',
  'enhancedDashboard.refresh': 'Actualizar',
  'enhancedDashboard.exporting': 'Exportando...',
  'enhancedDashboard.exportReport': 'Exportar informe',
  'enhancedDashboard.active': 'Activos',
  'enhancedDashboard.pending': 'Pendientes',
  'enhancedDashboard.completed': 'Completados',
  'enhancedDashboard.totalValue': 'Valor total',
  'enhancedDashboard.searchPaymentAgreements': 'Buscar acuerdos de pago...',

  'progressChecklist.completeTheseStepsTo':
    'Completa estos pasos para aprovechar al máximo tu plataforma de depósito en garantía',
  'progressChecklist.progress': 'Progreso',
  'progressChecklist.congratulationsYouVeCompleted':
    '¡Felicidades! Has completado la lista de bienvenida.',
  'progressChecklist.dismissChecklist': 'Ocultar la lista',

  'tourProvider.skipTour': 'Saltar el recorrido',
  'tourProvider.back': 'Atrás',

  'transactionWalkthrough.letSCreateA': 'Vamos a crear una solicitud de pago de ejemplo',
  'transactionWalkthrough.weLlCreateA':
    'Crearemos una solicitud de pago de práctica para mostrarte cómo funciona la protección del depósito en garantía. Es solo para aprender: no se enviará ningún correo real.',
  'transactionWalkthrough.tip': 'Consejo:',
  'transactionWalkthrough.anEscrowPaymentProtects':
    'Un pago en depósito en garantía protege al comprador y al vendedor porque retiene los fondos de forma segura hasta que se confirma la entrega.',
  'transactionWalkthrough.buyerSEmailAddress': 'Correo electrónico del comprador',
  'transactionWalkthrough.theBuyerWillReceive':
    'El comprador recibirá un correo con las instrucciones de pago',
  'transactionWalkthrough.howThisWorks': '💡 Cómo funciona:',
  'transactionWalkthrough.theBuyerGetsA':
    '• El comprador recibe un enlace seguro para depositar los fondos',
  'transactionWalkthrough.fundsAreHeldSafely':
    '• Los fondos quedan retenidos de forma segura hasta que entregues',
  'transactionWalkthrough.onceDeliveredFundsAre':
    '• Una vez entregado, los fondos se liberan automáticamente a tu favor',
  'transactionWalkthrough.serviceProductDescription': 'Descripción del servicio o producto',
  'transactionWalkthrough.beSpecificThisHelps':
    'Sé específico: ayuda a evitar disputas más adelante',
  'transactionWalkthrough.paymentAmountUsd': 'Monto del pago (USD)',
  'transactionWalkthrough.yourProtection': '✅ Tu protección:',
  'transactionWalkthrough.fundsAreGuaranteedOnce':
    '• Los fondos están garantizados en cuanto paga el comprador',
  'transactionWalkthrough.noChargebacksOrPayment': '• Sin contracargos ni reversiones de pago',
  'transactionWalkthrough.automaticReleaseWhenTime':
    '• Liberación automática cuando vence el plazo',
  'transactionWalkthrough.deliveryWindow': 'Plazo de entrega',
  'transactionWalkthrough.hours': 'Horas',
  'transactionWalkthrough.minutes': 'Minutos',
  'transactionWalkthrough.afterThisTimeYou':
    'Pasado este plazo, puedes reclamar el pago aunque el comprador lo dispute',
  'transactionWalkthrough.timelineExample': '⏰ Ejemplo de cronología:',
  'transactionWalkthrough.buyerPays': '1. El comprador paga:',
  'transactionWalkthrough.fundsLockedInEscrow': 'Fondos bloqueados en el depósito en garantía',
  'transactionWalkthrough.youDeliver': '2. Tú entregas:',
  'transactionWalkthrough.timeExpires': '3. Vence el plazo:',
  'transactionWalkthrough.youCanClaimPayment': 'Puedes reclamar el pago',
  'transactionWalkthrough.paymentRequest': 'Solicitud de pago',
  'transactionWalkthrough.service': 'Servicio:',
  'transactionWalkthrough.amount': 'Monto:',
  'transactionWalkthrough.deliveryWindow2': 'Plazo de entrega:',
  'transactionWalkthrough.buyer': 'Comprador:',
  'transactionWalkthrough.nextStep': 'Siguiente paso:',
  'transactionWalkthrough.greatJobYouRe': '¡Bien hecho! Ya puedes recibir pagos reales',
  'transactionWalkthrough.youVeLearnedHow':
    'Ya sabes cómo funciona la protección del depósito en garantía. Ahora puedes crear solicitudes de pago reales con confianza.',
  'transactionWalkthrough.whatYouLearned': 'Lo que aprendiste:',
  'transactionWalkthrough.howToCreateSecure': '✅ Cómo crear solicitudes de pago seguras',
  'transactionWalkthrough.settingAppropriateDeliveryTimelines':
    '✅ Cómo fijar plazos de entrega adecuados',
  'transactionWalkthrough.howEscrowProtectionWorks':
    '✅ Cómo protege el depósito en garantía a ambas partes',
  'transactionWalkthrough.thePaymentAndDelivery': '✅ El proceso de pago y entrega',
  'transactionWalkthrough.createRealPaymentRequest': 'Crear una solicitud de pago real',
  'transactionWalkthrough.goToDashboard': 'Ir al panel',
  'transactionWalkthrough.skipTutorial': 'Saltar el tutorial',
  'transactionWalkthrough.previous': 'Anterior',
  'transactionWalkthrough.websiteDesignForSmall': 'Diseño de sitio web para una pequeña empresa...',

  'dashboardPage.dashboard': 'Panel',
  'dashboardPage.connectYourWalletTo': 'Conecta tu billetera para continuar.',
  'dashboardPage.youNeedToConnect': 'Necesitas conectar tu billetera para ver tus contratos.',
  'dashboardPage.yourContracts': 'Tus contratos.',
  'dashboardPage.manageEscrowContractsAnd':
    'Administra los contratos de depósito en garantía y consulta el historial de transacciones.',
  'dashboardPage.requestPayment': 'Solicitar un pago',
  'dashboardPage.manageWallet': 'Administrar la billetera',
  'dashboardPage.buyUsdc': 'Comprar USDC',
  'dashboardPage.dashboardHeader': 'Encabezado del panel',
  'dashboardPage.wallet': 'Billetera',
  'dashboardPage.contracts': 'Contratos',
};
