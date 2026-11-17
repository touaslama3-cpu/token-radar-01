# Token Radar Pro (`token-radar-01`)

[![Competition](https://make.fun/badge/token-radar-01.svg)](https://make.fun/c/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/touaslama3-cpu/token-radar-01/rank.svg)](https://make.fun/c/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/touaslama3-cpu/token-radar-01/reward.svg)](https://make.fun/c/token-radar-01)

> Advanced quantitative token launch radar and DeFi airdrop intelligence platform for the Make.fun `token-radar-01` competition.

---

## Overview

Token Radar analyses the competition's sealed DefiLlama snapshot (758 protocols; 40 watchlist entries), isolates protocols whose snapshot records no token, and ranks them using a transparent heuristic implied-value model. The snapshot is fixed and the dashboard works offline; it is not a live network feed. It delivers an autonomous, 100% offline-ready web dashboard with tactical 6-step farming plans for every qualifying protocol.

### Highlights & Key Metrics
- **Full Watchlist Coverage**: 100% coverage (40/40 protocols) of the official Make.fun watchlist floor.
- **200 Scored Pre-Token Protocols**: 40 watchlist giants + 160 early pre-token opportunities discovered below the $50M floor.
- **Total TVL Monitored**: Over $16.19B in locked capital analyzed.
- **Aggregated Implied Valuation**: $4.19B in fair-launch implied value.
- **100% Offline Architecture**: Zero external network dependencies, no CDNs, no external fonts or images, strictly compliant with Make.fun's sandbox policy.

---

## Valuation Model (`radar-pro-2`)

The implied valuation is determined strictly from DefiLlama snapshot metrics:

$$\text{Implied Value} = \max\left(1, \operatorname{round}\left(\text{TVL} \times M_{\text{sector}} \times M_{\text{growth}} \times M_{\text{lifecycle}} \times M_{\text{ecosystem}}\right)\right)$$

1. **Sector Base Multiple ($M_{\text{sector}}$)**:
   - Derivatives & Prediction Markets: `0.35x`
   - DEXs & AMMs: `0.30x`
   - Lending & CDP: `0.26x`
   - Curators, Allocators & Vaults: `0.22x`
   - RWA & Basis Trading: `0.20x`
   - Bridges, Staking & Infrastructures: `0.18x`
2. **Growth Momentum Factor ($M_{\text{growth}}$)**:
   - Concave response to 7-day TVL change clamped between `[-50%, +100%]`.
   - Linear momentum bonus up to +30% growth; logarithmic dampener on extreme spikes to discard transient mercenary liquidity.
3. **Airdrop Lifecycle Curve ($M_{\text{lifecycle}}$)**:
   - `0 - 90 days`: $0.65x \to 0.85x$ (early protocol bootstrapping).
   - `90 - 540 days`: $0.85x \to 1.20x$ (**prime TGE and points campaign window**).
   - `540 - 1095 days`: $1.20x \to 0.85x$ (tapering token urgency).
   - `> 1095 days`: $0.85x$ (stable mature pre-token baseline).
4. **Ecosystem & Multi-Chain Catalyst ($M_{\text{ecosystem}}$)**:
   - $+0.03$ per additional active chain (up to $+0.12$).
   - $+0.03$ catalyst bonus for high-liquidity ecosystems (Solana, Base, Arbitrum).

---

## Tactical 6-Step Farming Guide

Every row is accompanied by a concrete, actionable farm plan derived from its primary chain, TVL tier, and category:
1. **Dedicated Burner Wallet Setup**: Non-custodial wallet isolation with realistic network gas estimates (Solana, L2s, Ethereum L1).
2. **Category-Specific Action**: Targeted liquidity provision, conservative collateralized borrowing, curated vault allocation, or cross-chain routing.
3. **Cadence & Maintenance**: Weekly recurring volume or maintenance to maintain active trader percentiles.
4. **Qualifying Holding Window**: 30 to 60 days holding commitment to cross snapshot blocks.
5. **Sybil Resistance**: Ongoing governance participation and voting history.
6. **Verification & Audit**: Claim verification exclusively through verified protocol links and transaction hash logging.

---

## Repository Structure

```text
├── main.ts                   # Node 22/24 entrypoint (standard library only)
├── lib/
│   └── model.ts              # Quantitative valuation engine & farm steps generator
├── dashboard/
│   ├── index.html            # Semantic, accessible HTML structure
│   ├── app.css               # Modern dark fintech terminal styling
│   └── app.js                # High-performance client-side dashboard logic
├── screenshots/
│   ├── 1-board.png           # 1440x900 board overview
│   ├── 2-detail.png          # 1440x900 detailed protocol drawer
│   └── 3-filtered.png        # 1440x900 filtered ecosystem view
├── vendor/
│   └── makefun-board.ts      # Make.fun official dossier generator
└── LICENSE                   # MIT Open Source License
```

---

## Local Execution & Verification

Run the pipeline using Node 22+ standard library:

```bash
mkdir -p out
node main.ts --input input/snapshot.json --output out
```

---

## License

[MIT](LICENSE)


## Important limitations

- The included `input/snapshot.json` is the competition's fixed snapshot, not a live feed.
- “Implied value” is a heuristic ranking metric based on snapshot fields. It is not an actual token valuation, a prediction that a token will launch, or investment advice.
- Farming actions can involve smart-contract, market, liquidation, bridge and transaction-fee risks. Review each protocol independently and never deposit funds you cannot afford to lose.
- The dashboard itself makes no network requests and runs from the generated output folder.
