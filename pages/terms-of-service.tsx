import { formatDateTimeWithTZ } from '@/utils/validation';

export default function TermsOfService() {
  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <p className="text-gray-600 mb-6">
            <strong>Last Updated:</strong> {formatDateTimeWithTZ(Date.now())}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing and using Conduit UCPI ("the Service"), you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              Conduit UCPI is a decentralized escrow platform that enables users to create time-delayed escrow 
              contracts on the Avalanche blockchain. The Service facilitates:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Creation and management of escrow contracts</li>
              <li>USDC token transactions and transfers</li>
              <li>Integration with Web3 wallets and payment processors</li>
              <li>Dispute resolution mechanisms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Responsibilities</h2>
            <p className="text-gray-700 mb-4">
              By using the Service, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Provide accurate and truthful information</li>
              <li>Maintain the security of your wallet and private keys</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Not use the Service for illegal or fraudulent activities</li>
              <li>Not attempt to exploit, hack, or disrupt the Service</li>
              <li>Be solely responsible for your transactions and their outcomes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Risks and Disclaimers</h2>
            <p className="text-gray-700 mb-4">
              <strong>IMPORTANT:</strong> Use of blockchain technology and cryptocurrencies involves significant risks:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Transactions on the blockchain are irreversible</li>
              <li>Smart contracts may contain bugs or vulnerabilities</li>
              <li>Network congestion may delay transactions</li>
              <li>Loss of private keys results in permanent loss of funds</li>
              <li>Regulatory changes may affect the availability of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              To the maximum extent permitted by law, Conduit UCPI and its operators shall not be liable for any 
              direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Loss of funds or cryptocurrencies</li>
              <li>Smart contract failures or exploits</li>
              <li>Network downtime or service interruptions</li>
              <li>Third-party service failures (Web3Auth, MoonPay, etc.)</li>
              <li>User error or misuse of the platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Service Availability</h2>
            <p className="text-gray-700 mb-4">
              We strive to maintain the Service's availability but do not guarantee uninterrupted access. 
              The Service may be temporarily unavailable due to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Scheduled maintenance</li>
              <li>Network congestion or blockchain issues</li>
              <li>Security incidents</li>
              <li>Technical difficulties</li>
              <li>Regulatory requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Third-Party Services</h2>
            <p className="text-gray-700 mb-4">
              The Service integrates with third-party providers including Web3Auth, MoonPay, and others. 
              Your use of these services is subject to their respective terms of service and privacy policies. 
              We are not responsible for the actions or policies of these third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The Service, including its design, code, and content, is protected by intellectual property laws. 
              You may not copy, modify, distribute, or reverse engineer any part of the Service without 
              explicit permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Termination</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to suspend or terminate your access to the Service at any time, with or 
              without notice, for violations of these terms or other reasons we deem necessary.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These terms shall be governed by and construed in accordance with the laws of New Zealand, 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
            <p className="text-gray-700">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
                legal@conduit-ucpi.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-700">
              We reserve the right to modify these terms at any time. Changes will be effective immediately 
              upon posting. Your continued use of the Service after any changes constitutes acceptance of 
              the new terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}