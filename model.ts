// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early radar rows the system exists to find.
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows from the snapshot's fundamental DeFi metrics:
//
//   1. Sector Base Multiple (Category Multiple):
//      Reflects historical fee-to-TVL velocity across DeFi primitives:
//      - Derivatives & Prediction: 0.35 (high capital velocity, heavy fee generation)
//      - DEXs & AMMs: 0.30 (governance value, fee-switch potential)
//      - Lending & CDP: 0.26 (sticky liquidity, conservative leverage)
//      - Curators & Allocators: 0.22 (active vault yield management)
//      - RWA & Basis Trading: 0.20 (treasury yield structures)
//      - Bridges & Staking / Others: 0.18
//
//   2. Growth & Momentum Multiplier (7-day change):
//      Smooth concave response to short-term TVL inflows, dampening pump-and-dump spikes:
//      - Clamped between -50% and +100%
//      - Moderate growth (up to +30%) rewarded with 0.6x linear momentum factor
//      - Hyper-growth (> +30%) tapered logarithmically to discount transient mercenary capital
//      - Negative growth penalizes capital flight down to a 0.75x floor
//
//   3. Airdrop Lifecycle & Maturity Curve (Age Sweet-Spot):
//      Models the real-world token generation event (TGE) distribution:
//      - Early Bootstrap (0-90 days): 0.65 to 0.85 (smart contract testing, season 0)
//      - Prime Launch Window (90-540 days): 0.85 to 1.20 (peak points campaign, imminent TGE)
//      - Extended / Legacy Pre-Token (540-1095 days): tapers from 1.20 to 0.85 (decreasing token urgency)
//      - Long-standing Pre-Token (>1095 days): stabilized at 0.85 (lower launch probability)
//      - Unlisted age default: 365 days (prime window baseline, 1.06x)
//
//   4. Multi-Chain Ecosystem Multiplier:
//      Reward multi-chain presence (wider addressable userbase) and presence on premier
//      retail/liquidity ecosystems (Solana, Base, Arbitrum): 1.00 to 1.15.
//
//   Implied Value = max(1, round(tvl_usd * category_mult * growth_mult * maturity_mult * ecosystem_mult))
//
// No protocol name or slug is ever hardcoded: the exact same quantitative function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  // Enhanced model parameters
  deriv_multiple: number;
  dex_multiple: number;
  lending_multiple: number;
  curator_multiple: number;
  rwa_multiple: number;
  infra_multiple: number;
  sweetspot_peak_days: number;
  ecosystem_chain_bonus: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.65,
  maturity_range: 0.55,
  maturity_days: 1095,
  unknown_age_days: 365,
  deriv_multiple: 0.35,
  dex_multiple: 0.30,
  lending_multiple: 0.26,
  curator_multiple: 0.22,
  rwa_multiple: 0.20,
  infra_multiple: 0.18,
  sweetspot_peak_days: 540,
  ecosystem_chain_bonus: 0.03,
};

/** The model's version label: displayed on the dashboard and documented in the dossier. */
export const MODEL_VERSION = 'radar-pro-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    category_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    ecosystem_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  ecosystem_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or invalid. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Derives sector-rational base multiple from the protocol's category. */
export function categoryMultiplier(category: string | null, model: ModelConstants = MODEL): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('prediction') || c.includes('options')) {
    return model.deriv_multiple;
  }
  if (c.includes('dex') || c.includes('collateral market')) {
    return model.dex_multiple;
  }
  if (c.includes('lend') || c.includes('cdp')) {
    return model.lending_multiple;
  }
  if (c.includes('yield') || c.includes('allocator') || c.includes('curator') || c.includes('vault')) {
    return model.curator_multiple;
  }
  if (c.includes('rwa') || c.includes('basis trading')) {
    return model.rwa_multiple;
  }
  if (c.includes('staking') || c.includes('restak') || c.includes('bridge') || c.includes('chain')) {
    return model.infra_multiple;
  }
  return model.rwa_multiple;
}

/** Concave momentum multiplier: rewards organic growth, tapers extreme spikes. */
export function growthMultiplier(change7d: number | null, model: ModelConstants = MODEL): { growthPct: number; growthMult: number } {
  const raw = finite(change7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, raw));
  let growthMult: number;
  if (growthPct >= 0) {
    if (growthPct <= 30) {
      growthMult = 1.0 + (growthPct / 100) * model.growth_weight;
    } else {
      // Diminishing returns on sudden spikes above +30%
      growthMult = 1.0 + 0.18 + Math.log10(1 + (growthPct - 30) / 70) * 0.25;
    }
  } else {
    // Controlled downside discount
    growthMult = 1.0 + (growthPct / 100) * 0.5;
  }
  return { growthPct: round4(growthPct), growthMult: round4(growthMult) };
}

