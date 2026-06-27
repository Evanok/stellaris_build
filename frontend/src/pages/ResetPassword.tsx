import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-5">
            <div className="alert alert-danger">
              Invalid reset link. Please request a new one.
            </div>
            <Link to="/forgot-password" className="btn btn-outline-light">
              Request new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card bg-dark text-white border-secondary">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Choose a new password</h2>

              {success ? (
                <div className="text-center">
                  <div className="alert alert-success">
                    Password updated successfully.
                  </div>
                  <Link to="/login" className="btn btn-primary mt-2">
                    Go to login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}
                  <div className="mb-3">
                    <label htmlFor="new-password" className="form-label">New password</label>
                    <input
                      type="password"
                      className="form-control bg-secondary text-white border-secondary"
                      id="new-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={12}
                      maxLength={128}
                      required
                    />
                    <small className="text-muted d-block mt-1">
                      Min. 12 characters — uppercase, lowercase, number, special character (@$!%*?&#)
                    </small>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="confirm-password" className="form-label">Confirm password</label>
                    <input
                      type="password"
                      className="form-control bg-secondary text-white border-secondary"
                      id="confirm-password"
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
                    className="btn btn-primary w-100"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Reset password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
