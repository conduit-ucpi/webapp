import { ReactNode } from 'react';
import { formatDateTimeWithTZ } from '@/utils/validation';

/** A numbered part heading within Schedule 1 (e.g. "3. United Kingdom"). */
function Clause({ n, heading }: { n: string; heading: string }) {
  return (
    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mt-6 mb-3">
      {n}. {heading}
    </h3>
  );
}

/** A numbered sub-clause within Schedule 1, keeping its number hanging in the margin. */
function Sub({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="text-secondary-700 dark:text-secondary-200 mb-3 pl-12 -indent-12">
      <span className="inline-block w-12 align-top tabular-nums">{n}</span>
      {children}
    </p>
  );
}

export default function TermsOfService() {
  return (
    <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-8">Terms of Service</h1>
          
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">
            <strong>Last Updated:</strong> {formatDateTimeWithTZ(Date.now())}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              By accessing and using Conduit UCPI ("the Service"), you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">2. Description of Service</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              Conduit UCPI is a decentralized escrow platform that enables users to create time-delayed escrow 
              contracts on EVM-compatible blockchains. The Service facilitates:
            </p>
            <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
              <li>Creation and management of escrow contracts</li>
              <li>USDC token transactions and transfers</li>
              <li>Integration with Web3 wallets and payment processors</li>
              <li>Dispute resolution mechanisms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">3. Regulatory Position</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              The regulatory position of Conduit UCPI Ltd in respect of the Stabledrop protocol is set
              out in{' '}
              <a href="#schedule-1" className="text-primary-600 hover:text-primary-500">
                Schedule 1 (Regulatory Position)
              </a>
              , which forms part of these Terms. Schedule 1 is provided for information and is not
              legal, financial, tax or regulatory advice; you are responsible for determining your own
              regulatory obligations and should take independent advice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">4. User Responsibilities</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              By using the Service, you agree to:
            </p>
            <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
              <li>Provide accurate and truthful information</li>
              <li>Maintain the security of your wallet and private keys</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Not use the Service for illegal or fraudulent activities</li>
              <li>Not attempt to exploit, hack, or disrupt the Service</li>
              <li>Be solely responsible for your transactions and their outcomes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">5. Risks and Disclaimers</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              <strong>IMPORTANT:</strong> Use of blockchain technology and cryptocurrencies involves significant risks:
            </p>
            <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
              <li>Transactions on the blockchain are irreversible</li>
              <li>Smart contracts may contain bugs or vulnerabilities</li>
              <li>Network congestion may delay transactions</li>
              <li>Loss of private keys results in permanent loss of funds</li>
              <li>Regulatory changes may affect the availability of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">6. Limitation of Liability</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              To the maximum extent permitted by law, Conduit UCPI and its operators shall not be liable for any 
              direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
              <li>Loss of funds or cryptocurrencies</li>
              <li>Smart contract failures or exploits</li>
              <li>Network downtime or service interruptions</li>
              <li>Third-party service failures (Web3Auth, MoonPay, etc.)</li>
              <li>User error or misuse of the platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">7. Service Availability</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              We strive to maintain the Service's availability but do not guarantee uninterrupted access. 
              The Service may be temporarily unavailable due to:
            </p>
            <ul className="list-disc pl-6 text-secondary-700 dark:text-secondary-200 space-y-2">
              <li>Scheduled maintenance</li>
              <li>Network congestion or blockchain issues</li>
              <li>Security incidents</li>
              <li>Technical difficulties</li>
              <li>Regulatory requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">8. Third-Party Services</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              The Service integrates with third-party providers including Web3Auth, MoonPay, and others. 
              Your use of these services is subject to their respective terms of service and privacy policies. 
              We are not responsible for the actions or policies of these third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">9. Intellectual Property</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              The Service, including its design, code, and content, is protected by intellectual property laws. 
              You may not copy, modify, distribute, or reverse engineer any part of the Service without 
              explicit permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">10. Termination</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              We reserve the right to suspend or terminate your access to the Service at any time, with or 
              without notice, for violations of these terms or other reasons we deem necessary.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">11. Governing Law</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              These terms shall be governed by and construed in accordance with the laws of Scotland,
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">12. Contact Information</h2>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              Conduit UCPI Ltd, Company No. 880319.
            </p>
            <p className="text-secondary-700 dark:text-secondary-200 mb-4">
              Registered address: 5 South Charlotte Street, Edinburgh, EH2 4AN, United Kingdom.
            </p>
            <p className="text-secondary-700 dark:text-secondary-200">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
                legal@conduit-ucpi.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">13. Changes to Terms</h2>
            <p className="text-secondary-700 dark:text-secondary-200">
              We reserve the right to modify these terms at any time. Changes will be effective immediately
              upon posting. Your continued use of the Service after any changes constitutes acceptance of
              the new terms.
            </p>
          </section>

          {/*
            Schedule 1 keeps its own clause numbering (1.1 … 6.3) deliberately: it is
            referenced by paragraph number elsewhere, so it must not be renumbered to
            follow the sections above.
          */}
          <section className="mb-8 pt-8 border-t border-secondary-200 dark:border-secondary-700" id="schedule-1">
            <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-2">
              Schedule 1 — Regulatory Position
            </h2>

            <Clause n="1" heading="Scope" />
            <Sub n="1.1">
              This statement describes the regulatory position of Conduit UCPI Ltd (SC880319)
              (&quot;Conduit&quot;) in respect of the Stabledrop protocol (&quot;Stabledrop&quot;),
              comprising Stabledrop Payments and Stabledrop Liquid.
            </Sub>
            <Sub n="1.2">
              It is provided for information. It is not legal, financial, tax or regulatory advice and
              must not be relied upon as such. Users are responsible for determining their own
              regulatory obligations and should take independent advice.
            </Sub>

            <Clause n="2" heading="Architecture" />
            <Sub n="2.1">
              The Stabledrop smart contracts are deployed permissionlessly on the Base network and may
              be interacted with directly by any party. Conduit does not control access to them.
            </Sub>
            <Sub n="2.2">
              The Stabledrop contract factory is immutable and publicly accessible independently of any
              interface provided by Conduit. Transaction parameters are constructed by contract code
              that Conduit does not control and cannot alter.
            </Sub>
            <Sub n="2.3">
              Counterparties transact directly with one another. Each counterparty authorises
              transactions by signing with private keys under its sole control.
            </Sub>
            <Sub n="2.4">
              Conduit does not at any time take possession or control of user funds, does not hold or
              have access to user private keys, and has no ability to move, freeze, reverse or
              otherwise interfere with user assets.
            </Sub>
            <Sub n="2.5">
              The Stabledrop smart contracts contain no administrative key or privileged role. Contract
              addresses and source code are published and independently verifiable on-chain.
            </Sub>

            <Clause n="3" heading="United Kingdom — Stabledrop Payments" />
            <Sub n="3.1">
              Stabledrop Payments executes conditional settlement instructions recorded in an immutable
              smart contract. Funds are released to the payee, or returned to the payer, solely in
              accordance with conditions agreed between the counterparties in advance.
            </Sub>
            <Sub n="3.2">
              Conduit does not enter into possession of the funds transferred at any stage, and cannot
              alter, override or influence the outcome of any transaction.
            </Sub>
            <Sub n="3.3">
              On that basis, Conduit does not carry on any regulated activity under the Financial
              Services and Markets Act 2000 or the Payment Services Regulations 2017 in respect of
              Stabledrop Payments, and does not require authorisation by the Financial Conduct
              Authority.
            </Sub>

            <Clause n="4" heading="United Kingdom — Stabledrop Liquid" />
            <Sub n="4.1">
              Stabledrop Liquid facilitates the assignment of pre-funded receivables. A pre-funded
              receivable is a trade receivable — an amount owed to a supplier for goods or services
              supplied in the course of business — in respect of which the corresponding funds are
              already committed to an immutable Stabledrop settlement contract.
            </Sub>
            <Sub n="4.2">
              Stabledrop Liquid operates only in respect of settlement contracts that are already
              funded. No credit is extended and no financing obligation arises. The assignee&apos;s
              entitlement is conditional on the agreed release conditions being satisfied.
            </Sub>
            <Sub n="4.3">
              The assignment of a pre-funded receivable is not a payment service, is not the issuance
              of electronic money, and does not constitute lending or the operation of an electronic
              system in relation to lending.
            </Sub>
            <Sub n="4.4">
              Pre-funded receivables are assigned bilaterally between identified counterparties.
              Conduit does not pool, aggregate or manage receivables or the consideration paid for
              them.
            </Sub>
            <Sub n="4.5">
              On that basis, Conduit does not carry on any regulated activity under the Financial
              Services and Markets Act 2000 in respect of Stabledrop Liquid, and does not require
              authorisation by the Financial Conduct Authority.
            </Sub>

            <Clause n="5" heading="European Union" />
            <Sub n="5.1">
              Conduit does not provide custody or administration of crypto-assets on behalf of clients,
              does not operate a trading platform for crypto-assets, and does not exchange
              crypto-assets for funds or for other crypto-assets.
            </Sub>
            <Sub n="5.2">
              Conduit does not issue any asset-referenced token or e-money token.
            </Sub>
            <Sub n="5.3">
              Conduit does not provide transfer services for crypto-assets on behalf of clients.
              Transfers are constructed by immutable on-chain contract code and are initiated and
              authorised by users signing with private keys under their sole control. Conduit does not
              construct, initiate, execute, or have the ability to effect any transfer.
            </Sub>

            <Clause n="6" heading="United States" />
            <Sub n="6.1">
              Conduit does not take custody of user funds and does not exercise independent control
              over user assets. On that basis it does not act as a money transmitter for the purposes
              of guidance issued by the Financial Crimes Enforcement Network.
            </Sub>
            <Sub n="6.2">
              Conduit does not issue a payment stablecoin and is not a permitted payment stablecoin
              issuer for the purposes of the GENIUS Act.
            </Sub>
            <Sub n="6.3">
              State money transmission requirements vary. US counterparties are responsible for
              determining their own position and should take independent advice.
            </Sub>
          </section>
        </div>
      </div>
    </div>
  );
}