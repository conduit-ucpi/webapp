import { openConsentSettings } from '@/lib/consent';

/**
 * The Privacy Policy, in English. The page's "Last Updated" date is the last commit that changed
 * THIS file, so only the words belong here: layout lives in PrivacyPolicy.tsx and the Spanish in
 * PrivacyText.es.tsx.
 */
export default function PrivacyTextEn() {
  return (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">1. Information We Collect</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          When you use Conduit UCPI, we collect the following types of information:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Wallet addresses and public blockchain data</li>
          <li>Email addresses for account identification</li>
          <li>Transaction data related to payment contracts</li>
          <li>Usage analytics and performance metrics</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">2. How We Use Your Information</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          We use the information we collect to:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Provide and maintain our protected payment services</li>
          <li>Process transactions and manage contracts</li>
          <li>Communicate with you about your account and transactions</li>
          <li>Improve our services and user experience</li>
          <li>Comply with legal obligations and prevent fraud</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">3. Information Sharing</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          We do not sell, trade, or otherwise transfer your personal information to third parties, except:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>When required by law or legal process</li>
          <li>To protect our rights, property, or safety</li>
          <li>With your explicit consent</li>
          <li>With service providers who assist in our operations (under strict confidentiality agreements)</li>
        </ul>
        <p className="text-secondary-700 dark:text-secondary-200 mt-4">
          <strong>AI in disputes.</strong> Our Dispute Service uses Claude, an AI model provided by Anthropic, as set out in the
          Dispute Resolution Rules. It receives the case record, which contains no names, contact details or wallet addresses from
          our records. In the text the parties wrote, email addresses, wallet addresses, phone numbers, UK postcodes and the paths of
          links are replaced with placeholders before it is sent. Names and street addresses written in that text are not detected,
          so please leave them out of what you write in a dispute.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">4. Data Security</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          We implement appropriate security measures to protect your personal information against unauthorized access, 
          alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic 
          storage is 100% secure.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">5. Blockchain Data</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          Please note that blockchain transactions are public and immutable. Once a transaction is recorded on the 
          blockchain, it cannot be modified or deleted. This includes your wallet address and transaction 
          amounts, which will be permanently visible on the blockchain.
        </p>
      </section>

      <section id="cookies" className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">6. Cookies</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          We use a small number of cookies and similar browser storage:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2 mb-4">
          <li>
            <strong>Strictly necessary</strong> &mdash; <code>AUTH-TOKEN</code> keeps you signed in;{' '}
            <code>cookie_consent</code> remembers your cookie choice for six months; your wallet connection and
            display theme are kept in your browser&rsquo;s local storage. These are needed for the site to work and
            are always on.
          </li>
          <li>
            <strong>Analytics (optional)</strong> &mdash; Google Analytics (<code>_ga</code>,{' '}
            <code>_ga_*</code>) measures how the site is used. These are set only if you accept them, and are
            deleted if you later reject them. If you have accepted them and you start a payment here &mdash; by
            creating a payment request, or by paying from our Pay page &mdash; we store your Google Analytics
            identifier with that payment. When it is funded, we tell Google Analytics that the payment came from
            your visit, with its amount and our fee; no wallet address or transaction is shared. We delete the
            identifier once that is sent, or if the payment expires without being funded.
          </li>
        </ul>
        <p className="text-secondary-700 dark:text-secondary-200">
          You can change your choice at any time:{' '}
          <button type="button" onClick={openConsentSettings} className="text-primary-600 hover:text-primary-500 underline">
            Cookie settings
          </button>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">7. Your Rights</h2>
        <p className="text-secondary-700 dark:text-secondary-200 mb-4">
          You have the right to:
        </p>
        <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
          <li>Access and review your personal information</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your personal information (subject to legal requirements)</li>
          <li>Withdraw consent for data processing where applicable</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">8. Contact Us</h2>
        <p className="text-secondary-700 dark:text-secondary-200">
          If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
          <a href="mailto:privacy@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
            privacy@conduit-ucpi.com
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">9. Changes to This Policy</h2>
        <p className="text-secondary-700 dark:text-secondary-200">
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the 
          new Privacy Policy on this page and updating the "Last Updated" date.
        </p>
      </section>
    </>
  );
}
