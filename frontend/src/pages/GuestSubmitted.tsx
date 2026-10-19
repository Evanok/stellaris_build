import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../AuthContext';
import { claimUrl } from '../utils/guestClaims';
import { decodeHtmlEntities } from '../utils/htmlDecode';

// Shown after a build was submitted without an account. The main goal besides
// confirming: turn the visitor into an account, which claims the build.
const GuestSubmitted: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as { name?: string; claimToken?: string } | null;
  const [copied, setCopied] = useState(false);

  const link = state?.claimToken ? claimUrl(state.claimToken) : null;

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link stays visible and selectable
    }
  };

  return (
    <div className="container mt-5">
      <Helmet>
        <title>Build Submitted - Stellaris Build</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="card bg-dark border-success">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3.5rem' }}></i>
                <h2 className="mt-3">Thanks for sharing your build!</h2>
                <p className="text-light mb-0">
                  {state?.name ? <><strong>{decodeHtmlEntities(state.name)}</strong> was</> : 'Your build was'} sent
                  to our moderators. It will be live on the site within 24-48 hours.
                </p>
              </div>

              {!user && (
                <div className="p-3 rounded mb-3" style={{ background: 'rgba(25, 135, 84, 0.12)', border: '1px solid rgba(25, 135, 84, 0.4)' }}>
                  <h5 className="mb-2">
                    <i className="bi bi-person-plus me-2"></i>
                    Make it yours
                  </h5>
                  <p className="mb-3 small">
                    Create a free account on this browser and the build is linked to it automatically,
                    so you can edit it later and keep track of how it is rated.
                  </p>
                  <Link to="/login" className="btn btn-success">Create an account / Sign in</Link>
                </div>
              )}

              {link && (
                <div className="mb-3">
                  <label className="form-label small text-muted mb-1">
                    Claim link - keep it to link the build to an account from another device
                  </label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control bg-secondary text-white border-secondary"
                      value={link}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                    <button className="btn btn-outline-light" type="button" onClick={handleCopy}>
                      <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'} me-1`}></i>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="text-center mt-4">
                <Link to="/" className="btn btn-outline-secondary">Back to builds</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestSubmitted;
