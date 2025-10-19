import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'oauth'>('oauth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed.');
        setSubmitting(false);
        return;
      }

      // Registration successful, redirect to home
      window.location.href = '/';
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed.');
        setSubmitting(false);
        return;
      }

      // Login successful, redirect to home
      window.location.href = '/';
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card bg-dark text-white border-secondary">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Sign In to Stellaris Build</h2>
              <p className="text-center text-muted mb-4">
                Sign in to create and share your own Stellaris empire builds
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

              {/* Error Alert */}
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {/* OAuth Tab */}
              {activeTab === 'oauth' && (
                <div className="d-grid gap-3">
                  <a
                    href="/auth/google"
                    className="btn btn-lg btn-light d-flex align-items-center justify-content-center"
                  >
                    <i className="bi bi-google me-2"></i>
                    Sign in with Google
                  </a>
                  <a
                    href="/auth/steam"
                    className="btn btn-lg btn-primary d-flex align-items-center justify-content-center"
                  >
                    <i className="bi bi-steam me-2"></i>
                    Sign in with Steam
                  </a>
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
                    disabled={submitting}
                  >
                    {submitting ? 'Logging in...' : 'Login'}
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
                    disabled={submitting}
                  >
                    {submitting ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="text-center mt-3">
            <a href="/" className="text-decoration-none text-light">
              &larr; Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
