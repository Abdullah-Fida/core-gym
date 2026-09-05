// Batgos — Constants & Enums

/** Product name. Used as the fallback whenever a gym has no name of its own. */
export const APP_NAME = 'Batgos';

export const MEMBER_STATUS = {
  ACTIVE: 'active',
  DUE_SOON: 'due_soon',
  EXPIRED: 'expired',
};

export const PLAN_DURATIONS = [
  { value: 1, label: '1 Month' },
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '12 Months' },
  { value: 'custom', label: 'Custom Days' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Rent', icon: '🏠' },
  { value: 'electricity', label: 'Electricity', icon: '⚡' },
  { value: 'water', label: 'Water', icon: '💧' },
  { value: 'equipment_repair', label: 'Equipment Repair', icon: '🔧' },
  { value: 'internet', label: 'Internet', icon: '🌐' },
  { value: 'cleaning', label: 'Cleaning Supplies', icon: '🧹' },
  { value: 'marketing', label: 'Marketing', icon: '📢' },
  { value: 'staff_bonus', label: 'Staff Bonus', icon: '🎁' },
  { value: 'fuel', label: 'Fuel', icon: '⛽' },
  { value: 'supplements', label: 'Supplements', icon: '💊' },
  { value: 'custom', label: 'Custom', icon: '✏️' },
];

// `tone` names a Badge/Avatar variant rather than a raw hex. The previous
// values (#6c5ce7, #00b894, #fdcb6e, #ff7675, #74b9ff, #a0a0b8) came from an
// unrelated palette and ignored the theme entirely.
export const STAFF_ROLES = [
  { value: 'trainer', label: 'Trainer', tone: 'accent' },
  { value: 'manager', label: 'Manager', tone: 'info' },
  { value: 'receptionist', label: 'Receptionist', tone: 'warning' },
  { value: 'security', label: 'Security', tone: 'danger' },
  { value: 'cleaner', label: 'Cleaner', tone: 'success' },
  { value: 'other', label: 'Other', tone: 'neutral' },
];


export const NOTIFICATION_TYPES = {
  FEE_WARNING: 'member_fee_expiry_warning',
  FEE_EXPIRED: 'member_fee_expired',
  SALARY_DUE: 'staff_salary_due',
  EXPENSE_REMINDER: 'expense_recurring_reminder',
  TRIAL_ENDING: 'trial_ending',
};

export const GYM_PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
};

export const WHATSAPP_TEMPLATES = {
  FEE_WARNING: (memberName, expiryDate, gymName) =>
    `Hello ${memberName}, your ${gymName} membership expires on ${expiryDate}. Please renew soon. Thanks!`,
  FEE_EXPIRED: (memberName, amount, gymName, gymPhone) =>
    `Hello ${memberName}, your ${gymName} membership expired today. Please log your fee of PKR ${amount} to continue. ${gymName} - ${gymPhone}`,
  SALARY_DUE: (staffName, gymName) =>
    `Dear ${staffName}, your salary for this month is pending. ${gymName} management.`,
};
