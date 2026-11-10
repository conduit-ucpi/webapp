import { openConsentSettings } from '@/lib/consent';

/**
 * The Privacy Policy in Spanish (Latin American), shown when the locale is es.
 *
 * ⚠️ A TRANSLATION FOR CONVENIENCE ONLY. The English text (PrivacyText.tsx) governs; PrivacyPolicy.tsx
 *    says so above this text. Keep it in step with PrivacyText.tsx, section for section. Cookie and
 *    storage names (AUTH-TOKEN, cookie_consent, _ga) stay as they are: they are what the browser shows.
 *
 * ⚠️ Machine-translated, without legal or native review. Have it reviewed before relying on it.
 */
/**
 * A fingerprint of the English text (PrivacyText.tsx) this translation was made from. When the English
 * changes, __tests__/components/legal/translations.test.tsx fails and prints the new value: update
 * the Spanish to match, then set this to it. Never update this without updating the Spanish.
 */
export const TRANSLATED_FROM = '48fd9d3789d8489a';

export default function PrivacyTextEs() {
  return (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">1. Información que recopilamos</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Cuando usas Conduit UCPI, recopilamos los siguientes tipos de información:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Direcciones de billetera y datos públicos de la blockchain</li>
          <li>Direcciones de correo electrónico para identificar tu cuenta</li>
          <li>Datos de transacciones relacionados con los contratos de pago</li>
          <li>Análisis de uso y métricas de rendimiento</li>
          <li>Grabaciones de pantalla que decidas enviarnos con «Informar de un problema», junto con lo que escribas y datos técnicos de la página y de tu navegador. Una grabación muestra todo lo que había en la pantalla que compartiste. Eliminamos las grabaciones a los 90 días</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">2. Cómo usamos tu información</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Usamos la información que recopilamos para:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Prestar y mantener nuestros servicios de pagos protegidos</li>
          <li>Procesar transacciones y gestionar contratos</li>
          <li>Comunicarnos contigo sobre tu cuenta y tus transacciones</li>
          <li>Mejorar nuestros servicios y la experiencia de uso</li>
          <li>Cumplir nuestras obligaciones legales y prevenir el fraude</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">3. Información que compartimos</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          No vendemos, intercambiamos ni transferimos de ningún otro modo tu información personal a terceros, salvo:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Cuando lo exija la ley o un procedimiento judicial</li>
          <li>Para proteger nuestros derechos, nuestros bienes o la seguridad</li>
          <li>Con tu consentimiento expreso</li>
          <li>Con proveedores de servicios que nos ayudan en nuestras operaciones (bajo estrictos acuerdos de confidencialidad)</li>
        </ul>
        <p className="text-secondary-700 dark:text-secondary-200 mt-4">
          <strong>IA en las disputas.</strong> Nuestro Servicio de Disputas usa Claude, un modelo de IA de Anthropic, según se
          establece en las Reglas de Resolución de Disputas. Recibe el expediente del caso, que no contiene nombres, datos de contacto
          ni direcciones de billetera de nuestros registros. En el texto escrito por las partes, las direcciones de correo electrónico,
          las direcciones de billetera, los números de teléfono, los códigos postales del Reino Unido y las rutas de los enlaces se
          sustituyen por marcadores antes de enviarlo. Los nombres y las direcciones postales escritos en ese texto no se detectan, así
          que no los incluyas en lo que escribas en una disputa.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">4. Seguridad de los datos</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Aplicamos medidas de seguridad adecuadas para proteger tu información personal contra el acceso, la
          alteración, la divulgación o la destrucción no autorizados. Sin embargo, ningún método de transmisión por
          Internet ni de almacenamiento electrónico es 100% seguro.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">5. Datos en la blockchain</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Ten en cuenta que las transacciones en la blockchain son públicas e inmutables. Una vez que una transacción
          queda registrada en la blockchain, no puede modificarse ni eliminarse. Esto incluye tu dirección de
          billetera y los importes de las transacciones, que quedarán visibles de forma permanente en la blockchain.
        </p>
      </section>

      <section id="cookies" className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">6. Cookies</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Usamos un pequeño número de cookies y de almacenamiento similar en el navegador:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2 mb-4">
          <li>
            <strong>Estrictamente necesarias</strong> &mdash; <code>AUTH-TOKEN</code> mantiene tu sesión iniciada;{' '}
            <code>cookie_consent</code> recuerda tu elección sobre cookies durante seis meses; la conexión de tu
            billetera y el tema de visualización se guardan en el almacenamiento local de tu navegador. Son necesarias
            para que el sitio funcione y siempre están activas.
          </li>
          <li>
            <strong>Analíticas (opcionales)</strong> &mdash; Google Analytics (<code>_ga</code>,{' '}
            <code>_ga_*</code>) mide cómo se usa el sitio. Solo se instalan si las aceptas, y se eliminan si más
            adelante las rechazas. Si las has aceptado e inicias un pago aquí &mdash; creando una solicitud de pago, o
            pagando desde nuestra página de pago &mdash; guardamos tu identificador de Google Analytics junto con ese
            pago. Cuando el pago se financia, le indicamos a Google Analytics que provino de tu visita, con su importe
            y nuestra comisión; no se comparte ninguna dirección de billetera ni ninguna transacción. Eliminamos el
            identificador una vez enviado ese dato, o si el pago vence sin haberse financiado.
          </li>
        </ul>
        <p className="text-secondary-700 dark:text-secondary-200">
          Puedes cambiar tu elección en cualquier momento:{' '}
          <button type="button" onClick={openConsentSettings} className="text-primary-600 hover:text-primary-500 underline">
            Configuración de cookies
          </button>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">7. Tus derechos</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Tienes derecho a:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Acceder a tu información personal y revisarla</li>
          <li>Solicitar la corrección de información inexacta</li>
          <li>Solicitar la eliminación de tu información personal (sujeto a los requisitos legales)</li>
          <li>Retirar tu consentimiento al tratamiento de datos cuando corresponda</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">8. Contacto</h2>
        <p className="text-secondary-700 dark:text-secondary-200">
          Si tienes preguntas sobre esta Política de Privacidad o sobre nuestras prácticas de tratamiento de datos,
          escríbenos a{' '}
          <a href="mailto:privacy@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
            privacy@conduit-ucpi.com
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">9. Cambios en esta política</h2>
        <p className="text-secondary-700 dark:text-secondary-200">
          Podemos actualizar esta Política de Privacidad periódicamente. Te informaremos de cualquier cambio
          publicando la nueva Política de Privacidad en esta página y actualizando la fecha de &quot;Última
          actualización&quot;.
        </p>
      </section>
    </>
  );
}
