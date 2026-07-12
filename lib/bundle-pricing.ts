/**
 * Bundle pricing engine.
 *
 * Products can define quantity bundles in `metadata.bundle_pricing`, e.g.
 *   [ { "qty": 1, "total_price": 90 },
 *     { "qty": 3, "total_price": 255 },
 *     { "qty": 5, "total_price": 410 } ]
 *
 * Bundles are mix-and-match across variants of the same product (buying
 * 2 white + 1 brown of the same top still qualifies for "3 for ₵255").
 * For any quantity, the engine finds the cheapest combination of bundles
 * plus leftover single units at the base unit price.
 */

export interface BundleTier {
    qty: number;
    total_price: number;
}

/** Parse and validate tiers coming from product metadata (untrusted JSON). */
export function parseBundleTiers(raw: any): BundleTier[] {
    if (!Array.isArray(raw)) return [];
    const tiers = raw
        .map((t: any) => ({
            qty: Math.floor(Number(t?.qty)),
            total_price: Number(t?.total_price),
        }))
        .filter(t => Number.isFinite(t.qty) && t.qty >= 1 && Number.isFinite(t.total_price) && t.total_price > 0);
    // De-duplicate by qty (keep cheapest) and sort ascending
    const byQty = new Map<number, BundleTier>();
    for (const t of tiers) {
        const existing = byQty.get(t.qty);
        if (!existing || t.total_price < existing.total_price) byQty.set(t.qty, t);
    }
    return Array.from(byQty.values()).sort((a, b) => a.qty - b.qty);
}

/**
 * Cheapest total for `quantity` units given bundle tiers and a base unit price.
 * Uses dynamic programming so combinations like "5-bundle + 1 single" are found.
 * Falls back to quantity × unitPrice when no tiers apply.
 */
export function computeBundlePrice(quantity: number, unitPrice: number, tiers: BundleTier[]): number {
    if (quantity <= 0) return 0;
    if (!tiers || tiers.length === 0) return quantity * unitPrice;

    // Cap DP size defensively; beyond that, extend linearly with the best tier rate.
    const DP_CAP = 500;
    const q = Math.min(quantity, DP_CAP);

    const cost = new Array<number>(q + 1).fill(Infinity);
    cost[0] = 0;
    for (let i = 1; i <= q; i++) {
        // Single unit at base price
        cost[i] = cost[i - 1] + unitPrice;
        for (const tier of tiers) {
            if (tier.qty <= i && cost[i - tier.qty] + tier.total_price < cost[i]) {
                cost[i] = cost[i - tier.qty] + tier.total_price;
            }
        }
    }

    if (quantity <= DP_CAP) return round2(cost[q]);

    // Extremely large quantities: use best per-unit rate for the overflow
    const bestRate = Math.min(unitPrice, ...tiers.map(t => t.total_price / t.qty));
    return round2(cost[q] + (quantity - DP_CAP) * bestRate);
}

/** How much the bundle engine saves vs plain unit pricing for this quantity. */
export function computeBundleSavings(quantity: number, unitPrice: number, tiers: BundleTier[]): number {
    const base = quantity * unitPrice;
    const bundled = computeBundlePrice(quantity, unitPrice, tiers);
    return round2(Math.max(0, base - bundled));
}

/** "3 for ₵255" style label. */
export function formatBundleLabel(tier: BundleTier, currency = '₵'): string {
    return `${tier.qty} for ${currency}${formatAmount(tier.total_price)}`;
}

/** Per-unit price of a tier, e.g. 255/3 = 85. */
export function tierUnitPrice(tier: BundleTier): number {
    return round2(tier.total_price / tier.qty);
}

/** Savings of a tier vs buying the same qty at base unit price. */
export function tierSavings(tier: BundleTier, unitPrice: number): number {
    return round2(Math.max(0, unitPrice * tier.qty - tier.total_price));
}

// ── Cart-level helpers ──────────────────────────────────────────────────────

export interface BundleCartLine {
    /** Product id (bundles group across variants of one product) */
    productId: string;
    quantity: number;
    /** Base unit price for this line (variant price or product price) */
    unitPrice: number;
    tiers?: BundleTier[] | null;
}

export interface CartBundleResult {
    /** Sum of quantity × unitPrice across all lines */
    baseSubtotal: number;
    /** Subtotal after bundle pricing is applied */
    bundledSubtotal: number;
    /** baseSubtotal − bundledSubtotal */
    savings: number;
}

/**
 * Compute bundle-aware totals for a whole cart.
 * Lines are grouped by product id; each group's combined quantity is priced
 * through the bundle engine using the group's minimum unit price for leftovers
 * (conservative: never overcharges vs listed prices).
 */
export function computeCartBundles(lines: BundleCartLine[]): CartBundleResult {
    let baseSubtotal = 0;
    let bundledSubtotal = 0;

    const bundleGroups = new Map<string, BundleCartLine[]>();
    for (const line of lines) {
        const lineBase = line.unitPrice * line.quantity;
        baseSubtotal += lineBase;
        if (line.tiers && line.tiers.length > 0) {
            if (!bundleGroups.has(line.productId)) bundleGroups.set(line.productId, []);
            bundleGroups.get(line.productId)!.push(line);
        } else {
            bundledSubtotal += lineBase;
        }
    }

    for (const groupLines of bundleGroups.values()) {
        const groupBase = groupLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
        const tiers = groupLines[0].tiers!;
        const totalQty = groupLines.reduce((s, l) => s + l.quantity, 0);
        const minUnit = Math.min(...groupLines.map(l => l.unitPrice));
        const bundled = computeBundlePrice(totalQty, minUnit, tiers);
        // Never charge more than plain per-line pricing
        bundledSubtotal += Math.min(groupBase, bundled);
    }

    return {
        baseSubtotal: round2(baseSubtotal),
        bundledSubtotal: round2(bundledSubtotal),
        savings: round2(Math.max(0, baseSubtotal - bundledSubtotal)),
    };
}

// ── Formatting ──────────────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function formatAmount(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
