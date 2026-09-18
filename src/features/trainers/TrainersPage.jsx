import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Users, Wallet, Package, ArrowRight, Plus, UserPlus, ChevronDown, ChevronUp, Trash2, Search } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useMoney } from '../../hooks/useMoney';
import {
  Page, PageHeader, Card, Button, Badge, Avatar, StatCard,
  EmptyState, ListSkeleton, ErrorState, Tabs,
  Modal, Input, Spinner
} from '../../components/ui';
import PtPackagesPanel from './PtPackagesPanel';

/**
 * Trainer overview: who is training whom, and what they have earned.
 *
 * Trainers already existed as `staff` rows with role='trainer', but nothing
 * connected them to members or to money — there was no assignment, no package,
 * and no commission anywhere in the product.
 */
export default function TrainersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const money = useMoney();

  const [tab, setTab] = useState('trainers');
  const [trainers, setTrainers] = useState(null);
  const [error, setError] = useState(null);

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/trainers');
        if (!alive) return;
        setError(null);
        setTrainers(res.data.data || []);
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setError(err.response?.data?.message || 'Could not load trainers.');
        setTrainers([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const rows = trainers ?? [];
  const totalPending = rows.reduce((s, t) => s + Number(t.commission_pending || 0), 0);
  const totalMembers = rows.reduce((s, t) => s + Number(t.member_count || 0), 0);

  const payout = async (trainer) => {
    try {
      const res = await api.post(`/trainers/${trainer.id}/payout`);
      toast.success(`${money(res.data.data.total)} paid to ${trainer.name}.`);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record the payout.');
    }
  };

  return (
    <Page>
      <PageHeader
        title="Trainers"
        subtitle="Assignments, personal-training packages and commission."
        actions={
          // The only way to add a trainer used to be the button inside the
          // empty state, so once the first one existed there was no way to add
          // a second.
          tab === 'trainers' ? (
            <Button onClick={() => navigate('/staff/add?role=trainer')}>
              <Plus className="size-4" aria-hidden="true" />
              Add trainer
            </Button>
          ) : null
        }
      />

      <Tabs
        items={[
          { key: 'trainers', label: 'Trainers', count: rows.length },
          { key: 'packages', label: 'PT packages' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {tab === 'packages' ? (
        <PtPackagesPanel />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <StatCard label="Trainers" value={rows.length} tone="accent" icon={Dumbbell} />
            <StatCard label="Members assigned" value={totalMembers} tone="info" icon={Users} />
            <StatCard
              label="Commission owed"
              value={money(totalPending)}
              tone={totalPending > 0 ? 'warning' : 'success'}
              icon={Wallet}
              deltaLabel={totalPending > 0 ? 'Pending payout' : 'All settled'}
            />
          </div>

          {trainers === null ? (
            <ListSkeleton rows={4} />
          ) : error ? (
            <ErrorState description={error} onRetry={reload} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="No trainers yet"
              description="Add a staff member with the Trainer role, then assign them to members."
              action={
                <Button onClick={() => navigate('/staff/add?role=trainer')}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add your first trainer
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {rows.map((t) => (
                <TrainerCard key={t.id} trainer={t} reload={reload} payout={payout} />
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function TrainerCard({ trainer: t, reload, payout }) {
  const navigate = useNavigate();
  const toast = useToast();
  const money = useMoney();

  const [showAssign, setShowAssign] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [showAssigned, setShowAssigned] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get('/members', { params: { search: search.trim() } });
        setSearchResults(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (showAssigned) {
      loadAssigned();
    }
  }, [showAssigned]);

  const loadAssigned = async () => {
    setLoadingAssigned(true);
    try {
      const res = await api.get('/trainers/assignments', { params: { staff_id: t.id } });
      setAssignedMembers(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssigned(false);
    }
  };

  const assignMember = async (memberId) => {
    try {
      await api.post('/trainers/assignments', {
        staff_id: t.id,
        member_id: memberId,
        is_primary: true
      });
      toast.success('Member assigned successfully.');
      setShowAssign(false);
      if (showAssigned) loadAssigned();
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign member.');
    }
  };

  const unassignMember = async (assignmentId) => {
    try {
      await api.delete(`/trainers/assignments/${assignmentId}`);
      toast.success('Member unassigned.');
      loadAssigned();
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unassign member.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={t.name} />
        <div className="min-w-0 grow">
          <h2 className="font-bold text-heading truncate">{t.name}</h2>
          <p className="text-xs text-muted truncate">{t.phone || 'No phone'}</p>
        </div>
        {t.commission_pending > 0 && <Badge variant="warning">Owed</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Members</dt>
          <dd className="font-bold text-heading tabular-nums">{t.member_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Active packages</dt>
          <dd className="font-bold text-heading tabular-nums">{t.active_packages}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Commission pending</dt>
          <dd className="font-bold text-warning tabular-nums">{money(t.commission_pending)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Paid to date</dt>
          <dd className="font-bold text-success tabular-nums">{money(t.commission_paid)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={() => setShowAssign(true)}>
          <UserPlus className="size-3.5" aria-hidden="true" />
          Assign Member
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="justify-between"
          onClick={() => setShowAssigned(!showAssigned)}
        >
          <span>Assigned Members</span>
          {showAssigned ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>

        {showAssigned && (
          <div className="mt-2 bg-surface-2 rounded-lg p-3 text-sm">
            {loadingAssigned ? (
              <div className="flex justify-center p-2"><Spinner className="size-4" /></div>
            ) : assignedMembers.length === 0 ? (
              <p className="text-center text-muted text-xs">No members assigned</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {assignedMembers.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 bg-surface-1 p-2 rounded-md">
                    <span className="truncate">{a.member_name}</span>
                    <Button variant="danger-soft" size="icon-sm" onClick={() => unassignMember(a.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-line">
        <Button
          variant="secondary"
          size="sm"
          className="grow"
          onClick={() => navigate(`/staff/${t.id}`)}
        >
          Details
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
        {t.commission_pending > 0 && (
          <Button variant="success" size="sm" onClick={() => payout(t)}>
            <Package className="size-3.5" aria-hidden="true" />
            Pay {money(t.commission_pending)}
          </Button>
        )}
      </div>

      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Member">
        <div className="flex flex-col gap-4">
          <Input 
            icon={Search} 
            placeholder="Search member by name or phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto">
            {isSearching ? (
              <div className="flex justify-center p-4"><Spinner className="size-6" /></div>
            ) : searchResults.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {searchResults.map(m => (
                  <li key={m.id} className="flex items-center justify-between p-2 rounded-md bg-surface-2">
                    <div>
                      <p className="font-semibold text-sm">{m.name}</p>
                      <p className="text-xs text-muted">{m.phone}</p>
                    </div>
                    <Button size="sm" onClick={() => assignMember(m.id)}>Assign</Button>
                  </li>
                ))}
              </ul>
            ) : search.trim() ? (
              <p className="text-center text-sm text-muted p-4">No members found.</p>
            ) : null}
          </div>
        </div>
      </Modal>
    </Card>
  );
}
