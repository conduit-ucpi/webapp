import type { FaqContent } from './types';

/**
 * The /faq page in Spanish (Latin American), shown when the locale is es: a Spanish-language brand,
 * or ?lang=es. Same register as config/locales/es.ts: tú, "billetera", "pago protegido" (never
 * "escrow" or "depósito en garantía").
 *
 * ⚠️ Machine-translated, without a native reviewer. Have a native speaker from the target market
 *    read it before it goes in front of customers.
 */
export const faqEs: FaqContent = {
  seo: {
    title: "Preguntas frecuentes sobre pagos protegidos | Stabledrop",
    description: "Respuestas a tus preguntas sobre pagos protegidos, pagos en USDC, disputas, seguridad, cobros para comercios, contracargos, cumplimiento PCI y cómo nuestros pagos protegidos cuidan a compradores y vendedores.",
    keywords: "preguntas frecuentes pagos protegidos, pagos USDC, resolución de disputas, seguridad de contratos inteligentes, protección de pagos cripto, pagos para comercios, pagos con stablecoins, sin contracargos, sin PCI, comercio de alto riesgo",
  },
  hero: { eyebrow: 'Preguntas frecuentes', heading: 'Preguntas frecuentes.' },
  sections: [
    {
      id: "basic-functionality",
      eyebrow: "Funcionamiento básico",
      heading: "Cómo funcionan los pagos protegidos.",
      items: [
        {
          id: "what-happens-if-the-seller",
          q: "¿Qué pasa si el vendedor nunca entrega mi artículo? ¿De verdad recupero mi dinero?",
          a: "Sí. Si el vendedor no entrega, abres una disputa antes de la fecha de pago escribiendo un comentario que explique el problema y proponiendo un monto de reembolso. Esto congela los fondos de inmediato. El vendedor recibe una notificación por correo electrónico y puede responder con sus propios comentarios y su propuesta de reembolso desde el panel. Cuando ambas partes acuerdan el mismo monto de reembolso, la disputa se resuelve automáticamente y los fondos se pagan en consecuencia. Si no logran ponerse de acuerdo, los fondos permanecen congelados hasta que lleguen a un acuerdo.",
        },
        {
          id: "how-do-i-know-the",
          q: "¿Cómo sé que el equipo de administración no va a robar mi dinero sin más?",
          a: "El código del contrato inteligente está verificado y publicado en la blockchain. Puedes ver que solo el vendedor o el administrador pueden reclamar los fondos, y que el administrador solo puede asignar los fondos en disputa al comprador o al vendedor, nunca a sí mismo. El código impide el robo. Además, nuestro sistema de gestión de disputas permite que las disputas se resuelvan automáticamente cuando ambas partes están de acuerdo, sin intervención del administrador.",
        },
        {
          id: "who-exactly-makes-dispute-decisions",
          q: "¿Quién toma exactamente las decisiones sobre las disputas y qué calificaciones tiene?",
          a: "Las disputas usan nuestro sistema de gestión de disputas. Cuando abres una disputa, propones un monto de reembolso y explicas tu postura. La otra parte puede responder con su propia propuesta. Ambos pueden ver el historial de comentarios y propuestas en su panel. Cuando ambos ingresan el mismo monto de reembolso, la disputa se resuelve automáticamente y los fondos se distribuyen en consecuencia. Todos los detalles en [nuestra página de política de disputas](/dispute-policy).",
        },
      ],
    },
    {
      id: "timing-and-process",
      eyebrow: "Plazos y proceso",
      heading: "Plazos y cancelación.",
      items: [
        {
          id: "how-long-do-i-have",
          q: "¿Cuánto tiempo tengo para recibir mi artículo antes de que el dinero pase al vendedor?",
          a: "El vendedor fija una fecha de vencimiento al crear el contrato, y tú la aceptas antes de fondearlo. Si no te convence el plazo, pídele que cree un nuevo contrato con otra fecha de vencimiento. Tú decides qué aceptas.",
        },
        {
          id: "can-i-cancel-if-i",
          q: "¿Puedo cancelar si me equivoqué o cambié de opinión?",
          a: "Una vez que hayas fondeado un contrato, puedes abrir una disputa con una solicitud de reembolso. Escribe tu motivo y propón un reembolso del 100% si te equivocaste. El vendedor recibirá una notificación y podrá aceptar tu monto de reembolso, lo que permite una resolución automática. Esto protege a los vendedores que quizás ya enviaron la mercancía y, al mismo tiempo, les da a los compradores una vía de resolución.",
        },
        {
          id: "what-if-i-want-to",
          q: "¿Y si quiero cancelar antes de que el comprador haya depositado el dinero?",
          a: "Esta función está en nuestra lista de desarrollo. Por ahora, simplemente dile al comprador que el contrato no es válido; sería insensato de su parte fondearlo después de que se lo hayas dicho.",
        },
      ],
    },
    {
      id: "technical-issues",
      eyebrow: "Problemas técnicos",
      heading: "Confiabilidad de la plataforma y casos especiales.",
      items: [
        {
          id: "what-if-the-seller-loses",
          q: "¿Y si el vendedor pierde el acceso a su correo electrónico o a su billetera?",
          a: "Si la cuenta de alguien se ve comprometida, abre una disputa para evitar que personas malintencionadas accedan a los fondos.",
        },
        {
          id: "what-happens-if-your-website",
          q: "¿Qué pasa si su sitio web se cae o su empresa cierra?",
          a: "Todos los contratos seguirán su curso, ya que están en la blockchain. Usamos Google Cloud para un alojamiento extremadamente confiable. Nuestra política es resolver todas las disputas pendientes antes de cualquier posible cierre.",
        },
        {
          id: "what-if-theres-a-dispute",
          q: "¿Y si hay una disputa después de que su empresa ya no exista?",
          a: "Todas las disputas pendientes se resolverían antes de cualquier cierre. Técnicamente, los contratos pertenecen al comprador; nuestro servicio simplemente facilita crear y administrar dinero programable.",
        },
      ],
    },
    {
      id: "costs-and-payments",
      eyebrow: "Costos y pagos",
      heading: "Comisiones y opciones de pago.",
      items: [
        {
          id: "what-does-this-actually-cost",
          q: "¿Cuánto me cuesta esto realmente?",
          a: "Nuestro servicio cobra una comisión del 1% por transacción. El sistema funciona en USDC, y ofrecemos herramientas para obtener USDC si lo necesitas, pero no tenemos control sobre los costos de conversión de terceros en tu ubicación. Nosotros cubrimos todas las comisiones de gas de la blockchain: los usuarios no pagan gas al usar el servicio.",
        },
        {
          id: "what-if-i-want-to-make",
          q: "¿Y si quiero hacer pagos parciales o en cuotas?",
          a: "Por ahora, tendrías que crear varios contratos independientes para las distintas etapas del pago.",
        },
      ],
    },
    {
      id: "disputes-and-problems",
      eyebrow: "Disputas y problemas",
      heading: "Cuando algo sale mal.",
      items: [
        {
          id: "how-long-do-i-have-to",
          q: "¿Cuánto tiempo tengo que esperar para que se resuelva una disputa?",
          a: "Una vez en disputa, los fondos quedan congelados, así que estás protegido. Con la función 'Gestionar disputa' de tu panel, tú y el vendedor pueden intercambiar comentarios y propuestas de reembolso. La disputa se resuelve automáticamente en cuanto ambos acuerdan el mismo monto de reembolso. No hay un plazo fijo: la resolución ocurre al instante cuando llegan a un acuerdo.",
        },
        {
          id: "what-stops-people-from-creating",
          q: "¿Qué impide que la gente cree contratos falsos para estafar a otros?",
          a: "Si alguien resulta ser un estafador y tu mercancía no llega, puedes abrir una disputa en cualquier momento hasta la fecha de vencimiento y recuperar tu dinero por falta de entrega.",
        },
        {
          id: "what-if-someone-disputes-in",
          q: "¿Y si alguien abre una disputa de mala fe para obtener cosas gratis?",
          a: "Los vendedores deben guardar pruebas del empaque y del envío. Cuando se abre una disputa, la investigación con las empresas de mensajería revelará la verdad sobre la entrega.",
        },
        {
          id: "what-if-the-item-arrives",
          q: "¿Y si el artículo llega pero es completamente distinto de lo que se describió?",
          a: "El sistema ofrece una infraestructura de pagos que no requiere confianza. Corresponde al comprador y al vendedor acordar si un artículo es \"como se describió\" y cuál debe ser la resolución. Una resolución común es que el vendedor acepte la devolución de la mercancía y reembolse al comprador una vez que el artículo esté de vuelta con el vendedor.",
        },
        {
          id: "what-if-i-need-to",
          q: "¿Y si necesito abrir una disputa fuera del horario de atención?",
          a: "Una vez en disputa, los fondos quedan congelados, así que estás seguro. Puedes gestionar la disputa desde tu panel en cualquier momento: ver el historial de comentarios y propuestas de reembolso, y agregar los tuyos. El sistema funciona 24/7, y las disputas se resuelven automáticamente en el momento en que ambas partes acuerdan un monto de reembolso.",
        },
        {
          id: "what-if-the-seller-goes",
          q: "¿Y si el vendedor deja de responder después de que pago, pero antes del vencimiento?",
          a: "Puedes abrir una disputa en cualquier momento antes del vencimiento haciendo clic en 'Abrir disputa' en tu panel. Escribe un comentario que explique la falta de comunicación y propón un reembolso total. El vendedor recibirá una notificación y podrá responder desde su panel. Si acepta tu monto de reembolso, la disputa se resuelve automáticamente.",
        },
      ],
    },
    {
      id: "international-and-legal-issues",
      eyebrow: "Temas internacionales y legales",
      heading: "Transacciones transfronterizas y preguntas legales.",
      items: [
        {
          id: "what-about-international-transactions-and",
          q: "¿Qué pasa con las transacciones internacionales y las leyes de los distintos países?",
          a: "Este es un servicio de transferencia protegida de dinero, no un servicio de resolución legal de disputas. Los procedimientos legales formales son entre el comprador y el vendedor. Una vez que se acuerda una resolución (con o sin intervención legal), los fondos se asignan según ese acuerdo.",
        },
        {
          id: "what-if-expensive-items-need",
          q: "¿Y si los artículos costosos necesitan una resolución legal formal?",
          a: "Técnicamente, los contratos son propiedad del comprador. Si el comprador y el vendedor no logran llegar a un acuerdo, los procedimientos legales formales entre ellos son su responsabilidad. La conclusión de ese proceso le indica a nuestro equipo de administración cómo asignar los fondos en disputa.",
        },
      ],
    },
    {
      id: "privacy-and-security",
      eyebrow: "Privacidad y seguridad",
      heading: "Datos, auditorías de código y transparencia.",
      items: [
        {
          id: "what-information-do-you-store",
          q: "¿Qué información guardan sobre mí?",
          a: "Nuestra política de privacidad está en [nuestra página de política de privacidad](/privacy-policy). En la blockchain pública: monto, ID de la billetera del comprador, ID de la billetera del vendedor, fecha de vencimiento y descripción. Guardamos las direcciones de correo electrónico en servidores protegidos porque son necesarias para prestar el servicio, pero estos datos no forman parte de ninguna interfaz pública.",
        },
        {
          id: "what-if-theres-a-bug",
          q: "¿Y si hay un error en el código del contrato inteligente?",
          a: "Todos los contratos usan el mismo código verificado disponible en la blockchain. Verificamos nuestro código con servicios de seguridad reconocidos.",
        },
        {
          id: "how-can-i-verify-for",
          q: "¿Cómo puedo verificar por mi cuenta que no pueden robar mi dinero?",
          a: "¿Quieres verificar nuestro código tú mismo? Copia el contrato verificado del explorador de blockchain y pégalo en herramientas como MythX, pregúntale a ChatGPT \"¿puede el administrador robar fondos de este contrato?\" o pide a cualquier desarrollador de Solidity que lo revise. El código está ampliamente comentado para dejar claras las limitaciones del administrador.\n\nUsamos [SolidityScan](https://solidityscan.com/quickscan) para auditar nuestros contratos, y tú también puedes hacerlo. Te pedirá que selecciones una blockchain (estamos en Base) y luego que pegues la dirección de un contrato. Te dará un informe de auditoría completo con una puntuación de 94%: 'Great'.",
          showContractAddress: true,
        },
        {
          id: "is-your-code-open-source",
          q: "¿Su código es de código abierto para que pueda revisarlo yo mismo?",
          a: "¡Sí! Toda la plataforma Conduit UCPI es de código abierto y está disponible en [github.com/conduit-ucpi](https://github.com/conduit-ucpi). Esto incluye nuestros contratos inteligentes, servicios de backend y aplicaciones de frontend. Puedes revisar cada línea de código, ver nuestro historial de desarrollo y verificar que los contratos desplegados coincidan con el código fuente publicado. Esta transparencia es central en nuestro compromiso con transacciones seguras que no requieren confianza.",
        },
        {
          id: "is-there-any-reputation-tracking",
          q: "¿Hay algún sistema de reputación o de opiniones?",
          a: "No. Este sistema existe para eliminar la necesidad de confianza en las transacciones, porque ambas partes están protegidas: se acabó eso de \"pagar y esperar que salga bien\".",
        },
      ],
    },
    {
      id: "support-and-documentation",
      eyebrow: "Soporte y documentación",
      heading: "Ayuda y orientación práctica.",
      items: [
        {
          id: "what-if-i-need-help",
          q: "¿Y si necesito ayuda con problemas técnicos que no son disputas?",
          a: "Hay soporte técnico disponible escribiendo a [info@stabledrop.me](mailto:info@stabledrop.me)",
        },
        {
          id: "can-i-get-proper-receiptsinvoices",
          q: "¿Puedo obtener recibos o facturas formales para transacciones comerciales?",
          a: "Suena como una gran mejora. Escríbenos a [info@stabledrop.me](mailto:info@stabledrop.me) para conversar sobre lo que necesitas.",
        },
        {
          id: "what-if-my-payment-gets",
          q: "¿Y si mi pago se queda atascado y no llega al contrato?",
          a: "El sistema lee el estado del contrato directamente de la blockchain, donde se guardan los fondos. El código de nuestro contrato hace imposible que una transacción pase de \"fondos depositados\" de vuelta a \"esperando pago\".",
        },
        {
          id: "what-about-timesensitive-purchases-like",
          q: "¿Y las compras con fecha límite, como entradas para conciertos?",
          a: "Este sistema es ideal para compras con fecha límite. Puedes fijar la fecha de vencimiento al hacer el acuerdo entre comprador y vendedor para asegurar la entrega en la fecha que necesitas.",
        },
        {
          id: "what-if-i-accidentally-send",
          q: "¿Y si por error envío dinero al contrato equivocado o ingreso un monto incorrecto?",
          a: "No te quedas atrapado con los errores: abre una disputa de inmediato con un comentario que explique el error y solicita un reembolso del 100%. Cuando la otra parte vea tu explicación y acepte el monto del reembolso, la disputa se resolverá automáticamente y se te devolverán los fondos.",
        },
        {
          id: "how-long-should-i-wait",
          q: "¿Cuánto debo esperar antes de abrir una disputa si necesito tiempo para inspeccionar artículos complejos?",
          a: "Este sistema ofrece una infraestructura de protección de pagos para que las transacciones no requieran confianza. Los acuerdos sobre los periodos de inspección y los criterios de aceptación los negocian el comprador y el vendedor entre ellos.",
        },
      ],
    },
    {
      id: "getting-started",
      eyebrow: "Primeros pasos",
      heading: "Tu primera transacción.",
      items: [
        {
          id: "this-sounds-complicated-with-crypto",
          q: "Esto suena complicado con cripto y billeteras: ¿me puedes explicar qué tengo que hacer exactamente?",
          a: "1. Consigue USDC siguiendo las instrucciones de nuestra pantalla de administración de billetera. 2. Pídele a tu vendedor que entre a nuestro sitio web, inicie sesión y haga clic en 'solicitar pago' (ingresa tu correo electrónico, el monto, la fecha de pago y una descripción). 3. Recibes un correo electrónico, inicias sesión para ver el pago pendiente, revisas los detalles y lo aceptas. ¡Eso es todo!",
        },
        {
          id: "what-is-usdc-and-why",
          q: "¿Qué es USDC y por qué no puedo pagar simplemente con dinero normal?",
          a: "USDC es una criptomoneda stablecoin que siempre vale 1:1 con el USD. La necesitas para usar los contratos inteligentes en blockchain que hacen posible este servicio, y que te dan garantías matemáticas de protección del pago que los sistemas de pago tradicionales no pueden ofrecer.",
        },
        {
          id: "im-nervous-about-using-cryptocurrency",
          q: "Me pone nervioso usar criptomonedas: ¿no es esto riesgoso y complicado?",
          a: "Llevas décadas usando dinero electrónico: el saldo de tu banco son solo números en una computadora, no efectivo físico. USDC funciona igual, salvo que opera sobre infraestructura pública en lugar de sistemas bancarios privados. Las principales diferencias prácticas: 1) Puedes verificar las transacciones tú mismo en la blockchain, 2) Nadie puede congelar ni revertir tus pagos sin tu consentimiento, 3) Funciona 24/7 en todo el mundo, sin horarios bancarios ni demoras de las transferencias internacionales. La parte \"cripto\" es solo la tecnología que hace posibles estas garantías: no necesitas entender la blockchain, igual que no necesitas entender las redes SWIFT para hacer transferencias bancarias normales.",
        },
        {
          id: "how-do-i-authenticate-is",
          q: "¿Cómo inicio sesión? ¿Es otra cuenta más con usuario y contraseña?",
          a: "Iniciar sesión es sencillo: elige tu cuenta de Google o ingresa tu correo electrónico y recibe un código de 6 dígitos para escribirlo en pantalla.",
        },
        {
          id: "what-does-it-cost-to",
          q: "¿Cuánto cuesta conseguir USDC?",
          a: "No controlamos los exchanges de criptomonedas, así que el costo depende del exchange que uses y de sus condiciones. Si este servicio te resulta útil, considera mantener algo de dinero en USDC para futuras transacciones.",
        },
        {
          id: "what-if-i-make-a",
          q: "¿Qué pasa si me equivoco durante la configuración?",
          a: "Si el vendedor ingresa un correo electrónico equivocado, no recibirás las notificaciones. ¿El monto está mal? Simplemente ignóralo y pídele que cree una nueva solicitud. Si por alguna razón fondeas el contrato equivocado, abre una disputa y lo resolveremos.",
        },
      ],
    },
    {
      id: "why-use-this",
      eyebrow: "Por qué usarlo",
      heading: "¿Es para ti?",
      items: [
        {
          id: "why-not-just-negotiate-directly",
          q: "¿Por qué no negociar directamente con el vendedor en lugar de usar su servicio?",
          a: "La ventaja clave es que los vendedores no reciben el dinero hasta que estés satisfecho, así que tienen un incentivo para resolver cualquier problema. También protege a los vendedores, porque les muestra que están tratando con un comprador que tiene los fondos listos.",
        },
        {
          id: "whats-the-smallest-purchase-amount",
          q: "¿Cuál es el monto de compra mínimo para el que esto tiene sentido?",
          a: "Ten en cuenta las comisiones del exchange para conseguir USDC más nuestra comisión del 1% por transacción. Esto funciona bien para compras en las que no puedes reunirte en persona o necesitas protección adicional. Y recuerda: si un vendedor se niega a usar este sistema por razones poco convincentes, probablemente acabas de evitar una estafa.",
        },
        {
          id: "is-this-mainly-for-cryptosavvy",
          q: "¿Esto es principalmente para expertos en cripto o lo puede usar cualquier consumidor?",
          a: "Está diseñado para personas comunes. La mayor fricción es conseguir USDC la primera vez; estamos trabajando en formas más fáciles de hacerlo. Si sabes copiar y pegar direcciones, no deberías tener problemas. Prueba nuestra opción de prueba gratuita de $0.001 para ver cómo funciona sin riesgo.",
        },
        {
          id: "can-i-use-this-for",
          q: "¿Puedo usarlo para compras desde otras ciudades o países?",
          a: "¡Sí! Esto permite transacciones seguras con vendedores de cualquier lugar, ya que estás protegido sin importar la ubicación geográfica. No estás limitado a vendedores locales con los que puedas reunirte en persona.",
        },
      ],
    },
    {
      id: "system-reliability",
      eyebrow: "Confiabilidad del sistema",
      heading: "Disponibilidad e infraestructura.",
      items: [
        {
          id: "what-if-your-website-crashes",
          q: "¿Qué pasa si su sitio web se cae o hay problemas técnicos?",
          a: "El sistema funciona en Google Cloud con despliegue automatizado y fue construido por ingenieros con experiencia (ex principals de Skyscanner con más de 50 años de experiencia combinada). Lo más importante: tus transacciones existen en la blockchain de forma independiente de nuestros servidores; son tuyas y, en teoría, podrías usar otras herramientas para acceder a ellas si fuera necesario.",
        },
      ],
    },
    {
      id: "for-merchants-getting-started",
      eyebrow: "Para comercios - Primeros pasos",
      heading: "Empieza a aceptar pagos en minutos.",
      items: [
        {
          id: "what-do-i-need-to",
          q: "¿Qué necesito para empezar a aceptar pagos como comercio?",
          a: "Una dirección de correo electrónico. Eso es todo. Sin solicitud, sin estados de cuenta bancarios, sin plan de negocios, sin periodo de espera. Puedes procesar tu primera transacción en menos de 10 minutos.",
        },
        {
          id: "why-is-there-no-approval",
          q: "¿Por qué no hay proceso de aprobación?",
          a: "Los procesadores tradicionales toman la custodia de tu dinero, así que necesitan evaluar tu riesgo. Nosotros nunca tocamos tus fondos: van del comprador al contrato inteligente y de ahí a ti. Sin custodia, no hay evaluación de riesgo.",
        },
        {
          id: "why-is-there-no-credit",
          q: "¿Por qué no hay verificación de crédito ni verificación del negocio?",
          a: "Los procesadores que retienen fondos necesitan saber que no vas a desaparecer debiéndoles dinero. A nosotros no nos pueden dejar con la deuda porque nunca retenemos nada.",
        },
        {
          id: "why-no-reserve-requirements",
          q: "¿Por qué no hay requisitos de reserva?",
          a: "Las reservas existen para que los procesadores puedan cubrir los contracargos si tú no puedes. Nuestro sistema no tiene contracargos: las disputas se resuelven antes de que los fondos salgan del contrato de pago. No hay nada contra lo que reservar.",
        },
        {
          id: "why-no-monthly-minimums-or",
          q: "¿Por qué no hay mínimos mensuales ni requisitos de volumen?",
          a: "Esos requisitos existen para que los comercios pequeños compensen el costo de evaluación de riesgo del procesador. Nosotros no tenemos costo de evaluación de riesgo.",
        },
        {
          id: "what-if-i-sell-cbd",
          q: "¿Qué pasa si vendo CBD, suplementos, contenido para adultos, armas de fuego u otras categorías de alto riesgo?",
          a: "No restringimos categorías de productos. Los procesadores tradicionales rechazan a los comercios de alto riesgo porque temen los contracargos y el escrutinio regulatorio. Nuestro sistema no tiene contracargos y no tomamos decisiones sobre tus fondos, así que no necesitamos vigilar lo que vendes.",
        },
        {
          id: "can-my-merchant-account-be",
          q: "¿Pueden congelar o cancelar mi cuenta de comercio?",
          a: "No podemos congelar fondos que no están bajo nuestra custodia. Tu dinero está en el contrato de pago (donde solo tú y el comprador pueden reclamarlo) o en tu billetera. No hay ninguna \"cuenta\" que cancelar: cada transacción es su propio contrato.",
        },
      ],
    },
    {
      id: "for-merchants-how-it-works",
      eyebrow: "Para comercios - Cómo funciona",
      heading: "Pagos, disputas y contracargos.",
      items: [
        {
          id: "what-happens-when-a-customer",
          q: "¿Qué pasa cuando un cliente me paga como comercio?",
          a: "Los fondos van a un contrato inteligente (no a ti ni a nosotros). En la fecha de pago acordada, los fondos se liberan a tu billetera automáticamente. Si antes de esa fecha hay una disputa, los fondos quedan congelados hasta que tú y el comprador acuerden una solución.",
        },
        {
          id: "how-is-this-different-from",
          q: "¿En qué se diferencia esto de un contracargo?",
          a: "**Contracargos:**\n\n- El cliente llama a su banco\n- El banco te quita el dinero de inmediato\n- Pagas una comisión de $15-25 sin importar el resultado\n- Tienes 7-10 días para reunir pruebas\n- El banco decide\n- Puedes perder incluso con pruebas\n- El cliente tiene hasta 180 días para disputar\n\n**Este sistema:**\n\n- El cliente abre una disputa en la app\n- Los fondos se congelan (pero no te los quitan)\n- Negocias directamente con el cliente\n- Cuando ambos acuerdan un reparto, los fondos se liberan automáticamente\n- Sin comisión\n- Ningún tercero decide tu destino",
        },
        {
          id: "what-if-a-buyer-disputes",
          q: "¿Qué pasa si un comprador abre una disputa de mala fe?",
          a: "Puede congelar los fondos, pero no puede obtenerlos sin tu acuerdo. Un comprador que recibió los productos y aun así abre una disputa queda atascado: no recupera el dinero y tú no cobras, hasta que alguien ceda. Guarda tus comprobantes de envío.",
        },
        {
          id: "what-does-my-customer-see",
          q: "¿Qué ve mi cliente durante el checkout?",
          a: "Tu cliente inicia sesión con su correo electrónico o con una red social. Si no tiene billetera, se crea una automáticamente, pero sigue siendo suya (puede exportar sus claves en cualquier momento). Si no tiene USDC ni USDT, le damos enlaces para comprar. Confirma el pago, lo firma en su dispositivo y listo. Sin configurar billeteras, sin comisiones de gas, sin necesidad de saber de cripto.",
        },
      ],
    },
    {
      id: "understanding-stablecoins",
      eyebrow: "Entender las stablecoins",
      heading: "USDC, USDT y cómo pasarlas a dinero tradicional.",
      items: [
        {
          id: "which-stablecoins-can-customers-pay",
          q: "¿Con qué stablecoins pueden pagar los clientes?",
          a: "USDC o USDT. Ambas están vinculadas 1:1 al USD. USDT tiene mayor circulación a nivel mundial; USDC tiene costos de conversión a dinero tradicional más claros a través de Coinbase.",
        },
        {
          id: "what-if-my-customer-doesnt",
          q: "¿Qué pasa si mi cliente no tiene USDC ni USDT?",
          a: "El checkout ofrece enlaces para comprar stablecoins directamente. Los clientes pueden comprar con tarjeta o transferencia bancaria a través de servicios de compra integrados.",
        },
        {
          id: "do-my-customers-need-a",
          q: "¿Mis clientes necesitan una billetera cripto?",
          a: "No. A los clientes que no tienen billetera se les crea una automáticamente durante el checkout. Siguen siendo sus dueños: pueden exportar sus claves privadas cuando quieran. Es su billetera; nosotros solo hacemos que la configuración sea invisible.",
        },
        {
          id: "what-if-a-customer-already",
          q: "¿Y si un cliente ya tiene una billetera?",
          a: "Puede conectarla en su lugar. Funciona de cualquiera de las dos formas.",
        },
        {
          id: "who-pays-the-blockchain-transaction",
          q: "¿Quién paga las comisiones de las transacciones en la blockchain?",
          a: "Nosotros. Las comisiones de gas en Base son fracciones de centavo, pero normalmente los usuarios tendrían que tener ETH para pagarlas. Eliminamos eso: tus clientes nunca necesitan tocar ETH. Pagan en USDC o USDT, y listo.",
        },
        {
          id: "what-about-price-volatility-with",
          q: "¿Y la volatilidad de precio de las criptomonedas?",
          a: "USDC y USDT son stablecoins: están vinculadas 1:1 al USD. $100 USDC siempre valen $100. Esto no es Bitcoin.",
        },
        {
          id: "how-do-i-turn-stablecoins",
          q: "¿Cómo convierto las stablecoins en dinero real?",
          a: "Coinbase convierte USDC a USD 1:1 sin comisión para conversiones de menos de $5 millones al mes. Para USDT, la mayoría de los exchanges cobran una comisión pequeña (normalmente 0.1-0.5%), o puedes cambiar primero USDT a USDC. De cualquier forma, tu costo efectivo es cercano a solo la comisión del 1% por transacción.",
        },
        {
          id: "how-do-i-handle-accounting",
          q: "¿Cómo manejo la contabilidad de los pagos con stablecoins?",
          a: "USDC y USDT equivalen 1:1 al USD, así que el valor de la transacción es sencillo. Cada transacción tiene un registro en la blockchain con fecha y hora, monto y direcciones. Trata la conversión a dinero tradicional (a moneda fiat) como un evento aparte. Habla con tu contador sobre cómo declarar ingresos en cripto en tu jurisdicción.",
        },
        {
          id: "what-about-taxes-on-stablecoin",
          q: "¿Y los impuestos sobre los pagos con stablecoins?",
          a: "En la mayoría de las jurisdicciones, recibir stablecoins como pago se trata igual que recibir USD: es un ingreso en el momento en que se recibe. La conversión a dinero tradicional puede tener implicaciones fiscales según el momento y cualquier variación de valor. Esto no es asesoría fiscal; consulta a un profesional.",
        },
      ],
    },
    {
      id: "security-and-fraud-protection",
      eyebrow: "Seguridad y protección contra fraude",
      heading: "Los pagos push eliminan el fraude de raíz.",
      items: [
        {
          id: "why-is-fraud-lower-with",
          q: "¿Por qué hay menos fraude con los pagos con stablecoins?",
          a: "Los pagos con tarjeta son \"pull\": entregas credenciales que permiten al procesador del comercio extraer los fondos. Los pagos con stablecoins son \"push\": el comprador envía activamente los fondos. No hay ningún secreto compartido que robar. Un estafador necesitaría acceso a la billetera de tu cliente, no solo a un número impreso en un pedazo de plástico. No se intercambian credenciales, no se guarda nada, no hay nada que se pueda clonar ni robar con phishing.",
        },
        {
          id: "what-does-lower-fraud-mean",
          q: "¿Qué significa menos fraude para mí como comercio?",
          a: "El fraude con tarjeta no presente ronda el 0.5% del volumen de transacciones. Tú lo pagas: ya sea directamente con pérdidas, o indirectamente con comisiones del procesador que incluyen el riesgo de fraude en el precio. Con los pagos push, esa categoría de fraude no existe. Los compradores deben tener los fondos y autorizar activamente la transacción.",
        },
        {
          id: "where-does-payment-security-actually",
          q: "¿Dónde ocurre realmente la seguridad del pago?",
          a: "Con los pagos con stablecoins, toda la seguridad ocurre en el dispositivo del cliente en el momento en que conecta su billetera y firma la transacción. No hay número de tarjeta que guardar, ni base de datos de credenciales que vulnerar, ni datos sensibles circulando por servidores. No podríamos filtrar los datos de pago de tus clientes aunque quisiéramos: nunca los tenemos.",
        },
        {
          id: "does-this-mean-i-dont",
          q: "¿Significa esto que no necesito cumplir con PCI?",
          a: "No hay datos de tarjeta, así que no hay nada con qué cumplir. Sin auditorías anuales, sin cuestionarios, sin requisitos de seguridad para manejar datos que nunca tocas.",
        },
        {
          id: "what-about-fraud-protection-services",
          q: "¿Y los servicios de protección contra fraude?",
          a: "No los necesitas. Los pagos push desde billeteras propiedad del usuario eliminan el problema de raíz. No hay número de tarjeta robado que usar, ni credenciales que robar con phishing, ni base de datos del procesador que vulnerar. No necesitas detección de fraude con IA, controles de velocidad, verificación de dirección, 3D Secure ni nada de eso.",
        },
      ],
    },
    {
      id: "regulatory-and-custody",
      eyebrow: "Regulación y custodia",
      heading: "Sin custodia por diseño.",
      items: [
        {
          id: "dont-escrow-services-require-banking",
          q: "¿Los servicios de pago protegido no requieren licencias bancarias y aprobación regulatoria?",
          a: "Los servicios tradicionales sí, porque un tercero guarda tu dinero. Nosotros no somos custodios. Los fondos van directamente de la billetera del comprador a un contrato inteligente que pertenece a ambas partes. Nunca guardamos, controlamos ni tenemos acceso a los fondos. El código del contrato determina lo que pasa. El administrador solo puede asignar los fondos en disputa entre el comprador y el vendedor, nunca a nadie más.",
        },
        {
          id: "what-about-mica-or-money",
          q: "¿Y MiCA o las leyes de transmisión de dinero?",
          a: "Regulaciones como MiCA se aplican a los proveedores de servicios de criptoactivos que custodian fondos o actúan como intermediarios. Nosotros somos infraestructura. Los contratos inteligentes se ejecutan en una blockchain pública. Los usuarios interactúan directamente con sus propios contratos. Si nuestro sitio web desapareciera mañana, tus contratos se seguirían ejecutando.",
        },
        {
          id: "but-you-resolve-disputes-doesnt",
          q: "Pero ustedes resuelven disputas, ¿eso no los convierte en custodios?",
          a: "No. Resolver disputas significa que podemos asignar los fondos entre el comprador y el vendedor cuando no logran ponerse de acuerdo. No podemos extraer fondos para nosotros ni para ningún tercero. El código del contrato lo hace imposible: no es que vaya contra nuestras políticas, es imposible. Cualquiera puede comprobarlo leyendo el contrato verificado en la blockchain.",
        },
        {
          id: "what-if-a-regulator-disagrees",
          q: "¿Y si un regulador no está de acuerdo con su interpretación?",
          a: "La interpretación regulatoria varía según la jurisdicción. Pero la arquitectura es realmente distinta de la de los servicios con custodia. Si una jurisdicción específica decide que la infraestructura de contratos inteligentes sin custodia requiere licencia, esa es una conversación sobre esa jurisdicción: no cambia la realidad técnica de cómo funciona el sistema.",
        },
        {
          id: "what-if-regulations-change-and",
          q: "¿Y si cambian las regulaciones y los obligan a cerrar?",
          a: "Tus transacciones en curso se completan de todos modos. Los contratos inteligentes existen en la blockchain, no en nuestros servidores. Si los reguladores nos cerraran mañana, todos los contratos activos seguirían funcionando: los fondos se liberan en la fecha programada y las disputas se resuelven cuando las partes se ponen de acuerdo.",
        },
      ],
    },
    {
      id: "trust-and-platform-risk",
      eyebrow: "Confianza y riesgo de plataforma",
      heading: "Verifica, no confíes.",
      items: [
        {
          id: "how-do-i-know-you",
          q: "¿Cómo sé que no me van a robar el dinero como comercio?",
          a: "No tienes que confiar en nosotros. El código del contrato inteligente está verificado en la blockchain: cualquiera puede leerlo. El código demuestra que los fondos solo pueden ir al comprador o al vendedor. Pégalo en ChatGPT y pregunta \"¿puede el administrador robar mis fondos?\". La respuesta es, demostrablemente, no.",
        },
        {
          id: "what-if-your-company-shuts",
          q: "¿Y si su empresa cierra mientras tengo transacciones activas?",
          a: "Tus transacciones en curso se completan automáticamente: son contratos inteligentes, no nuestros servidores. Si desapareciéramos mañana, los fondos se te liberan en la fecha programada, o se quedan congelados en disputa hasta que tú y el comprador lo resuelvan directamente.",
        },
      ],
    },
    {
      id: "comparison-to-traditional-payment-processing",
      eyebrow: "Comparación con el procesamiento de pagos tradicional",
      heading: "Cómo se compara.",
      items: [
        {
          id: "what-fees-am-i-actually",
          q: "¿Qué comisiones me ahorro realmente en comparación con los procesadores de pago tradicionales?",
          a: "- Comisiones de intercambio (~2%): eliminadas\n- Comisiones por transacción ($0.25-0.30): eliminadas\n- Comisiones por contracargo ($15-25 por disputa): eliminadas\n- Reserva móvil (20-30% retenido): eliminada\n- Mínimos mensuales: eliminados\n- Costos de cumplimiento PCI: eliminados\n- Servicios de protección contra fraude: eliminados",
        },
        {
          id: "whats-the-catch-with-this",
          q: "¿Cuál es la trampa de este sistema de pagos?",
          a: "Tus clientes necesitan USDC o USDT. Esa es la verdadera barrera. Redujimos la fricción (billeteras automáticas, enlaces de compra, transacciones sin gas), pero si tus clientes no tienen stablecoins y no las van a conseguir, esto no te sirve.",
        },
        {
          id: "why-wouldnt-i-just-keep",
          q: "¿Por qué no seguir usando Stripe o los procesadores tradicionales?",
          a: "Si Stripe te funciona, sigue usándolo. Esto es para comercios que: venden en categorías de alto riesgo que son rechazadas o cerradas, han sufrido congelamientos de cuenta o retenciones de fondos, quieren llegar a quienes tienen cripto, quieren un canal de pago de respaldo que no se pueda congelar, o están cansados de la economía de los contracargos.",
        },
        {
          id: "can-i-test-the-merchant",
          q: "¿Puedo probar primero el sistema de pagos para comercios?",
          a: "Sí. Crea una transacción de prueba por $0.001: no se cobra la comisión, así que puedes ver cómo funciona sin riesgo.",
        },
        {
          id: "can-i-pay-someone-or",
          q: "¿Puedo pagarle a alguien, o indicar quién puede abrir una disputa, usando solo su correo electrónico?",
          a: "Sí. Siempre que un pago pida una billetera — la del vendedor que recibe el pago, o la del comprador que puede abrir una disputa — puedes dar un correo electrónico en su lugar. Lo convertimos en la billetera que pertenece a esa persona, y le creamos una si nunca ha iniciado sesión; el mismo correo siempre se convierte en la misma billetera. Esto funciona al crear una solicitud de pago en el sitio, a través de la API y a través de las herramientas MCP que usa un agente.",
        },
        {
          id: "a-payment-was-sent-to",
          q: "Me enviaron un pago a mi correo electrónico. ¿Cómo recibo el dinero?",
          a: "Inicia sesión con ese correo electrónico, con un código por correo o con Google. La billetera vinculada a él ya tiene el pago. Desde la página Billetera puedes enviar los fondos a donde quieras, o exportar la clave de la billetera para usarla en otro lugar.",
        },
      ],
    },
  ],
  more: {
    eyebrow: '¿Necesitas más ayuda?',
    heading: '¿Todavía tienes preguntas?',
    body: "Escribe a nuestro equipo de soporte a [info@stabledrop.me](mailto:info@stabledrop.me) si necesitas más ayuda.",
  },
  footer: { home: 'Inicio', support: 'Soporte técnico' },
  contractAddress: {
    label: 'Dirección de implementación del contrato:',
    note: 'Puedes usar esta dirección para verificar el código de nuestro contrato inteligente en SolidityScan o en cualquier explorador de blockchain.',
  },
};
