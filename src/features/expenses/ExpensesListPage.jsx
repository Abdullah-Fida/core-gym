import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Receipt, ChevronDown, ChevronRight, Wallet, BarChart3, Repeat } from 'lucide-react';
import { formatDate, getCurrentMonth, getCurrentYear, getMonthName } from '../../lib/utils';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import api from '../../lib/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Button, Card, Select,
  EmptyState, ListSkeleton,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

export default function ExpensesListPage() {
  const money = useMoney();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [showStaffDetails, setShowStaffDetails] = useState(false);
  const [month, setMonth] = useState(getCurrentMonth());
  const [category, setCategory] = useState('');
  const year = getCurrentYear();

  const [expenseData, setExpenseData] = useState(null);
  const [deletingIds, setDeletingIds] = useState([]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setExpenseData(null);
      try {
        const res = await api.get('/expenses', { params: { month, year, category } });
        if (isMounted) setExpenseData(res.data.data || []);
      } catch (err) {
        console.error('Expenses api error:', err);
        if (isMounted) setExpenseData([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [month, year, category]);

  const { staffSalaries, otherExpenses, staffTotal, total } = useMemo(() => {
    const all = expenseData ?? [];
    const salaries = all.filter((e) => e.is_staff_salary);
    return {
      staffSalaries: salaries,
      otherExpenses: all.filter((e) => !e.is_staff_salary),
      staffTotal: salaries.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      total: all.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    };
  }, [expenseData]);

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete expense?',
      message: 'This expense will be permanently removed from your records.',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    setDeletingIds((prev) => [...prev, id]);
    await new Promise((r) => setTimeout(r, 300));

    try {
      await api.delete(`/expenses/${id}`);
      setExpenseData((prev) => prev?.filter((e) => e.id !== id) ?? prev);
    } catch (err) {
      console.error('Failed to delete expense:', err);
      // Was a raw window.alert(), which cannot be styled and blocks the page.
      toast.error(err.response?.data?.message || 'Could not delete this expense.');
      setDeletingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const catIcon = (cat) => EXPENSE_CATEGORIES.find((c) => c.value === cat)?.icon || '📦';
  const catLabel = (exp) =>
    exp.custom_category || EXPENSE_CATEGORIES.find((c) => c.value === exp.category)?.label || 'Expense';

  const loading = expenseData === null;

  return (
    <Page>
      <PageHeader
        title="Expenses"
        subtitle={`${getMonthName(month)} ${year}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/expenses/summary')}>
              <BarChart3 className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Profit / loss</span>
            </Button>
            <Button onClick={() => navigate('/expenses/add')}>
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {getMonthName(i + 1)}
            </option>
          ))}
        </Select>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <Card className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total expenses</p>
        <p className="text-3xl font-bold text-danger font-display tabular-nums mt-1">
          {loading ? '—' : money(total)}
        </p>
      </Card>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : (expenseData?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses recorded"
          description={category ? 'Try a different category.' : `Nothing logged for ${getMonthName(month)} yet.`}
          action={
            <Button onClick={() => navigate('/expenses/add')}>
              <Plus className="size-4" aria-hidden="true" />
              Add expense
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {/* Staff salaries roll up into one expandable row */}
          {staffSalaries.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowStaffDetails((v) => !v)}
                aria-expanded={showStaffDetails}
                className="flex items-center gap-3 w-full p-4 text-left bg-surface-2 border border-line border-l-4 border-l-success rounded-xl transition-colors hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex items-center justify-center size-11 rounded-xl bg-success-soft text-success shrink-0">
                  <Wallet className="size-5" aria-hidden="true" />
                </span>
                <span className="grow min-w-0">
                  <span className="block font-semibold text-heading">Staff salaries</span>
                  <span className="block text-xs text-muted">
                    {staffSalaries.length} paid this month
                  </span>
                </span>
                <span className="font-bold text-danger tabular-nums shrink-0">{money(staffTotal)}</span>
                {showStaffDetails ? (
                  <ChevronDown className="size-4 text-muted shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4 text-muted shrink-0" aria-hidden="true" />
                )}
              </button>

              {showStaffDetails && (
                <ul className="ml-5 mt-1 pl-3 border-l-2 border-dashed border-line flex flex-col gap-1">
                  {staffSalaries.map((sp) => (
                    <li
                      key={sp.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-3/60"
                    >
                      <span className="grow min-w-0">
                        <span className="block text-sm font-medium text-heading truncate">
                          {sp.description?.includes(': ') ? sp.description.split(': ')[1] : sp.description}
                        </span>
                        <span className="block text-xs text-muted">Paid {formatDate(sp.expense_date)}</span>
                      </span>
                      <span className="text-sm font-semibold text-danger tabular-nums shrink-0">
                        {money(sp.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {otherExpenses.map((exp) => {
            const isDeleting = deletingIds.includes(exp.id);
            return (
              <div
                key={exp.id}
                className={cn(
                  'flex items-center gap-3 p-3 sm:p-4 bg-surface-2 border border-line rounded-xl',
                  'transition-all duration-300 hover:border-line-hover',
                  isDeleting && 'translate-x-24 opacity-0 pointer-events-none'
                )}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/expenses/${exp.id}/edit`)}
                  className="flex items-center gap-3 grow min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    className="flex items-center justify-center size-11 rounded-xl bg-surface-3 text-2xl shrink-0"
                    aria-hidden="true"
                  >
                    {catIcon(exp.category)}
                  </span>
                  <span className="grow min-w-0">
                    <span className="block font-semibold text-heading truncate">{catLabel(exp)}</span>
                    {exp.description && (
                      <span className="block text-xs text-muted truncate">{exp.description}</span>
                    )}
                    <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted mt-0.5">
                      {formatDate(exp.expense_date)}
                      {exp.is_recurring && (
                        <>
                          <Repeat className="size-3" aria-hidden="true" />
                          Recurring
                        </>
                      )}
                    </span>
                  </span>
                </button>

                <span className="font-bold text-danger tabular-nums shrink-0">{money(exp.amount)}</span>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted hover:text-danger hover:bg-danger-soft shrink-0"
                  onClick={() => handleDelete(exp.id)}
                  aria-label={`Delete ${catLabel(exp)} expense`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
