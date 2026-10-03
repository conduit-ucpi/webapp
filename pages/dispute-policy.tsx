import SEO from '@/components/SEO'
import { GetStaticProps } from 'next'
import { ReactNode } from 'react';
import { isr } from '@/utils/isr';
import { lastTextChangeISO } from '@/lib/server/lastTextChange';
import DisputeRules from '@/components/dispute-rules/DisputeRules';
import { useBrand } from '@conduit-ucpi/whitelabel-sdk';

/**
 * The dispute policy, in three parts.
 *
 * Parts 1 and 2 state what the escrow contract (EscrowContract, created by EscrowContractFactory)
 * does, and nothing else: no reasons, no advice. Every statement is checked against the contract
 * source. Part 3 is served live by disputeservice from DISPUTE_POLICY.md, under the commit that
 * last changed it, and applies only when the platform's default tiebreaker holds the seat.
 *
 * Every name comes from the visitor's brand. The fee sentence names nobody: the fee goes to the
 * platform's fee wallet, and on some brands part of it to a partner.
 */

/** Said at the start of the page and again at the end, word for word. */
const threeVotes = (brand: string) =>
  `The contract has three votes of equal standing: the buyer's, the seller's, and the tiebreaker's (a party you nominate, or ${brand}'s default). Funds are released when any two of the three agree.`;

const part1 = (brand: string): ReactNode[] => [
  <>Each payment is its own contract on the blockchain. It records a buyer, a seller and a tiebreaker.</>,
  <><strong>The contract cannot be changed once it is created, by anyone, including {brand}.</strong> It has no owner, no admin key and no way to be upgraded. Its rules are fixed in its code.</>,
  <>When the buyer pays, the platform fee is deducted and the contract holds the rest. The fee is 1% of the amount, with a minimum of 0.30 of the payment&apos;s token. Amounts of 0.001 of the token or less carry no fee.</>,
  <>If there is no dispute, after the payout date the amount held can be released, and only to the seller.</>,
  <><strong>Raising a dispute:</strong> only the buyer can, only once, and only before the payout date. A payment with no payout date (an instant payment) cannot be disputed. A dispute cannot be withdrawn.</>,
  <><strong>Voting:</strong> while a dispute is open, the buyer, the seller and the tiebreaker can each vote. A vote is a whole number from 0 to 100: the percentage of the amount held that goes to the buyer. The rest goes to the seller.</>,
  <>Each of them can change their vote any number of times. The contract keeps only each one&apos;s latest vote. It stores a number, with no message.</>,
  <><strong>The moment any two of the three latest votes are the same number,</strong> the contract pays out that split in the same transaction. The payout is final.</>,
  <>If nobody holds the tiebreaker seat, only the buyer&apos;s and the seller&apos;s votes count.</>,
  <>The money can only go to the buyer and the seller.</>,
  <>There is no time limit. While no two votes match, the money stays in the contract.</>,
  <>The seller can move their payout to another wallet, including during a dispute. That wallet becomes the seller for voting, and it starts with no vote.</>,
  <><strong>On the {brand} site:</strong> raising a dispute also sends the percentage you enter as your vote, from your own wallet. Each figure you enter on the dispute screen after that is sent as your vote in the same way. The reason you give each time is saved in {brand}&apos;s records alongside it, not in the contract.</>,
];

const part2 = (brand: string): ReactNode[] => [
  <><strong>At creation:</strong> the tiebreaker is set when the payment is created. On {brand} it is {brand}&apos;s default tiebreaker, unless the seller enters a different wallet address. The tiebreaker can never be the buyer or the seller.</>,
  <><strong>When the seat empties:</strong> only when the payout is sold through the {brand} marketplace, or when a tiebreaker is removed (point 3). The seller moving their payout to another wallet does not empty it.</>,
  <><strong>Removal:</strong> during a dispute, the buyer or the seller can remove the tiebreaker if it has not voted for 30 days. Those 30 days count from the latest of: when it took the seat, its last vote, or when the dispute was raised. Removing it does not move any money.</>,
  <><strong>Filling an empty seat:</strong> the buyer and the seller each nominate a wallet address, and either can change their nomination. When both name the same address, that wallet takes the seat. It cannot be the buyer or the seller. If the seller&apos;s payout moves to another wallet, the seller&apos;s nomination is cleared.</>,
  <><strong>The default tiebreaker:</strong> if the seat is empty during a dispute, anyone can put {brand}&apos;s default tiebreaker in it once 72 hours have passed. The 72 hours count from when the dispute was raised, or from when the seat emptied if that happened during the dispute. Until the default is actually seated, a matching nomination still takes the seat.</>,
  <>A newly seated tiebreaker starts with no vote. A removed tiebreaker&apos;s vote no longer counts.</>,
  <>Once a tiebreaker holds the seat, it cannot be replaced by agreement. It can only be removed under point 3.</>,
];

function Part({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section id={`part-${number}`} className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm dark:shadow-none p-6 mb-6">
      <h2 className="text-2xl font-semibold text-secondary-800 dark:text-secondary-100 mb-4">
        Part {number}. {title}
      </h2>
      {children}
    </section>
  );
}

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal pl-6 space-y-2 text-secondary-600 dark:text-secondary-300">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  );
}

export default function DisputePolicy({ dateModified }: { dateModified: string }) {
  const brand = useBrand().name;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Dispute Policy",
    "description": `How disputes work in a ${brand} escrow payment: the contract's three-party voting, how the tiebreaker is appointed and changed, and how ${brand}'s default tiebreaker decides its vote.`,
    "publisher": { "@type": "Organization", "name": brand },
    "dateModified": dateModified
  };

  return (
    <>
      <SEO
        title={`Dispute Policy | ${brand}`}
        description={`How disputes work in a ${brand} escrow payment: three-party voting in the contract, how the tiebreaker is appointed and changed, and how ${brand}'s default tiebreaker decides its vote.`}
        keywords="escrow dispute, dispute policy, tiebreaker, USDC escrow, smart contract dispute"
        canonical="/dispute-policy"
        structuredData={structuredData}
      />
      <div className="min-h-screen bg-white dark:bg-secondary-900 py-12 transition-colors">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-secondary-900 dark:text-white mb-2">Dispute Management System</h1>
            <p id="three-votes-intro" className="text-lg text-secondary-700 dark:text-secondary-200 mb-2">{threeVotes(brand)}</p>
            <p className="text-lg text-secondary-600 dark:text-secondary-300 mb-8">
              This page covers {brand} escrow payments.
            </p>

            <Part number={1} title="How a dispute works in the escrow contract">
              <Points items={part1(brand)} />
            </Part>

            <Part number={2} title="How the tiebreaker is appointed and changed">
              <Points items={part2(brand)} />
            </Part>

            <Part number={3} title={`How ${brand}'s default tiebreaker votes`}>
              <DisputeRules />
            </Part>

            <section id="one-vote" className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm dark:shadow-none p-6 mb-6">
              <h2 className="text-2xl font-semibold text-secondary-800 dark:text-secondary-100 mb-4">Remember: the tiebreaker has one vote of three</h2>
              <p className="text-secondary-600 dark:text-secondary-300">{threeVotes(brand)}</p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

// Static generation for SEO.
//
// `dateModified` comes from git, so it changes only when this file does; see
// lib/server/lastTextChange.ts for why, and for the file-granularity caveat.
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      dateModified: lastTextChangeISO('pages/dispute-policy.tsx', '2026-10-03'),
    },
    ...isr(86400), // Revalidate daily
  };
}
