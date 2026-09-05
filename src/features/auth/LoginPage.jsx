import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Activity, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME } from '../../lib/constants';
import { Button, Input, Field } from '../../components/ui';

/**
 * Why the user was bounced back to /login. The API client redirects here with
 * ?suspended=1 (gym deactivated) or ?expired=1 (401), and the banner is read
 * once at mount so it survives the history rewrite below.
 */
function redirectReason() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('suspended') === '1') {
    return 'Your gym access has been suspended by the admin. Please contact support.';
  }
  if (params.get('expired') === '1') {
    return 'Your session has expired. Please log in again.';
  }
  return '';
}

const FEATURES = [
  {
    icon: Users,
    title: 'Smart member management',
    body: 'Track attendance, subscriptions and renewals from one place.',
  },
  {
    icon: Activity,
    title: 'Real-time analytics',
    body: 'See daily cash, growth and expiring memberships at a glance.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure and reliable',
    body: 'Every gym’s data is isolated and protected.',
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(redirectReason);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', '/login');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      navigate(result.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface grid lg:grid-cols-2">
      {/* Marketing column — desktop only */}
      <div className="relative hidden lg:flex flex-col justify-center p-12 overflow-hidden bg-surface-2 border-r border-line">
        <div
          className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-20 size-112 rounded-full bg-info/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <span className="flex items-center justify-center size-11 rounded-xl bg-accent text-accent-contrast font-bold">
              BG
            </span>
            <span className="text-xl font-bold text-heading font-display">{APP_NAME}</span>
          </div>

          <h1 className="text-4xl font-bold text-heading font-display tracking-tight leading-[1.15]">
            Run your gym, not your spreadsheets.
          </h1>
          <p className="text-base text-muted mt-4 leading-relaxed">
            Members, fees, attendance, staff and reporting — one platform built for how gyms
            actually work.
          </p>

          <ul className="flex flex-col gap-6 mt-12">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex items-center justify-center size-10 rounded-xl bg-accent-soft text-accent shrink-0">
                  <f.icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-heading">{f.title}</span>
                  <span className="block text-sm text-muted mt-0.5">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form column */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center size-10 rounded-xl bg-accent text-accent-contrast font-bold text-sm">
              BG
            </span>
            <span className="text-lg font-bold text-heading font-display">{APP_NAME}</span>
          </div>

          <h2 className="text-2xl font-bold text-heading font-display">Welcome back</h2>
          <p className="text-sm text-muted mt-1.5">Enter your details to sign in.</p>

          {error && (
            <p
              role="alert"
              className="mt-5 p-3 rounded-lg border border-danger/30 bg-danger-soft text-sm text-danger"
            >
              {error}
            </p>
          )}

          <form className="flex flex-col gap-4 mt-6" onSubmit={handleSubmit}>
            {/* The label had no htmlFor even though the input carried an id, so
                clicking it did nothing. Field wires them together. */}
            <Input
              id="login-email"
              label="Email"
              type="email"
              placeholder="you@yourgym.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />

            <Field label="Password" htmlFor="login-password" required>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full bg-surface-3 border border-line rounded-lg px-3 py-2.5 pr-11 text-sm text-heading placeholder:text-muted/70 transition-colors hover:border-line-hover focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted transition-colors hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {showPass ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </Field>

            <div className="flex justify-end -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-accent hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" size="lg" block loading={loading} className="mt-2">
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