/**
 * Airdrop Lifecycle Multiplier:
 * Reflects the real-world TGE timing distribution:
 * - 0-90 days: early testing bootstrap (0.65 -> 0.85)
 * - 90-540 days: prime points campaign window (0.85 -> 1.20)
 * - 540-1095 days: delayed launch tapering (1.20 -> 0.85)
 * - >1095 days: stable floor for mature pre-token protocols (0.85)
 */
export function maturityMultiplier(age: number | null, model: ModelConstants = MODEL): number {
  const days = age ?? model.unknown_age_days;
  let mult: number;
  if (days < 90) {
    mult = model.maturity_floor + (days / 90) * 0.20;
  } else if (days <= model.sweetspot_peak_days) {
    mult = 0.85 + ((days - 90) / (model.sweetspot_peak_days - 90)) * 0.35;
  } else if (days <= model.maturity_days) {
    mult = 1.20 - ((days - model.sweetspot_peak_days) / (model.maturity_days - model.sweetspot_peak_days)) * 0.35;
  } else {
    mult = 0.85;
  }
  return round4(mult);
}

/** Multi-chain breadth and high-liquidity ecosystem catalyst. */
export function ecosystemMultiplier(chains: string[], model: ModelConstants = MODEL): number {
  const chainList = chains ?? [];
  let mult = 1.0;
  if (chainList.length > 1) {
    mult += Math.min(0.12, (chainList.length - 1) * model.ecosystem_chain_bonus);
  }
  const hasGrowthChain = chainList.some((c) => ['Solana', 'Base', 'Arbitrum'].includes(c));
  if (hasGrowthChain) mult += 0.03;
  return round4(Math.min(1.15, mult));
}

/** The valuation multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): {
  implied: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  categoryMult: number;
  ecosystemMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const categoryMult = categoryMultiplier(protocol.category, model);
  const { growthPct, growthMult } = growthMultiplier(protocol.change_7d, model);
  const maturityMult = maturityMultiplier(age, model);
  const ecosystemMult = ecosystemMultiplier(protocol.chains, model);

  const raw = protocol.tvl_usd * categoryMult * growthMult * maturityMult * ecosystemMult;
  const implied = Math.max(1, Math.round(raw));

  return { implied, growthPct, growthMult, maturityMult, categoryMult, ecosystemMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();

  // 1. The watchlist is the floor: every slug must appear on the board
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }

  // 2. The early radar: pre-token protocols below the watchlist floor, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);

  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const valuation = impliedValue(p, snapshot.as_of, model);
    return { p, ...valuation };
  });

  // Strict sorting: implied value desc, then TVL desc, then slug asc
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      category_multiplier: s.categoryMult,
      growth_pct: s.growthPct,
      growth_multiplier: s.growthMult,
      maturity_multiplier: s.maturityMult,
      ecosystem_multiplier: s.ecosystemMult,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, strictly within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's official page.`;
  return s;
}

/** Determines realistic gas fee profile from the protocol's primary deployment chain. */
function chainGasProfile(chains: string[]): { setup: string; maint: string; time: string } {
  const chain = (chains.length > 0 ? chains[0]! : 'Ethereum').toLowerCase();
  if (chain.includes('solana') || chain.includes('sui') || chain.includes('aptos')) {
    return { setup: 'under $0.02 of high-speed network gas', maint: 'under $0.01 per transaction', time: '1-2 minutes' };
  }
  if (chain.includes('tron') || chain.includes('binance') || chain.includes('bsc')) {
    return { setup: 'about $0.30 to $0.80 of network gas', maint: 'about $0.20 per interaction', time: '2-3 minutes' };
  }
  if (
    chain.includes('base') ||
    chain.includes('arbitrum') ||
    chain.includes('optimism') ||
    chain.includes('polygon') ||
    chain.includes('ink') ||
    chain.includes('blast') ||
    chain.includes('hyperliquid') ||
    chain.includes('berachain') ||
    chain.includes('monad') ||
    chain.includes('avalanche')
  ) {
    return { setup: 'about $0.10 to $0.35 of L2/alt-L1 gas', maint: 'about $0.08 a week', time: '2-4 minutes' };
  }
  if (chain.includes('ethereum')) {
    return { setup: 'about $8 to $18 of L1 gas depending on gwei', maint: 'about $4 to $8 per interaction', time: '5-10 minutes' };
  }
  return { setup: 'about $0.50 of network fees', maint: 'about $0.20 a week', time: '3-5 minutes' };
}

