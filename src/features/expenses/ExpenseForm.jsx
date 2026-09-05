import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { Input, Select, Textarea, Toggle } from '../../components/ui';

/** Shared expense fields for the add and edit screens. */
export default function ExpenseForm({ form, set }) {
  return (
    <>
      <Select
        label="Category"
        value={form.category || 'equipment_repair'}
        onChange={(e) => set('category', e.target.value)}
      >
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.icon} {c.label}
          </option>
        ))}
      </Select>

      {form.category === 'custom' && (
        <Input
          label="Custom category"
          placeholder="Category name"
          value={form.custom_category || ''}
          onChange={(e) => set('custom_category', e.target.value)}
        />
      )}

      <Input
        label="Amount"
        required
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={form.amount || ''}
        onChange={(e) => set('amount', e.target.value)}
      />

      <Input
        label="Date"
        type="date"
        value={form.expense_date || ''}
        onChange={(e) => set('expense_date', e.target.value)}
      />

      <Textarea
        label="Description"
        placeholder="What was this expense for?"
        value={form.description || ''}
        onChange={(e) => set('description', e.target.value)}
      />

      <Toggle
        label="Recurring expense"
        description="Repeats on the same day each month"
        checked={form.is_recurring}
        onChange={(v) => set('is_recurring', v)}
      />

      {form.is_recurring && (
        <Input
          label="Day of month"
          type="number"
          min="1"
          max="31"
          value={form.recurrence_day ?? ''}
          onChange={(e) => set('recurrence_day', e.target.value)}
        />
      )}

      <Input
        label="Logged by"
        placeholder="Staff name (optional)"
        value={form.logged_by || ''}
        onChange={(e) => set('logged_by', e.target.value)}
      />
    </>
  );
}
