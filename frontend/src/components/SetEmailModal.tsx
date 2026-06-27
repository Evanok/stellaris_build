import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

const SKIP_KEY = 'skip_email_prompt';

interface SetEmailModalProps {
  show: boolean;
  onClose: () => void;
}

export const SetEmailModal: React.FC<SetEmailModalProps> = ({ show, onClose }) => {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(SKIP_KEY, '1');
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (email !== confirmEmail) {
      setError('Email addresses do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/user/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save email.');
        setSubmitting(false);
        return;
      }

      await refreshUser();
      onClose();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1050 }} role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content bg-dark text-white border-secondary">
            <div className="modal-header border-secondary">
              <h5 className="modal-title">Add a recovery email</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                disabled={submitting}
              ></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Add an email to your account so you can recover it if you forget your password.
                </p>

                {error && (
                  <div className="alert alert-danger py-2" role="alert">
                    {error}
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="set-email" className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-control bg-secondary text-white border-secondary"
                    id="set-email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    autoFocus
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="confirm-set-email" className="form-label">Confirm email address</label>
                  <input
                    type="email"
                    className="form-control bg-secondary text-white border-secondary"
                    id="confirm-set-email"
                    autoComplete="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="dont-show-again"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                  />
                  <label className="form-check-label text-muted small" htmlFor="dont-show-again">
                    Don't show this again
                  </label>
                </div>
              </div>

              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !email || !confirmEmail}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : 'Save email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
