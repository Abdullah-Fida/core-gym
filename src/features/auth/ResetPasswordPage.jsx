import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { Button, Input } from '../../components/ui';
import AuthShell from './AuthShell';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const phone = location.state?.phone || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 4) {
      setError('Enter the code from your phone.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { phone, otp, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password.');
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password reset" subtitle="Taking you back to sign in…">
        <div className="flex flex-col items-center text-center p-6 rounded-xl border border-line bg-surface-2">
          <span className="flex items-center justify-center size-12 rounded-2xl bg-success-soft text-success mb-4">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">You can now sign in with your new password.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={phone ? `Enter the code sent to ${phone}.` : 'Enter the code sent to your phone.'}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <p role="alert" className="p-3 rounded-lg border border-danger/30 bg-danger-soft text-sm text-danger">
            {error}
          </p>
        )}

        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          className="text-center text-xl tracking-[0.5em] font-bold"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          required
        />

        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && password !== confirm ? 'Passwords do not match' : undefined}
          required
        />

        <Button type="submit" size="lg" block loading={loading}>
          <Lock className="size-4" aria-hidden="true" />
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
