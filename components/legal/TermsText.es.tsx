import { A, Def, Heading, Items, Para, Section, Sub } from './LegalParts';

const DISPUTE_POLICY = 'https://stabledrop.me/dispute-policy/';
const PRIVACY_POLICY = 'https://stabledrop.me/privacy-policy/';
const TERMS = 'https://stabledrop.me/terms-of-service/';

/**
 * The Terms of Service in Spanish (Latin American), shown when the locale is es.
 *
 * ⚠️ A TRANSLATION FOR CONVENIENCE ONLY. The English text (TermsText.tsx) is the one every sign-in
 *    accepts and the one that governs; TermsOfService.tsx says so above this text. Editing this file
 *    does not issue a new terms version. Keep it in step with TermsText.tsx: every section and
 *    sub-clause there has its counterpart here, in the same order and with the same numbers.
 *
 * ⚠️ Machine-translated, without legal or native review. Have it reviewed before relying on it.
 *    Statutes, regulators and company details are kept in their original English form.
 */
/**
 * A fingerprint of the English text (TermsText.tsx) this translation was made from. When the English
 * changes, __tests__/components/legal/translations.test.tsx fails and prints the new value: update
 * the Spanish to match, then set this to it. Never update this without updating the Spanish.
 */
export const TRANSLATED_FROM = 'c828955668f5a386';

