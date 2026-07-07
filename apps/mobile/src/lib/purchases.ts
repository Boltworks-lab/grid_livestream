/**
 * RevenueCat IAP for mobile (react-native-purchases — native, dev/prod build
 * only). Diamonds are credited SERVER-SIDE by the RevenueCat webhook (§3.3,
 * exactly once) — the app only initiates the purchase; it never grants currency.
 *
 * Fully works once: (1) EXPO_PUBLIC_REVENUECAT_KEY is set (platform SDK key),
 * (2) products/entitlements exist in RevenueCat + App Store/Play, and (3) the
 * API's REVENUECAT_WEBHOOK_AUTH secret matches the dashboard. Until then this
 * degrades to a no-op and the wallet stays view-only on mobile.
 */
let configured = false;

export function initPurchases(appUserId: string): boolean {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_KEY;
  if (!apiKey) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    Purchases.configure({ apiKey, appUserID: appUserId });
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/** Present the store's diamond packages (RevenueCat offerings). */
export async function getDiamondOfferings(): Promise<unknown[]> {
  if (!configured) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/** Buy a package. Crediting lands via the webhook — refetch the wallet after. */
export async function purchase(pkg: unknown): Promise<'ok' | 'cancelled' | 'unavailable'> {
  if (!configured) return 'unavailable';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    await Purchases.purchasePackage(pkg);
    return 'ok';
  } catch (e) {
    const err = e as { userCancelled?: boolean };
    return err.userCancelled ? 'cancelled' : 'unavailable';
  }
}
