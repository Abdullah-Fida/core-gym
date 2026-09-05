import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Trash2, Users } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { daysFromNow, formatDateShort, calculateMemberStatus } from '../../lib/utils';
import api from '../../lib/api';
import { cn } from '../../lib/cn';
import {
  Page,
  PageHeader,
  Button,
  Input,
  Select,
  Tabs,
  Avatar,
  MemberStatusBadge,
  EmptyState,
  ListSkeleton,
  DeleteChoiceModal,
} from '../../components/ui';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'due_soon', label: 'Due Soon' },
  { key: 'expired', label: 'Expired' },
  { key: 'inactive', label: 'Inactive' },
];

/** Newest expiry across a member's payments, falling back to the cached column. */
function resolveExpiry(member) {
  if (member.latest_expiry) return member.latest_expiry;
  if (!member.payments?.length) return null;
  const sorted = [...member.payments].sort(
    (a, b) => new Date(b.expiry_date || b.payment_date || 0) - new Date(a.expiry_date || a.payment_date || 0)
  );
  return sorted[0].expiry_date || sorted[0].payment_date || null;
}

function avatarTone(status, days) {
  if (status === 'expired' || (days !== null && days < 0)) return 'danger';
  if (status === 'due_soon' || (days !== null && days <= 3)) return 'warning';
  if (status === 'inactive' || days === null) return 'neutral';
  if (status === 'trial') return 'info';
  return 'accent';
}

function remainingLabel(days) {
  if (days === null) return { text: 'No payment', tone: 'text-muted' };
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: 'text-danger' };
  if (days === 0) return { text: 'Expires today', tone: 'text-warning' };
  if (days <= 3) return { text: `${days}d left`, tone: 'text-warning' };
  return { text: `${days}d left`, tone: 'text-success' };
}

export default function MembersListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [sort, setSort] = useState('name');
  const [membersData, setMembersData] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingIds, setDeletingIds] = useState([]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await api.get('/members');
        const results = (res.data.data || [])
          .filter((m) => m.status !== 'deleted')
          .map((m) => {
            const sorted = m.payments?.length
              ? [...m.payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
              : [];
            return {
              ...m,
              status: calculateMemberStatus(m),
              lastPayDate: sorted[0]?.payment_date ?? null,
            };
          });
        setMembersData(results);
      } catch (err) {
        console.error(err);
        setMembersData([]);
      }
    };
    fetchMembers();
  }, []);

  const members = useMemo(() => {
    if (!membersData) return null;
    let results = [...membersData];

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (m) => (m.name || '').toLowerCase().includes(s) || String(m.phone || '').includes(s)
      );
    }

    if (statusFilter !== 'all') {
      results = results.filter((m) => m.status === statusFilter);
    }

    if (sort === 'name') {
      results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'join_date') {
      results.sort((a, b) => new Date(b.join_date || 0) - new Date(a.join_date || 0));
    } else if (sort === 'overdue') {
      results.sort((a, b) => {
        const da = resolveExpiry(a) ? daysFromNow(resolveExpiry(a)) : 9999;
        const db = resolveExpiry(b) ? daysFromNow(resolveExpiry(b)) : 9999;
        return da - db;
      });
    }
    return results;
  }, [membersData, search, statusFilter, sort]);

  const tabsWithCounts = useMemo(
    () =>
      STATUS_TABS.map((tab) => ({
        ...tab,
        count:
          tab.key === 'all'
            ? membersData?.length
            : membersData?.filter((m) => m.status === tab.key).length,
      })),
    [membersData]
  );

  const processDeletion = async (permanent) => {
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    setDeletingIds((prev) => [...prev, id]);
    await new Promise((r) => setTimeout(r, 300));

    try {
      await api.delete(`/members/${id}${permanent ? '?permanent=true' : ''}`);
      toast.success(
        permanent
          ? `${name} and all associated records permanently deleted`
          : `${name} removed (financial records preserved)`
      );
      setMembersData((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Failed to delete member', err);
      toast.error(err.response?.data?.message || 'Could not delete this member.');
      setDeletingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const loading = members === null;
  const list = members ?? [];

  return (
    <Page>
      <PageHeader
        title="Members"
        subtitle={loading ? 'Loading…' : `${membersData.length} total`}
        actions={
          <Button onClick={() => navigate('/members/add')}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add member
          </Button>
        }
      />

      <div className="flex flex-col gap-3 mb-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search by name or phone…"
            aria-label="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs items={tabsWithCounts} value={statusFilter} onChange={setStatusFilter} size="sm" />
          <Select
            aria-label="Sort members"
            className="w-auto text-xs py-1.5"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">A → Z</option>
            <option value="join_date">Newest first</option>
            <option value="overdue">Most overdue</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description={
            search || statusFilter !== 'all'
              ? 'Try a different search or filter.'
              : 'Add your first gym member to get started.'
          }
          action={
            !search && statusFilter === 'all' ? (
              <Button onClick={() => navigate('/members/add')}>
                <UserPlus className="size-4" aria-hidden="true" />
                Add member
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((member) => {
            const days = resolveExpiry(member) ? daysFromNow(resolveExpiry(member)) : null;
            const remaining = remainingLabel(days);
            const isDeleting = deletingIds.includes(member.id);

            return (
              <li
                key={member.id}
                className={cn(
                  'transition-all duration-300',
                  isDeleting && 'translate-x-24 opacity-0 pointer-events-none'
                )}
              >
                <div className="group flex items-center gap-3 p-3 sm:p-4 bg-surface-2 border border-line rounded-xl transition-colors hover:border-line-hover">
                  {/*
                    Previously the whole row was a clickable <div> with no role,
                    no tabIndex and no key handler — the primary way to open a
                    member was unreachable by keyboard.
                  */}
                  <button
                    type="button"
                    onClick={() => navigate(`/members/${member.id}`)}
                    className="flex items-center gap-3 grow min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Avatar name={member.name} tone={avatarTone(member.status, days)} />
                    <span className="flex flex-col min-w-0">
                      <span className="font-semibold text-heading truncate">{member.name}</span>
                      <span className="text-xs text-muted truncate">{member.phone}</span>
                      {member.lastPayDate && (
                        <span className="text-[0.6875rem] text-muted mt-0.5">
                          Last paid {formatDateShort(member.lastPayDate)}
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <MemberStatusBadge status={member.status} />
                    <span className={cn('text-xs font-semibold tabular-nums', remaining.tone)}>
                      {remaining.text}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted hover:text-danger hover:bg-danger-soft shrink-0"
                    onClick={() => setDeleteTarget({ id: member.id, name: member.name })}
                    aria-label={`Delete ${member.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DeleteChoiceModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete member"
        name={deleteTarget?.name}
        softDescription="The member is hidden from lists, but their payment history stays in your revenue reports."
        hardDescription="Permanently deletes the member along with every payment, attendance record and notification. This cannot be undone."
        onSoftDelete={() => processDeletion(false)}
        onHardDelete={() => processDeletion(true)}
      />

    </Page>
  );
}
