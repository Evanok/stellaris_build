import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../AuthContext';
import { ClaimResult, claimBuild, removeGuestClaim } from '../utils/guestClaims';
import { setPostLoginRedirect } from '../utils/postLoginRedirect';
import { trackEvent } from '../utils/analytics';

// Target of the claim link given after a submission without an account. Attaches
// the build to the logged-in account; asks to sign in first, then comes back here.
const ClaimBuild: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || !user || attempted.current) return;
    attempted.current = true;
    claimBuild(token)
      .then(res => {
        setResult(res);
        removeGuestClaim(token);
        trackEvent('build_claimed', { status: res.status, source: 'link' });
      })
      .catch(err => setError(err.message));
  }, [user, loading, token]);

  const handleSignIn = () => {
    setPostLoginRedirect(`/claim/${encodeURIComponent(token)}`);
    navigate('/login');
  };

  let content: React.ReactNode;
  if (loading || (user && !result && !error)) {
    content = (
      <div className="text-center">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  } else if (!user) {
    content = (
      <div className="text-center">
        <i className="bi bi-link-45deg" style={{ fontSize: '3rem', color: '#0dcaf0' }}></i>
        <h3 className="mt-2">Claim your build</h3>
        <p className="text-muted">Sign in or create a free account, and this build will be linked to it.</p>
        <button className="btn btn-primary btn-lg" onClick={handleSignIn}>Sign in / Create an account</button>
      </div>
    );
  } else if (error) {
    content = (
      <div className="text-center">
        <i className="bi bi-x-circle text-danger" style={{ fontSize: '3rem' }}></i>
        <h3 className="mt-2">Could not claim this build</h3>
        <p className="text-muted">{error}</p>
        <Link to="/" className="btn btn-outline-secondary">Back to builds</Link>
      </div>
    );
  } else if (result) {
    const messages = {
      approved: <>Your build <strong>{result.build_name}</strong> is now linked to your account.</>,
      pending: <>Your build <strong>{result.build_name}</strong> is linked to your account. It is still waiting for moderation and will be published under your name.</>,
      rejected: <>Your build <strong>{result.build_name}</strong> was not approved by our moderators, so there is nothing to claim.</>,
    };
    content = (
      <div className="text-center">
        <i className={`bi ${result.status === 'rejected' ? 'bi-info-circle text-warning' : 'bi-check-circle-fill text-success'}`} style={{ fontSize: '3rem' }}></i>
        <p className="mt-3">{messages[result.status]}</p>
        {result.status === 'approved' && result.build_id
          ? <Link to={`/build/${result.build_id}`} className="btn btn-success">View my build</Link>
          : <Link to="/" className="btn btn-outline-secondary">Back to builds</Link>}
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <Helmet>
        <title>Claim Your Build - Stellaris Build</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card bg-dark border-secondary">
            <div className="card-body p-4">{content}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimBuild;
