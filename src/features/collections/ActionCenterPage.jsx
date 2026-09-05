import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Send, CreditCard, Clock, Bell, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { daysFromNow, formatDate, getWhatsAppLink, calculateMemberStatus } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, Button, Badge, Tabs, Modal, Textarea,
  Avatar, EmptyState, ListSkeleton,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

export default function ActionCenterPage() {
  const { user } = useAuth();
  const money = useMoney();
  const navigate = useNavigate();
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [staffAlerts, setStaffAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [editNotif, setEditNotif] = useState(null);
  const [editMessage, setEditMessage] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pendingRes = await api.get('/payments/pending');
      setMembers(
        (pendingRes.data.data || []).map((m) => {
          const sorted = m.payments?.length
            ? [...m.payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
            : [];
          return { ...m, status: calculateMemberStatus(m), lastPayment: sorted[0] ?? null, itemType: 'member' };
        })
      );

      const notifRes = await api.get('/notifications', { params: { status: 'pending' } });
      setStaffAlerts(
        (notifRes.data.data || [])
          .filter((n) => n.notification_type && !n.notification_type.includes('member'))
          .map((n) => ({ ...n, itemType: 'alert' }))
      );
    } catch (err) {
      console.error('Failed to fetch action center data', err);
      toast.error('Could not load action items.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(
    () => ({
      total: members.length + staffAlerts.length,
      overdue: members.filter((m) => m.status === 'expired').length,
      dueSoon: members.filter((m) => m.status === 'due_soon').length,
      alerts: staffAlerts.length,
    }),
    [members, staffAlerts]
  );

  const displayedItems = useMemo(() => {
    if (filter === 'overdue') return members.filter((m) => m.status === 'expired');
    if (filter === 'due_soon') return members.filter((m) => m.status === 'due_soon');
    if (filter === 'alerts') return staffAlerts;
    return [...members, ...staffAlerts];
  }, [members, staffAlerts, filter]);

  const handleAlertSend = async () => {
    if (!editNotif) return;
    window.open(
      getWhatsAppLink(editNotif.recipient_phone || '', editMessage, user?.country_code),
      '_blank',
      'noopener,noreferrer'
    );

    try {
      await api.patch(`/notifications/${editNotif.id}/sent`);
      toast.success('Alert marked as sent.');
      setEditNotif(null);
      setEditMessage('');
      fetchData();
      window.dispatchEvent(new Event('action-center-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the alert status.');
    }
  };

  return (
    <Page>
      <PageHeader
        title="Action center"
        subtitle="Overdue fees, upcoming renewals and staff alerts"
        actions={
          !loading && (
            <>
              <Badge variant="danger" dot>
                {stats.overdue} overdue
              </Badge>
              <Badge variant="warning" dot>
                {stats.dueSoon} due soon
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
          { key: 'overdue', label: 'Collect fee', count: stats.overdue },
          { key: 'due_soon', label: 'Due soon', count: stats.dueSoon },
          { key: 'alerts', label: 'Staff alerts', count: stats.alerts },
        ]}
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : displayedItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up"
          description="No pending collections or alerts right now."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedItems.map((item) => {
            if (item.itemType === 'member') {
              const days = item.latest_expiry ? daysFromNow(item.latest_expiry) : null;
              const isExpired = item.status === 'expired' || (days !== null && days < 0);
              const tone = isExpired ? 'danger' : 'warning';

              return (
                <Card
                  key={`m_${item.id}`}
                  padding="lg"
                  className={cn('flex flex-col border-l-4', isExpired ? 'border-l-danger' : 'border-l-warning')}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar name={item.name} tone={tone} size="lg" className="rounded-xl" />
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-heading truncate">{item.name}</h3>
                      <p
                        className={cn(
                          'flex items-center gap-1.5 text-sm font-semibold mt-0.5',
                          isExpired ? 'text-danger' : 'text-warning'
                        )}
                      >
                        {isExpired ? (
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                        )}
                        {days === null
                          ? 'No payment record'
                          : isExpired
                            ? `${Math.abs(days)} days overdue`
                            : `Expires in ${days} days`}
                      </p>
                      <p className="text-xs text-muted mt-0.5 truncate">{item.phone || 'No phone number'}</p>
                    </div>
                  </div>

                  <p className="p-3 rounded-lg bg-surface-3 text-xs text-body mb-4 grow">
                    {item.lastPayment ? (
                      <>
                        Last payment{' '}
                        <strong className="text-heading">{money(item.lastPayment.amount)}</strong> on{' '}
                        {formatDate(item.lastPayment.payment_date)}
                      </>
                    ) : (
                      'No previous payments logged.'
                    )}
                  </p>

                  <Button
                    variant="success"
                    block
                    onClick={() => navigate(`/payments/add?member=${item.id}&returnUrl=/action-center`)}
                  >
                    <CreditCard className="size-4" aria-hidden="true" />
                    Collect payment
                  </Button>
                </Card>
              );
            }

            const isSalary = item.notification_type === 'staff_salary_due';
            return (
              <Card key={`a_${item.id}`} padding="lg" className="flex flex-col border-l-4 border-l-accent">
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex items-center justify-center size-12 rounded-xl bg-accent-soft text-accent shrink-0">
                    <Bell className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-heading">
                      {isSalary ? 'Salary due' : 'System alert'}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Scheduled {formatDate(item.scheduled_for)}
                    </p>
                  </div>
                </div>

                <p className="p-3 rounded-lg bg-surface-3 text-sm text-body mb-4 grow">
                  {item.message_template}
                </p>

                <Button
                  variant="secondary"
                  block
                  onClick={() => {
                    setEditNotif(item);
                    setEditMessage(item.message_template || '');
                  }}
                >
                  <Send className="size-4" aria-hidden="true" />
                  Contact
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(editNotif)}
        onClose={() => setEditNotif(null)}
        title="Send alert"
        description="Review the message before opening WhatsApp."
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label="WhatsApp message"
            rows={5}
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setEditNotif(null)}>
              Cancel
            </Button>
            <Button block onClick={handleAlertSend}>
              <Send className="size-4" aria-hidden="true" />
              Open WhatsApp
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
