import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import api from '../../lib/api';
import { Field, Input, Button, Avatar, Spinner } from '../../components/ui';

/**
 * Search-and-select a member. Debounced, and it now filters server-side via
 * `?search=` instead of downloading every member on each keystroke.
 */
export default function MemberPicker({ selected, onSelect, onClear }) {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setMembers([]);
      return undefined;
    }

    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/members', { params: { search: search.trim() } });
        if (!alive) return;
        setMembers((res.data.data || []).filter((m) => m.status !== 'deleted').slice(0, 10));
      } catch (err) {
        console.error('Member search failed', err);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);

  if (selected) {
    return (
      <Field label="Member" required>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-line bg-surface-3">
          <Avatar name={selected.name} size="sm" />
          <span className="grow min-w-0">
            <span className="block text-sm font-semibold text-heading truncate">{selected.name}</span>
            <span className="block text-xs text-muted truncate">{selected.phone}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="size-3.5" aria-hidden="true" />
            Change
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label="Member" required hint="Search by name or phone number.">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
          aria-hidden="true"
        />
        <Input
          type="search"
          className="pl-9"
          placeholder="Search members…"
          aria-label="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted mt-2">
          <Spinner className="scale-75" label="Searching" />
          Searching…
        </p>
      )}

      {!loading && search.trim() && members.length === 0 && (
        <p className="text-xs text-muted mt-2">No member matches “{search}”.</p>
      )}

      {members.length > 0 && (
        <ul className="flex flex-col gap-1 mt-2 max-h-56 overflow-y-auto rounded-lg border border-line p-1">
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(m);
                  setSearch('');
                }}
                className="flex items-center gap-3 w-full p-2 text-left rounded-md transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Avatar name={m.name} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-heading truncate">{m.name}</span>
                  <span className="block text-xs text-muted truncate">{m.phone}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
