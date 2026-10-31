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

interface ReportedComment {
  id: number;
  build_id: number;
  content: string;
  created_at: string;
  author_name: string;
  build_name: string;
  report_count: number;
  last_reported_at: string;
  reporters: string | null;
}

const formatDbDate = (value: string) => new Date(value.replace(' ', 'T') + 'Z').toLocaleString();

// Moderation queue: builds submitted without an account + reported comments (admin only)
export default function PendingBuilds() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingBuildSummary[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reported, setReported] = useState<ReportedComment[] | null>(null);
  const [busyCommentId, setBusyCommentId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/pending-builds')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load the moderation queue'))))
      .then(data => setPending(data.pending))
      .catch(err => setError(err.message));
    fetch('/api/admin/reported-comments')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load reported comments'))))
      .then(data => setReported(data.comments))
      .catch(err => setError(err.message));
  }, []);

  // Delete the comment, or dismiss its reports (comment judged fine)
  const handleComment = async (comment: ReportedComment, action: 'delete' | 'dismiss') => {
    if (action === 'delete' && !window.confirm('Delete this comment?')) return;
    setBusyCommentId(comment.id);
    setError('');
    try {
      const url = action === 'delete'
        ? `/api/builds/${comment.build_id}/comments/${comment.id}`
        : `/api/builds/${comment.build_id}/comments/${comment.id}/reports`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Action failed');
      }
      setReported(current => current?.filter(c => c.id !== comment.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyCommentId(null);
    }
  };

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
      <h2 className="mb-1">Moderation</h2>
      <h3 className="mt-4 mb-1">Pending Builds</h3>
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
                  {' '}- {p.game_version} - submitted {formatDbDate(p.created_at)}
                </div>
              </div>
              <Link to={`/admin/pending/${p.id}`} className="btn btn-sm btn-outline-light">Preview</Link>
              <button className="btn btn-sm btn-success" disabled={busyId === p.id} onClick={() => review(p.id, 'approve')}>Approve</button>
              <button className="btn btn-sm btn-outline-danger" disabled={busyId === p.id} onClick={() => review(p.id, 'reject')}>Reject</button>
            </div>
          ))}
        </div>
      )}

      <h3 className="mt-5 mb-1">Reported Comments</h3>
      <p className="text-muted">Delete the comment, or dismiss the reports to keep it. Authors and reporters are never notified.</p>

      {reported === null && !error && (
        <div className="text-center mt-3">
          <div className="spinner-border spinner-border-sm text-light" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {reported?.length === 0 && (
        <div className="alert alert-secondary">No reported comments.</div>
      )}

      {reported && reported.length > 0 && (
        <div className="list-group mb-5">
          {reported.map(c => (
            <div key={c.id} className="list-group-item bg-dark text-white border-secondary">
              <div className="d-flex flex-wrap align-items-start gap-2">
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="small text-muted mb-1">
                    <span className="badge bg-danger me-2"><i className="bi bi-flag-fill me-1"></i>{c.report_count}</span>
                    <strong className="text-info">{c.author_name}</strong> on{' '}
                    <Link to={`/build/${c.build_id}#comment-${c.id}`}>{decodeHtmlEntities(c.build_name)}</Link>
                    {' '}- posted {formatDbDate(c.created_at)}
                  </div>
                  <p className="mb-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</p>
                  <div className="small text-muted">
                    Reported by {c.reporters || 'unknown'} - last {formatDbDate(c.last_reported_at)}
                  </div>
                </div>
                <Link to={`/build/${c.build_id}#comment-${c.id}`} className="btn btn-sm btn-outline-light">View</Link>
                <button className="btn btn-sm btn-outline-secondary" disabled={busyCommentId === c.id} onClick={() => handleComment(c, 'dismiss')}>Dismiss</button>
                <button className="btn btn-sm btn-danger" disabled={busyCommentId === c.id} onClick={() => handleComment(c, 'delete')}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
