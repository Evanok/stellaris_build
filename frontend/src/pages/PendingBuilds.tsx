import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../AuthContext';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { reviewPendingBuild } from '../utils/moderation';

interface PendingBuildSummary {
  id: number;
  name: string;
  game_version: string;
  guest_name: string;
  claimed: boolean;
  created_at: string;
}

// Moderation queue: builds submitted without an account (admin only)
export default function PendingBuilds() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingBuildSummary[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/pending-builds')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load the moderation queue'))))
      .then(data => setPending(data.pending))
      .catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.is_admin !== 1) {
      navigate('/');
      return;
    }
    load();
  }, [user, authLoading, navigate, load]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    try {
      await reviewPendingBuild(id, action);
      setPending(current => current?.filter(p => p.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container mt-4">
      <Helmet>
        <title>Moderation Queue - Stellaris Build</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h2 className="mb-1">Moderation Queue</h2>
      <p className="text-muted">Builds submitted without an account. Approving publishes them under the author's name.</p>

      {error && <div className="alert alert-danger">{error}</div>}

      {pending === null && !error && (
        <div className="text-center mt-5">
          <div className="spinner-border text-light" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {pending?.length === 0 && (
        <div className="alert alert-secondary">Nothing to review.</div>
      )}

      {pending && pending.length > 0 && (
        <div className="list-group">
          {pending.map(p => (
            <div key={p.id} className="list-group-item bg-dark text-white border-secondary d-flex flex-wrap align-items-center gap-2">
              <div className="flex-grow-1">
                <Link to={`/admin/pending/${p.id}`} className="fw-bold">{decodeHtmlEntities(p.name)}</Link>
                <div className="small text-muted">
                  by {p.guest_name}
                  {p.claimed && <span className="badge bg-info text-dark ms-2">claimed by an account</span>}
                  {' '}- {p.game_version} - submitted {new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleString()}
                </div>
              </div>
              <Link to={`/admin/pending/${p.id}`} className="btn btn-sm btn-outline-light">Preview</Link>
              <button className="btn btn-sm btn-success" disabled={busyId === p.id} onClick={() => review(p.id, 'approve')}>Approve</button>
              <button className="btn btn-sm btn-outline-danger" disabled={busyId === p.id} onClick={() => review(p.id, 'reject')}>Reject</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
