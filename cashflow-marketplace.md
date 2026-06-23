# Cashflow Marketplace: Tradeable Escrow Cashflows - PLAN

## Overview

Conduit Escrow (stabledrop.me) provides stablecoin escrow with built-in buyer protection for merchants and consumers. Every escrow contract locks funds on-chain with a defined recipient and maturity date â€” creating a guaranteed future cashflow.

The Cashflow Marketplace extends this by allowing escrow recipients to sell their future cashflows to liquidity providers at a discount, receiving immediate payment. This transforms every escrow into a tradeable financial instrument, enabling low-cost, low-risk liquidity for SMEs without relying on traditional invoice factoring or trade credit.

## How It Works Today

1. A seller creates a payment request (e.g. $10,000, 30-day delivery window)
2. A buyer locks funds into an escrow smart contract
3. At maturity, funds are automatically released to the seller
4. If there's a problem, a built-in dispute resolution process protects both parties

The funds are committed and on-chain from the moment the buyer deposits. This is not a promise to pay â€” the money is already locked.

## The Opportunity

A seller with $10,000 locked in escrow, paying out in 30 days, might prefer $9,800 today. A liquidity provider with idle stablecoins would happily earn $200 on a 30-day, near-zero-risk position â€” the funds are already locked in the contract.

This is invoice factoring, but with the money already committed. The risk profile is fundamentally different from traditional trade finance because the underlying funds are verifiable on-chain and cannot be withdrawn by the original buyer.

## Marketplace Mechanism

The marketplace enables atomic, trustless exchange of cashflow ownership for immediate payment. It uses a temporary ownership transfer pattern that works within the existing escrow permission model â€” no new trust assumptions, no operator approvals, no external oracles.

### Key Principle

In the existing escrow contract, only the current recipient can change the recipient field. The marketplace mechanism uses this by having the seller temporarily transfer recipient status to a marketplace escrow contract, which then has permission to reassign it to the cashflow buyer as part of an atomic swap.

### Step-by-Step Flow

#### Step 1: Seller Accepts an Offer

A liquidity provider (cashflow buyer) browses active escrows on the marketplace and makes an offer â€” for example, "$9,800 now for your $10,000 cashflow maturing in 30 days."

The seller accepts and creates a **marketplace escrow contract** containing:

- **Cashflow contract address** â€” the escrow being sold
- **New buyer wallet ID** â€” the liquidity provider's address
- **Sale amount** â€” the agreed price (e.g. $9,800)
- **Time limit** â€” a window for the buyer to complete payment, which must expire well before the cashflow matures

#### Step 2: Seller Transfers Recipient Status

The seller changes the recipient on their original escrow contract to the address of the marketplace escrow contract. This gives the marketplace contract permission to reassign the recipient field â€” because it is now the current recipient.

The marketplace escrow contract includes a **time-locked recovery function** callable only by the original seller. If the buyer fails to pay within the time limit, the seller calls this function and the marketplace contract changes the cashflow recipient back to the seller's address. The seller walks away with their cashflow intact.

#### Step 3: Buyer Pays â€” Atomic Swap Executes

The cashflow buyer deposits the agreed amount into the marketplace escrow contract. This triggers an atomic transaction that:

1. **Checks no dispute has been raised** on the underlying cashflow contract
2. **Changes the cashflow recipient** from the marketplace contract to the buyer's wallet
3. **Pays the sale amount** to the original seller

If any step fails â€” a dispute exists, the recipient change fails, or the payment fails â€” the entire transaction reverts. The buyer's funds are returned and the cashflow recipient remains unchanged.

### After the Swap

- The **liquidity provider** now owns the cashflow and will receive the full escrow amount at maturity
- The **seller** has immediate liquidity at a small discount
- The **original escrow** is unaffected â€” it still pays out at maturity to whoever the current recipient is

## Trust Model

| Risk | Mitigation |
|---|---|
| Marketplace contract has recipient control | Temporary â€” only between seller transfer and buyer payment. Time-locked recovery if buyer doesn't pay. |
| Cashflow matures while marketplace contract is recipient | Time limit on the marketplace escrow must expire well before cashflow maturity. |
| Dispute raised on underlying escrow | Atomic swap checks for active disputes before executing. Reverts if one exists. |
| Buyer never pays | Seller reclaims recipient status via time-locked recovery function. |
| Marketplace contract is exploited | Contract is open source, auditable, and has minimal surface area â€” it holds funds temporarily and performs a single atomic operation. |

The only trust the seller places is in the marketplace contract code itself. There are no operator approvals, no off-chain signatures, and no third parties with special permissions. The seller retains the ability to reclaim their cashflow at all times until the atomic swap executes.

## What Needs to Be Built

### Contract Changes

- **Existing escrow contract**: Add an editable recipient field (changeRecipient function callable by current recipient only)
- **New marketplace escrow contract**: Holds buyer funds, executes atomic swap (check dispute status â†’ change recipient â†’ pay seller), includes time-locked seller recovery function

### Frontend

- **Marketplace view**: Browse all active escrows as potential cashflows, filtered by maturity date, amount, and discount
- **Offer system**: Liquidity providers make offers, sellers receive notifications and accept/reject
- **Opt-out mechanism**: Sellers can hide their escrows from the marketplace if they don't want to receive offers

### Data

- All escrow data already exists in the current database
- All escrows are visible on the marketplace by default (opt-out model)
- On-chain data (dispute history, completion rates) provides risk information for cashflow buyers and their advisors

## Why This Matters for SMEs

Late payments cost UK SMEs an average of Â£22,000 per year and contribute to 50,000 business closures annually. Traditional invoice factoring addresses this but is expensive â€” fees of 1-5% â€” because the financier takes on credit risk. The debtor might not pay.

With escrow-locked cashflows, the money is already committed on-chain. There is no credit risk â€” only dispute risk, which is visible and quantifiable from on-chain data. This fundamentally changes the cost of liquidity:

- **Traditional invoice factoring**: 1-5% fee, credit checks, paperwork, days to process
- **Escrow cashflow marketplace**: Sub-1% discount, instant settlement, no paperwork, risk verifiable on-chain

The result is faster, cheaper access to working capital for SMEs, built on transparent, auditable, open-source infrastructure.
