import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import api from '../../lib/api';
import '../../styles/auth.css';

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
    if (!otp || otp.length < 4) { setError('Enter valid OTP code'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { phone, otp, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">CG</div>
          <h1>Reset Password</h1>
          <p>Enter OTP and create new password</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>✅</div>
            <h3>Password Reset!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Redirecting to login...</p>
          </div>
        ) : (
          <>
            {error && <div className="auth-error">{error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">OTP Code</label>
                <input className="form-input" placeholder="Enter 4-6 digit code" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} style={{ textAlign: 'center', letterSpacing: 8, fontSize: 'var(--font-xl)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg"><Lock size={18} /> Reset Password</button>
            </form>
          </>
        )}

        <div className="auth-footer">
          <Link to="/login">← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
