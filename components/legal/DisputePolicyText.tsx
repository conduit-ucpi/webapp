import DisputeRules from '@/components/dispute-rules/DisputeRules';
import { A, Heading, Items, Section, Sub } from '@/components/legal/LegalParts';
import { useBrand } from '@conduit-ucpi/whitelabel-sdk';

/** The file whose last change is the rules' dateModified: this one, which holds most of their words. */
export const DISPUTE_POLICY_FILE = 'components/legal/DisputePolicyText.tsx';

/**
 * The Dispute Resolution Rules.
 *
 * Sections 4 and 5 state what the escrow contract (EscrowContract, created by EscrowContractFactory)
 * does, so each statement must hold against the contract source. Sections 6 and 7.1 to 7.3 are served
 * live by disputeservice from DISPUTE_POLICY.md, under the commit that last changed it, because that
 * file is also what the deciding model is told. They apply only when the platform's default Third
 * Voter holds the seat.
 *
 * Every name comes from the visitor's brand, except clause 2.1: it says whose trading name
 * Stabledrop is, which would be false of any other brand.
 *
 * English only: the served sections are in English, and the rest stays with them until there is a
 * reviewed translation of the whole text. The page's dateModified is the last change to THIS file.
 */
export default function DisputePolicyText() {
  const brand = useBrand().name;
  return (
    <>
      <h1 className="text-4xl font-bold text-secondary-900 dark:text-white mb-8">{brand} Dispute Resolution Rules</h1>

      <Section title="1. Definitions">
        <Sub n="1.1">Definitions, please refer to definitions in <A href="/terms-of-service">{brand} T&amp;C</A>.</Sub>
      </Section>

      <Section title="2. About these rules">
        <Sub n="2.1">These rules explain how disputes about Protected Payments made using {brand} are resolved. Stabledrop is the trading name of Conduit-UCPI Ltd, a company registered in Scotland (SC880319), at 5 South Charlotte Street, Edinburgh, EH2 4AN.</Sub>
        <Sub n="2.2">These rules form part of the {brand} Terms and Conditions. If you use {brand} through a Partner, the Partner&apos;s terms also apply to you. If they conflict with these rules on how a dispute is resolved, these rules apply.</Sub>
        <Sub n="2.3">A dispute is always decided under the rules version in force when its Protected Payment was created.</Sub>
      </Section>

      <Section title={`3. ${brand}'s role`}>
        <Sub n="3.1">{brand} provides software. It is not a party to your transaction, and it is not a bank, payment service provider, money transmitter or escrow agent.</Sub>
        <Sub n="3.2">Funds in a Protected Payment are held by the Smart Contract, not by {brand}. The Smart Contract has no owner, administrator key, pause or upgrade function. No one, including {brand}, can move, freeze or redirect those funds.</Sub>
        <Sub n="3.3">When {brand}&apos;s Third Voter votes, its vote is worked out under section 6 and automated through the Dispute Service.</Sub>
        <Sub n="3.4">{brand} staff can help with using the dispute tools and with technical problems. Staff cannot resolve disputes, suggest outcomes, share anyone&apos;s contact details or move funds.</Sub>
      </Section>

      <Section title="4. How each Smart Contract treats a Dispute">
        <Sub n="4.1">The Smart Contract uses a system of Open 2-of-3 matching-split release. The three parties are: the Buyer, the Seller, and the Third Voter (a party you nominate, or {brand}&apos;s default). Funds are released automatically when any two of the three agree.</Sub>
        <Heading>How a dispute works in the Smart Contract</Heading>
        <Sub n="4.2">Each payment is its own contract on the blockchain. It records a Buyer, a Seller and a Third Voter.</Sub>
        <Sub n="4.3">The Smart Contract cannot be changed once it is created, by anyone, including {brand}. It has no owner, no admin key and no way to be upgraded. Its rules are fixed in its code.</Sub>
        <Sub n="4.4">When the Smart Contract is initiated, the Platform Fee is deducted and the contract holds the rest.</Sub>
        <Sub n="4.5">If there is no dispute, after the payout date the amount held can be released, and only to the seller.</Sub>
        <Sub n="4.6">Raising a dispute: only the buyer can raise a dispute, only once, and only before the Payout Date. Therefore, a payment with no payout date (an instant payment) cannot be disputed. A dispute cannot be withdrawn.</Sub>
        <Sub n="4.7">Voting: while a dispute is open, the Buyer, the Seller and the Third Voter can each vote. A vote is a whole number from 0 to 100 representing the percentage of the funds remaining in the Smart Contract that should return to the Buyer, the rest going to the Seller.</Sub>
        <Sub n="4.8">If nobody holds the Third Voter Seat, only the buyer&apos;s and the seller&apos;s votes count.</Sub>
        <Sub n="4.9">The money can only go to the Buyer and/or the Seller.</Sub>
        <Sub n="4.10">There is no time limit. While no two votes match, the money stays in the contract.</Sub>
        <Sub n="4.11">The Seller can move their payout to another wallet unless there&apos;s a live dispute.</Sub>
        <Sub n="4.12">On the {brand} site: raising a dispute also sends the percentage you enter as your vote, from your own wallet. Each figure you enter on the dispute screen after that is sent as your vote in the same way. The reason you give each time is saved in {brand}&apos;s records alongside it, not in the Smart Contract.</Sub>
      </Section>

      <Section title="5. How the Third Voter is appointed and changed">
        <Sub n="5.1">At creation: the Third Voter is set when the payment is created. On {brand} it is {brand}&apos;s default Third Voter, unless the seller enters a different wallet address. The Third Voter can never be the Buyer or the Seller.</Sub>
        <Sub n="5.2">When the Third Voter Seat empties: only when the Seller&apos;s payout is transferred through an operator the Seller has approved, such as a sale on the Marketplace, when the Third Voter is removed (5.3), or when the Third Voter resigns (5.7). A Seller moving their payout directly to another wallet does not empty the seat.</Sub>
        <Sub n="5.3">Removal: during a dispute, the Buyer or the Seller can remove the Third Voter if it has not voted for 30 days. Those 30 days count from the latest of: when it took the seat, its last vote, or when the dispute was raised. Removing it does not move any money.</Sub>
        <Sub n="5.4">Filling an empty seat: the buyer and the seller each nominate a wallet address, and either can change their nomination. When both name the same address, that wallet takes the seat. It cannot be the buyer or the seller. If the seller&apos;s payout moves to another wallet, the seller&apos;s nomination is cleared.</Sub>
        <Sub n="5.5">The default Third Voter: if the seat is empty during a dispute, the Buyer or Seller can put {brand}&apos;s default Third Voter in it once 72 hours have passed. The 72 hours count from when the dispute was raised, or from when the seat emptied if that happened during the dispute. Until the default is actually seated, a matching nomination still takes the seat.</Sub>
        <Sub n="5.6">A newly seated Third Voter starts with no vote. A removed Third Voter&apos;s vote no longer counts.</Sub>
        <Sub n="5.7">A Third Voter can resign at any point, leaving an empty seat. A Third Voter can be replaced at any point by the Buyer and Seller agreeing on a new appointee - this is facilitated in the dispute management of the UI.</Sub>
        <Heading>Choosing the Third Voter</Heading>
        <Sub n="5.8">{brand}&apos;s Third Voter is the Third Voter on every Protected Payment unless the Buyer and Seller agree otherwise.</Sub>
        <Sub n="5.9">Before a Protected Payment is funded, either party may propose a different Third Voter. It is only used if the other party expressly accepts it before the payment is funded.</Sub>
        <Sub n="5.10">A Third Voter can never be the Buyer or the Seller. A party proposing a Third Voter confirms that it is independent of them.</Sub>
        <Sub n="5.11">{brand} is not responsible for a third party&apos;s Third Voter&apos;s decision making process, votes, conduct or fees.</Sub>
        <Sub n="5.12">Once a dispute has started, the Third Voter can only be changed as set out in section 5. If the parties would rather someone else decided, they can use independent review (section 8).</Sub>
      </Section>

      <Section title={`6. How ${brand}'s default Third Voter votes`}>
        <DisputeRules only={['2a', '3', '4', '4a']} />
        <Heading>Remember: the Third Voter has one vote of three</Heading>
        <p className="text-secondary-700 dark:text-secondary-200 mb-3">
          The contract has three votes of equal standing: the Buyer&apos;s, the Seller&apos;s, and the Third Voter&apos;s (a party you nominate, or {brand}&apos;s default). Funds are released when any two of the three agree.
        </p>
      </Section>

      <Section title="7. Deadlines and notices">
        <DisputeRules only={['5']} bare />
        <Heading>Notices</Heading>
        <Sub n="7.4">Notices are sent by email in English, to the email address verified for your Wallet. It is the Buyer and Seller&apos;s responsibility to keep it up to date.</Sub>
        <Sub n="7.5">Reminders from a partner are a courtesy and do not change any deadline.</Sub>
        <Sub n="7.6">Failure to receive a notice is not {brand}&apos;s responsibility, provided the notice was sent to the verified email address. It is your responsibility to keep that address current and to check your {brand} dashboard, where every dispute is also shown.</Sub>
      </Section>

      <Section title="8. Independent review">
        <Sub n="8.1">The Third Voter can be changed up to any point up to payout by mutual consent between the Buyer and Seller.</Sub>
        <Sub n="8.2">Disputed Funds stay locked in the Smart Contract until the decision is carried out.</Sub>
        <Sub n="8.3">The reviewer gets one vote in the Open 2-of-3 matching-split release system.</Sub>
      </Section>

      <Section title="9. Evidence and fair play">
        <Sub n="9.1">Evidence can include links to photographs, delivery and shipping records, invoices and messages between the parties.</Sub>
        <Sub n="9.2">Evidence must be genuine, relevant to the payment, and yours to share. Do not include other people&apos;s personal data unless it is needed to decide the dispute.</Sub>
        <Sub n="9.3">You must not:</Sub>
        <Items>
          <li>submit false, altered or misleading evidence;</li>
          <li>include text, images or hidden content designed to instruct, mislead or influence the AI system;</li>
          <li>impersonate anyone; or</li>
          <li>interfere with the dispute service, the Smart Contract or a reviewer.</li>
        </Items>
        <Sub n="9.4">If you do, your evidence may be disregarded, your access may be suspended, and the matter may be reported to the authorities where the law requires it.</Sub>
      </Section>

      <Section title="10. Fees and costs">
        <Sub n="10.1">There is no charge for resolving a dispute through {brand}.</Sub>
        <Sub n="10.2">If you use an independent reviewer or anyone else, you pay their fees directly, under their terms. Fees are never paid through {brand} or out of the funds in the Smart Contract, which can only be paid to the Buyer or the Seller.</Sub>
        <Sub n="10.3">{brand} is not responsible for paying any costs incurred by either party as a result of taking part in a dispute.</Sub>
      </Section>

      <Section title="11. Your consents and rights">
        <Sub n="11.1">When {brand}&apos;s Third Voter votes on your dispute, you consent to automated systems being used.</Sub>
        <Sub n="11.2">Nothing in these rules removes any right you have by law that cannot be excluded by contract, including consumer rights in the country where you live.</Sub>
      </Section>

      <Section title="12. Liability">
        <Sub n="12.1">Decisions can be wrong. That is why you can object and use independent review. {brand} is not liable for the outcome of a dispute decided under these rules, or for any loss arising from it, except where the law does not allow that liability to be excluded, such as for fraud.</Sub>
        <Sub n="12.2">Any other liability of {brand} is limited as set out in the {brand} Platform Terms.</Sub>
      </Section>

      <Section title="13. Changes to these rules">
        <Sub n="13.1">{brand} may update these rules. Changes are published at <A href="/dispute-policy">this page</A> and take effect as soon as published, with a new rules version number.</Sub>
        <Sub n="13.2">Each Smart Contract is governed by the published rules that were in effect on the date and time that the Smart Contract was created.</Sub>
      </Section>

      <Section title="14. Governing law and language">
        <Sub n="14.1">These rules are governed by the law of England and Wales, and the courts of England and Wales have non-exclusive jurisdiction. This does not affect any mandatory rights you have where you live, or your right to bring a claim in the courts there.</Sub>
        <Sub n="14.2">These rules are published in English. If other versions are provided in other languages and differ, the English version prevails.</Sub>
      </Section>
    </>
  );
}
