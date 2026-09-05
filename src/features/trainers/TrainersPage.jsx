import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Users, Wallet, Package, ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useMoney } from '../../hooks/useMoney';
import {
  Page, PageHeader, Card, Button, Badge, Avatar, StatCard,
  EmptyState, ListSkeleton, ErrorState, Tabs,
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
              action={<Button onClick={() => navigate('/staff/add')}>Add staff</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {rows.map((t) => (
                <Card key={t.id}>
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
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
