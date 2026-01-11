import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';

interface DisplayNameModalProps {
  show: boolean;
  onClose: () => void;
}

export const DisplayNameModal: React.FC<DisplayNameModalProps> = ({ show, onClose }) => {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill with current display_name when modal opens
  useEffect(() => {
    if (show && user) {
      setDisplayName(user.display_name || '');
      setError('');
      setSuccess('');
    }
  }, [show, user]);

  const validateDisplayName = (name: string): string | null => {
    if (name.length < 3) {
      return 'Display name must be at least 3 characters';
    }
    if (name.length > 30) {
      return 'Display name must be at most 30 characters';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return 'Display name can only contain letters, numbers, underscores, and dashes';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = displayName.trim();

    // Client-side validation
    const validationError = validateDisplayName(trimmedName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/user/display-name', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ display_name: trimmedName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update display name');
        return;
      }

      // Success - refresh user and show success message
      setSuccess('Display name updated successfully!');
      await refreshUser();

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
    setError(''); // Clear error when user types
  };

  if (!show) return null;

  return (
    <>
      {/* Bootstrap Modal Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1040 }}
      ></div>

      {/* Bootstrap Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        style={{ zIndex: 1050 }}
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content bg-dark text-white border-secondary">
            <div className="modal-header border-secondary">
              <h5 className="modal-title">Change Display Name</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={loading}
              ></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Your display name will be shown on all your builds instead of your {user?.provider} username.
                </p>

                {user?.display_name && (
                  <div className="mb-3">
                    <small className="text-info">
                      Current display name: <strong>{user.display_name}</strong>
                    </small>
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="displayName" className="form-label">
                    New Display Name
                  </label>
                  <input
                    type="text"
                    className={`form-control bg-secondary text-white border-secondary ${
                      error ? 'is-invalid' : ''
                    } ${success ? 'is-valid' : ''}`}
                    id="displayName"
                    value={displayName}
                    onChange={handleInputChange}
                    placeholder="Enter display name (3-30 characters)"
                    disabled={loading}
                    autoFocus
                  />
                  <div className="form-text text-muted">
                    Letters, numbers, underscores, and dashes only
                  </div>
                  {error && <div className="invalid-feedback d-block">{error}</div>}
                  {success && <div className="valid-feedback d-block">{success}</div>}
                </div>
              </div>

              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !displayName.trim()}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Display Name'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
