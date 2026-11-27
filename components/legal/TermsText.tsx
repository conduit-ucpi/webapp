import { A, Def, Heading, Items, Para, Section, Sub } from './LegalParts';

const DISPUTE_POLICY = 'https://stabledrop.me/dispute-policy/';
const PRIVACY_POLICY = 'https://stabledrop.me/privacy-policy/';
const TERMS = 'https://stabledrop.me/terms-of-service/';

/**
 * ⚠️ THE TERMS OF SERVICE, IN ENGLISH: THE TEXT EVERY SIGN-IN ACCEPTS. The terms version in the SIWE
 *    statement is the last commit that changed THIS file (TERMS_FILE in lib/server/gitFileVersion.js),
 *    and so is the page's "Last Updated" date. Only the words belong here: layout lives in
 *    TermsOfService.tsx and LegalParts.tsx, and the Spanish in TermsText.es.tsx, so changing either
 *    does not issue a new version. Any edit here does.
 */
export default function TermsTextEn() {
  return (
    <>
      <Section title="1. About these Terms">
        <Sub n="1.1">
          These Terms and Conditions are an agreement between Conduit-UCPI Ltd, a company registered in Scotland (SC880319), at 5 South Charlotte Street, Edinburgh, EH2 4AN ("Stabledrop", "we", "us", "SD") and the user ("you" or "your") governing your use of Stabledrop (the "Service" or the "Product").
        </Sub>

        <Heading>Use of the term "Escrow"</Heading>
        <Para flush>
          Wherever the terms "escrow", "escrow payment", "escrow account" or similar appear on this website, in our applications, documentation or communications, they describe an escrow-like arrangement: funds are locked in a self-executing smart contract and released or returned according to pre-defined conditions agreed by the parties.
        </Para>
        <Para flush>
          Conduit-UCPI Ltd does not act as an escrow agent, trustee, custodian or other fiduciary, and does not at any time take possession or control of user funds. We do not hold any licence, authorisation or registration to provide escrow services in any jurisdiction, and use of the term "escrow" should not be taken to imply that we do, or that the protections associated with licensed or regulated escrow services apply.
        </Para>
        <Para flush>
          Smart contracts operate automatically and independently of Conduit UCPI Ltd. Users are responsible for understanding the terms and risks of any transaction before entering into it.
        </Para>

        <Heading>Use of the terms "Arbiter" and "Arbitrator"</Heading>
        <Para flush>
          Wherever the terms "arbiter", "arbitrator", "arbitration" or similar appear on this website, in our applications, documentation or communications, they refer to the third of three parties entitled to vote on how funds held in a smart contract are distributed. Funds are released only when two of the three parties submit matching votes for the same split of funds. The arbiter's vote has no greater weight than either other party's, and the arbiter cannot release, return or redirect funds acting alone. This process is not arbitration within the meaning of the Arbitration (Scotland) Act 2010, the Arbitration Act 1996, or any equivalent law in any other jurisdiction. An arbiter's vote is not an arbitral award or a determination of any party's legal rights, and is not made under any arbitration agreement, procedural rules or seat of arbitration. Arbiters are not required to hold any qualification, accreditation or appointment as an arbitrator.
        </Para>
        <Para flush>
          Nothing in this process excludes, limits or replaces any party's right to pursue a dispute through the courts or any other legal remedy available to them.
        </Para>

        <Sub n="1.2">
          Stabledrop provides the Protected Payment software, and these Terms cover your use of that software. You can use it directly at stabledrop.me, or through another business that offers Stabledrop within its own website or app (a “Partner”). Either way, your Stabledrop account is created and accessed through Stabledrop’s own sign-in, and your Wallet is provided by our wallet provider (see section 6).
        </Sub>
        <Para>
          If you use Stabledrop through a Partner, the Partner’s own terms also apply to the Partner’s service, for example its website, any fee it charges and the customer support it provides. The Partner is responsible for its own service, and Stabledrop is responsible only for the Services.
        </Para>
        <Sub n="1.3">
          These Terms include the Stabledrop Dispute Resolution Rules, published at <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A>
        </Sub>
        <Sub n="1.4">
          These Terms apply however you access the Services, including directly at stabledrop.me, through a Partner, or through our API or MCP server. Before you use the Services for the first time, you will be asked to confirm that you have read and agree to these Terms, the Dispute Resolution Rules and the Privacy Policy. We record which version you accepted and when. You may not use the Services unless you accept these Terms. Section 19 explains how we handle changes.
        </Sub>
      </Section>

      <Section title="2. Definitions">
        <Def term="Administrator">
          a member of Stabledrop's team authorised to check that the Dispute Resolution Rules have been applied correctly before Stabledrop's Third Voter casts its vote, and to approve that vote from the Third Voter’s Safe. Administrators must follow the published Rules and act impartially, and step aside from any Dispute where they have a connection to the Buyer or Seller. They cannot move funds, change the Smart Contract, or vote on behalf of the Buyer or Seller or cause funds to be released without a matching vote from the Buyer or Seller.
        </Def>
        <Def term="AI system">
          computer software (artificial intelligence) that reads the Case record and the Rules within the Dispute Service and then suggests how Stabledrop's Third Voter should vote. It gives an opinion only: it holds no Key and cannot cast a vote, move funds, send messages or change any record. Its suggestions are checked by the Rules and, where these Rules say so, by an Administrator. The AI provider used is named in the Stabledrop privacy notice.
        </Def>
        <Def term="Automated Dispute Resolution">
          the process in section 6 of the Dispute Management Policy, in which the Dispute service works out how Stabledrop's Third Voter should vote, using published rules, AI and review by Stabledrop staff.
        </Def>
        <Def term="Blockchain">a shared public record of transactions that cannot be altered.</Def>
        <Def term="Buyer">
          the Wallet named in the Smart Contract as the Buyer, who can raise a dispute, participate in a dispute and be the recipient of a refund in a dispute. Anyone can put funds into the Smart Contract.
        </Def>
        <Def term="Case record">
          the parts of the Stabledrop records that the Dispute service uses to decide a Dispute, such as the Payment Terms, each party's votes, comments, reasons and evidence. Names, contact details and Wallet addresses are removed before a Case record is sent to an AI system.
        </Def>
        <Def term="Dispute">a disagreement between Buyer and Seller about whether, or how far, the Payment Terms have been met.</Def>
        <Def term="Dispute Resolution Rules">
          the rules at <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A> that decide disagreements between Buyer and Seller.
        </Def>
        <Def term="Dispute service">
          the part of Stabledrop's systems that works out how Stabledrop's Third Voter votes and sends Dispute notices. It cannot move funds.
        </Def>
        <Def term="ERC-20">
          ERC-20 is the standard for creating fungible tokens on the Ethereum blockchain and Ethereum-compatible networks, ensuring interoperability and compatibility among tokens.
        </Def>
        <Def term="Human Review">the review of a Dispute by an independent person under section 8 of the Dispute Management Policy.</Def>
        <Def term="Instant payment">a payment with no Payout date. It is paid straight away and cannot be disputed.</Def>
        <Def term="Keys" />
        <Items flush>
          <li>Public key - the ID of the wallet you see and visible to everyone.</li>
          <li>Private key - the password that allows you to transact using the wallet, which is machine generated, and cannot be changed.</li>
        </Items>
        <Para flush>The public key and private key together are a pair.</Para>
        <Def term="Marketplace">where a Seller can sell their right to be paid to another party, to be paid early.</Def>
        <Def term="On-chain">
          recorded on the Blockchain, in the Smart Contract, where it is public and cannot be changed. For example, an on-chain vote is a vote recorded in the Smart Contract, which is what counts towards releasing funds. A comment or proposal made in the dashboard but not entered as a vote is "off-chain": it is kept in the Stabledrop records, not in the Smart Contract.
        </Def>
        <Def term="Open 2-of-3 matching-split release">
          Each party can enter a percentage figure as many times as they wish during a dispute. There are 3 parties who can enter % figures.
        </Def>
        <Items flush>
          <li>2-of-3: 2-of-3 is when 2 of them agree.</li>
          <li>Release: release happens automatically when 2-of-3 enter the same figure.</li>
        </Items>
        <Def term="Outcome">a decision on a Dispute, which may be a full release to the Seller, a full refund to the Buyer, or a split between them.</Def>
        <Def term="Payment Terms">
          what the Buyer and Seller agreed when the Protected Payment was set up, including what is to be delivered, by when, and how delivery is confirmed.
        </Def>
        <Def term="Payout date (also called the expiry date)">
          the date set when a Protected Payment is created. The Buyer can raise a Dispute until then; after it, the funds can be released to the Seller if there is no Dispute.
        </Def>
        <Def term="Platform Fee">
          Platform fees are what you pay each time you process a transaction through Stabledrop’s platform. Fees are 1% of contract value with a minimum of 0.30 units of the Stablecoin used, deducted when the Protected Payment is set up.
        </Def>
        <Def term="Protected Payment">
          a payment that works like escrow. Funds are locked in the Smart Contract, not held by anyone, until released to the Seller or returned to the Buyer.
        </Def>
        <Def term="Review Provider">
          the independent dispute resolution provider that the Buyer and Seller choose together for Human Review under section 8 of the Dispute Management Policy. The Buyer and Seller jointly appoint any independent provider they both agree on; Stabledrop does not maintain or recommend a list of providers.
        </Def>
        <Def term="Rules">The Rules as listed and described within the Dispute Service in the Dispute Management Policy.</Def>
        <Def term="Safe">
          a type of shared digital wallet that is owned by several Keys and only acts when a set number of them approve, like a bank account that needs two signatures. Stabledrop's Third Voter votes from a Safe with three Keys, and at least two must approve before any vote is cast. Safe is the name of the product used as defined by Safe Labs GmbH, more details can be found here: <A href="https://app.safe.global/">https://app.safe.global/</A>; it is not a Stabledrop service.
        </Def>
        <Def term="Seller">
          the party who will be paid after the Payout date if there is no Dispute. If the Seller moves their payout to another Wallet, or sells it through the Marketplace, "Seller" means whoever now holds the right to be paid.
        </Def>
        <Def term="Services">the Stabledrop software, interface and Smart Contract, whether you use them directly or through another business.</Def>
        <Def term="Smart Contract">the software deployed on the blockchain that holds funds for each Protected Payment and carries out releases and refunds.</Def>
        <Def term="Stablecoin">
          a digital token issued under the ERC-20 token standard and designed to hold a stable value against a currency, such as USDT or USDC.
        </Def>
        <Def term="Stabledrop records">
          the information Stabledrop keeps about a Protected Payment and any Dispute, outside the Blockchain. This includes who the Buyer and Seller are and the email addresses linked to their Wallets, comments, reasons and evidence, notices sent, AI opinions, Administrator checks and decisions, and each party's acceptance of these Rules. It is handled under the Stabledrop privacy notice at <A href={PRIVACY_POLICY}>{PRIVACY_POLICY}</A> and kept for 7 years.
        </Def>
        <Def term="Third Voter">
          the party that holds one of three votes in a Dispute, alongside the Buyer and the Seller. By default it is Stabledrop's Third Voter, which is operated by Stabledrop and votes under the Dispute Management Policy Rules. The parties may choose a different Third Voter under section 5 of the Dispute Management Policy. A Third Voter cannot move funds on its own.
        </Def>
        <Def term="Third Voter seat">
          the Third Voter's role on a Protected Payment. Whoever is the Third Voter "holds the seat". The seat is "empty" when there is no Third Voter; while it is empty, only the Buyer's and Seller's votes count.
        </Def>
        <Def term="Wallet">a digital account for holding and sending Stablecoins.</Def>
        <Def term="Wallet address">
          like an account number for a Wallet: a long code starting "0x" that identifies where Stablecoins are sent. If you sign in to Stabledrop with your email, a Wallet address is created for you automatically.
        </Def>
      </Section>

      <Section title="3. What Stabledrop is, and is not">
        <Sub n="3.1">
          Stabledrop is a software suite that makes it easier to interact with specific open-source smart-contracts available on a blockchain. All fund movements are explicitly authorized by the buyer's or seller's wallets.
        </Sub>
        <Sub n="3.2">
          Stabledrop does not hold, take custody of or control, your funds at any time. Stablecoins move directly between the Buyer’s and Seller’s wallets through the Smart Contract.
        </Sub>
        <Para>
          Once a Protected Payment is set up, the Stablecoins in it are locked in the Smart Contract. Stabledrop cannot move, redirect, withdraw or freeze them. Only the Smart Contract can pay them out to the Buyer or the Seller, under these Terms, the Payment Terms and the Dispute Resolution Rules.
        </Para>
        <Para>
          Where Stabledrop’s Third Voter holds the Third Voter seat, it casts one of three votes in a Dispute, following the published Dispute Resolution Rules. That vote has no more weight than the Buyer’s or the Seller’s. Funds are released only when two of the three parties submit matching votes, so Stabledrop can never release, return or redirect funds acting alone.
        </Para>
        <Sub n="3.3">Stabledrop has no administrative, upgrade or override power over the smart contracts used by Stabledrop.</Sub>
        <Sub n="3.4">
          Stabledrop is not a bank, payment service provider, money transmitter, money services business, custodian, exchange, broker or escrow agent. It does not provide financial, investment, legal or tax advice.
        </Sub>
        <Sub n="3.5">
          Stabledrop is not a party to any transaction between Buyer and Seller. It does not sell, buy, check or guarantee any goods or services.
        </Sub>
        <Sub n="3.6">The Buyer and Seller decide the Payment Terms. The Smart Contract carries them out. Stabledrop does not decide how or when funds move.</Sub>
        <Sub n="3.7">Stabledrop does not convert money. Any conversion is provided by a third party, such as an exchange or a bank, under its own terms.</Sub>
      </Section>

      <Section title="4. Who can use Stabledrop">
        <Sub n="4.1">To use the Services you must:</Sub>
        <Items>
          <li>be at least 18 years old, or the age of legal adulthood where you live if that is higher, and able to enter into a binding contract;</li>
          <li>not be located in, or ordinarily resident in, a Restricted Location under section 5; and</li>
          <li>not be named on, or acting for anyone named on, a sanctions list (see section 5); and</li>
          <li>be allowed by the laws that apply to you to use the Services and the Stablecoins you use with them.</li>
        </Items>
        <Sub n="4.2">
          You can use the Services as an individual or for a business. If you use them for a business, you confirm that you have authority to accept these Terms on its behalf, and “you” includes that business.
        </Sub>
        <Sub n="4.3">You are responsible for checking that using the Services is lawful where you are.</Sub>
      </Section>

      <Section title="5. Sanctions, screening and restricted locations">
        <Sub n="5.1">You confirm that you, and anyone you act for or transact with through the Services:</Sub>
        <Items lettered>
          <li>(a) are not named on, or owned or controlled by anyone named on a sanctions list kept by the United States (including OFAC's Specially Designated Nationals list), the United Kingdom, the European Union or the United Nations; and</li>
          <li>(b) are not located in, or ordinarily resident in, a Restricted Location.</li>
        </Items>
        <Sub n="5.2">
          Restricted Locations are any country, territory or region that is the target of comprehensive or territory-wide sanctions or embargo administered by the United States (OFAC), the United Kingdom (OFSI), the European Union or the United Nations, as in force from time to time. As at November 6, 2026 these include Cuba, Iran, North Korea, and the Crimea, Donetsk, Zaporizhzhia, Kherson and Luhansk regions and other Russian-occupied areas of Ukraine; and any other place where use of the Services would breach sanctions law.
        </Sub>
        <Sub n="5.3">
          Stabledrop screens the Wallet addresses and email addresses involved in a Protected Payment including those of the Buyer, the Seller, anyone funding it and the Third Voter. We check them against sanctions lists and other published lists of high-risk or illegal activity. We may also use third-party tools to trace the transaction history of a Wallet address and produce a risk assessment. Screening may take place when a Wallet is first used with the Services and at other times.
        </Sub>
        <Sub n="5.4">We may refuse to set up a Protected Payment, block a Wallet address, or restrict your access to the Services, where</Sub>
        <Items>
          <li>a Wallet address or email address matches, or is linked to, a person or place described in section 5.1 or 5.2;</li>
          <li>the risk assessment exceeds our threshold; or</li>
          <li>we reasonably believe it is needed to comply with the law.</li>
        </Items>
        <Para>We do not have to explain our reasons where the law prevents us, or where doing so could undermine our controls.</Para>
        <Sub n="5.5">
          Our screening controls apply to access to the interface and Services before any funds are locked. Stabledrop has no control over a Smart Contract once it has been created so neither we nor anyone else can freeze, move or return Stablecoins once they are locked in a Protected Payment. If Stablecoins have already been sent to the address reserved for a Protected Payment, that we then refuse to set up no one, including Stabledrop, can move them unless the Protected Payment can later lawfully be set up. Stabledrop does not hold or control those Stablecoins.
        </Sub>
        <Sub n="5.6">We process personal data for screening as described in the Privacy Policy.</Sub>
      </Section>

      <Section title="6. Your wallet and keys">
        <Sub n="6.1">You are responsible for your Wallet, including keeping its keys, passwords and recovery phrases secure. If your Wallet is provided by another service, that service's terms also apply.</Sub>
        <Sub n="6.2">Stabledrop never has access to your keys and cannot recover them. If they are lost or stolen, you may permanently lose access to your Stablecoins.</Sub>
        <Para>
          Stabledrop provides a tool in the wallet manager for getting your wallet’s keys. We strongly recommend you use this to access your keys and store them securely separately. Stabledrop has no access to your keys and cannot help you if you lose them, or if the wallet manager (Privy - a third party company) experiences issues.
        </Para>
        <Sub n="6.3">Check every Wallet address before you send Stablecoins. Transactions sent to the wrong address cannot be reversed by Stabledrop.</Sub>
      </Section>

      <Section title="7. How Protected Payments work">
        <Sub n="7.1">
          The Buyer and Seller agree the Payment Terms, (buyer, seller, token (currency), amount, Payout date, Third Voter identity) when the Protected Payment is set up. Make them specific: they are what any dispute is decided against.
        </Sub>
        <Sub n="7.2">
          When the Buyer funds the Protected Payment, the Stablecoins are locked in the Smart Contract. Neither the Buyer, the Seller nor Stabledrop can move them except as set out in these Terms and the Payment Terms.
        </Sub>
        <Sub n="7.3">
          Each Protected Payment has an expiry date set when it is set up. If no dispute has been raised by then, the ERC-20 tokens will be released to the Seller automatically once that date has passed. The funds can only go to the Seller. If the Buyer raises a dispute before the expiry date, the funds are instead handled by the smart contract, as defined in the Dispute Resolution Rules, which may mean a full or partial refund to the Buyer (see 7.5 and section 8).
        </Sub>
        <Sub n="7.4">The Buyer and Seller can jointly agree to release, refund or split the funds at any time.</Sub>
        <Sub n="7.5">
          If there is a problem, the Buyer can raise a dispute under the Dispute Resolution Rules, but only before the expiry date. This stops release to the Seller until the dispute is resolved. Payments set up without an expiry date (instant transfers) cannot be disputed: you will be told this before you pay.
        </Sub>
        <Sub n="7.6">Blockchain transactions are final. Once the Smart Contract has released or returned Stablecoins, the transaction cannot be reversed.</Sub>
        <Sub n="7.7">If you are the Seller, please note:</Sub>
        <Items>
          <li>Only the Buyer can raise a dispute, and only before the expiry date. You cannot raise one.</li>
          <li>If the Buyer raises a dispute, the funds stay in the Smart Contract and you will not be paid until the dispute is resolved under the Dispute Resolution Rules. This may mean a full or partial refund to the Buyer.</li>
          <li>Once a dispute is raised, you take full part: you can add evidence, vote on the refund, change your vote, and request review by an independent organisation.</li>
          <li>If no dispute is raised by the expiry date, the funds will be released to you once that date has passed.</li>
          <li>Instant transfers (with no expiry date) cannot be disputed by either party.</li>
          <li>Nothing in these Terms affects any claim you may have against the Buyer in court, or your rights under the law where you live.</li>
        </Items>
      </Section>

      <Section title="8. Disputes between Buyer and Seller">
        <Sub n="8.1">Details of how disputes are managed can be found in Stabledrop’s Dispute Management Policy <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A>.</Sub>
        <Sub n="8.2">No one at Stabledrop unilaterally decides disputes or changes outcomes.</Sub>
        <Sub n="8.3">You can object to an automated decision before the Third Voter votes, as set out in the Dispute Resolution Rules (section 6.3). Once funds have been released the payment is final, and no one, including Stabledrop, can reverse it. After that, your remedy is a claim against the other party in court. Any rights you have by law are not affected.</Sub>
        <Sub n="8.4">Complaints about Stabledrop itself, rather than about the other party, are dealt with under section 20.</Sub>
      </Section>

      <Section title="9. Blockchain risks">
        <Sub n="9.1">Using blockchains carries risks, including:</Sub>
        <Items>
          <li>Loss of value: an ERC-20 token may lose its link to the currency it tracks, temporarily or permanently, including while it is locked in the Smart Contract.</li>
          <li>Issuer risk: ERC-20 tokens are issued by third parties. An issuer may freeze addresses, fail, or stop redeeming its tokens. Stabledrop has no control over issuers.</li>
          <li>Smart contract risk: the Smart Contract may contain errors or vulnerabilities. We have taken reasonable steps to test it, but no software can be guaranteed to be free of errors or vulnerabilities.</li>
          <li>Network risk: blockchain networks can be congested, delayed, changed or attacked, and network fees can rise.</li>
          <li>Regulatory risk: laws on any ERC-20 tokens may change in your country, and may affect whether you can use them.</li>
        </Items>
        <Sub n="9.2">
          By using the Services, you confirm that you understand these risks. Stabledrop is not responsible for losses caused by them, except where the loss results from our breach of these Terms or our failure to use reasonable care and skill, and subject to section 16.
        </Sub>
      </Section>

      <Section title="10. Fees">
        <Sub n="10.1">
          Stabledrop charges a Platform Fee of 1% of the amount of each Protected Payment, with a minimum of 0.30 units of the Stablecoin used (for example 0.30 USDC). The fee is deducted automatically when the Protected Payment is set up. So the amount locked in the Smart Contract is the amount funded less the Platform Fee.
        </Sub>
        <Sub n="10.2">
          Any payment to the Seller is paid from the amount locked, whether it is released after the Payout date, agreed between the Buyer and Seller, or decided under the Dispute Resolution Rules. On a full release, the Seller receives 99% of the amount funded, or the amount funded less the minimum fee, where that applies. On a partial release, the Seller receives the agreed share of the amount locked.
        </Sub>
        <Sub n="10.3">
          The Platform Fee is not refundable. Any refund to the Buyer, whether agreed between the Buyer and Seller or decided under the Dispute Resolution Rules, is calculated on the amount locked, not the amount funded. For example, on a 1,000 USDC Protected Payment, a full refund returns 990 USDC.
        </Sub>
        <Sub n="10.4">If you use Stabledrop through a Partner, the Partner may charge its own separate fee. Stabledrop does not charge you anything other than the Platform Fee.</Sub>
        <Sub n="10.5">Fees for dispute resolution are set out in the Dispute Resolution Rules <A href={DISPUTE_POLICY}>{DISPUTE_POLICY}</A></Sub>
      </Section>

      <Section title="11. Identity checks, and prohibited uses">
        <Sub n="11.1">
          Stabledrop does not carry out identity checks on users. Section 5 explains how we screen Wallet addresses and email addresses, and when we may refuse or restrict use of the Services.
        </Sub>
        <Sub n="11.2">
          You must not use the Services for any purpose that is unlawful under any law that applies to you or the other party, including the law of where either of you is located, resident or established, or in a way that breaks these Terms. This includes, without limitation, using the Services:
        </Sub>
        <Items lettered>
          <li>(a) for fraud, money laundering, terrorist financing or to evade sanctions;</li>
          <li>(b) to buy, sell or pay for goods or services that are illegal where either party is located;</li>
          <li>(c) with a Wallet, account or email address that is not yours, or that you are not authorised to use;</li>
          <li>(d) to deceive or mislead the other party to a Protected Payment, for example by setting Payment Terms you do not intend to honour;</li>
          <li>(e) to interfere with, disrupt, attack or test the security of the Services, the Smart Contract or any network, except under a disclosure programme we have published;</li>
          <li>(f) to access the Services by automated means other than our API or MCP server, or in a way that places an unreasonable load on them; or</li>
          <li>(g) to break any part of these Terms.</li>
        </Items>
        <Sub n="11.3">We will report suspicious activity to the authorities where the law requires it and we may share information with them or with our screening providers where the law allows.</Sub>
        <Sub n="11.4">If we reasonably believe you have broken this section, we may take the steps described in section 18, including suspending or ending your access to the Services.</Sub>
      </Section>

      <Section title="12. Taxes">
        <Para flush>
          You are responsible for any taxes on your transactions, and for any reporting the law requires of you, in every country where you have tax obligations. Stabledrop does not collect, withhold or report taxes for you.
        </Para>
      </Section>

      <Section title="13. Intellectual property and licence">
        <Sub n="13.1">Stabledrop owns, or is licensed to use, all rights in the Services, including the software, the Smart Contract, the interface, the Dispute Resolution Rules and the Stabledrop name and logo.</Sub>
        <Sub n="13.2">We give you a personal, non-exclusive, non-transferable, revocable licence to use the Services for their intended purpose while these Terms apply.</Sub>
        <Sub n="13.3">You must not copy, modify, reverse engineer or resell the Services, or use them to build a competing product, except where the law allows this and cannot be excluded.</Sub>
        <Sub n="13.4">If you send us feedback or suggestions, we may use them without any obligation to you.</Sub>
      </Section>

      <Section title="14. Privacy">
        <Sub n="14.1">Stabledrop processes the data it needs to provide the Services and resolve disputes, under the Stabledrop privacy notice at <A href={PRIVACY_POLICY}>{PRIVACY_POLICY}</A></Sub>
        <Sub n="14.2">If you use Stabledrop through a Partner business, that business may also collect and use your personal data under its own privacy notice. Stabledrop and that business are each responsible for the personal data they process for their own purposes.</Sub>
        <Sub n="14.3">Transactions on a public blockchain, including Wallet addresses and amounts, are visible to anyone and cannot be deleted. Do not put personal data in on-chain fields.</Sub>
        <Sub n="14.4">Your data may be transferred between locations, with the safeguards the local law requires.</Sub>
        <Sub n="14.5">
          You have a right to request a copy of your data held by Stabledrop. You have a right to request its deletion from our systems to the extent we are able, within a reasonable time. We cannot delete or change information recorded on the blockchain, which is public and permanent, and we may need to keep some information to meet legal, tax, accounting, sanctions or anti-money-laundering obligations, or to establish or defend legal claims. See the Privacy Policy.
        </Sub>
      </Section>

      <Section title="15. Disclaimers">
        <Sub n="15.1">The Services are provided "as is" and "as available". To the extent the law allows, we make no promise that they will be uninterrupted, error-free or suitable for your particular purpose.</Sub>
        <Sub n="15.2">We do not guarantee the value of any Stablecoin, the conduct of any Buyer or Seller, or the quality or delivery of anything bought or sold.</Sub>
        <Sub n="15.3">Nothing in these Terms affects rights you have by law that cannot be excluded, including consumer rights where you live.</Sub>
      </Section>

      <Section title="16. Limitation of liability">
        <Sub n="16.1">Nothing in these Terms limits liability for fraud, for death or personal injury caused by negligence, or for anything else the law does not allow to be limited.</Sub>
        <Sub n="16.2">Subject to 16.1, Stabledrop is not liable for:</Sub>
        <Items>
          <li>losses caused by the other party to your transaction;</li>
          <li>the outcome of a dispute decided under the Dispute Resolution Rules;</li>
          <li>losses caused by the risks described in section 9, or by events outside our reasonable control;</li>
          <li>loss of your keys, or transactions sent to the wrong address; or</li>
          <li>loss of profit, business, revenue or opportunity, or any indirect loss.</li>
        </Items>
        <Sub n="16.3">
          Subject to 16.1, Stabledrop's total liability to you under these Terms is limited to the greater of (a) the fees Stabledrop received from you in the 12 months before the claim; and (b) US$1,000 (or the equivalent in the Stablecoin concerned). This reflects that Stabledrop provides software for a small fee and never holds or controls the funds in a Protected Payment, which belong to the Buyer or Seller.
        </Sub>
      </Section>

      <Section title="17. Indemnity">
        <Para flush>
          If you use the Services for a business, you will compensate Stabledrop for losses, claims and reasonable costs arising from your breach of these Terms, your breach of the law, or your dealings with the other party to a Protected Payment. This section does not apply to you if you are using the Services as a consumer.
        </Para>
      </Section>

      <Section title="18. Suspension and termination">
        <Sub n="18.1">You can stop using the Services at any time.</Sub>
        <Sub n="18.2">We may suspend or end your access to the Services if you breach these Terms, if the law requires it, or if we reasonably suspect fraud, sanctions breaches or other illegal activity. We will tell you unless the law prevents us.</Sub>
        <Sub n="18.3">Suspension or termination affects your access to the interface and Services only. Stablecoins already in a Protected Payment remain in the Smart Contract and are released, refunded or decided under the Payment Terms and the Dispute Resolution Rules.</Sub>
        <Sub n="18.4">Sections 3, 9, 12, 13, 15, 16, 17 and 20 continue to apply after these Terms end.</Sub>
      </Section>

      <Section title="19. Changes to these Terms">
        <Sub n="19.1">We may update these Terms from time to time. The current version, with its effective date, is always published at <A href={TERMS}>stabledrop.me/terms-of-service/</A>, and previous versions are available on request.</Sub>
        <Sub n="19.2">Changes do not apply to a Protected Payment set up before it takes effect.</Sub>
        <Sub n="19.3">If you do not agree to a change, you can stop using the Services at any time. Any Protected Payment you have already set up will continue under the Terms that applied to it.</Sub>
      </Section>

      <Section title="20. Governing law, complaints and language">
        <Sub n="20.1">If you have a complaint about Stabledrop, contact <A href="mailto:support@stabledrop.me">support@stabledrop.me</A>. We will respond within 15 working days. If you use Stabledrop through a Partner, complaints about that business's own service go to it.</Sub>
        <Sub n="20.2">These Terms are governed by the law of England and Wales, and the courts of England and Wales have non-exclusive jurisdiction. This does not affect any mandatory rights you have under the law of the country or state where you live, or your right to bring a claim in the courts there.</Sub>
        <Sub n="20.3">These Terms are published in English. If also provided in another language, the English version prevails.</Sub>
      </Section>

      <Section title="21. General">
        <Sub n="21.1">These Terms and the Dispute Resolution Rules are the whole agreement between you and Stabledrop about the Services except as follows:</Sub>
        <Items lettered>
          <li>(a) if you have signed a separate written agreement with Stabledrop that covers your use of the Services, that agreement takes priority over these Terms where they conflict, and these Terms apply to everything it does not cover;</li>
          <li>(b) if you use Stabledrop through a Partner and the Partner’s terms conflict with these Terms about the Services, these Terms apply.</li>
        </Items>
        <Sub n="21.2">You may not transfer your rights or obligations under these Terms without our written consent. We may transfer ours to another company as part of a reorganisation or sale of our business, without reducing your rights.</Sub>
        <Sub n="21.3">If any part of these Terms is found invalid, the rest continues to apply.</Sub>
        <Sub n="21.4">If we do not enforce a right straight away, we can still enforce it later.</Sub>
        <Sub n="21.5">Nothing in these Terms creates a partnership, joint venture, agency or employment relationship between you and Stabledrop, or between Stabledrop and any Partner. A Partner has no authority to make promises or commitments on Stabledrop’s behalf.</Sub>
        <Sub n="21.6">No one other than you and Stabledrop can enforce these Terms.</Sub>
      </Section>
    </>
  );
}
