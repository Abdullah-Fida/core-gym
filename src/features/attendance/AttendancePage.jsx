import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { identifyFingerprint } from '../../lib/biometrics';
import { daysFromNow, calculateMemberStatus } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import {
  Fingerprint, CheckCircle2, XCircle, Loader2, Search, Clock,
  UserCheck, ShieldAlert, CalendarCheck,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, Input, Tabs,
  Avatar, Badge, MemberStatusBadge, EmptyState, ListSkeleton,
} from '../../components/ui';

const TABS = [
  { key: 'gate', label: 'Live gate' },
  { key: 'history', label: "Today's entries" },
];

const ACCESS_RULES = [
  { tone: 'bg-success', text: 'Active members are logged automatically.' },
  { tone: 'bg-danger', text: 'Expired members are blocked at the gate.' },
  { tone: 'bg-accent', text: 'A local fingerprint sensor is required.' },
];

const isSecureContextForBiometrics = () =>
  window.location.protocol === 'https:' || window.location.hostname === 'localhost';

export default function AttendancePage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('gate');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = useCallback(async () => {
    setHistory(null);
    try {
      const res = await api.get('/attendance', {
        params: { date: new Date().toISOString().split('T')[0] },
      });
      setHistory(res.data.data || []);
    } catch (err) {
      console.error(err);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchHistory]);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/members', { params: { search: searchTerm } });
        if (!alive) return;
        setSearchResults(
          (res.data.data || [])
            .filter((m) => m.status !== 'deleted')
            .map((m) => ({ ...m, status: calculateMemberStatus(m) }))
            .slice(0, 10)
        );
      } catch (err) {
        console.error('Member search failed', err);
      }
    }, 250); // debounced — this previously refetched every member on each keystroke

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const member = await identifyFingerprint();
      const days = member.latest_expiry ? daysFromNow(member.latest_expiry) : null;
      const isExpired = member.status === 'expired' || (days !== null && days < 0);

      if (isExpired) {
        setScanResult({
          member,
          allowed: false,
          message: days === null ? 'Access denied — no active membership.' : `Access denied — fee overdue by ${Math.abs(days)} days.`,
        });
        toast.error('Membership expired.');
      } else {
        await api.post('/attendance/mark', {
          member_id: member.id,
          check_in_time: new Date().toISOString(),
        });
        setScanResult({ member, allowed: true, message: 'Access granted.' });
        toast.success(`Welcome back, ${member.name.split(' ')[0]}.`);
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        toast.error(err.message || 'Identification failed.');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleManualMark = async (memberId, name) => {
    try {
      await api.post('/attendance/mark', {
        member_id: memberId,
        check_in_time: new Date().toISOString(),
      });
      toast.success(`${name} checked in.`);
      setSearchTerm('');
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark attendance.');
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Page>
      <PageHeader title="Attendance" subtitle="Biometric gate and daily check-in log" />

      <Tabs items={TABS} value={activeTab} onChange={setActiveTab} className="mb-5" />

      {activeTab === 'gate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Card padding="lg" className="text-center">
            <div
              className={cn(
                'flex items-center justify-center size-28 mx-auto mb-8 rounded-full transition-all duration-300',
                scanResult
                  ? scanResult.allowed
                    ? 'bg-success-soft text-success'
                    : 'bg-danger-soft text-danger'
                  : scanning
                    ? 'bg-accent-soft text-accent shadow-accent'
                    : 'bg-surface-3 text-muted'
              )}
            >
              {scanning ? (
                <Loader2 className="size-12 animate-spin" aria-hidden="true" />
              ) : scanResult ? (
                scanResult.allowed ? (
                  <CheckCircle2 className="size-14" aria-hidden="true" />
                ) : (
                  <XCircle className="size-14" aria-hidden="true" />
                )
              ) : (
                <Fingerprint className="size-14" aria-hidden="true" />
              )}
            </div>

            <div role="status" aria-live="polite">
              {scanResult ? (
                <>
                  <Avatar
                    name={scanResult.member.name}
                    size="lg"
                    tone={scanResult.allowed ? 'success' : 'danger'}
                    className="mx-auto mb-4"
                  />
                  <h2 className="text-xl font-bold text-heading font-display">{scanResult.member.name}</h2>
                  <p className={cn('font-semibold mt-1.5 mb-6', scanResult.allowed ? 'text-success' : 'text-danger')}>
                    {scanResult.message}
                  </p>
                  <Button variant="secondary" block onClick={() => setScanResult(null)}>
                    Scan next member
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-heading">Ready to identify</h2>
                  <p className="text-sm text-muted mt-1.5 mb-8">Ask the member to press the scanner.</p>
                  <Button size="lg" block loading={scanning} onClick={handleScan}>
                    Identify fingerprint
                  </Button>
                </>
              )}
            </div>

            {!isSecureContextForBiometrics() && (
              <p className="flex items-start gap-2 mt-5 p-3 rounded-lg bg-danger-soft text-danger text-xs text-left">
                <ShieldAlert className="size-4 shrink-0 mt-px" aria-hidden="true" />
                <span>
                  Biometrics are disabled. Browsers require <strong>HTTPS</strong> or{' '}
                  <strong>localhost</strong> for fingerprint access — this connection is insecure.
                </span>
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader
                title="Manual check-in"
                subtitle="Use this when the scanner is unavailable"
              />
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  className="pl-9"
                  placeholder="Member name or phone…"
                  aria-label="Search members to check in"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searchTerm.trim().length >= 2 && (
                <ul className="flex flex-col gap-2 mt-3">
                  {searchResults.length === 0 ? (
                    <li className="text-sm text-muted text-center py-4">
                      No members matching “{searchTerm}”.
                    </li>
                  ) : (
                    searchResults.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-3"
                      >
                        <Avatar name={m.name} size="sm" />
                        <span className="grow min-w-0">
                          <span className="block text-sm font-semibold text-heading truncate">{m.name}</span>
                          <span className="block text-xs text-muted truncate">{m.phone || 'No phone'}</span>
                        </span>
                        <MemberStatusBadge status={m.status} />
                        <Button size="sm" onClick={() => handleManualMark(m.id, m.name)}>
                          Check in
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Access rules" />
              <ul className="flex flex-col gap-2.5">
                {ACCESS_RULES.map((rule) => (
                  <li key={rule.text} className="flex items-center gap-2.5 text-sm text-body">
                    <span className={cn('size-1.5 rounded-full shrink-0', rule.tone)} aria-hidden="true" />
                    {rule.text}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="border-dashed">
              <CardHeader
                title="Fingerprint enrolment"
                subtitle="Register a new fingerprint from the member's profile page"
              />
              <Button variant="secondary" size="sm" onClick={() => navigate('/members')}>
                <UserCheck className="size-4" aria-hidden="true" />
                Manage members
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          {history === null ? (
            <ListSkeleton rows={5} />
          ) : history.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No check-ins today"
              description="Entries will appear here as members arrive."
            />
          ) : (
            <>
              <CardHeader title={`Today's check-ins (${history.length})`} />
              <ul className="flex flex-col gap-2">
                {history.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-3"
                  >
                    {/*
                      These read `log.members` and `log.check_in_time`. The page
                      previously read `log.member` and `log.timestamp` — neither
                      of which the API returns — so every row rendered a blank
                      name and a `--:--` time.
                    */}
                    <Avatar name={log.members?.name} size="sm" />
                    <span className="grow min-w-0">
                      <span className="block text-sm font-semibold text-heading truncate">
                        {log.members?.name || 'Unknown member'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="size-3" aria-hidden="true" />
                        {formatTime(log.check_in_time)}
                      </span>
                    </span>
                    <Badge variant="success" dot>
                      Present
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
    </Page>
  );
}
