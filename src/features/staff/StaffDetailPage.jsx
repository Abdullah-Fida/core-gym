import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, CreditCard, Trash2, Printer, Wallet, CalendarDays, HandCoins } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, getCurrentMonth, getCurrentYear, getMonthName, generateId } from '../../lib/utils';
import { STAFF_ROLES, PAYMENT_METHODS, APP_NAME } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import {
  Page, PageHeader, BackLink, Card, CardHeader, Button, Badge,
  Avatar, Input, Select, Modal, DeleteChoiceModal,
  Skeleton, ErrorState, EmptyState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

export default function StaffDetailPage() {
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  // Trainers accrue commission alongside salary; other roles never will, so the
  // block below stays hidden for them rather than showing a permanent zero.
  const [commission, setCommission] = useState({ pending: 0, paid: 0, loading: true });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [payForm, setPayForm] = useState({
    amount_paid: '',
    paid_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes: '',
  });

  const month = getCurrentMonth();
  const year = getCurrentYear();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/staff/${id}`);
        const s = res.data.data;
        if (!s) {
          setNotFound(true);
          return;
        }
        setStaff(s);
        setPayForm((p) => ({ ...p, amount_paid: String(s.monthly_salary ?? '') }));
      } catch (err) {
        console.error('Failed to fetch staff member', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    let alive = true;
    api.get('/trainers/commissions', { params: { staff_id: id } })
      .then((res) => {
        if (!alive) return;
        const t = res.data.totals || { pending: 0, paid: 0 };
        setCommission({ pending: t.pending, paid: t.paid, loading: false });
      })
      .catch(() => alive && setCommission((c) => ({ ...c, loading: false })));
    return () => { alive = false; };
  }, [id]);

  const handleCommissionPayout = async () => {
    try {
      const res = await api.post(`/trainers/${id}/payout`);
      toast.success(`${money(res.data.data.total)} paid to ${staff.name}.`);
      const fresh = await api.get('/trainers/commissions', { params: { staff_id: id } });
      const t = fresh.data.totals || { pending: 0, paid: 0 };
      setCommission({ pending: t.pending, paid: t.paid, loading: false });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record the payout.');
    }
  };

  const printSalaryReceipt = (data) => {
    printThermalReceipt({
      gymName: user?.gym_name || APP_NAME,
      invoiceId: data.id,
      memberName: data.staffName,
      memberPhone: data.staffPhone,
      amount: data.amount,
      paymentDate: data.paidDate,
      paymentMethod: data.paymentMethod,
      reason: `Salary — ${getMonthName(data.month)} ${data.year}`,
    });
  };

  const handlePaySalary = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const pid = generateId();
      await api.post(`/staff/${id}/salary`, {
        id: pid,
        staff_id: id,
        month,
        year,
        amount_paid: Number(payForm.amount_paid),
        paid_date: payForm.paid_date,
        payment_method: payForm.payment_method,
        notes: payForm.notes,
      });

      toast.success(`Salary logged for ${staff.name}.`);
      setShowPayForm(false);

      printSalaryReceipt({
        id: pid,
        staffName: staff.name,
        staffPhone: staff.phone,
        amount: Number(payForm.amount_paid),
        month,
        year,
        paidDate: payForm.paid_date,
        paymentMethod: payForm.payment_method,
      });

      const res = await api.get(`/staff/${id}`);
      if (res.data.data) setStaff(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not log this salary payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (permanent) => {
    setShowDeleteOptions(false);
    try {
      await api.delete(`/staff/${id}${permanent ? '?permanent=true' : ''}`);
      toast.success(
        permanent
          ? `${staff.name} and all records permanently deleted.`
          : `${staff.name} removed — salary history preserved.`
      );
      navigate('/staff');
    } catch (err) {
      console.error('Failed to delete staff', err);
      toast.error(err.response?.data?.message || 'Could not remove this staff member.');
    }
  };

  if (loading) {
    return (
      <Page width="narrow">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-40 mb-4" />
        <Skeleton className="h-64" />
      </Page>
    );
  }

  if (notFound || !staff) {
    return (
      <Page width="narrow">
        <ErrorState
          title="Staff member not found"
          description="They may have been removed."
          onRetry={() => navigate('/staff')}
        />
      </Page>
    );
  }

  const salaryHistory = (staff.staff_payments || []).filter((p) => (p.kind ?? 'salary') === 'salary');
  let isPaid = false;
  if (salaryHistory.length) {
    const [latest] = [...salaryHistory].sort((a, b) => new Date(b.paid_date) - new Date(a.paid_date));
    const last = new Date(latest.paid_date);
    const today = new Date();
    last.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    isPaid = Math.floor((today - last) / 86400000) <= 30;
  }
  const role = STAFF_ROLES.find((r) => r.value === staff.role);

  return (
    <Page width="narrow">
      <PageHeader
        title={staff.name}
        subtitle={staff.phone}
        back={<BackLink to="/staff" label="Staff" />}
        actions={
          <Button variant="secondary" onClick={() => navigate(`/staff/${id}/edit`)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
        }
      />

      <Card padding="lg" className="text-center mb-4">
        <Avatar name={staff.name} tone={role?.tone ?? 'neutral'} size="lg" className="mx-auto mb-3" />
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant={role?.tone ?? 'neutral'}>{role?.label || staff.custom_role || 'Staff'}</Badge>
          <Badge variant={isPaid ? 'success' : 'danger'} dot>
            {isPaid ? 'Paid' : 'Unpaid'} · {getMonthName(month)}
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl bg-accent-soft text-accent shrink-0">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted">Monthly salary</span>
            <span className="block font-bold text-heading tabular-nums truncate">
              {money(staff.monthly_salary)}
            </span>
          </span>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl bg-info-soft text-info shrink-0">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted">Joined</span>
            <span className="block font-bold text-heading truncate">{formatDate(staff.join_date)}</span>
          </span>
        </Card>
      </div>

      {staff.role === 'trainer' && !commission.loading && (
        <Card className="mb-4">
          <CardHeader
            title="Personal-training commission"
            subtitle="Earned from PT packages, paid through the same ledger as salary."
            action={
              commission.pending > 0 ? (
                <Button size="sm" variant="success" onClick={handleCommissionPayout}>
                  <HandCoins className="size-4" aria-hidden="true" />
                  Pay {money(commission.pending)}
                </Button>
              ) : null
            }
          />
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted">Pending</dt>
              <dd className="text-xl font-bold text-warning font-display tabular-nums">
                {money(commission.pending)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Paid to date</dt>
              <dd className="text-xl font-bold text-success font-display tabular-nums">
                {money(commission.paid)}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <div className="flex gap-2 mb-6">
        <Button
          className="grow"
          disabled={isPaid}
          onClick={() => setShowPayForm(true)}
          title={isPaid ? 'Already paid this month' : undefined}
        >
          <CreditCard className="size-4" aria-hidden="true" />
          {isPaid ? 'Salary paid' : 'Pay salary'}
        </Button>
        <Button variant="danger-soft" onClick={() => setShowDeleteOptions(true)}>
          <Trash2 className="size-4" aria-hidden="true" />
          Remove
        </Button>
      </div>

      <Card>
        <CardHeader title="Salary history" subtitle={`${salaryHistory.length} payment${salaryHistory.length === 1 ? '' : 's'}`} />
        {salaryHistory.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Logged salaries appear here." className="py-8" />
        ) : (
          <ul className="flex flex-col divide-y divide-line -my-2">
            {salaryHistory.map((sp) => (
              <li key={sp.id} className="flex items-center gap-3 py-3">
                <span className="grow min-w-0">
                  <span className="block text-sm font-semibold text-heading">
                    {getMonthName(sp.month)} {sp.year}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatDate(sp.paid_date)} · {sp.payment_method}
                  </span>
                </span>
                <span className="font-bold text-success tabular-nums shrink-0">
                  {money(sp.amount_paid)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Print receipt for ${getMonthName(sp.month)} ${sp.year}`}
                  title="Print receipt"
                  onClick={() =>
                    printSalaryReceipt({
                      id: sp.id,
                      staffName: staff.name,
                      staffPhone: staff.phone,
                      amount: sp.amount_paid,
                      month: sp.month,
                      year: sp.year,
                      paidDate: sp.paid_date,
                      paymentMethod: sp.payment_method,
                    })
                  }
                >
                  <Printer className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={showPayForm}
        onClose={() => setShowPayForm(false)}
        title="Log salary payment"
        description={`${staff.name} · ${getMonthName(month)} ${year}`}
      >
        <form className="flex flex-col gap-4" onSubmit={handlePaySalary}>
          <Input
            label="Amount paid"
            required
            type="text"
            inputMode="numeric"
            value={payForm.amount_paid}
            onChange={(e) => setPayForm((p) => ({ ...p, amount_paid: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            value={payForm.paid_date}
            onChange={(e) => setPayForm((p) => ({ ...p, paid_date: e.target.value }))}
          />
          <Select
            label="Payment method"
            value={payForm.payment_method}
            onChange={(e) => setPayForm((p) => ({ ...p, payment_method: e.target.value }))}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setShowPayForm(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={isSaving}>
              Log salary
            </Button>
          </div>
        </form>
      </Modal>

      <DeleteChoiceModal
        open={showDeleteOptions}
        onClose={() => setShowDeleteOptions(false)}
        title="Remove staff member"
        name={staff.name}
        softDescription="They disappear from your staff list, but their salary payments stay in your expense reports."
        hardDescription="Permanently deletes this staff member along with every salary payment and attendance record. This cannot be undone."
        onSoftDelete={() => handleDelete(false)}
        onHardDelete={() => handleDelete(true)}
      />
    </Page>
  );
}
