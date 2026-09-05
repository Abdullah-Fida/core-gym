import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Pencil, CreditCard, MessageCircle, Trash2, Printer, Phone,
  ReceiptText, Fingerprint, CalendarDays, ShieldCheck,
} from 'lucide-react';
import api from '../../lib/api';
import { registerFingerprint } from '../../lib/biometrics';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, daysFromNow, buildWhatsAppMessage, getWhatsAppLink } from '../../lib/utils';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { APP_NAME } from '../../lib/constants';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, BackLink, Card, CardHeader, Button, Badge,
  Avatar, Modal, Textarea, Skeleton, ErrorState, EmptyState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';
import MemberTrainerPanel from '../trainers/MemberTrainerPanel';
import MeasurementsPanel from '../measurements/MeasurementsPanel';

export default function MemberDetailPage() {
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [member, setMember] = useState(null);
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [showWaModal, setShowWaModal] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/members/${id}`);
        if (!res.data.data) {
          setNotFound(true);
          return;
        }
        setMember(res.data.data);

        try {
          const gRes = await api.get('/gym');
          setGym(gRes.data.data);
        } catch {
          const cached = localStorage.getItem(STORAGE_KEYS.gymSettings);
          if (cached) setGym(JSON.parse(cached));
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleRemind = () => {
    if (!gym) {
      toast.error('Gym settings have not loaded yet.');
      return;
    }
    setEditMessage(buildWhatsAppMessage(member, gym));
    setShowWaModal(true);
  };

  const executeSendWhatsApp = () => {
    window.open(
      getWhatsAppLink(member.phone || '', editMessage, gym?.country_code),
      '_blank',
      'noopener,noreferrer'
    );
    setShowWaModal(false);
  };

  const handleRegisterFingerprint = async () => {
    setEnrolling(true);
    try {
      toast.info('Touch the fingerprint sensor…');
      const credentialId = await registerFingerprint(member);
      await api.put(`/members/${member.id}`, { fingerprint_id: credentialId });
      setMember((m) => ({ ...m, fingerprint_id: credentialId }));
      toast.success('Fingerprint registered.');
    } catch (err) {
      toast.error(err.message || 'Could not register the fingerprint.');
    } finally {
      setEnrolling(false);
    }
  };

  const printReceipt = (p) => {
    printThermalReceipt({
      gymName: gym?.gym_name || gym?.name || user?.gym_name || APP_NAME,
      invoiceId: p.id,
      memberName: member.name,
      memberPhone: member.phone,
      amount: p.amount,
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      expiryDate: p.expiry_date,
      reason: 'Membership fee',
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Remove member?',
      message: `${member.name} will be removed from your member list. Their payment history stays in your revenue reports.`,
      confirmText: 'Remove',
    });
    if (!ok) return;

    try {
      await api.delete(`/members/${id}`);
      toast.success('Member removed.');
      navigate('/members');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove this member.');
    }
  };

  if (loading) {
    return (
      <Page width="narrow">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-44 mb-4" />
        <Skeleton className="h-72" />
      </Page>
    );
  }

  if (notFound || !member) {
    return (
      <Page width="narrow">
        <ErrorState
          title="Member not found"
          description="They may have been removed."
          onRetry={() => navigate('/members')}
        />
      </Page>
    );
  }

  const payments = member.payments || [];

  // latest_expiry is a denormalised cache; fall back to the payments array.
  let actualExpiry = member.latest_expiry;
  if (!actualExpiry && payments.length > 0) {
    const [latest] = [...payments].sort(
      (a, b) =>
        new Date(b.expiry_date || b.payment_date || 0) - new Date(a.expiry_date || a.payment_date || 0)
    );
    actualExpiry = latest.expiry_date || latest.payment_date;
  }

  const days = actualExpiry ? daysFromNow(actualExpiry) : null;
  const isExpired = member.status === 'expired' || (days !== null && days < 0);
  const isDueSoon = member.status === 'due_soon' || (days !== null && days >= 0 && days <= 3);
  const tone = isExpired ? 'danger' : isDueSoon ? 'warning' : days === null ? 'neutral' : 'success';

  return (
    <Page width="narrow">
      <PageHeader
        title={member.name}
        back={<BackLink to="/members" label="Members" />}
        actions={
          <>
            <Button variant="secondary" size="icon" onClick={() => navigate(`/members/${id}/edit`)} aria-label="Edit member">
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="danger-soft" size="icon" onClick={handleDelete} aria-label="Remove member">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        }
      />

      <Card padding="lg" className="text-center mb-4">
        <Avatar name={member.name} tone={tone} size="lg" className="mx-auto mb-3" />
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted">
          <Phone className="size-3.5" aria-hidden="true" />
          {member.phone}
        </p>
        <div className="mt-3">
          <Badge variant={tone === 'neutral' ? 'neutral' : tone} dot>
            {isExpired ? 'Expired' : isDueSoon ? 'Due soon' : days === null ? 'No payment' : 'Active'}
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="text-center">
          <p className="text-xs text-muted">Membership</p>
          <p
            className={cn(
              'font-bold tabular-nums mt-0.5',
              isExpired ? 'text-danger' : isDueSoon ? 'text-warning' : days === null ? 'text-muted' : 'text-success'
            )}
          >
            {days === null ? 'No payment' : isExpired ? `${Math.abs(days)}d overdue` : `${days} days left`}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-muted">Transactions</p>
          <p className="font-bold text-heading tabular-nums mt-0.5">{payments.length}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <Button size="lg" className="grow" onClick={() => navigate(`/payments/add?member=${id}`)}>
          <CreditCard className="size-4" aria-hidden="true" />
          Log payment
        </Button>
        <Button variant="secondary" size="lg" className="grow" onClick={handleRemind}>
          <MessageCircle className="size-4" aria-hidden="true" />
          Message on WhatsApp
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Member details" />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Member since
              </dt>
              <dd className="text-sm font-semibold text-heading mt-0.5">{formatDate(member.join_date)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Phone className="size-3.5" aria-hidden="true" />
                Emergency contact
              </dt>
              <dd className="text-sm font-semibold text-heading mt-0.5">
                {member.emergency_contact || 'Not provided'}
              </dd>
            </div>
          </dl>
          {member.notes && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Internal notes</p>
              <p className="text-sm text-body mt-1">{member.notes}</p>
            </div>
          )}
        </Card>

        <MemberTrainerPanel memberId={member.id} memberName={member.name} />

        <MeasurementsPanel memberId={member.id} memberName={member.name} />

        <Card>
          <CardHeader title="Security &amp; access" />
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center justify-center size-12 rounded-xl shrink-0',
                member.fingerprint_id ? 'bg-success-soft text-success' : 'bg-surface-3 text-muted'
              )}
            >
              <Fingerprint className="size-6" aria-hidden="true" />
            </span>
            <div className="grow min-w-0">
              <p className="text-sm font-semibold text-heading">Fingerprint access</p>
              <p
                className={cn(
                  'flex items-center gap-1 text-xs mt-0.5',
                  member.fingerprint_id ? 'text-success' : 'text-muted'
                )}
              >
                {member.fingerprint_id && <ShieldCheck className="size-3.5" aria-hidden="true" />}
                {member.fingerprint_id ? 'Registered' : 'Not registered'}
              </p>
            </div>
            <Button
              variant={member.fingerprint_id ? 'secondary' : 'primary'}
              size="sm"
              loading={enrolling}
              onClick={handleRegisterFingerprint}
            >
              {member.fingerprint_id ? 'Re-register' : 'Add fingerprint'}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment history" subtitle={`${payments.length} record${payments.length === 1 ? '' : 's'}`} />
          {payments.length === 0 ? (
            <EmptyState icon={ReceiptText} title="No payments yet" description="Logged fees appear here." className="py-8" />
          ) : (
            <ul className="flex flex-col divide-y divide-line -my-2">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span className="flex items-center justify-center size-9 rounded-lg bg-surface-3 text-muted shrink-0">
                    <ReceiptText className="size-4" aria-hidden="true" />
                  </span>
                  <span className="grow min-w-0">
                    <span className="block text-sm font-semibold text-heading">
                      {formatDate(p.payment_date)}
                    </span>
                    <span className="block text-xs text-muted truncate">
                      {p.plan_duration_months === 'custom'
                        ? `${p.custom_days} days`
                        : `${p.plan_duration_months} month plan`}
                      {' · '}
                      {p.payment_method}
                    </span>
                  </span>
                  <span className="font-bold text-success tabular-nums shrink-0">{money(p.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Print receipt for ${formatDate(p.payment_date)}`}
                    title="Print receipt"
                    onClick={() => printReceipt(p)}
                  >
                    <Printer className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={showWaModal}
        onClose={() => setShowWaModal(false)}
        title="Message on WhatsApp"
        description={`Review before opening WhatsApp for ${member.name}.`}
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label="Message"
            rows={5}
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setShowWaModal(false)}>
              Cancel
            </Button>
            <Button block onClick={executeSendWhatsApp}>
              <MessageCircle className="size-4" aria-hidden="true" />
              Open WhatsApp
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
