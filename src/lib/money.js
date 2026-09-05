/**
 * Currency formatting driven by the gym's own settings.
 *
 * `formatPKR` hardcoded `PKR` and `en-PK` in 15 files, so every gym saw Pakistani
 * rupees no matter where they were. Phase 3 stores `currency`, `locale` and
 * `timezone` per gym; this reads them.
 */

export const SUPPORTED_CURRENCIES = [
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
];

/** A reasonable default locale per currency, used when a gym has none set. */
const DEFAULT_LOCALE = {
  PKR: 'en-PK', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN',
  AED: 'ar-AE', SAR: 'ar-SA', CAD: 'en-CA', AUD: 'en-AU', NGN: 'en-NG',
  ZAR: 'en-ZA', BDT: 'bn-BD', MYR: 'ms-MY', TRY: 'tr-TR',
};

/**
 * Format an amount in a gym's currency.
 *
 * Falls back to a plain "CODE 1,234" rather than throwing when the runtime does
 * not know the currency — Intl throws a RangeError on an unknown code, which
 * would blank out a whole revenue page.
 */
export function formatMoney(amount, { currency = 'PKR', locale } = {}) {
  const value = Number(amount || 0);
  const code = String(currency || 'PKR').toUpperCase();
  const loc = locale || DEFAULT_LOCALE[code] || 'en-US';

  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: code,
      // Gym fees are whole units in every market we support; showing ".00" on
      // every row is noise.
      minimumFractionDigits: 0,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(loc === 'en-US' ? undefined : loc)}`;
  }
}

/** Just the symbol, for input prefixes and compact labels. */
export function currencySymbol(currency = 'PKR') {
  const code = String(currency || 'PKR').toUpperCase();
  const known = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  if (known) return known.symbol;
  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE[code] || 'en-US', { style: 'currency', currency: code })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * A curated timezone list. The full IANA set is ~600 entries, which is an
 * unusable dropdown; these cover the markets the currencies above imply.
 */
export const COMMON_TIMEZONES = [
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Riyadh',
  'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Tokyo',
  'Europe/London', 'Europe/Dublin', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
  'Europe/Rome', 'Europe/Istanbul', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
  'Africa/Lagos', 'Africa/Cairo', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Pacific/Auckland',
  'UTC',
];

/** Guess the viewer's timezone, so the create form starts somewhere sensible. */
export function guessTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return COMMON_TIMEZONES.includes(tz) ? tz : 'Asia/Karachi';
  } catch {
    return 'Asia/Karachi';
  }
}

/**
 * Build a formatter that carries its own currency metadata.
 *
 * Lives here rather than inside the hook because attaching properties to a
 * function in a hook body trips react-hooks/immutability — the rule cannot see
 * that the object never escapes before it is fully built.
 */
export function createMoneyFormatter(currency = 'PKR', locale) {
  const format = (amount) => formatMoney(amount, { currency, locale });
  format.symbol = currencySymbol(currency);
  format.currency = String(currency || 'PKR').toUpperCase();
  format.locale = locale;
  return format;
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'upi', label: 'UPI' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'cheque', label: 'Cheque' },
];
