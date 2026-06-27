import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      setSent(true);
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
              <h2 className="card-title text-center mb-2">Reset Password</h2>
              <p className="text-center text-muted mb-4">For local accounts only (not Google or Steam)</p>

              {sent ? (
                <div className="text-center">
                  <div className="alert alert-success">
                    If an account with that email exists, a reset link has been sent. Check your inbox.
                  </div>
                  <Link to="/login" className="btn btn-outline-light mt-2">
                    Back to login
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
                    <label htmlFor="forgot-email" className="form-label">Email address</label>
                    <input
                      type="email"
                      className="form-control bg-secondary text-white border-secondary"
                      id="forgot-email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="text-center mt-3">
            <Link to="/login" className="text-decoration-none text-light">
              &larr; Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
