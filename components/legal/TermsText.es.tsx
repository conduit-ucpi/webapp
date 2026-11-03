import { Clause, Sub } from './LegalParts';

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
export const TRANSLATED_FROM = 'b0aefea009f67958';

export default function TermsTextEs() {
  return (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">1. Aceptación de los términos</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Al acceder a Stabledrop en stabledrop.me (&quot;el Servicio&quot;), operado por Conduit UCPI Ltd, y al usarlo,
          aceptas quedar obligado por los términos y disposiciones de este acuerdo. Si no estás de acuerdo con lo
          anterior, no uses este servicio.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">2. Descripción del Servicio</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Stabledrop es una plataforma descentralizada de pagos protegidos que permite a los usuarios crear contratos
          de pago con liberación diferida en blockchains compatibles con EVM. El Servicio facilita:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>La creación y gestión de contratos de pago</li>
          <li>Transacciones y transferencias del token USDC</li>
          <li>La integración con billeteras Web3 y procesadores de pago</li>
          <li>Mecanismos de resolución de disputas</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">3. Posición regulatoria</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          La posición regulatoria de Conduit UCPI Ltd respecto del protocolo Stabledrop se expone en el{' '}
          <a href="#schedule-1" className="text-primary-600 hover:text-primary-500">
            Anexo 1 (Posición regulatoria)
          </a>
          , que forma parte de estos Términos. El Anexo 1 se proporciona a título informativo y no constituye
          asesoramiento legal, financiero, fiscal ni regulatorio; eres responsable de determinar tus propias
          obligaciones regulatorias y debes obtener asesoramiento independiente.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">4. Responsabilidades del usuario</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Al usar el Servicio, te comprometes a:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Proporcionar información exacta y veraz</li>
          <li>Mantener la seguridad de tu billetera y de tus claves privadas</li>
          <li>Cumplir todas las leyes y normas aplicables</li>
          <li>No usar el Servicio para actividades ilegales o fraudulentas</li>
          <li>No intentar explotar, vulnerar ni interrumpir el Servicio</li>
          <li>Ser el único responsable de tus transacciones y de sus resultados</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">5. Riesgos y exenciones de responsabilidad</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          <strong>IMPORTANTE:</strong> el uso de la tecnología blockchain y de las criptomonedas conlleva riesgos significativos:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Las transacciones en la blockchain son irreversibles</li>
          <li>Los contratos inteligentes pueden contener errores o vulnerabilidades</li>
          <li>La congestión de la red puede retrasar las transacciones</li>
          <li>La pérdida de las claves privadas supone la pérdida permanente de los fondos</li>
          <li>Los cambios regulatorios pueden afectar la disponibilidad del Servicio</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">6. Limitación de responsabilidad</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          En la máxima medida permitida por la ley, Conduit UCPI Ltd y sus operadores no serán responsables de ningún
          daño directo, indirecto, incidental, especial, consecuente o punitivo, incluidos, entre otros:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>La pérdida de fondos o criptomonedas</li>
          <li>Fallos o explotaciones de contratos inteligentes</li>
          <li>Caídas de la red o interrupciones del servicio</li>
          <li>Fallos de servicios de terceros (Privy, Coinbase, etc.)</li>
          <li>Errores del usuario o uso indebido de la plataforma</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">7. Disponibilidad del Servicio</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Procuramos mantener la disponibilidad del Servicio, pero no garantizamos un acceso ininterrumpido.
          El Servicio puede no estar disponible temporalmente debido a:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Mantenimiento programado</li>
          <li>Congestión de la red o problemas de la blockchain</li>
          <li>Incidentes de seguridad</li>
          <li>Dificultades técnicas</li>
          <li>Requisitos regulatorios</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">8. Servicios de terceros</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          El Servicio se integra con proveedores externos, entre ellos Privy, Coinbase y otros. El uso que hagas de
          esos servicios se rige por sus respectivos términos de servicio y políticas de privacidad. No somos
          responsables de las acciones ni de las políticas de esos terceros.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">9. Propiedad intelectual</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          El Servicio, incluidos su diseño, su código y su contenido, está protegido por las leyes de propiedad
          intelectual. No puedes copiar, modificar, distribuir ni aplicar ingeniería inversa a ninguna parte del
          Servicio sin permiso expreso.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">10. Terminación</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Nos reservamos el derecho de suspender o cancelar tu acceso al Servicio en cualquier momento, con o sin
          aviso, por incumplimiento de estos términos o por otros motivos que consideremos necesarios.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">11. Ley aplicable</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Estos términos se rigen e interpretan de acuerdo con las leyes de Escocia, sin tener en cuenta sus normas
          sobre conflicto de leyes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">12. Información de contacto</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Conduit UCPI Ltd, Company No. 880319.
        </p>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Domicilio social: 5 South Charlotte Street, Edinburgh, EH2 4AN, United Kingdom.
        </p>
        <p className="text-secondary-700 dark:text-secondary-200">
          Si tienes preguntas sobre estos Términos de Servicio, escríbenos a{' '}
          <a href="mailto:legal@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
            legal@conduit-ucpi.com
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">13. Cambios en los términos</h2>
        <p className="text-secondary-700 dark:text-secondary-200">
          Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor en
          cuanto se publiquen. Si sigues usando el Servicio después de cualquier cambio, se entenderá que aceptas los
          nuevos términos.
        </p>
      </section>

      {/* Schedule 1 keeps the English clause numbering (1.1 … 6.3): it is referenced by number. */}
      <section className="mb-8 pt-8 border-t border-secondary-200 dark:border-secondary-700" id="schedule-1">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-2">
          Anexo 1 — Posición regulatoria
        </h2>

        <Clause n="1" heading="Alcance" />
        <Sub n="1.1">
          Esta declaración describe la posición regulatoria de Conduit UCPI Ltd (SC880319) (&quot;Conduit&quot;)
          respecto del protocolo Stabledrop (&quot;Stabledrop&quot;), que comprende Stabledrop Payments y Stabledrop
          Liquid.
        </Sub>
        <Sub n="1.2">
          Se proporciona a título informativo. No constituye asesoramiento legal, financiero, fiscal ni regulatorio y
          no debe utilizarse como tal. Los usuarios son responsables de determinar sus propias obligaciones
          regulatorias y deben obtener asesoramiento independiente.
        </Sub>

        <Clause n="2" heading="Arquitectura" />
        <Sub n="2.1">
          Los contratos inteligentes de Stabledrop están desplegados sin permisos en la red Base y cualquier parte
          puede interactuar con ellos directamente. Conduit no controla el acceso a ellos.
        </Sub>
        <Sub n="2.2">
          La fábrica de contratos de Stabledrop es inmutable y públicamente accesible con independencia de cualquier
          interfaz que proporcione Conduit. Los parámetros de las transacciones los construye un código de contrato
          que Conduit no controla y no puede modificar.
        </Sub>
        <Sub n="2.3">
          Las contrapartes realizan transacciones directamente entre sí. Cada contraparte autoriza las transacciones
          firmando con claves privadas bajo su control exclusivo.
        </Sub>
        <Sub n="2.4">
          Conduit no toma en ningún momento la posesión ni el control de los fondos de los usuarios, no posee ni tiene
          acceso a sus claves privadas y no tiene capacidad para mover, congelar, revertir ni interferir de otro modo
          con los activos de los usuarios.
        </Sub>
        <Sub n="2.5">
          Los contratos inteligentes de Stabledrop no contienen ninguna clave administrativa ni ningún rol
          privilegiado. Las direcciones de los contratos y su código fuente están publicados y pueden verificarse de
          forma independiente en la cadena.
        </Sub>

        <Clause n="3" heading="Reino Unido — Stabledrop Payments" />
        <Sub n="3.1">
          Stabledrop Payments ejecuta instrucciones de liquidación condicional registradas en un contrato inteligente
          inmutable. Los fondos se liberan al beneficiario, o se devuelven al pagador, únicamente de acuerdo con las
          condiciones acordadas de antemano entre las contrapartes.
        </Sub>
        <Sub n="3.2">
          Conduit no entra en posesión de los fondos transferidos en ninguna fase y no puede alterar, anular ni
          influir en el resultado de ninguna transacción.
        </Sub>
        <Sub n="3.3">
          Sobre esa base, Conduit no realiza ninguna actividad regulada en virtud de la Financial Services and Markets
          Act 2000 ni de las Payment Services Regulations 2017 en relación con Stabledrop Payments, y no necesita
          autorización de la Financial Conduct Authority.
        </Sub>

        <Clause n="4" heading="Reino Unido — Stabledrop Liquid" />
        <Sub n="4.1">
          Stabledrop Liquid facilita la cesión de cuentas por cobrar prefinanciadas. Una cuenta por cobrar
          prefinanciada es una cuenta comercial por cobrar —un importe adeudado a un proveedor por bienes o servicios
          suministrados en el curso de su actividad— cuyos fondos correspondientes ya están comprometidos en un
          contrato de liquidación inmutable de Stabledrop.
        </Sub>
        <Sub n="4.2">
          Stabledrop Liquid opera únicamente respecto de contratos de liquidación que ya están financiados. No se
          concede crédito ni surge ninguna obligación de financiación. El derecho del cesionario está condicionado a
          que se cumplan las condiciones de liberación acordadas.
        </Sub>
        <Sub n="4.3">
          La cesión de una cuenta por cobrar prefinanciada no es un servicio de pago, no es una emisión de dinero
          electrónico y no constituye un préstamo ni la operación de un sistema electrónico relacionado con
          préstamos.
        </Sub>
        <Sub n="4.4">
          Las cuentas por cobrar prefinanciadas se ceden de forma bilateral entre contrapartes identificadas. Conduit
          no agrupa, agrega ni gestiona cuentas por cobrar ni la contraprestación pagada por ellas.
        </Sub>
        <Sub n="4.5">
          Sobre esa base, Conduit no realiza ninguna actividad regulada en virtud de la Financial Services and Markets
          Act 2000 en relación con Stabledrop Liquid, y no necesita autorización de la Financial Conduct Authority.
        </Sub>

        <Clause n="5" heading="Unión Europea" />
        <Sub n="5.1">
          Conduit no presta servicios de custodia ni de administración de criptoactivos por cuenta de clientes, no
          opera una plataforma de negociación de criptoactivos y no canjea criptoactivos por fondos ni por otros
          criptoactivos.
        </Sub>
        <Sub n="5.2">
          Conduit no emite ningún token referenciado a activos ni ningún token de dinero electrónico.
        </Sub>
        <Sub n="5.3">
          Conduit no presta servicios de transferencia de criptoactivos por cuenta de clientes. Las transferencias las
          construye un código de contrato inmutable en la cadena y las inician y autorizan los usuarios firmando con
          claves privadas bajo su control exclusivo. Conduit no construye, inicia ni ejecuta ninguna transferencia, ni
          tiene capacidad para efectuarla.
        </Sub>

        <Clause n="6" heading="Estados Unidos" />
        <Sub n="6.1">
          Conduit no asume la custodia de los fondos de los usuarios y no ejerce un control independiente sobre sus
          activos. Sobre esa base, no actúa como transmisor de dinero (money transmitter) a efectos de las
          orientaciones emitidas por la Financial Crimes Enforcement Network.
        </Sub>
        <Sub n="6.2">
          Conduit no emite ninguna stablecoin de pago y no es un emisor autorizado de stablecoins de pago (permitted
          payment stablecoin issuer) a efectos de la GENIUS Act.
        </Sub>
        <Sub n="6.3">
          Los requisitos estatales de transmisión de dinero varían. Las contrapartes estadounidenses son responsables
          de determinar su propia posición y deben obtener asesoramiento independiente.
        </Sub>
      </section>
    </>
  );
}
