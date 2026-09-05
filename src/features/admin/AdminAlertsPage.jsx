import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Phone, MessageCircle, X, CheckCircle2, Clock,
  MapPin, Activity,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import api from '../../lib/api';
import { getWhatsAppLink } from '../../lib/utils';
import { APP_NAME } from '../../lib/constants';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Button, Badge, Tabs, Modal,
  Input, Select, EmptyState, ListSkeleton,
} from '../../components/ui';

const ALERT_CONFIG = {
  trial_ending: { icon: Clock, tone: 'warning', title: 'Subscription ending soon' },
  no_login: { icon: Activity, tone: 'info', title: 'No login in 14+ days' },
  suspended_expired: { icon: AlertTriangle, tone: 'danger', title: 'Suspended — subscription expired' },
};

const TONE_CLASSES = {
  warning: { bar: 'border-t-warning', chip: 'bg-warning-soft text-warning', title: 'text-warning' },
  info: { bar: 'border-t-info', chip: 'bg-info-soft text-info', title: 'text-info' },
  danger: { bar: 'border-t-danger', chip: 'bg-danger-soft text-danger', title: 'text-danger' },
};

const EMPTY_RENEWAL = { gymId: '', gymName: '', months: '1', customDays: '', amount: '3000' };

export default function AdminAlertsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [alerts, setAlerts] = useState(null);
  const [dismissed, setDismissed] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewalForm, setRenewalForm] = useState(EMPTY_RENEWAL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/admin/alerts');
      setAlerts(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch admin alerts', err);
      setAlerts([]);
      toast.error('Could not load alerts.');
    }
  }, [toast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const active = useMemo(
    () => (alerts ?? []).filter((a) => !dismissed.includes(a.id)),
    [alerts, dismissed]
  );

  const stats = useMemo(
    () => ({
      total: active.length,
      suspended: active.filter((a) => a.type === 'suspended_expired').length,
      expiring: active.filter((a) => a.type === 'trial_ending').length,
      inactive: active.filter((a) => a.type === 'no_login').length,
    }),
    [active]
  );

  const visibleAlerts = filter === 'all' ? active : active.filter((a) => a.type === filter);

  const handleRenewClick = (gym) => {
    setRenewalForm({ ...EMPTY_RENEWAL, gymId: gym.id, gymName: gym.gym_name });
    setShowRenewModal(true);
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/admin/gyms/${renewalForm.gymId}/renew`, {
        amount: Number(renewalForm.amount),
        months: renewalForm.months === 'custom' ? 0 : Number(renewalForm.months),
        customDays: renewalForm.months === 'custom' ? Number(renewalForm.customDays) : 0,
      });
      toast.success(`${renewalForm.gymName} renewed — access reactivated.`);
      setShowRenewModal(false);
      fetchAlerts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not renew this subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = alerts === null;

  return (
    <Page>
      <PageHeader
        title="Alerts"
        subtitle="Gyms needing attention"
        actions={
          !loading && (
            <>
              <Badge variant="danger" dot>
                {stats.suspended} suspended
              </Badge>
              <Badge variant="warning" dot>
                {stats.expiring} expiring
              </Badge>
            </>
          )
        }
      />

      <Tabs
        className="mb-5"
        value={filter}
        onChange={setFilter}
        items={[
          { key: 'all', label: 'All', count: stats.total },
          { key: 'suspended_expired', label: 'Suspended', count: stats.suspended },
          { key: 'trial_ending', label: 'Expiring', count: stats.expiring },
          { key: 'no_login', label: 'Inactive', count: stats.inactive },
        ]}
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : visibleAlerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All clear"
          description="No alerts need your attention right now."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleAlerts.map((a) => {
            const config = ALERT_CONFIG[a.type] ?? ALERT_CONFIG.suspended_expired;
            const tone = TONE_CLASSES[config.tone];
            const Icon = config.icon;

            return (
              <article
                key={a.id}
                className={cn(
                  'relative flex flex-col p-5 bg-surface-2 border border-line border-t-4 rounded-xl shadow-card',
                  tone.bar
                )}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-3 right-3 text-muted"
                  onClick={() => setDismissed((p) => [...p, a.id])}
                  aria-label={`Dismiss alert for ${a.gym.gym_name}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>

                <div className="flex items-start gap-3 mb-4 pr-8">
                  <span className={cn('flex items-center justify-center size-11 rounded-xl shrink-0', tone.chip)}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className={cn('text-sm font-bold', tone.title)}>{config.title}</h3>
                    <p className="text-xs text-body mt-0.5 leading-relaxed">{a.message}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-3 mb-4 grow">
                  <p className="text-base font-bold text-heading truncate">{a.gym.gym_name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted mt-1">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {a.gym.city || 'No city'} · {a.gym.owner_name}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-body mt-1">
                    <Phone className="size-3.5 text-muted shrink-0" aria-hidden="true" />
                    {a.gym.phone || 'No phone'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="grow"
                    onClick={() =>
                      window.open(
                        getWhatsAppLink(
                          a.gym.phone,
                          `Hello ${a.gym.owner_name}, regarding your ${APP_NAME} account: ${a.message}`
                        ),
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    Message
                  </Button>

                  {(a.type === 'suspended_expired' || a.type === 'trial_ending') && (
                    <Button size="sm" onClick={() => handleRenewClick(a.gym)}>
                      Renew
                    </Button>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/gyms/${a.gym.id}`)}>
                    Details
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="Renew gym access"
        description={`Reactivating ${renewalForm.gymName}. This logs a payment and extends the subscription end date.`}
      >
        <form className="flex flex-col gap-4" onSubmit={handleRenewSubmit}>
          <Select
            label="Duration"
            value={renewalForm.months}
            onChange={(e) => setRenewalForm({ ...renewalForm, months: e.target.value })}
          >
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">1 year</option>
            <option value="custom">Custom days</option>
          </Select>

          {renewalForm.months === 'custom' && (
            <Input
              label="Custom days"
              required
              type="number"
              min="1"
              placeholder="e.g. 15"
              value={renewalForm.customDays}
              onChange={(e) => setRenewalForm({ ...renewalForm, customDays: e.target.value })}
            />
          )}

          <Input
            label="Payment collected"
            required
            type="text"
            inputMode="numeric"
            placeholder="2500"
            value={renewalForm.amount}
            onChange={(e) => setRenewalForm({ ...renewalForm, amount: e.target.value })}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setShowRenewModal(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={isSubmitting}>
              Complete renewal
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
