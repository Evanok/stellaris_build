import React, { useState } from 'react';

interface GuestSubmitModalProps {
  show: boolean;
  onClose: () => void;
  onBack: () => void;
  // Resolves with an error message to display, or null on success
  onSubmit: (guestName: string, website: string) => Promise<string | null>;
}

const GUEST_NAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

// Publishing without an account: the visitor only picks a name. The build is
// reviewed by a moderator before it goes live (see POST /api/builds/guest).
export const GuestSubmitModal: React.FC<GuestSubmitModalProps> = ({ show, onClose, onBack, onSubmit }) => {
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem('guest_author_name') || '';
    } catch {
      return '';
    }
  });
  // Honeypot: hidden from humans, filled in by bots
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guestName.trim();
    if (!GUEST_NAME_PATTERN.test(trimmed)) {
      setError('Your name must be 3 to 30 characters: letters, numbers, underscores and dashes only.');
      return;
    }
    setError('');
    setSubmitting(true);
    const submitError = await onSubmit(trimmed, website);
    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    try {
      localStorage.setItem('guest_author_name', trimmed);
    } catch {
      // Only a convenience for the next submission
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-dark text-white border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Publish Without an Account</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <p className="text-muted">
                Your build will be <strong className="text-white">reviewed by a moderator</strong> before
                it goes live, usually within 24-48 hours.
              </p>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <label htmlFor="guest-name" className="form-label">Your name, shown as the build's author</label>
              <input
                id="guest-name"
                type="text"
                className="form-control bg-secondary text-white border-secondary"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={30}
                placeholder="e.g. VoidEmperor_42"
                autoFocus
                required
              />
              <div className="form-text text-muted">3-30 characters: letters, numbers, _ and -</div>
              {/* Honeypot - positioned off-screen rather than display:none, which some bots skip */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
                <label htmlFor="guest-website">Website</label>
                <input id="guest-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer border-secondary">
              <button type="button" className="btn btn-outline-secondary" onClick={onBack} disabled={submitting}>
                Back to sign in
              </button>
              <button type="submit" className="btn btn-success" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
