import { useState } from 'react';
import api from '../../lib/api';
import { identifyFingerprint } from '../../lib/biometrics';
import { daysFromNow } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { Fingerprint, CheckCircle2, XCircle, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Page, PageHeader, BackLink, Card, Button, Avatar } from '../../components/ui';

export default function AttendanceScanner() {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { member, allowed, message }

  const handleScan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const member = await identifyFingerprint();

      const days = member.latest_expiry ? daysFromNow(member.latest_expiry) : null;
      const isExpired = member.status === 'expired' || (days !== null && days < 0);

      if (isExpired) {
        setResult({
          member,
          allowed: false,
          message:
            days === null
              ? 'Access denied — no active membership.'
              : `Access denied — membership expired ${Math.abs(days)} days ago.`,
        });
        toast.error('Membership expired.');
      } else {
        await api.post('/attendance/mark', {
          member_id: member.id,
          check_in_time: new Date().toISOString(),
        });

        setResult({ member, allowed: true, message: `Welcome back, ${member.name.split(' ')[0]}!` });
        toast.success(`Welcome, ${member.name}.`);
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        toast.error(err.message || 'Scan failed.');
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <Page width="narrow">
      <PageHeader
        title="Access gate"
        subtitle="Scan a fingerprint to grant entry and mark attendance"
        back={<BackLink to="/attendance" label="Attendance" />}
      />

      <Card padding="lg" className="text-center">
        <div
          className={cn(
            'flex items-center justify-center size-28 mx-auto mb-8 rounded-full transition-all duration-300',
            result
              ? result.allowed
                ? 'bg-success-soft text-success'
                : 'bg-danger-soft text-danger'
              : scanning
                ? 'bg-accent-soft text-accent shadow-accent'
                : 'bg-surface-3 text-muted'
          )}
        >
          {scanning ? (
            <Loader2 className="size-12 animate-spin" aria-hidden="true" />
          ) : result ? (
            result.allowed ? (
              <CheckCircle2 className="size-14" aria-hidden="true" />
            ) : (
              <XCircle className="size-14" aria-hidden="true" />
            )
          ) : (
            <Fingerprint className="size-14" aria-hidden="true" />
          )}
        </div>

        {/* The scan outcome is announced, not just shown. */}
        <div role="status" aria-live="polite">
          {result ? (
            <>
              <Avatar
                name={result.member.name}
                size="lg"
                tone={result.allowed ? 'success' : 'danger'}
                className="mx-auto mb-4"
              />
              <h2 className="text-2xl font-bold text-heading font-display">{result.member.name}</h2>
              <p
                className={cn(
                  'text-base font-semibold mt-2',
                  result.allowed ? 'text-success' : 'text-danger'
                )}
              >
                {result.message}
              </p>

              {!result.allowed && (
                <p className="flex items-center justify-center gap-2 p-3 mt-5 rounded-xl bg-accent-soft text-accent text-sm">
                  <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                  Please clear dues before entering.
                </p>
              )}

              <Button variant="secondary" block className="mt-6" onClick={() => setResult(null)}>
                Clear and scan next
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-heading">Ready to scan</h2>
              <p className="text-sm text-muted mt-1.5 mb-8">
                Ask the member to place their finger on the sensor.
              </p>
              <Button size="lg" block loading={scanning} onClick={handleScan}>
                {scanning ? 'Waiting for sensor…' : 'Start scanner'}
              </Button>
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Card>
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">Entry rule</p>
          <p className="text-sm font-semibold text-heading mt-1">Strict expiry check</p>
        </Card>
        <Card>
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">Log status</p>
          <p className="text-sm font-semibold text-heading mt-1">Auto attendance enabled</p>
        </Card>
      </div>
    </Page>
  );
}
