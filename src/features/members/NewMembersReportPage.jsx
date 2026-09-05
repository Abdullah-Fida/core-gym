import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { getMonthName, daysFromNow, formatDateShort, calculateMemberStatus } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, BackLink, Card, CardHeader, Select,
  Avatar, MemberStatusBadge, EmptyState, ListSkeleton, Skeleton,
} from '../../components/ui';

function selectPeriod(members, period, now) {
  if (period === 'this_month') {
    return members.filter((m) => {
      const d = new Date(m.join_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }
  if (period === 'last_3_months') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return members.filter((m) => new Date(m.join_date) >= cutoff);
  }
  if (period === 'last_6_months') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return members.filter((m) => new Date(m.join_date) >= cutoff);
  }
  if (period === 'this_year') {
    return members.filter((m) => new Date(m.join_date).getFullYear() === now.getFullYear());
  }
  if (period.startsWith('month_')) {
    const monthIdx = parseInt(period.split('_')[1], 10) - 1;
    return members.filter((m) => {
      const d = new Date(m.join_date);
      return d.getMonth() === monthIdx && d.getFullYear() === now.getFullYear();
    });
  }
  return members; // all_time
}

export default function NewMembersReportPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('this_month');
  const [allMembers, setAllMembers] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/members');
        setAllMembers(
          (res.data.data || [])
            .filter((m) => m.status !== 'deleted')
            .map((m) => ({ ...m, status: calculateMemberStatus(m) }))
        );
      } catch (err) {
        console.error('Failed to fetch members', err);
        setAllMembers([]);
      }
    })();
  }, []);

  const report = useMemo(() => {
    if (!allMembers) return null;
    const now = new Date();
    const members = selectPeriod(allMembers, period, now);

    let prevTotal = 0;
    if (period === 'this_month' || period.startsWith('month_')) {
      const selectedMonth = period === 'this_month' ? now.getMonth() + 1 : parseInt(period.split('_')[1], 10);
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? now.getFullYear() - 1 : now.getFullYear();
      prevTotal = allMembers.filter((m) => {
        const d = new Date(m.join_date);
        return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear;
      }).length;
    }

    const total = members.length;
    return {
      members: [...members].sort((a, b) => new Date(b.join_date) - new Date(a.join_date)),
      total,
      prevTotal,
      change: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0,
      byStatus: [
        { label: 'Active', count: members.filter((m) => m.status === 'active').length, tone: 'text-success' },
        { label: 'Due soon', count: members.filter((m) => m.status === 'due_soon').length, tone: 'text-warning' },
        { label: 'Expired', count: members.filter((m) => m.status === 'expired').length, tone: 'text-danger' },
      ],
    };
  }, [allMembers, period]);

  const loading = !report;

  return (
    <Page>
      <PageHeader title="New members" back={<BackLink to="/members" label="Members" />} />

      <Select
        aria-label="Reporting period"
        className="mb-4"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
      >
        <option value="this_month">This month</option>
        <option value="last_3_months">Last 3 months</option>
        <option value="last_6_months">Last 6 months</option>
        <option value="this_year">This year</option>
        <option value="all_time">All time</option>
        <optgroup label="Specific month (this year)">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={`month_${i + 1}`}>
              {getMonthName(i + 1)}
            </option>
          ))}
        </optgroup>
      </Select>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4 mb-6">
        <Card className="text-center flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total joined</p>
          {loading ? (
            <Skeleton className="h-11 w-20 mx-auto my-2" />
          ) : (
            <p className="text-4xl font-bold text-accent font-display tabular-nums my-1">{report.total}</p>
          )}
          {!loading && report.prevTotal > 0 && (
            <p
              className={cn(
                'flex items-center justify-center gap-1 text-sm font-semibold',
                report.change >= 0 ? 'text-success' : 'text-danger'
              )}
            >
              {report.change >= 0 ? (
                <TrendingUp className="size-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4" aria-hidden="true" />
              )}
              {report.change >= 0 ? '+' : ''}
              {report.change}% vs previous month
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Current status" subtitle="Of the members in this period" />
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <dl className="flex flex-col divide-y divide-line">
              {report.byStatus.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2.5">
                  <dt className={cn('text-sm font-semibold', s.tone)}>{s.label}</dt>
                  <dd className="text-sm font-bold text-heading tabular-nums">{s.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
        Members joined {loading ? '' : `(${report.total})`}
      </h2>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : report.members.length === 0 ? (
        <EmptyState icon={UserPlus} title="No members joined" description="Nobody signed up in this period." />
      ) : (
        <ul className="flex flex-col gap-2">
          {report.members.map((member) => {
            const days = member.latest_expiry ? daysFromNow(member.latest_expiry) : null;
            const tone =
              days === null ? 'neutral' : days < 0 ? 'danger' : days <= 3 ? 'warning' : 'accent';
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/members/${member.id}`)}
                  className="flex items-center gap-3 w-full p-3 text-left bg-surface-2 border border-line rounded-xl transition-colors hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Avatar name={member.name} tone={tone} size="sm" />
                  <span className="grow min-w-0">
                    <span className="block text-sm font-semibold text-heading truncate">{member.name}</span>
                    <span className="block text-xs text-muted">
                      Joined {formatDateShort(member.join_date)}
                    </span>
                  </span>
                  <MemberStatusBadge status={member.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