/** Scaled capital requirement based on protocol TVL tier. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 20_000_000) return 100;
  return 50;
}

/** Recommended qualification holding window based on protocol maturity. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 90) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * A protocol's farm plan: 6 concrete, tactical steps tailored to its DeFi category,
 * primary blockchain, capital requirements, and holding period.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chains = p.chains ?? [];
  const chainName = chains.length > 0 ? chains[0]! : 'its main chain';
  const gas = chainGasProfile(chains);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const cat = (p.category ?? '').toLowerCase();
  const name = p.name;

  let action1 = '';
  let action2 = '';

  if (cat.includes('lend') || cat.includes('cdp') || cat.includes('collateral')) {
    action1 = `Supply $${capital} of blue-chip collateral (USDC, USDT or native gas token) into ${name} on ${chainName} to start earning lending yield and protocol points.`;
    action2 = `Borrow a conservative 20% to 30% against collateral to activate borrower tier multipliers while keeping liquidation safety above 250%.`;
  } else if (cat.includes('dex') || cat.includes('liquidity')) {
    action1 = `Deposit $${capital} into ${name}'s core trading pair on ${chainName} (e.g. USDC/native token) to accumulate liquidity provider points and fee shares.`;
    action2 = `Perform weekly recurring micro-swaps ($20-$50) on ${name} to register active trader volume and maintain top-quartile activity rankings.`;
  } else if (cat.includes('derivative') || cat.includes('perpetual') || cat.includes('prediction')) {
    action1 = `Deposit $${capital} of USDC as initial margin on ${name} on ${chainName} to qualify for trader reward tiers.`;
    action2 = `Execute paired delta-neutral or small hedged orders weekly to generate real exchange volume while controlling directional market risk.`;
  } else if (cat.includes('curator') || cat.includes('allocator') || cat.includes('vault') || cat.includes('yield')) {
    action1 = `Allocate $${capital} into ${name}'s flagship curated vault on ${chainName} to accrue optimized yield shares and tenure-weighted points.`;
    action2 = `Monitor epoch rebalances and keep the position untouched through quarterly airdrop snapshot intervals.`;
  } else if (cat.includes('rwa') || cat.includes('basis trading')) {
    action1 = `Deposit or mint $${capital} of ${name}'s tokenized yield asset on ${chainName} to establish verified early participant record.`;
    action2 = `Hold the asset in a self-custodial wallet and reinvest periodic yield distributions to demonstrate long-term engagement.`;
  } else if (cat.includes('staking') || cat.includes('restak')) {
    action1 = `Stake $${capital} of native assets through ${name} on ${chainName} to receive liquid receipt tokens and base validator rewards.`;
    action2 = `Delegate or allocate receipt tokens into whitelisted partner integrations to double-dip on secondary ecosystem rewards.`;
  } else if (cat.includes('bridge')) {
    action1 = `Transfer $${capital} of stablecoins or native assets across chains using ${name} to record cross-chain bridge transaction hash.`;
    action2 = `Execute an opposing rebalancing bridge transfer every two weeks to establish bilateral routing volume.`;
  } else {
    action1 = `Deposit $${capital} of USDC or native assets into ${name}'s primary contract on ${chainName} to register initial protocol interaction.`;
    action2 = `Maintain active balance and interact with smart contracts periodically to verify ongoing wallet tenure.`;
  }

  return [
    {
      text: 'Setup dedicated burner wallet: Use a clean non-custodial wallet holding only farming funds to isolate smart contract risk.',
      cost: gas.setup,
      time: '5 minutes',
    },
    {
      text: action1,
      cost: `$${capital} capital and ${gas.setup}`,
      time: gas.time,
    },
    {
      text: action2,
      cost: gas.maint,
      time: '5 to 10 minutes per session',
    },
    {
      text: `Maintain continuous qualifying position for at least ${hold} days to register across multiple snapshot blocks.`,
      cost: `$${capital} capital held`,
      time: `${hold} days commitment`,
    },
    {
      text: `Participate in governance proposals or community votes on ${chainName} when available to boost sybil-resistance score.`,
      cost: 'negligible gas',
      time: '5 minutes per vote',
    },
    {
      text: 'Verify claims exclusively through official links listed on DefiLlama or verified protocol docs; log transaction hashes for tax tracking.',
      cost: 'zero fees to verify',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiplier: row.model.category_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    ecosystem_multiplier: row.model.ecosystem_multiplier,
  };
}

/** Everything the dashboard renders, derived strictly from the sealed snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
