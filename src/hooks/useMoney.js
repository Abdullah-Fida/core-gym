import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createMoneyFormatter } from '../lib/money';

/**
 * Currency formatter bound to the signed-in gym.
 *
 *   const money = useMoney();
 *   money(1500)        // "Rs 1,500" for a PKR gym, "$1,500" for a USD one
 *   money.symbol       // "Rs" / "$"
 *
 * Pages previously called the module-level `formatPKR`, which hardcoded PKR and
 * en-PK, so a gym in New York saw its own revenue in rupees.
 */
export function useMoney() {
  const { user } = useAuth();
  const currency = user?.currency || 'PKR';
  const locale = user?.locale || undefined;

  return useMemo(() => createMoneyFormatter(currency, locale), [currency, locale]);
}

export default useMoney;