export default function TermsTextEs() {
  return (
    <>
      <Section title="1. Acerca de estos Términos">
        <Sub n="1.1">
          Estos Términos y Condiciones son un acuerdo entre Conduit-UCPI Ltd, una sociedad registrada en Escocia (SC880319), con domicilio en 5 South Charlotte Street, Edinburgh, EH2 4AN ("Stabledrop", "nosotros", "SD") y el usuario ("tú" o "tu") que rige tu uso de Stabledrop (el "Servicio" o el "Producto").
        </Sub>

        <Heading>Uso del término "Escrow" (depósito en garantía)</Heading>
        <Para flush>
          Siempre que los términos "escrow", "pago en escrow", "cuenta de escrow" o similares aparezcan en este sitio web, en nuestras aplicaciones, documentación o comunicaciones, describen un acuerdo similar a un escrow: los fondos quedan bloqueados en un contrato inteligente autoejecutable y se liberan o devuelven según condiciones predefinidas acordadas por las partes.
        </Para>
        <Para flush>
          Conduit-UCPI Ltd no actúa como agente de escrow, fiduciario, custodio ni en ninguna otra función fiduciaria, y en ningún momento toma posesión ni control de los fondos de los usuarios. No tenemos ninguna licencia, autorización ni registro para prestar servicios de escrow en ninguna jurisdicción, y el uso del término "escrow" no debe interpretarse en el sentido de que los tengamos, ni de que se apliquen las protecciones asociadas a los servicios de escrow con licencia o regulados.
        </Para>
        <Para flush>
          Los contratos inteligentes funcionan de forma automática e independiente de Conduit UCPI Ltd. Los usuarios son responsables de comprender las condiciones y los riesgos de cualquier transacción antes de realizarla.
        </Para>

        <Heading>Uso de los términos "Árbitro" y "Arbitraje"</Heading>
        <Para flush>
          Siempre que los términos "árbitro", "arbitraje" o similares aparezcan en este sitio web, en nuestras aplicaciones, documentación o comunicaciones, se refieren a la tercera de las tres partes con derecho a votar sobre cómo se distribuyen los fondos retenidos en un contrato inteligente. Los fondos se liberan solo cuando dos de las tres partes emiten votos coincidentes para el mismo reparto de fondos. El voto del árbitro no tiene más peso que el de cualquiera de las otras partes, y el árbitro no puede liberar, devolver ni redirigir fondos actuando por sí solo. Este proceso no es un arbitraje en el sentido de la Arbitration (Scotland) Act 2010, la Arbitration Act 1996 ni ninguna ley equivalente de otra jurisdicción. El voto de un árbitro no es un laudo arbitral ni una determinación de los derechos legales de ninguna parte, y no se emite en virtud de ningún acuerdo de arbitraje, reglas de procedimiento ni sede arbitral. Los árbitros no están obligados a tener ninguna cualificación, acreditación o nombramiento como árbitro.
        </Para>
        <Para flush>
          Nada en este proceso excluye, limita ni sustituye el derecho de cualquiera de las partes a llevar una disputa ante los tribunales o a ejercer cualquier otro recurso legal a su disposición.
        </Para>

        <Sub n="1.2">
          Stabledrop proporciona el software de Pago Protegido, y estos Términos cubren tu uso de ese software. Puedes usarlo directamente en stabledrop.me, o a través de otra empresa que ofrezca Stabledrop dentro de su propio sitio web o aplicación (un "Socio"). En ambos casos, tu cuenta de Stabledrop se crea y se accede a ella mediante el inicio de sesión propio de Stabledrop, y tu Billetera la proporciona nuestro proveedor de billeteras (consulta la sección 6).
        </Sub>
        <Para>
          Si usas Stabledrop a través de un Socio, los términos propios del Socio también se aplican al servicio del Socio, por ejemplo su sitio web, cualquier comisión que cobre y la atención al cliente que preste. El Socio es responsable de su propio servicio, y Stabledrop es responsable únicamente de los Servicios.
        </Para>
        <Sub n="1.3">
          Estos Términos incluyen las Reglas de Resolución de Disputas de Stabledrop, publicadas en <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A>
        </Sub>
        <Sub n="1.4">
          Estos Términos se aplican sea cual sea la forma en que accedas a los Servicios, incluso directamente en stabledrop.me, a través de un Socio, o mediante nuestra API o servidor MCP. Antes de usar los Servicios por primera vez, se te pedirá que confirmes que has leído y aceptas estos Términos, las Reglas de Resolución de Disputas y la Política de Privacidad. Registramos qué versión aceptaste y cuándo. No puedes usar los Servicios si no aceptas estos Términos. La sección 19 explica cómo gestionamos los cambios.
        </Sub>
      </Section>

      <Section title="2. Definiciones">
        <Def term="Administrador">
          un miembro del equipo de Stabledrop autorizado para comprobar que las Reglas de Resolución de Disputas se han aplicado correctamente antes de que el Tercer Votante de Stabledrop emita su voto, y para aprobar ese voto desde el Safe del Tercer Votante. Los Administradores deben seguir las Reglas publicadas y actuar con imparcialidad, y apartarse de cualquier Disputa en la que tengan una relación con el Comprador o el Vendedor. No pueden mover fondos, cambiar el Contrato Inteligente, votar en nombre del Comprador o del Vendedor ni hacer que se liberen fondos sin un voto coincidente del Comprador o del Vendedor.
        </Def>
        <Def term="Sistema de IA">
          software informático (inteligencia artificial) que lee el Expediente del Caso y las Reglas dentro del Servicio de Disputas y luego sugiere cómo debería votar el Tercer Votante de Stabledrop. Solo da una opinión: no tiene ninguna Clave y no puede emitir un voto, mover fondos, enviar mensajes ni cambiar ningún registro. Sus sugerencias se comprueban conforme a las Reglas y, cuando estas Reglas lo indican, por un Administrador. El proveedor de IA utilizado se indica en el aviso de privacidad de Stabledrop.
        </Def>
        <Def term="Resolución Automatizada de Disputas">
          el proceso de la sección 6 de la Política de Gestión de Disputas, en el que el Servicio de Disputas determina cómo debería votar el Tercer Votante de Stabledrop, usando reglas publicadas, IA y revisión por parte del personal de Stabledrop.
        </Def>
        <Def term="Blockchain">un registro público compartido de transacciones que no se puede alterar.</Def>
        <Def term="Comprador">
          la Billetera indicada en el Contrato Inteligente como Comprador, que puede abrir una disputa, participar en una disputa y recibir un reembolso en una disputa. Cualquiera puede aportar fondos al Contrato Inteligente.
        </Def>
        <Def term="Expediente del Caso">
          las partes de los registros de Stabledrop que el Servicio de Disputas usa para decidir una Disputa, como las Condiciones de Pago, los votos, comentarios, motivos y pruebas de cada parte. Los nombres, datos de contacto y direcciones de Billetera se eliminan antes de enviar un Expediente del Caso a un Sistema de IA.
        </Def>
        <Def term="Disputa">un desacuerdo entre el Comprador y el Vendedor sobre si se han cumplido las Condiciones de Pago, o en qué medida.</Def>
        <Def term="Reglas de Resolución de Disputas">
          las reglas publicadas en <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A> que deciden los desacuerdos entre el Comprador y el Vendedor.
        </Def>
        <Def term="Servicio de Disputas">
          la parte de los sistemas de Stabledrop que determina cómo vota el Tercer Votante de Stabledrop y envía los avisos de Disputa. No puede mover fondos.
        </Def>
        <Def term="ERC-20">
          ERC-20 es el estándar para crear tokens fungibles en la blockchain de Ethereum y en redes compatibles con Ethereum, que garantiza la interoperabilidad y la compatibilidad entre tokens.
        </Def>
        <Def term="Revisión Humana">la revisión de una Disputa por una persona independiente conforme a la sección 8 de la Política de Gestión de Disputas.</Def>
        <Def term="Pago instantáneo">un pago sin Fecha de Pago. Se paga de inmediato y no se puede disputar.</Def>
        <Def term="Claves" />
        <Items flush>
          <li>Clave pública: el identificador de la billetera que ves y que es visible para todos.</li>
          <li>Clave privada: la contraseña que te permite realizar transacciones con la billetera, que se genera automáticamente y no se puede cambiar.</li>
        </Items>
        <Para flush>La clave pública y la clave privada forman un par.</Para>
        <Def term="Marketplace">donde un Vendedor puede vender a otra parte su derecho a cobrar, para cobrar antes.</Def>
        <Def term="On-chain">
          registrado en la Blockchain, en el Contrato Inteligente, donde es público y no se puede cambiar. Por ejemplo, un voto on-chain es un voto registrado en el Contrato Inteligente, que es lo que cuenta para liberar los fondos. Un comentario o propuesta hecho en el panel pero no introducido como voto es "off-chain": se conserva en los registros de Stabledrop, no en el Contrato Inteligente.
        </Def>
        <Def term="Liberación abierta por reparto coincidente de 2 de 3">
          Cada parte puede introducir un porcentaje tantas veces como desee durante una disputa. Hay 3 partes que pueden introducir porcentajes.
        </Def>
        <Items flush>
          <li>2 de 3: 2 de 3 es cuando 2 de ellas están de acuerdo.</li>
          <li>Liberación: la liberación se produce automáticamente cuando 2 de las 3 introducen la misma cifra.</li>
        </Items>
        <Def term="Resultado">una decisión sobre una Disputa, que puede ser una liberación total al Vendedor, un reembolso total al Comprador o un reparto entre ambos.</Def>
        <Def term="Condiciones de Pago">
          lo que el Comprador y el Vendedor acordaron al configurar el Pago Protegido, incluido qué se debe entregar, para cuándo y cómo se confirma la entrega.
        </Def>
        <Def term="Fecha de Pago (también llamada fecha de vencimiento)">
          la fecha fijada al crear un Pago Protegido. El Comprador puede abrir una Disputa hasta esa fecha; después, los fondos pueden liberarse al Vendedor si no hay ninguna Disputa.
        </Def>
        <Def term="Comisión de Plataforma">
          las comisiones de plataforma son lo que pagas cada vez que procesas una transacción a través de la plataforma de Stabledrop. Las comisiones son del 1% del valor del contrato, con un mínimo de 0.30 unidades de la Stablecoin utilizada, y se deducen al configurar el Pago Protegido.
        </Def>
        <Def term="Pago Protegido">
          un pago que funciona como un escrow. Los fondos quedan bloqueados en el Contrato Inteligente, sin que nadie los tenga en su poder, hasta que se liberan al Vendedor o se devuelven al Comprador.
        </Def>
        <Def term="Proveedor de Revisión">
          el proveedor independiente de resolución de disputas que el Comprador y el Vendedor eligen de común acuerdo para la Revisión Humana conforme a la sección 8 de la Política de Gestión de Disputas. El Comprador y el Vendedor designan conjuntamente a cualquier proveedor independiente en el que ambos estén de acuerdo; Stabledrop no mantiene ni recomienda ninguna lista de proveedores.
        </Def>
        <Def term="Reglas">las Reglas enumeradas y descritas dentro del Servicio de Disputas en la Política de Gestión de Disputas.</Def>
        <Def term="Safe">
          un tipo de billetera digital compartida que pertenece a varias Claves y que solo actúa cuando un número determinado de ellas lo aprueba, como una cuenta bancaria que necesita dos firmas. El Tercer Votante de Stabledrop vota desde un Safe con tres Claves, y al menos dos deben aprobar antes de emitir cualquier voto. Safe es el nombre del producto utilizado, tal como lo define Safe Labs GmbH; puedes encontrar más información aquí: <A href="https://app.safe.global/">https://app.safe.global/</A>; no es un servicio de Stabledrop.
        </Def>
        <Def term="Vendedor">
          la parte a la que se pagará después de la Fecha de Pago si no hay ninguna Disputa. Si el Vendedor traslada su cobro a otra Billetera, o lo vende a través del Marketplace, "Vendedor" significa quien tenga en ese momento el derecho a cobrar.
        </Def>
        <Def term="Servicios">el software, la interfaz y el Contrato Inteligente de Stabledrop, tanto si los usas directamente como a través de otra empresa.</Def>
        <Def term="Contrato Inteligente">el software desplegado en la blockchain que retiene los fondos de cada Pago Protegido y ejecuta las liberaciones y los reembolsos.</Def>
        <Def term="Stablecoin">
          un token digital emitido conforme al estándar de tokens ERC-20 y diseñado para mantener un valor estable frente a una moneda, como USDT o USDC.
        </Def>
        <Def term="Registros de Stabledrop">
          la información que Stabledrop conserva sobre un Pago Protegido y cualquier Disputa, fuera de la Blockchain. Incluye quiénes son el Comprador y el Vendedor y las direcciones de correo electrónico vinculadas a sus Billeteras, los comentarios, motivos y pruebas, los avisos enviados, las opiniones de la IA, las comprobaciones y decisiones de los Administradores, y la aceptación de estas Reglas por cada parte. Se trata conforme al aviso de privacidad de Stabledrop en <A href={PRIVACY_POLICY}>{PRIVACY_POLICY}</A> y se conserva durante 7 años.
        </Def>
        <Def term="Tercer Votante">
          la parte que tiene uno de los tres votos en una Disputa, junto con el Comprador y el Vendedor. Por defecto es el Tercer Votante de Stabledrop, que opera Stabledrop y que vota conforme a las Reglas de la Política de Gestión de Disputas. Las partes pueden elegir un Tercer Votante diferente conforme a la sección 5 de la Política de Gestión de Disputas. Un Tercer Votante no puede mover fondos por sí solo.
        </Def>
        <Def term="Puesto de Tercer Votante">
          la función del Tercer Votante en un Pago Protegido. Quien sea el Tercer Votante "ocupa el puesto". El puesto está "vacío" cuando no hay Tercer Votante; mientras está vacío, solo cuentan los votos del Comprador y del Vendedor.
        </Def>
        <Def term="Billetera">una cuenta digital para guardar y enviar Stablecoins.</Def>
        <Def term="Dirección de Billetera">
          como un número de cuenta de una Billetera: un código largo que empieza por "0x" e identifica adónde se envían las Stablecoins. Si inicias sesión en Stabledrop con tu correo electrónico, se crea automáticamente una Dirección de Billetera para ti.
        </Def>
      </Section>

      <Section title="3. Qué es Stabledrop y qué no es">
        <Sub n="3.1">
          Stabledrop es un conjunto de software que facilita la interacción con determinados contratos inteligentes de código abierto disponibles en una blockchain. Todos los movimientos de fondos los autorizan expresamente las billeteras del comprador o del vendedor.
        </Sub>
        <Sub n="3.2">
          Stabledrop no retiene, custodia ni controla tus fondos en ningún momento. Las Stablecoins se mueven directamente entre las billeteras del Comprador y del Vendedor a través del Contrato Inteligente.
        </Sub>
        <Para>
          Una vez configurado un Pago Protegido, las Stablecoins que contiene quedan bloqueadas en el Contrato Inteligente. Stabledrop no puede moverlas, redirigirlas, retirarlas ni congelarlas. Solo el Contrato Inteligente puede pagarlas al Comprador o al Vendedor, conforme a estos Términos, las Condiciones de Pago y las Reglas de Resolución de Disputas.
        </Para>
        <Para>
          Cuando el Tercer Votante de Stabledrop ocupa el Puesto de Tercer Votante, emite uno de los tres votos en una Disputa, siguiendo las Reglas de Resolución de Disputas publicadas. Ese voto no tiene más peso que el del Comprador o el del Vendedor. Los fondos se liberan solo cuando dos de las tres partes emiten votos coincidentes, por lo que Stabledrop nunca puede liberar, devolver ni redirigir fondos actuando por sí sola.
        </Para>
        <Sub n="3.3">Stabledrop no tiene ningún poder de administración, actualización o anulación sobre los contratos inteligentes que utiliza.</Sub>
        <Sub n="3.4">
          Stabledrop no es un banco, proveedor de servicios de pago, transmisor de dinero, empresa de servicios monetarios, custodio, casa de cambio, corredor ni agente de escrow. No presta asesoramiento financiero, de inversión, legal ni fiscal.
        </Sub>
        <Sub n="3.5">
          Stabledrop no es parte de ninguna transacción entre el Comprador y el Vendedor. No vende, compra, comprueba ni garantiza ningún bien o servicio.
        </Sub>
        <Sub n="3.6">El Comprador y el Vendedor deciden las Condiciones de Pago. El Contrato Inteligente las ejecuta. Stabledrop no decide cómo ni cuándo se mueven los fondos.</Sub>
        <Sub n="3.7">Stabledrop no convierte dinero. Cualquier conversión la realiza un tercero, como una casa de cambio o un banco, conforme a sus propios términos.</Sub>
      </Section>

      <Section title="4. Quién puede usar Stabledrop">
        <Sub n="4.1">Para usar los Servicios debes:</Sub>
        <Items>
          <li>tener al menos 18 años, o la mayoría de edad legal donde vives si es superior, y poder celebrar un contrato vinculante;</li>
          <li>no encontrarte ni residir habitualmente en una Ubicación Restringida conforme a la sección 5; y</li>
          <li>no figurar en una lista de sanciones ni actuar en nombre de alguien que figure en ella (consulta la sección 5); y</li>
          <li>estar autorizado por las leyes que te son aplicables a usar los Servicios y las Stablecoins que uses con ellos.</li>
        </Items>
        <Sub n="4.2">
          Puedes usar los Servicios como particular o para una empresa. Si los usas para una empresa, confirmas que tienes autoridad para aceptar estos Términos en su nombre, y "tú" incluye a esa empresa.
        </Sub>
        <Sub n="4.3">Eres responsable de comprobar que el uso de los Servicios es legal donde te encuentras.</Sub>
      </Section>

      <Section title="5. Sanciones, verificación y ubicaciones restringidas">
        <Sub n="5.1">Confirmas que tú, y cualquier persona en cuyo nombre actúes o con quien realices transacciones a través de los Servicios:</Sub>
        <Items lettered>
          <li>(a) no figuran en una lista de sanciones mantenida por los Estados Unidos (incluida la Specially Designated Nationals list de OFAC), el Reino Unido, la Unión Europea o las Naciones Unidas, ni son propiedad ni están bajo el control de alguien que figure en ella; y</li>
          <li>(b) no se encuentran ni residen habitualmente en una Ubicación Restringida.</li>
        </Items>
        <Sub n="5.2">
          Las Ubicaciones Restringidas son cualquier país, territorio o región objeto de sanciones integrales o que abarquen todo el territorio, o de un embargo, administrados por los Estados Unidos (OFAC), el Reino Unido (OFSI), la Unión Europea o las Naciones Unidas, según estén vigentes en cada momento. A 6 de noviembre de 2026 incluyen Cuba, Irán, Corea del Norte, y las regiones de Crimea, Donetsk, Zaporiyia, Jersón y Lugansk y otras zonas de Ucrania ocupadas por Rusia; y cualquier otro lugar donde el uso de los Servicios infrinja la legislación sobre sanciones.
        </Sub>
        <Sub n="5.3">
          Stabledrop verifica las direcciones de Billetera y de correo electrónico que intervienen en un Pago Protegido, incluidas las del Comprador, el Vendedor, cualquier persona que lo financie y el Tercer Votante. Las cotejamos con listas de sanciones y otras listas publicadas de actividades de alto riesgo o ilegales. También podemos usar herramientas de terceros para rastrear el historial de transacciones de una dirección de Billetera y elaborar una evaluación de riesgo. La verificación puede realizarse cuando una Billetera se usa por primera vez con los Servicios y en otros momentos.
        </Sub>
        <Sub n="5.4">Podemos negarnos a configurar un Pago Protegido, bloquear una dirección de Billetera o restringir tu acceso a los Servicios cuando</Sub>
        <Items>
          <li>una dirección de Billetera o de correo electrónico coincida con una persona o lugar descritos en la sección 5.1 o 5.2, o esté vinculada a ellos;</li>
          <li>la evaluación de riesgo supere nuestro umbral; o</li>
          <li>creamos razonablemente que es necesario para cumplir la ley.</li>
        </Items>
        <Para>No estamos obligados a explicar nuestros motivos cuando la ley nos lo impida o cuando hacerlo pueda socavar nuestros controles.</Para>
        <Sub n="5.5">
          Nuestros controles de verificación se aplican al acceso a la interfaz y a los Servicios antes de que se bloquee cualquier fondo. Stabledrop no tiene ningún control sobre un Contrato Inteligente una vez creado, por lo que ni nosotros ni nadie más puede congelar, mover o devolver Stablecoins una vez bloqueadas en un Pago Protegido. Si ya se han enviado Stablecoins a la dirección reservada para un Pago Protegido que luego nos negamos a configurar, nadie, incluida Stabledrop, puede moverlas a menos que el Pago Protegido pueda configurarse legalmente más adelante. Stabledrop no retiene ni controla esas Stablecoins.
        </Sub>
        <Sub n="5.6">Tratamos los datos personales para la verificación según se describe en la Política de Privacidad.</Sub>
      </Section>

      <Section title="6. Tu billetera y tus claves">
        <Sub n="6.1">Eres responsable de tu Billetera, incluida la seguridad de sus claves, contraseñas y frases de recuperación. Si tu Billetera la proporciona otro servicio, también se aplican los términos de ese servicio.</Sub>
        <Sub n="6.2">Stabledrop nunca tiene acceso a tus claves y no puede recuperarlas. Si se pierden o te las roban, puedes perder de forma permanente el acceso a tus Stablecoins.</Sub>
        <Para>
          Stabledrop proporciona una herramienta en el gestor de billeteras para obtener las claves de tu billetera. Te recomendamos encarecidamente que la uses para acceder a tus claves y guardarlas de forma segura por separado. Stabledrop no tiene acceso a tus claves y no puede ayudarte si las pierdes o si el gestor de billeteras (Privy, una empresa externa) tiene problemas.
        </Para>
        <Sub n="6.3">Comprueba cada dirección de Billetera antes de enviar Stablecoins. Stabledrop no puede revertir las transacciones enviadas a una dirección equivocada.</Sub>
      </Section>

      <Section title="7. Cómo funcionan los Pagos Protegidos">
        <Sub n="7.1">
          El Comprador y el Vendedor acuerdan las Condiciones de Pago (comprador, vendedor, token (moneda), importe, Fecha de Pago, identidad del Tercer Votante) al configurar el Pago Protegido. Hazlas específicas: es con ellas con lo que se decide cualquier disputa.
        </Sub>
        <Sub n="7.2">
          Cuando el Comprador financia el Pago Protegido, las Stablecoins quedan bloqueadas en el Contrato Inteligente. Ni el Comprador, ni el Vendedor ni Stabledrop pueden moverlas salvo según lo establecido en estos Términos y en las Condiciones de Pago.
        </Sub>
        <Sub n="7.3">
          Cada Pago Protegido tiene una fecha de vencimiento fijada al configurarlo. Si para entonces no se ha abierto ninguna disputa, los tokens ERC-20 se liberarán automáticamente al Vendedor una vez pasada esa fecha. Los fondos solo pueden ir al Vendedor. Si el Comprador abre una disputa antes de la fecha de vencimiento, los fondos los gestiona en cambio el contrato inteligente, según lo definido en las Reglas de Resolución de Disputas, lo que puede suponer un reembolso total o parcial al Comprador (consulta 7.5 y la sección 8).
        </Sub>
        <Sub n="7.4">El Comprador y el Vendedor pueden acordar conjuntamente liberar, reembolsar o repartir los fondos en cualquier momento.</Sub>
        <Sub n="7.5">
          Si hay un problema, el Comprador puede abrir una disputa conforme a las Reglas de Resolución de Disputas, pero solo antes de la fecha de vencimiento. Esto detiene la liberación al Vendedor hasta que se resuelva la disputa. Los pagos configurados sin fecha de vencimiento (transferencias instantáneas) no se pueden disputar: se te informará de ello antes de pagar.
        </Sub>
        <Sub n="7.6">Las transacciones en blockchain son definitivas. Una vez que el Contrato Inteligente ha liberado o devuelto las Stablecoins, la transacción no se puede revertir.</Sub>
        <Sub n="7.7">Si eres el Vendedor, ten en cuenta lo siguiente:</Sub>
        <Items>
          <li>Solo el Comprador puede abrir una disputa, y solo antes de la fecha de vencimiento. Tú no puedes abrirla.</li>
          <li>Si el Comprador abre una disputa, los fondos permanecen en el Contrato Inteligente y no se te pagará hasta que la disputa se resuelva conforme a las Reglas de Resolución de Disputas. Esto puede suponer un reembolso total o parcial al Comprador.</li>
          <li>Una vez abierta una disputa, participas plenamente: puedes añadir pruebas, votar sobre el reembolso, cambiar tu voto y solicitar la revisión por una organización independiente.</li>
          <li>Si no se abre ninguna disputa antes de la fecha de vencimiento, los fondos se te liberarán una vez pasada esa fecha.</li>
          <li>Las transferencias instantáneas (sin fecha de vencimiento) no pueden ser disputadas por ninguna de las partes.</li>
          <li>Nada en estos Términos afecta a cualquier reclamación que puedas tener contra el Comprador ante los tribunales, ni a tus derechos conforme a la ley del lugar donde vives.</li>
        </Items>
      </Section>

      <Section title="8. Disputas entre el Comprador y el Vendedor">
        <Sub n="8.1">Los detalles sobre cómo se gestionan las disputas se encuentran en la Política de Gestión de Disputas de Stabledrop <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A>.</Sub>
        <Sub n="8.2">Nadie en Stabledrop decide unilateralmente las disputas ni cambia sus resultados.</Sub>
        <Sub n="8.3">Puedes objetar una decisión automatizada antes de que el Tercer Votante vote, según se establece en las Reglas de Resolución de Disputas (sección 6.3). Una vez liberados los fondos, el pago es definitivo y nadie, incluida Stabledrop, puede revertirlo. A partir de ese momento, tu recurso es presentar una reclamación contra la otra parte ante los tribunales. Esto no afecta a ningún derecho que tengas por ley.</Sub>
        <Sub n="8.4">Las reclamaciones sobre la propia Stabledrop, y no sobre la otra parte, se tratan conforme a la sección 20.</Sub>
      </Section>

      <Section title="9. Riesgos de la blockchain">
        <Sub n="9.1">El uso de blockchains conlleva riesgos, entre ellos:</Sub>
        <Items>
          <li>Pérdida de valor: un token ERC-20 puede perder su vínculo con la moneda a la que sigue, de forma temporal o permanente, incluso mientras está bloqueado en el Contrato Inteligente.</li>
          <li>Riesgo del emisor: los tokens ERC-20 los emiten terceros. Un emisor puede congelar direcciones, quebrar o dejar de reembolsar sus tokens. Stabledrop no tiene ningún control sobre los emisores.</li>
          <li>Riesgo del contrato inteligente: el Contrato Inteligente puede contener errores o vulnerabilidades. Hemos tomado medidas razonables para probarlo, pero no se puede garantizar que ningún software esté libre de errores o vulnerabilidades.</li>
          <li>Riesgo de la red: las redes blockchain pueden congestionarse, sufrir retrasos, cambios o ataques, y las comisiones de red pueden subir.</li>
          <li>Riesgo regulatorio: las leyes sobre cualquier token ERC-20 pueden cambiar en tu país y afectar a si puedes usarlos.</li>
        </Items>
        <Sub n="9.2">
          Al usar los Servicios, confirmas que comprendes estos riesgos. Stabledrop no es responsable de las pérdidas que causen, salvo cuando la pérdida se deba a nuestro incumplimiento de estos Términos o a no haber actuado con la diligencia y competencia razonables, y con sujeción a la sección 16.
        </Sub>
      </Section>

      <Section title="10. Comisiones">
        <Sub n="10.1">
          Stabledrop cobra una Comisión de Plataforma del 1% del importe de cada Pago Protegido, con un mínimo de 0.30 unidades de la Stablecoin utilizada (por ejemplo, 0.30 USDC). La comisión se deduce automáticamente al configurar el Pago Protegido. Por tanto, el importe bloqueado en el Contrato Inteligente es el importe aportado menos la Comisión de Plataforma.
        </Sub>
        <Sub n="10.2">
          Cualquier pago al Vendedor se realiza con cargo al importe bloqueado, ya sea que se libere después de la Fecha de Pago, se acuerde entre el Comprador y el Vendedor o se decida conforme a las Reglas de Resolución de Disputas. En una liberación total, el Vendedor recibe el 99% del importe aportado, o el importe aportado menos la comisión mínima, cuando esta se aplique. En una liberación parcial, el Vendedor recibe la parte acordada del importe bloqueado.
        </Sub>
        <Sub n="10.3">
          La Comisión de Plataforma no es reembolsable. Cualquier reembolso al Comprador, ya sea acordado entre el Comprador y el Vendedor o decidido conforme a las Reglas de Resolución de Disputas, se calcula sobre el importe bloqueado, no sobre el importe aportado. Por ejemplo, en un Pago Protegido de 1,000 USDC, un reembolso total devuelve 990 USDC.
        </Sub>
        <Sub n="10.4">Si usas Stabledrop a través de un Socio, el Socio puede cobrar su propia comisión por separado. Stabledrop no te cobra nada más que la Comisión de Plataforma.</Sub>
        <Sub n="10.5">Las comisiones por la resolución de disputas se establecen en las Reglas de Resolución de Disputas <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A></Sub>
      </Section>

      <Section title="11. Comprobaciones de identidad y usos prohibidos">
        <Sub n="11.1">
          Stabledrop no realiza comprobaciones de identidad de los usuarios. La sección 5 explica cómo verificamos las direcciones de Billetera y de correo electrónico, y cuándo podemos rechazar o restringir el uso de los Servicios.
        </Sub>
        <Sub n="11.2">
          No debes usar los Servicios para ningún fin que sea ilegal conforme a cualquier ley aplicable a ti o a la otra parte, incluida la ley del lugar donde cualquiera de ustedes se encuentre, resida o esté establecido, ni de forma que incumpla estos Términos. Esto incluye, entre otros, usar los Servicios:
        </Sub>
        <Items lettered>
          <li>(a) para fraude, blanqueo de capitales, financiación del terrorismo o para eludir sanciones;</li>
          <li>(b) para comprar, vender o pagar bienes o servicios que sean ilegales donde se encuentre cualquiera de las partes;</li>
          <li>(c) con una Billetera, cuenta o dirección de correo electrónico que no sea tuya o que no estés autorizado a usar;</li>
          <li>(d) para engañar o inducir a error a la otra parte de un Pago Protegido, por ejemplo fijando Condiciones de Pago que no piensas cumplir;</li>
          <li>(e) para interferir, perturbar, atacar o probar la seguridad de los Servicios, el Contrato Inteligente o cualquier red, salvo en el marco de un programa de divulgación que hayamos publicado;</li>
          <li>(f) para acceder a los Servicios por medios automatizados distintos de nuestra API o servidor MCP, o de una forma que les imponga una carga excesiva; o</li>
          <li>(g) para incumplir cualquier parte de estos Términos.</li>
        </Items>
        <Sub n="11.3">Informaremos de las actividades sospechosas a las autoridades cuando la ley lo exija, y podemos compartir información con ellas o con nuestros proveedores de verificación cuando la ley lo permita.</Sub>
        <Sub n="11.4">Si creemos razonablemente que has incumplido esta sección, podemos tomar las medidas descritas en la sección 18, incluida la suspensión o la finalización de tu acceso a los Servicios.</Sub>
      </Section>

      <Section title="12. Impuestos">
        <Para flush>
          Eres responsable de cualquier impuesto sobre tus transacciones y de cualquier declaración que la ley te exija, en todos los países donde tengas obligaciones fiscales. Stabledrop no recauda, retiene ni declara impuestos por ti.
        </Para>
      </Section>

      <Section title="13. Propiedad intelectual y licencia">
        <Sub n="13.1">Stabledrop es titular de todos los derechos sobre los Servicios, o tiene licencia para usarlos, incluidos el software, el Contrato Inteligente, la interfaz, las Reglas de Resolución de Disputas y el nombre y el logotipo de Stabledrop.</Sub>
        <Sub n="13.2">Te otorgamos una licencia personal, no exclusiva, intransferible y revocable para usar los Servicios para su finalidad prevista mientras estos Términos sean aplicables.</Sub>
        <Sub n="13.3">No debes copiar, modificar, aplicar ingeniería inversa ni revender los Servicios, ni usarlos para crear un producto competidor, salvo cuando la ley lo permita y no pueda excluirse.</Sub>
        <Sub n="13.4">Si nos envías comentarios o sugerencias, podemos usarlos sin ninguna obligación hacia ti.</Sub>
      </Section>

      <Section title="14. Privacidad">
        <Sub n="14.1">Stabledrop trata los datos que necesita para prestar los Servicios y resolver disputas, conforme al aviso de privacidad de Stabledrop en <A href={PRIVACY_POLICY}>{PRIVACY_POLICY}</A></Sub>
        <Sub n="14.2">Si usas Stabledrop a través de una empresa Socia, esa empresa también puede recopilar y usar tus datos personales conforme a su propio aviso de privacidad. Stabledrop y esa empresa son responsables, cada una, de los datos personales que traten para sus propios fines.</Sub>
        <Sub n="14.3">Las transacciones en una blockchain pública, incluidas las direcciones de Billetera y los importes, son visibles para cualquiera y no se pueden eliminar. No incluyas datos personales en campos on-chain.</Sub>
        <Sub n="14.4">Tus datos pueden transferirse entre ubicaciones, con las garantías que exija la ley local.</Sub>
        <Sub n="14.5">
          Tienes derecho a solicitar una copia de tus datos en poder de Stabledrop. Tienes derecho a solicitar su eliminación de nuestros sistemas en la medida en que podamos, en un plazo razonable. No podemos eliminar ni cambiar la información registrada en la blockchain, que es pública y permanente, y es posible que debamos conservar cierta información para cumplir obligaciones legales, fiscales, contables, de sanciones o contra el blanqueo de capitales, o para establecer o defender reclamaciones legales. Consulta la Política de Privacidad.
        </Sub>
      </Section>

      <Section title="15. Exenciones de responsabilidad">
        <Sub n="15.1">Los Servicios se prestan "tal cual" y "según disponibilidad". En la medida en que la ley lo permita, no prometemos que sean ininterrumpidos, que estén libres de errores ni que sean adecuados para tu finalidad concreta.</Sub>
        <Sub n="15.2">No garantizamos el valor de ninguna Stablecoin, la conducta de ningún Comprador o Vendedor, ni la calidad o entrega de nada que se compre o venda.</Sub>
        <Sub n="15.3">Nada en estos Términos afecta a los derechos que tengas por ley y que no puedan excluirse, incluidos los derechos de los consumidores donde vives.</Sub>
      </Section>

      <Section title="16. Limitación de responsabilidad">
        <Sub n="16.1">Nada en estos Términos limita la responsabilidad por fraude, por muerte o lesiones personales causadas por negligencia, ni por cualquier otra cosa cuya limitación no permita la ley.</Sub>
        <Sub n="16.2">Con sujeción a 16.1, Stabledrop no es responsable de:</Sub>
        <Items>
          <li>las pérdidas causadas por la otra parte de tu transacción;</li>
          <li>el resultado de una disputa decidida conforme a las Reglas de Resolución de Disputas;</li>
          <li>las pérdidas causadas por los riesgos descritos en la sección 9, o por hechos fuera de nuestro control razonable;</li>
          <li>la pérdida de tus claves, o las transacciones enviadas a una dirección equivocada; o</li>
          <li>la pérdida de beneficios, negocio, ingresos u oportunidades, ni ninguna pérdida indirecta.</li>
        </Items>
        <Sub n="16.3">
          Con sujeción a 16.1, la responsabilidad total de Stabledrop hacia ti conforme a estos Términos se limita a la mayor de estas cantidades: (a) las comisiones que Stabledrop haya recibido de ti en los 12 meses anteriores a la reclamación; y (b) US$1,000 (o su equivalente en la Stablecoin de que se trate). Esto refleja que Stabledrop proporciona software por una comisión pequeña y nunca retiene ni controla los fondos de un Pago Protegido, que pertenecen al Comprador o al Vendedor.
        </Sub>
      </Section>

      <Section title="17. Indemnización">
        <Para flush>
          Si usas los Servicios para una empresa, compensarás a Stabledrop por las pérdidas, reclamaciones y costos razonables derivados de tu incumplimiento de estos Términos, tu incumplimiento de la ley o tus tratos con la otra parte de un Pago Protegido. Esta sección no se te aplica si usas los Servicios como consumidor.
        </Para>
      </Section>

      <Section title="18. Suspensión y terminación">
        <Sub n="18.1">Puedes dejar de usar los Servicios en cualquier momento.</Sub>
        <Sub n="18.2">Podemos suspender o finalizar tu acceso a los Servicios si incumples estos Términos, si la ley lo exige o si sospechamos razonablemente de fraude, incumplimiento de sanciones u otra actividad ilegal. Te lo diremos salvo que la ley nos lo impida.</Sub>
        <Sub n="18.3">La suspensión o terminación afecta únicamente a tu acceso a la interfaz y a los Servicios. Las Stablecoins que ya estén en un Pago Protegido permanecen en el Contrato Inteligente y se liberan, reembolsan o deciden conforme a las Condiciones de Pago y las Reglas de Resolución de Disputas.</Sub>
        <Sub n="18.4">Las secciones 3, 9, 12, 13, 15, 16, 17 y 20 siguen aplicándose después de que estos Términos terminen.</Sub>
      </Section>

      <Section title="19. Cambios en estos Términos">
        <Sub n="19.1">Podemos actualizar estos Términos periódicamente. La versión vigente, con su fecha de entrada en vigor, está siempre publicada en <A href={TERMS}>stabledrop.me/terms-of-service/</A>, y las versiones anteriores están disponibles previa solicitud.</Sub>
        <Sub n="19.2">Los cambios no se aplican a un Pago Protegido configurado antes de su entrada en vigor.</Sub>
        <Sub n="19.3">Si no estás de acuerdo con un cambio, puedes dejar de usar los Servicios en cualquier momento. Cualquier Pago Protegido que ya hayas configurado continuará conforme a los Términos que le eran aplicables.</Sub>
      </Section>

      <Section title="20. Ley aplicable, reclamaciones e idioma">
        <Sub n="20.1">Si tienes una reclamación sobre Stabledrop, escribe a <A href="mailto:support@stabledrop.me">support@stabledrop.me</A>. Responderemos en un plazo de 15 días hábiles. Si usas Stabledrop a través de un Socio, las reclamaciones sobre el propio servicio de esa empresa se dirigen a ella.</Sub>
        <Sub n="20.2">Estos Términos se rigen por la ley de Inglaterra y Gales, y los tribunales de Inglaterra y Gales tienen jurisdicción no exclusiva. Esto no afecta a ningún derecho imperativo que tengas conforme a la ley del país o estado donde vives, ni a tu derecho a presentar una reclamación ante los tribunales de allí.</Sub>
        <Sub n="20.3">Estos Términos se publican en inglés. Si también se proporcionan en otro idioma, prevalece la versión en inglés.</Sub>
      </Section>

      <Section title="21. Disposiciones generales">
        <Sub n="21.1">Estos Términos y las Reglas de Resolución de Disputas constituyen el acuerdo completo entre tú y Stabledrop sobre los Servicios, salvo en lo siguiente:</Sub>
        <Items lettered>
          <li>(a) si has firmado con Stabledrop un acuerdo escrito separado que cubra tu uso de los Servicios, ese acuerdo tiene prioridad sobre estos Términos en caso de conflicto, y estos Términos se aplican a todo lo que aquel no cubra;</li>
          <li>(b) si usas Stabledrop a través de un Socio y los términos del Socio entran en conflicto con estos Términos en relación con los Servicios, se aplican estos Términos.</li>
        </Items>
        <Sub n="21.2">No puedes transferir tus derechos u obligaciones conforme a estos Términos sin nuestro consentimiento por escrito. Podemos transferir los nuestros a otra empresa como parte de una reorganización o venta de nuestro negocio, sin reducir tus derechos.</Sub>
        <Sub n="21.3">Si alguna parte de estos Términos se considera inválida, el resto sigue aplicándose.</Sub>
        <Sub n="21.4">Si no hacemos valer un derecho de inmediato, aún podemos hacerlo más adelante.</Sub>
        <Sub n="21.5">Nada en estos Términos crea una sociedad, empresa conjunta, agencia o relación laboral entre tú y Stabledrop, ni entre Stabledrop y ningún Socio. Un Socio no tiene autoridad para hacer promesas ni asumir compromisos en nombre de Stabledrop.</Sub>
        <Sub n="21.6">Nadie más que tú y Stabledrop puede hacer valer estos Términos.</Sub>
      </Section>
    </>
  );
}
