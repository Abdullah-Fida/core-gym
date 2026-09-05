import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Plus, Power, PowerOff } from 'lucide-react';
import api from '../../lib/api';
import { formatDate, calculateHealthScore } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Button, Input, Select, Modal,
  Badge, Table, Avatar, EmptyState, ListSkeleton,
} from '../../components/ui';
import RegisterGymModal from './RegisterGymModal';

const PLAN_VARIANT = { pro: 'success', basic: 'info', free: 'neutral' };

function HealthBadge({ score }) {
  const variant = score <= 30 ? 'danger' : score <= 60 ? 'warning' : 'success';
  return <Badge variant={variant}>{score}</Badge>;
}

export default function AdminGymsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [gyms, setGyms] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = { search, plan_type: planFilter };
        if (statusFilter === 'active') params.is_active = 'true';
        if (statusFilter === 'churned') params.is_active = 'false';

        const res = await api.get('/admin/gyms', { params });
        if (alive) setGyms(res.data.data);
      } catch (err) {
        console.error(err);
        if (alive) {
          setGyms([]);
          toast.error('Could not load gyms.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [search, planFilter, statusFilter, refresh, toast]);

  const toggleGym = async (id, currentStatus) => {
    try {
      await api.post(`/admin/gyms/${id}/${currentStatus ? 'suspend' : 'reactivate'}`);
      toast.success(currentStatus ? 'Gym suspended.' : 'Gym activated.');
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update access.');
    }
  };

  const loading = gyms === null;
  const rows = gyms ?? [];

  const columns = [
    { key: 'gym_name', header: 'Gym', render: (g) => <span className="font-semibold text-heading">{g.gym_name}</span> },
    { key: 'owner_name', header: 'Owner' },
    { key: 'city', header: 'City' },
    {
      key: 'plan_type',
      header: 'Plan',
      render: (g) => <Badge variant={PLAN_VARIANT[g.plan_type] ?? 'neutral'}>{g.plan_type}</Badge>,
    },
    { key: 'members', header: 'Members', align: 'right', render: (g) => g.members?.[0]?.count || 0 },
    {
      key: 'last_login_at',
      header: 'Last login',
      render: (g) => <span className="text-xs text-muted">{formatDate(g.last_login_at)}</span>,
    },
    { key: 'health', header: 'Health', render: (g) => <HealthBadge score={calculateHealthScore(g)} /> },
    {
      key: 'is_active',
      header: 'Access',
      render: (g) => (
        <Badge variant={g.is_active ? 'success' : 'danger'} dot>
          {g.is_active ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (g) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleGym(g.id, g.is_active);
          }}
          aria-label={g.is_active ? `Suspend ${g.gym_name}` : `Activate ${g.gym_name}`}
          title={g.is_active ? 'Suspend gym' : 'Activate gym'}
          className={cn(g.is_active ? 'hover:text-danger' : 'hover:text-success')}
        >
          {g.is_active ? <PowerOff className="size-4" aria-hidden="true" /> : <Power className="size-4" aria-hidden="true" />}
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="All gyms"
        subtitle={loading ? 'Loading…' : `${rows.length} registered`}
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add gym
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search gym, owner or city…"
            aria-label="Search gyms"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select aria-label="Access status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="churned">Suspended</option>
        </Select>
        <Select aria-label="Plan" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </Select>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No gyms found"
          description={search || planFilter || statusFilter ? 'Try a different filter.' : 'Register your first gym.'}
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add gym
            </Button>
          }
        />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          onRowClick={(g) => navigate(`/admin/gyms/${g.id}`)}
          renderCard={(g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => navigate(`/admin/gyms/${g.id}`)}
              className="flex items-center gap-3 w-full p-3 text-left bg-surface-2 border border-line rounded-xl transition-colors hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Avatar name={g.gym_name} tone={g.is_active ? 'accent' : 'danger'} />
              <span className="grow min-w-0">
                <span className="block font-semibold text-heading truncate">{g.gym_name}</span>
                <span className="block text-xs text-muted truncate">
                  {g.owner_name}
                  {g.city ? ` · ${g.city}` : ''}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={PLAN_VARIANT[g.plan_type] ?? 'neutral'}>{g.plan_type}</Badge>
                <Badge variant={g.is_active ? 'success' : 'danger'} dot>
                  {g.is_active ? 'Active' : 'Suspended'}
                </Badge>
              </span>
            </button>
          )}
        />
      )}

      <RegisterGymModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => setRefresh((r) => r + 1)}
      />
    </Page>
  );
}
