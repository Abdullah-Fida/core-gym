import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import api from '../../lib/api';
import '../../styles/auth.css';

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) { setError('Phone number is required'); return; }
    
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { phone });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">CG</div>
          <h1>Forgot Password</h1>
          <p>Enter your phone number to receive OTP</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>📱</div>
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>OTP Sent!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-lg)' }}>
              A verification code has been sent to {phone}
            </p>
            <Link to="/reset-password" state={{ phone }} className="btn btn-primary btn-block">Enter OTP Code</Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error" style={{ color: 'var(--status-danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" placeholder="03001234567" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Sending...' : <><Send size={18} /> Send OTP</>}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login">← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
