import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import { Button, Input } from '../../components/ui';
import AuthShell from './AuthShell';

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError('Enter the phone number on your gym account.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { phone });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your phone" subtitle={`If ${phone} is registered, a code is on its way.`}>
        <div className="flex flex-col items-center text-center p-6 rounded-xl border border-line bg-surface-2">
          <span className="flex items-center justify-center size-12 rounded-2xl bg-accent-soft text-accent mb-4">
            <MessageSquare className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">
            The code expires in 10 minutes. Enter it on the next screen to set a new password.
          </p>
          <Link to="/reset-password" state={{ phone }} className="w-full mt-5">
            <Button block>Enter code</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="We'll send a one-time code to your registered number.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <p role="alert" className="p-3 rounded-lg border border-danger/30 bg-danger-soft text-sm text-danger">
            {error}
          </p>
        )}

        <Input
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="03001234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

        <Button type="submit" size="lg" block loading={loading}>
          <Send className="size-4" aria-hidden="true" />
          Send code
        </Button>
      </form>
    </AuthShell>
  );
}
