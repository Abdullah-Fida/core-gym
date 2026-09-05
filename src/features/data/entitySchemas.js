/**
 * Field definitions for every importable / exportable entity.
 *
 * One source of truth: the import column-mapper, the downloadable template, the
 * validation preview and the CSV/XLSX export all read from here, so a field
 * cannot be added to one and forgotten in the others.
 */

const REQUIRED = true;

/** Reject Excel's habit of turning "03001234567" into 3001234567. */
const normalisePhone = (v) => {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\s()-]/g, '').trim();
};

/**
 * Accept the date formats a spreadsheet actually produces: ISO, dd/mm/yyyy,
 * and Excel's numeric serial. Returns yyyy-mm-dd or null.
 */
export function parseFlexibleDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Excel serial date: days since 1899-12-30.
  if (typeof value === 'number' && value > 0 && value < 100000) {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  // dd/mm/yyyy or dd-mm-yyyy. Day-first, because every market this ships to
  // writes dates that way; a US file with mm/dd would be misread, so the
  // preview shows the parsed result for the user to check before committing.
  const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return Number.isNaN(new Date(iso).getTime()) ? null : iso;
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const numberField = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  // Strip currency symbols and thousands separators a spreadsheet may carry.
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const ENTITIES = {
  members: {
    label: 'Members',
    endpoint: 'members',
    // Used for the dedupe message and the export filename.
    describe: (r) => r.name,
    fields: [
      {
        key: 'name',
        label: 'Full name',
        required: REQUIRED,
        aliases: ['name', 'full name', 'member name', 'fullname', 'member'],
        validate: (v) => (String(v ?? '').trim().length >= 2 ? null : 'Name is required.'),
        transform: (v) => String(v ?? '').trim(),
      },
      {
        key: 'phone',
        label: 'Phone',
        required: REQUIRED,
        aliases: ['phone', 'mobile', 'contact', 'phone number', 'cell'],
        validate: (v) => (normalisePhone(v).length >= 6 ? null : 'A phone number is required.'),
        transform: normalisePhone,
      },
      {
        key: 'join_date',
        label: 'Join date',
        aliases: ['join date', 'joined', 'joining date', 'start date', 'date'],
        transform: parseFlexibleDate,
        validate: (v, raw) => (raw && !v ? `Could not read the date "${raw}".` : null),
      },
      {
        key: 'emergency_contact',
        label: 'Emergency contact',
        aliases: ['emergency contact', 'emergency', 'next of kin'],
        transform: (v) => String(v ?? '').trim(),
      },
      {
        key: 'notes',
        label: 'Notes',
        aliases: ['notes', 'note', 'remarks', 'comment'],
        transform: (v) => String(v ?? '').trim(),
      },
    ],
  },

  payments: {
    label: 'Payments',
    endpoint: 'payments',
    describe: (r) => `${r.member_phone} — ${r.amount}`,
    fields: [
      {
        key: 'member_phone',
        label: 'Member phone',
        required: REQUIRED,
        // Matched against existing members server-side; importing a payment for
        // an unknown member would orphan the row.
        aliases: ['member phone', 'phone', 'mobile', 'member'],
        validate: (v) => (normalisePhone(v).length >= 6 ? null : 'Member phone is required to match the payment.'),
        transform: normalisePhone,
      },
      {
        key: 'amount',
        label: 'Amount',
        required: REQUIRED,
        aliases: ['amount', 'paid', 'fee', 'payment', 'total'],
        transform: numberField,
        validate: (v) => (v !== null && v >= 0 ? null : 'Amount must be a number.'),
      },
      {
        key: 'payment_date',
        label: 'Payment date',
        required: REQUIRED,
        aliases: ['payment date', 'date', 'paid on', 'paid date'],
        transform: parseFlexibleDate,
        validate: (v) => (v ? null : 'A valid payment date is required.'),
      },
      {
        key: 'plan_duration_months',
        label: 'Plan months',
        aliases: ['plan duration months', 'months', 'duration', 'plan'],
        transform: (v) => (v === '' || v == null ? 1 : Number(v) || 1),
      },
      {
        key: 'payment_method',
        label: 'Method',
        aliases: ['payment method', 'method', 'mode', 'type'],
        transform: (v) => String(v ?? 'cash').toLowerCase().trim() || 'cash',
      },
      {
        key: 'notes',
        label: 'Notes',
        aliases: ['notes', 'note', 'remarks'],
        transform: (v) => String(v ?? '').trim(),
      },
    ],
  },

  staff: {
    label: 'Staff',
    endpoint: 'staff',
    describe: (r) => r.name,
    fields: [
      {
        key: 'name',
        label: 'Full name',
        required: REQUIRED,
        aliases: ['name', 'full name', 'staff name', 'employee'],
        validate: (v) => (String(v ?? '').trim().length >= 2 ? null : 'Name is required.'),
        transform: (v) => String(v ?? '').trim(),
      },
      {
        key: 'role',
        label: 'Role',
        required: REQUIRED,
        aliases: ['role', 'position', 'designation', 'job'],
        transform: (v) => {
          const r = String(v ?? '').toLowerCase().trim();
          const known = ['trainer', 'receptionist', 'cleaner', 'manager', 'security', 'other'];
          return known.includes(r) ? r : 'other';
        },
      },
      {
        key: 'phone',
        label: 'Phone',
        aliases: ['phone', 'mobile', 'contact'],
        transform: normalisePhone,
      },
      {
        key: 'monthly_salary',
        label: 'Monthly salary',
        aliases: ['monthly salary', 'salary', 'wage', 'pay'],
        transform: (v) => numberField(v) ?? 0,
      },
      {
        key: 'join_date',
        label: 'Join date',
        aliases: ['join date', 'joined', 'start date'],
        transform: parseFlexibleDate,
      },
    ],
  },

  expenses: {
    label: 'Expenses',
    endpoint: 'expenses',
    describe: (r) => `${r.category} — ${r.amount}`,
    fields: [
      {
        key: 'title',
        label: 'Title',
        required: REQUIRED,
        aliases: ['title', 'description', 'item', 'name', 'detail'],
        validate: (v) => (String(v ?? '').trim() ? null : 'A title is required.'),
        transform: (v) => String(v ?? '').trim(),
      },
      {
        key: 'amount',
        label: 'Amount',
        required: REQUIRED,
        aliases: ['amount', 'cost', 'price', 'total', 'spent'],
        transform: numberField,
        validate: (v) => (v !== null && v >= 0 ? null : 'Amount must be a number.'),
      },
      {
        key: 'category',
        label: 'Category',
        aliases: ['category', 'type', 'group'],
        transform: (v) => String(v ?? 'other').toLowerCase().trim() || 'other',
      },
      {
        key: 'expense_date',
        label: 'Date',
        required: REQUIRED,
        aliases: ['expense date', 'date', 'spent on'],
        transform: parseFlexibleDate,
        validate: (v) => (v ? null : 'A valid date is required.'),
      },
      {
        key: 'notes',
        label: 'Notes',
        aliases: ['notes', 'note', 'remarks'],
        transform: (v) => String(v ?? '').trim(),
      },
    ],
  },
};

/**
 * Guess which uploaded column maps to which field.
 *
 * Matching is case- and punctuation-insensitive so "Member Name", "member_name"
 * and "MEMBER NAME" all land on the same field — otherwise the mapping step is
 * pure manual work on every single import.
 */
export function autoMapColumns(entityKey, headers) {
  const entity = ENTITIES[entityKey];
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapping = {};
  const taken = new Set();

  for (const field of entity.fields) {
    const candidates = [field.key, field.label, ...(field.aliases || [])].map(norm);
    const match = headers.find((h) => !taken.has(h) && candidates.includes(norm(h)));
    if (match) {
      mapping[field.key] = match;
      taken.add(match);
    } else {
      mapping[field.key] = '';
    }
  }
  return mapping;
}

/**
 * Apply the mapping and validate every row.
 *
 * Returns both the clean rows and the per-row errors so the preview can show
 * exactly which line failed and why, rather than a single "import failed".
 */
export function validateRows(entityKey, rows, mapping) {
  const entity = ENTITIES[entityKey];
  const valid = [];
  const errors = [];

  rows.forEach((raw, index) => {
    const record = {};
    const rowErrors = [];

    for (const field of entity.fields) {
      const column = mapping[field.key];
      const rawValue = column ? raw[column] : undefined;
      const value = field.transform ? field.transform(rawValue) : rawValue;

      if (field.required && (value === null || value === undefined || value === '')) {
        rowErrors.push(`${field.label} is missing.`);
        continue;
      }
      const problem = field.validate?.(value, rawValue);
      if (problem && (field.required || (rawValue !== '' && rawValue != null))) {
        rowErrors.push(problem);
        continue;
      }
      if (value !== null && value !== undefined && value !== '') record[field.key] = value;
    }

    // +2: spreadsheets are 1-indexed and row 1 is the header, so this is the
    // line number the user actually sees in Excel.
    if (rowErrors.length) errors.push({ row: index + 2, errors: rowErrors, raw });
    else valid.push(record);
  });

  return { valid, errors };
}

/** Header row for a downloadable template. */
export function templateHeaders(entityKey) {
  return ENTITIES[entityKey].fields.map((f) => f.label);
}
