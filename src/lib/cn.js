import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names, with later Tailwind utilities winning over
 * earlier ones in the same group (`px-2 px-4` → `px-4`).
 *
 * This is what lets a primitive expose a `className` prop that callers can
 * actually override, instead of the two fighting and specificity deciding.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
