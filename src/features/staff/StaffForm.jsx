import { STAFF_ROLES } from '../../lib/constants';
import { Input, Select, Textarea } from '../../components/ui';

/**
 * Shared staff fields. Add and Edit rendered two hand-maintained copies of this
 * markup which had already diverged — Add collected a join date, Edit did not;
 * Edit exposed status, Add did not.
 */
export default function StaffForm({ form, set, showStatus = false }) {
  return (
    <>
      <Input
        label="Full name"
        required
        placeholder="Staff member name"
        value={form.name || ''}
        onChange={(e) => set('name', e.target.value)}
      />

      <Input
        label="Phone number"
        required
        type="tel"
        inputMode="tel"
        placeholder="03001234567"
        value={form.phone || ''}
        onChange={(e) => set('phone', e.target.value)}
      />

      <Select label="Role" value={form.role || 'trainer'} onChange={(e) => set('role', e.target.value)}>
        {STAFF_ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>

      {form.role === 'other' && (
        <Input
          label="Custom role"
          placeholder="e.g. Physiotherapist"
          value={form.custom_role || ''}
          onChange={(e) => set('custom_role', e.target.value)}
        />
      )}

      <Input
        label="Join date"
        type="date"
        value={form.join_date || ''}
        onChange={(e) => set('join_date', e.target.value)}
      />

      <Input
        label="Monthly salary"
        type="text"
        inputMode="numeric"
        placeholder="25000"
        value={form.monthly_salary || ''}
        onChange={(e) => set('monthly_salary', e.target.value)}
      />

      {showStatus && (
        <Select label="Status" value={form.status || 'active'} onChange={(e) => set('status', e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </Select>
      )}

      <Textarea
        label="Notes"
        placeholder="Optional notes…"
        value={form.notes || ''}
        onChange={(e) => set('notes', e.target.value)}
      />
    </>
  );
}
