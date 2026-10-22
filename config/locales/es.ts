import type { PageCatalogue } from '@conduit-ucpi/whitelabel-sdk';
import type { pagesEn } from './en';

/**
 * Spanish (Latin American) for this deployment's own pages.
 *
 * Same register as the SDK catalogue, so the two do not read as different
 * voices on one screen: second person informal ("tú"), "billetera" rather than
 * "cartera", "pago protegido" for escrow ("escrow", and its translation "depósito
 * en garantía", is a licensed term in some jurisdictions).
 *
 * ⚠️ Written without a native reviewer. Have a native speaker from the target
 *    market read this before it goes in front of customers — COBRO's own site
 *    is the register to match.
 */
export const pagesEs: PageCatalogue<typeof pagesEn> = {
  'wl.badge': 'Pago protegido · liquidado en USDC sobre Base',
  'wl.dashboard': 'Panel',

  'wl.loadingTitle': 'Crear una solicitud de pago',
  'wl.loadingSubtitle': 'Preparando todo…',

  'wl.connectTitle': 'Comienza con {brand}',
  'wl.connectSubtitle':
    'Usamos una billetera para enviar y recibir tus pagos de forma segura. Inicia sesión con Google o con un correo electrónico y creamos una por ti.',

  'wl.createTitle': 'Solicitud de pago con liberación programada',
  'wl.createSubtitle':
    'Define un monto y una fecha de liberación. El comprador hace un pago protegido, las disputas siguen abiertas hasta esa fecha, y después los fondos pasan a ti automáticamente.',

  'wl.howTitle': 'Cómo funciona',
  'wl.howStep1': 'Tú defines el monto, la stablecoin y las condiciones de liberación',
  'wl.howStep2':
    'El comprador hace un pago protegido: los fondos quedan retenidos, todavía no se te envían',
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
    'Define un monto y una fecha de pago. El comprador hace un pago protegido y los fondos se liberan automáticamente en la fecha que ambos acordaron.',

  // /integrate — la guía de integración. El código, los nombres de campo y los
  // identificadores se quedan en la página sin traducir.
  'integrate.seo.title':
    'Guía de integración — Agrega un checkout con stablecoins a tu sitio web | {siteName}',
  'integrate.seo.description':
    'Agrega pagos protegidos con stablecoins a tu sitio web en minutos. Sin backend. Comisión del 1 %, protección de pagos y soporte para webhooks.',
  'integrate.seo.keywords':
    'integrar pagos cripto, widget de checkout USDC, integración de pagos con stablecoins, checkout con depósito en garantía, aceptar pagos cripto en tu sitio web',

  'integrate.copy': 'Copiar',
  'integrate.copied': 'Copiado al portapapeles',
  'integrate.yes': 'Sí',
  'integrate.no': 'No',
  'integrate.apiReference': 'Referencia de la API',
  'integrate.col.option': 'Opción',
  'integrate.col.parameter': 'Parámetro',
  'integrate.col.field': 'Campo',
  'integrate.col.type': 'Tipo',
  'integrate.col.required': 'Obligatorio',
  'integrate.col.default': 'Valor predeterminado',
  'integrate.col.description': 'Descripción',
  'integrate.col.meaning': 'Significado',

  'integrate.hero.ariaLabel': 'Portada',
  'integrate.hero.eyebrow': 'Guía de integración',
  'integrate.hero.title': 'Agrega un checkout con stablecoins a tu sitio web.',
  'integrate.hero.subtitle':
    'Incluye un script, configura tu billetera y empieza a aceptar pagos. No necesitas integrar un backend.',
  'integrate.hero.setup': 'Configuración en 3 pasos',
  'integrate.hero.noBackend': 'Sin backend',
  'integrate.hero.webhooks': 'Soporte para webhooks',
  'integrate.hero.liveDemo': 'Demo en vivo',

  'integrate.quick.eyebrow': 'Inicio rápido',
  'integrate.quick.title': 'Tres pasos para empezar a aceptar pagos.',
  'integrate.quick.subtitle':
    'No necesitas integrar un backend. Agrega el script, configura tu billetera y crea botones de pago.',
  'integrate.quick.step1.title': 'Incluye el script',
  'integrate.quick.step1.body': 'Agrega esta línea justo antes de la etiqueta de cierre {tag}.',
  'integrate.quick.step2.title': 'Inicializa con tu billetera',
  'integrate.quick.step2.body': 'Configura el checkout con la dirección de tu billetera de comercio.',
  'integrate.quick.step3.title': 'Agrega botones de pago',
  'integrate.quick.step3.body': 'Crea botones que abran el checkout.',

  'integrate.modes.eyebrow': 'Modos de visualización',
  'integrate.modes.title': 'Elige cómo se muestra el checkout.',
  'integrate.modes.tab.popup': 'Ventana emergente',
  'integrate.modes.tab.redirect': 'Redirección completa',
  'integrate.modes.popup.title': 'Ventana emergente',
  'integrate.modes.popup.body':
    'Se abre en una ventana emergente centrada. Ideal para interrumpir lo menos posible la experiencia de compra.',
  'integrate.modes.redirect.title': 'Redirección completa',
  'integrate.modes.redirect.body':
    'Redirige a la página de checkout. Ideal para dispositivos móviles y flujos de un solo producto.',

  'integrate.examples.eyebrow': 'Ejemplos',
  'integrate.examples.title': 'Patrones de integración comunes.',
  'integrate.examples.tab.basic': 'Pago básico',
  'integrate.examples.tab.extended': 'Protección extendida',
  'integrate.examples.tab.custom': 'Monto personalizado',
  'integrate.examples.tab.usdt': 'Pago en USDT',
  'integrate.examples.basic.title': 'Pago básico de un producto',
  'integrate.examples.basic.body':
    'Checkout sencillo para un solo producto, con seguimiento del pedido.',
  'integrate.examples.extended.title': 'Protección extendida para el comprador',
  'integrate.examples.extended.body':
    'Define un periodo de protección más largo para servicios o artículos de alto valor.',
  'integrate.examples.custom.title': 'Monto personalizado (donaciones, propinas)',
  'integrate.examples.custom.body': 'Deja que el usuario ingrese su propio monto antes del checkout.',
  'integrate.examples.usdt.title': 'Acepta USDT en lugar de USDC',
  'integrate.examples.usdt.body': 'Cambia el token predeterminado en cada pago.',

  'integrate.reference.ariaLabel': 'Referencia de configuración',
  'integrate.reference.eyebrow': 'Referencia',
  'integrate.reference.title': 'Opciones de configuración.',
  'integrate.init.sellerAddress': 'La dirección de tu billetera para recibir pagos',
  'integrate.init.baseUrl': 'URL base de la página de checkout',
  'integrate.init.brand':
    'El id de marca de un socio white-label: el checkout muestra su marca y los pagos se le atribuyen',
  'integrate.init.webhookUrl': 'URL del webhook para la verificación de pagos',
  'integrate.init.webhookSecret':
    'Secreto HMAC opcional para firmar los webhooks. Se define en el navegador, así que confirma con /api/results antes de entregar el pedido',
  'integrate.init.tokenSymbol': "'USDC' o 'USDT'",
  'integrate.init.expiryDays': 'Días hasta la liberación automática al vendedor',
  'integrate.init.mode': "'popup' o 'redirect'",
  'integrate.init.onSuccess': 'Callback cuando el pago se completa',
  'integrate.init.onError': 'Callback cuando el pago falla',
  'integrate.init.onCancel': 'Callback cuando el usuario cancela',
  'integrate.open.amount': "Monto del pago (p. ej., '50.00')",
  'integrate.open.description': 'Descripción del pago (máx. 160 caracteres)',
  'integrate.open.orderId': 'Tu ID interno de pedido o transacción',
  'integrate.open.email': 'Correo electrónico del cliente',
  'integrate.open.tokenSymbol': 'Cambia el token predeterminado para este pago',
  'integrate.open.expiryDays': 'Cambia el vencimiento predeterminado',
  'integrate.open.webhookUrl': 'Cambia la URL del webhook para este pago',
  'integrate.open.metadata': 'Metadatos personalizados que se incluyen',

  'integrate.server.ariaLabel': 'Pagos desde el servidor',
  'integrate.server.eyebrow': 'Desde el servidor',
  'integrate.server.title': 'Sin script: prepara, fondea, liquida.',
  'integrate.server.intro':
    'Si tienes un backend, puedes omitir el script de checkout. Llama a {prepare} con las condiciones; la respuesta te dice a dónde va el dinero, cómo fondearlo, un enlace que abre el pago para tu cliente y la solicitud exacta que crea el pago protegido una vez recibido el dinero. Envía con ella tu código de acceso gratis (obtén el tuyo en /myAPIAccessCode, toma un minuto).',
  'integrate.server.step1.title': 'Prepara el pago',
  'integrate.server.step1.body':
    'Los montos están en las unidades base del token (1 USDC = 1000000). El vendedor y el comprador pueden ser billeteras o correos electrónicos; el comprador es quien puede abrir una disputa.',
  'integrate.server.step2.title': 'Recibe el pago',
  'integrate.server.step2.body':
    'Envía a tu cliente {payLink} (o un código QR de ese enlace): abre exactamente este pago, y puede pagar con billetera, tarjeta o transferencia. O fondea tú mismo {escrowAddress} usando {fundByTransfer}.',
  'integrate.server.step3.title': 'Liquida',
  'integrate.server.step3.body':
    'Cuando el dinero haya llegado, envía sin cambios la solicitud del bloque {settle} de la respuesta: {settleRequest}. Crea el pago protegido y devuelve un recibo firmado. Si la envías demasiado pronto, te dice cuánto tiene la dirección y no gasta nada; si nunca la envías, un pago fondeado se activa de todos modos en unos 30 minutos.',
  'integrate.server.step3.reference': 'Cada campo está descrito en la {link}.',

  'integrate.webhook.ariaLabel': 'Integración con webhooks',
  'integrate.webhook.eyebrow': 'Integración con el backend',
  'integrate.webhook.title': 'Entrega de pedidos basada en webhooks.',
  'integrate.webhook.intro':
    'Recibe un aviso cuando se completa un pago y luego confírmalo tú mismo. El webhook dice que algo pasó; {results} es la fuente de verdad, y es un endpoint público que puedes consultar desde tu servidor sin clave y sin configuración.',
  'integrate.webhook.step1.title': 'Configura el SDK con un webhook',
  'integrate.webhook.step1.body':
    'El SDK se encarga automáticamente de la verificación y del envío del webhook. No necesitas llamadas manuales a {fetch}.',
  'integrate.webhook.step2.title': 'Confírmalo y luego entrega',
  'integrate.webhook.step2.body':
    'Pregunta a {results} qué pasó realmente antes de enviar cualquier cosa. Lee el mismo registro que consulta el checkout, así que confirma el monto, la moneda y a quién se pagó; y una solicitud que nunca llega no cambia nada.',
  'integrate.webhook.step3.title': 'Verifica un pago tú mismo',
  'integrate.webhook.step3.body':
    'La misma consulta, por sí sola. Pública, sin autenticación, sin clave que solicitar: dale un {contractid} y te dice qué se pagó y a quién. Útil para conciliaciones, para soporte y para volver a procesar cualquier cosa que un webhook no haya entregado.',
  'integrate.webhook.step3.openapi':
    'El esquema completo de la solicitud y la respuesta está publicado como documento OpenAPI: {link}. Apunta tus herramientas de OpenAPI a él para generar un cliente.',
  'integrate.webhook.step3.response': 'Respuesta:',
  'integrate.webhook.payloadTitle': 'Payload del webhook',

  'integrate.results.queryTitle': 'Campos de consulta',
  'integrate.results.query.contractid':
    'Coincidencia exacta con el id de contrato que devuelve el checkout',
  'integrate.results.query.chainAddress': 'Coincidencia exacta con la dirección de pago',
  'integrate.results.query.chainAddresses':
    'La forma por lotes. Se combinan con OR dentro de la lista, así que una sola consulta completa una página entera de contratos en lugar de una llamada por cada uno. No distingue mayúsculas y minúsculas, porque las direcciones leídas de los logs de eventos están en minúsculas mientras que los registros pueden tener checksum',
  'integrate.results.query.sellerWalletId':
    'Coincide con el vendedor O el comprador, sin distinguir mayúsculas y minúsculas: así listas todo lo que se pagó a tu billetera',
  'integrate.results.queryNote':
    'Todos son opcionales, pero se requiere al menos uno: un cuerpo vacío devuelve 400. Si usas varios campos, se combinan con AND.',
  'integrate.results.responseTitle': 'Campos de la respuesta',
  'integrate.results.response.contractid': 'El id del contrato',
  'integrate.results.response.chainAddress':
    'La dirección de pago. Se asigna cuando el comprador abre la página de pago, así que su presencia no indica si pagó: para eso, lee state',
  'integrate.results.response.sellerWalletId':
    'Quién recibe el pago. Compáralo con tu propia billetera',
  'integrate.results.response.amount':
    'En las unidades de currency (abajo), así que divide entre 1,000,000 si es una moneda micro',
  'integrate.results.response.description': 'El concepto del pago',
  'integrate.results.response.currency':
    'p. ej., microUSDC. No existe un campo currencySymbol aparte',
  'integrate.results.response.state':
    'Si el dinero llegó. ACTIVE, DISPUTED, RESOLVED, CLAIMED y COMPLETED significan que sí; trata cualquier otro valor como aún no pagado, incluidos los estados que no reconozcas',
  'integrate.results.response.chainId': 'p. ej., 8453 para Base',
  'integrate.results.response.createdate': 'Segundos Unix en que se creó el registro',
  'integrate.results.response.maturity':
    'Segundos Unix en que se desbloquean los fondos. Distinto de createdate',
  'integrate.results.note':
    '{countZero} significa que no existe ese pago: trátalo como no pagado, nunca como un error. También puedes consultar por {chainAddress}, o por {sellerWalletId} para listar todo lo que se pagó a tu billetera. Los montos en una moneda con prefijo {micro} están en millonésimas, así que divide entre 1,000,000. {state} es el ciclo de vida del pago, no un aprobado/rechazado: un pago completado aparece como {claimed}, así que verifica los estados de error en lugar de buscar un único valor de éxito.',

  'integrate.verified.ariaLabel': 'Datos verificados',
  'integrate.verified.eyebrow': 'Verificación',
  'integrate.verified.title': 'Qué significan los datos verificados.',
  'integrate.verified.verified': 'El backend confirmó que el pago existe en la blockchain',
  'integrate.verified.state': 'Los fondos están bloqueados en el contrato de pago',
  'integrate.verified.seller': 'Coincide con tu billetera (verificado por el SDK)',
  'integrate.verified.amount': 'Coincide con el monto esperado (verificado por el SDK)',
  'integrate.verified.chainAddress':
    'Dirección del contrato en la blockchain (registro permanente)',
  'integrate.verified.note':
    'Una vez que recibes datos verificados, puedes entregar el pedido con seguridad. El SDK ya confirmó todo on-chain.',

  'integrate.platform.ariaLabel': 'Funciones y seguridad',
  'integrate.platform.eyebrow': 'Plataforma',
  'integrate.platform.title': 'Protección integrada en cada transacción.',
  'integrate.platform.buyer.label': 'Protección al comprador',
  'integrate.platform.buyer.1': 'Fondos retenidos en un smart contract de pago',
  'integrate.platform.buyer.2': 'Liberación diferida (7 días por defecto)',
  'integrate.platform.buyer.3': 'Mecanismo de disputas',
  'integrate.platform.buyer.4': 'Árbitro independiente para desempatar',
  'integrate.platform.gas.label': 'Sin costos de gas',
  'integrate.platform.gas.1': 'La plataforma cubre todos los costos de la blockchain',
  'integrate.platform.gas.2': 'Los usuarios pagan una comisión de plataforma del 1 %',
  'integrate.platform.gas.3': 'Pago mínimo: $1.001',
  'integrate.platform.gas.4': 'Comisión incluida en el monto del pago',
  'integrate.platform.security.label': 'Seguridad del lado del cliente',
  'integrate.platform.security.1': 'Los usuarios firman con su propia billetera',
  'integrate.platform.security.2': 'Sin custodia de los fondos de los usuarios',
  'integrate.platform.security.3': 'HTTPS obligatorio',
  'integrate.platform.security.4': 'Smart contracts de código abierto',
  'integrate.platform.tokens.label': 'Soporte para varios tokens',
  'integrate.platform.tokens.1': 'USDC (predeterminado)',
  'integrate.platform.tokens.2': 'USDT (opcional)',
  'integrate.platform.tokens.3': 'Red Base (L2 de Ethereum)',
  'integrate.platform.tokens.4': 'Bajos costos de transacción',

  'integrate.flow.ariaLabel': 'Experiencia del cliente',
  'integrate.flow.eyebrow': 'Flujo de principio a fin',
  'integrate.flow.1.title': 'El cliente hace clic en pagar',
  'integrate.flow.1.desc': 'Abre el checkout en ventana emergente o por redirección.',
  'integrate.flow.2.title': 'Conecta su billetera y paga',
  'integrate.flow.2.desc': 'El cliente firma la transacción.',
  'integrate.flow.3.title': 'El SDK verifica on-chain',
  'integrate.flow.3.desc': 'Verificación automática en la blockchain.',
  'integrate.flow.4.title': 'Webhook enviado al backend',
  'integrate.flow.4.desc': 'Tu servidor recibe los datos verificados.',
  'integrate.flow.5.title': 'Pedido entregado',
  'integrate.flow.5.desc': 'Envía la mercancía, entrega el producto, manda el recibo.',

  'integrate.faq.eyebrow': 'Preguntas frecuentes',
  'integrate.faq.title': 'Preguntas frecuentes.',
  'integrate.faq.tokens.q': '¿Qué tokens se aceptan?',
  'integrate.faq.tokens.a': 'Actualmente {currencies} en la red Base (Layer 2 de Ethereum).',
  'integrate.faq.fees.q': '¿Cuáles son las comisiones?',
  'integrate.faq.fees.a':
    'Comisión de plataforma del 1 % por transacción. Sin costos de alta ni cuotas mensuales. El pago mínimo es de $1.001. La plataforma cubre los costos de gas.',
  'integrate.faq.payout.q': '¿Cuánto tarda en llegarme el dinero?',
  'integrate.faq.payout.a':
    'Los fondos se liberan automáticamente al terminar el periodo de vencimiento (7 días por defecto), salvo que el comprador abra una disputa. Puedes personalizar el periodo de vencimiento en cada pago.',
  'integrate.faq.refunds.q': '¿Los compradores pueden obtener reembolsos?',
  'integrate.faq.refunds.a':
    'Los compradores pueden abrir una disputa dentro del periodo de protección. Nuestro equipo de administración revisa las disputas y puede liberar los fondos a cualquiera de las partes según la evidencia.',
  'integrate.faq.wallet.q': '¿Necesito una billetera cripto?',
  'integrate.faq.wallet.a':
    'Sí, necesitas la dirección de una billetera para recibir pagos. Recomendamos MetaMask, Coinbase Wallet o cualquier billetera compatible con Web3. Los compradores pueden usar correo electrónico + inicio de sesión social (creamos billeteras integradas para ellos).',
  'integrate.faq.secure.q': '¿Es seguro?',
  'integrate.faq.secure.a':
    'Sí. Los pagos están protegidos por smart contracts inmutables en la blockchain de Base. Los usuarios firman las transacciones con sus propias billeteras. Todas las transacciones son auditables on-chain. Se requiere HTTPS en todas las integraciones.',
  'integrate.faq.chargebacks.q': '¿Y los contracargos?',
  'integrate.faq.chargebacks.a':
    'Las transacciones con criptomonedas son irreversibles: no hay contracargos como con las tarjetas de crédito. El sistema de pagos protegidos ampara al comprador mediante el mecanismo de disputas durante el periodo de protección.',

  'integrate.cta.ariaLabel': 'Comienza',
  'integrate.cta.title': '¿Listo para integrar?',
  'integrate.cta.body':
    'Prueba la demo interactiva o empieza a integrarlo directamente en tu sitio.',
  'integrate.cta.demo': 'Ver demo en vivo',
  'integrate.cta.merchant': 'Información para comercios',
  'integrate.footer.howItWorks': 'Cómo funciona',
  'integrate.footer.faq': 'Preguntas frecuentes',
  'integrate.footer.shopify': 'Integración con Shopify',
  'integrate.footer.whiteLabel': 'Socios white-label',
  'integrate.footer.source': 'Código fuente',

  // /api-keys
  'apiKeys.title': 'Claves de API',
  'apiKeys.intro':
    'Deja que tu propio servidor cree enlaces de pago, por ejemplo para enviarlos a tus clientes por WhatsApp. Mantén tus claves en secreto: cualquiera que tenga una puede crear solicitudes de pago a tu nombre.',
  'apiKeys.signIn.eyebrow': 'Claves de API',
  'apiKeys.signIn.title': 'Inicia sesión para gestionar tus claves de API.',
  'apiKeys.signIn.body': 'Una clave de API permite que tu propio servidor cree enlaces de pago para tus clientes.',
  'apiKeys.wallet.title': 'Adónde van tus pagos',
  'apiKeys.wallet.body': 'Los pagos solicitados con estas claves se depositan en esta billetera cuando se liberan.',
  'apiKeys.wallet.copy': 'Copiar dirección',
  'apiKeys.wallet.link': 'Ve a tu billetera para ver tu saldo y retirar tus tokens',
  'apiKeys.wallet.none': 'Tu cuenta aún no tiene billetera. Termina de configurar tu cuenta antes de crear una clave.',
  'apiKeys.new.title': 'Nueva clave: {label}',
  'apiKeys.new.warning': 'Copia esta clave ahora. No podrás volver a verla.',
  'apiKeys.new.copy': 'Copiar clave',
  'apiKeys.new.dismiss': 'Ya la copié, ocultar la clave',
  'apiKeys.create.title': 'Crear una clave',
  'apiKeys.create.labelAria': 'Nombre de la clave',
  'apiKeys.create.placeholder': 'p. ej. Bot de WhatsApp',
  'apiKeys.create.help': 'Un nombre para distinguir tus claves. Hasta 60 caracteres.',
  'apiKeys.create.submit': 'Crear clave',
  'apiKeys.create.brand': 'Los enlaces de pago creados con esta clave llevarán la marca {brand}.',
  'apiKeys.create.submitting': 'Creando…',
  'apiKeys.list.title': 'Tus claves',
  'apiKeys.list.empty': 'Aún no tienes claves de API.',
  'apiKeys.list.retry': 'Reintentar',
  'apiKeys.list.meta': 'Creada {created} · Último uso {lastUsed}',
  'apiKeys.list.never': 'nunca',
  'apiKeys.list.brand': 'Los enlaces de pago creados con esta clave llevan la marca {brand}',
  'apiKeys.revoke.button': 'Revocar',
  'apiKeys.revoke.confirm': '¿Revocar esta clave?',
  'apiKeys.revoke.yes': 'Sí, revocar',
  'apiKeys.revoke.busy': 'Revocando…',
  'apiKeys.revoke.cancel': 'Cancelar',
  'apiKeys.using.title': 'Cómo usar tu clave',
  'apiKeys.using.body':
    'Envía a tu cliente el {payLink} de la respuesta. {amount} está en unidades base de USDC (20000000 = 20 USDC), y {expiry} es cuándo se cierra el periodo de disputa (0 = inmediato).',
  'apiKeys.using.exampleDescription': 'Pedido #123',
  'apiKeys.using.withNewKey':
    'Este ejemplo contiene tu nueva clave, así que puedes ejecutarlo tal cual. No lo compartas: deja de mostrarse cuando ocultes la clave.',
  'apiKeys.using.withEnvKey':
    'Define {variable} con tu clave en tu servidor y ejecuta esto tal cual. Si no tienes una clave, créala arriba.',
  'apiKeys.using.reference': 'Referencia completa de la API',
  'apiKeys.copy': 'Copiar',
  'apiKeys.copied': 'Copiado',
  'apiKeys.error.session': 'Tu sesión expiró. Vuelve a iniciar sesión para gestionar tus claves de API.',
  'apiKeys.error.limit': 'Ya tienes 10 claves. Revoca una primero.',
  'apiKeys.error.noWallet':
    'Primero termina de configurar tu cuenta: necesita una billetera antes de poder tener claves de API.',
  'apiKeys.error.gone': 'Esa clave ya no existe. Es posible que ya se haya revocado.',
  'apiKeys.error.create': 'No se pudo crear la clave',
  'apiKeys.error.load': 'No se pudieron cargar tus claves de API',
  'apiKeys.error.revoke': 'No se pudo revocar la clave',
  // /myAPIAccessCode — el código de acceso gratis para la API de pagos y el servidor MCP.
  'accessCode.title': 'Tu código de acceso gratis',
  'accessCode.intro':
    'Tu código de acceso permite que tus propias apps y asistentes de IA usen Stabledrop por ti. Es gratis, dura 90 días y muestra que aceptaste nuestros términos.',
  'accessCode.signIn.eyebrow': 'Código de acceso gratis',
  'accessCode.signIn.title': 'Obtén tu código de acceso gratis',
  'accessCode.signIn.body': 'Inicia sesión y es tuyo. Es gratis y toma un minuto.',
  'accessCode.current.title': 'Tu código',
  'accessCode.current.meta': 'Empieza por {prefix}… · Funciona hasta el {expires}',
  'accessCode.current.none': 'Todavía no tienes un código.',
  'accessCode.get.first': 'Obtener mi código de acceso',
  'accessCode.get.again': 'Obtener un código nuevo',
  'accessCode.get.replaces': 'Obtener un código nuevo hace que el actual deje de funcionar.',
  'accessCode.get.busy': 'Obteniendo tu código…',
  'accessCode.new.title': 'Este es tu código de acceso',
  'accessCode.new.warning': 'Cópialo ahora: por tu seguridad, solo lo mostramos una vez.',
  'accessCode.new.copy': 'Copiar código',
  'accessCode.new.dismiss': 'Ya lo copié',
  'accessCode.use.title': 'Cómo usar tu código',
  'accessCode.use.assistant': 'En un asistente de IA',
  'accessCode.use.assistantBody': 'Agrega Stabledrop a tu asistente con tu código. En Claude Code, ejecuta esto:',
  'accessCode.use.assistantOther': 'En otros asistentes, agrega la dirección {url} con el encabezado {header}.',
  'accessCode.use.connector': 'En Claude.ai o ChatGPT, agrega un conector personalizado con esta dirección: {url}',
  'accessCode.use.app': 'En tu propia app',
  'accessCode.use.appBody': 'Envía tu código en cada llamada como el encabezado {header}.',
  'accessCode.use.guide': 'Guía paso a paso',
  'accessCode.stop.button': 'Hacer que este código deje de funcionar',
  'accessCode.stop.confirm': '¿Hacer que tu código deje de funcionar?',
  'accessCode.stop.yes': 'Sí, detenerlo',
  'accessCode.stop.busy': 'Deteniendo…',
  'accessCode.stop.cancel': 'Cancelar',
  'accessCode.error.terms': 'Actualizamos nuestros términos. Cierra sesión, vuelve a iniciarla para verlos y luego obtén tu código.',
  'accessCode.error.noWallet': 'Primero termina de configurar tu cuenta: necesita una billetera antes de poder tener un código.',
  'accessCode.error.get': 'No pudimos obtener tu código ahora. Inténtalo de nuevo.',
  'accessCode.error.load': 'No pudimos cargar tu código ahora.',
  'accessCode.error.stop': 'No pudimos detener tu código ahora. Inténtalo de nuevo.',
  'accessCode.retry': 'Intentar de nuevo',
};
