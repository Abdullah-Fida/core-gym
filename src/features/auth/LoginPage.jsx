import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Handle redirects from suspension
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('suspended') === '1') {
      setError('Your gym access has been suspended by the admin. Please contact support at 03069005213.');
      // remove the query param safely
      window.history.replaceState(null, '', '/login');
    } else if (params.get('expired') === '1') {
      setError('Your session has expired. Please log in again.');
      window.history.replaceState(null, '', '/login');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      if (result.role === 'admin') navigate('/admin/dashboard');
      else navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">CG</div>
          <h1>Core Gym</h1>
          <p>Gym Management Platform</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email or Phone</label>
            <input
              id="login-email"
              type="text"
              className="form-input"
              placeholder="Enter email or phone number"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Link to="/forgot-password" style={{ fontSize: 'var(--font-sm)', color: 'var(--accent-primary)' }}>
              Forgot Password?
            </Link>
          </div>

          <button id="login-submit" type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span> : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: 'var(--space-md)' }}>
          Need access? Contact support to register your gym.
        </div>
      </div>
    </div>
  );
}


