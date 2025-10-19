import React, { useState } from 'react';

interface AuthModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ show, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'oauth'>('oauth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      // Registration successful, user is now logged in
      onSuccess();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed.');
        setLoading(false);
        return;
      }

      // Login successful
      onSuccess();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'steam') => {
    // Store current form data before redirecting
    window.location.href = `/auth/${provider}`;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-dark text-white border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Sign In to Continue</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            <p className="text-muted mb-3">
              You need to be signed in to create a build. Choose how you want to continue:
            </p>

            {/* Tab Navigation */}
            <ul className="nav nav-tabs nav-fill mb-3" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'oauth' ? 'active' : ''}`}
                  onClick={() => setActiveTab('oauth')}
                  type="button"
                >
                  OAuth
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'login' ? 'active' : ''}`}
                  onClick={() => setActiveTab('login')}
                  type="button"
                >
                  Login
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'register' ? 'active' : ''}`}
                  onClick={() => setActiveTab('register')}
                  type="button"
                >
                  Register
                </button>
              </li>
            </ul>

            {/* Tab Content */}
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            {/* OAuth Tab */}
            {activeTab === 'oauth' && (
              <div>
                <button
                  className="btn btn-light w-100 mb-2"
                  onClick={() => handleOAuthLogin('google')}
                >
                  <i className="bi bi-google me-2"></i>
                  Continue with Google
                </button>
                <button
                  className="btn btn-primary w-100"
                  onClick={() => handleOAuthLogin('steam')}
                >
                  <i className="bi bi-steam me-2"></i>
                  Continue with Steam
                </button>
              </div>
            )}

            {/* Login Tab */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label htmlFor="login-username" className="form-label">
                    Username
                  </label>
                  <input
                    type="text"
                    className="form-control bg-secondary text-white border-secondary"
                    id="login-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="login-password" className="form-label">
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-control bg-secondary text-white border-secondary"
                    id="login-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            )}

            {/* Register Tab */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="mb-3">
                  <label htmlFor="register-username" className="form-label">
                    Username
                  </label>
                  <input
                    type="text"
                    className="form-control bg-secondary text-white border-secondary"
                    id="register-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    minLength={3}
                    maxLength={50}
                    required
                  />
                  <small className="text-muted">3-50 characters</small>
                </div>
                <div className="mb-3">
                  <label htmlFor="register-password" className="form-label">
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-control bg-secondary text-white border-secondary"
                    id="register-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={12}
                    maxLength={128}
                    required
                  />
                  <small className="text-muted d-block">
                    Minimum 12 characters with at least:
                    <ul className="mb-0 mt-1" style={{ fontSize: '0.85em' }}>
                      <li>One uppercase letter</li>
                      <li>One lowercase letter</li>
                      <li>One number</li>
                      <li>One special character (@$!%*?&#)</li>
                    </ul>
                  </small>
                </div>
                <div className="mb-3">
                  <label htmlFor="register-confirm-password" className="form-label">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    className="form-control bg-secondary text-white border-secondary"
                    id="register-confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-success w-100"
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
