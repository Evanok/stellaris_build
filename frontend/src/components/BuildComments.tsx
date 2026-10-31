import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { trackEvent } from '../utils/analytics';
import { setPostLoginRedirect } from '../utils/postLoginRedirect';

interface BuildComment {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  author_name: string;
  avatar: string | null;
  quote_id: number | null;
  quote_content: string | null; // null when the quoted comment was deleted
  quote_author: string | null;
  user_reported: number;
  report_count?: number; // admins only
}

const MAX_LENGTH = 2000;
const QUOTE_EXCERPT_LENGTH = 200;

// SQLite CURRENT_TIMESTAMP is UTC without a zone marker ("2026-10-31 12:21:08")
const parseDbDate = (value: string) => new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');

const formatDate = (value: string) =>
  parseDbDate(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const excerpt = (text: string) =>
  text.length > QUOTE_EXCERPT_LENGTH ? text.slice(0, QUOTE_EXCERPT_LENGTH).trimEnd() + '…' : text;

const Avatar: React.FC<{ name: string; avatar: string | null }> = ({ name, avatar }) =>
  avatar ? (
    <img src={avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
  ) : (
    <div
      style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#0dcaf0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.85rem', fontWeight: 'bold', color: '#000'
      }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );

const QuoteBlock: React.FC<{ author: string | null; content: string | null; onClick?: () => void }> = ({ author, content, onClick }) => (
  <blockquote
    className="border-start border-3 border-info ps-2 py-1 mb-2 small text-muted"
    style={{ background: 'rgba(255,255,255,0.04)', cursor: onClick ? 'pointer' : undefined }}
    onClick={onClick}
  >
    {content != null ? (
      <>
        <div className="fw-semibold text-info">{author} wrote:</div>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{excerpt(content)}</div>
      </>
    ) : (
      <em>Quoted comment was deleted</em>
    )}
  </blockquote>
);

export const BuildComments: React.FC<{ buildId: string; buildAuthorId?: number | null }> = ({ buildId, buildAuthorId }) => {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === 1;

  const [comments, setComments] = useState<BuildComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [quoted, setQuoted] = useState<BuildComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/builds/${buildId}/comments`, { cache: 'no-store' });
      if (!res.ok) return;
      setComments(await res.json());
    } catch {
      // Network error: keep what is displayed
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    setComments([]);
    setLoaded(false);
    setQuoted(null);
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId]);

  // Links like /build/42#comment-7 (report emails) - comments load after the page
  const hashHandledRef = useRef(false);
  useEffect(() => {
    if (!loaded || hashHandledRef.current) return;
    const match = window.location.hash.match(/^#comment-(\d+)$/);
    if (match) {
      hashHandledRef.current = true;
      scrollToComment(Number(match[1]));
    } else if (window.location.hash === '#comments') {
      hashHandledRef.current = true;
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loaded, comments]);

  const handleQuote = (comment: BuildComment) => {
    setQuoted(comment);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToComment = (commentId: number) => {
    const el = document.getElementById(`comment-${commentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('border-info');
    setTimeout(() => el.classList.remove('border-info'), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await fetch(`/api/builds/${buildId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, quote_id: quoted?.id ?? null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to post comment');
        return;
      }
      trackEvent('comment_posted', { build_id: buildId });
      setInput('');
      setQuoted(null);
      await fetchComments();
    } catch {
      setError('Network error, please try again');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      const res = await fetch(`/api/builds/${buildId}/comments/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to delete comment');
      }
    } catch {
      setError('Network error, please try again');
    } finally {
      setDeleteTarget(null);
      await fetchComments();
    }
  };

  const handleReport = async () => {
    if (reportTarget === null) return;
    setError('');
    try {
      const res = await fetch(`/api/builds/${buildId}/comments/${reportTarget}/report`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Failed to report comment');
      else setNotice('Thanks, the comment was reported to the moderators.');
    } catch {
      setError('Network error, please try again');
    } finally {
      setReportTarget(null);
      await fetchComments();
    }
  };

  const handleDismissReports = async (commentId: number) => {
    try {
      await fetch(`/api/builds/${buildId}/comments/${commentId}/reports`, { method: 'DELETE' });
    } finally {
      await fetchComments();
    }
  };

  return (
    <div className="card bg-dark border-secondary mb-4" id="comments">
      <div className="card-header bg-secondary">
        <h4 className="mb-0 text-white">
          <i className="bi bi-chat-left-text me-2"></i>
          Comments {comments.length > 0 && <span className="text-white-50 fs-6">({comments.length})</span>}
        </h4>
      </div>
      <div className="card-body">
        {loaded && comments.length === 0 && (
          <p className="text-muted mb-3">No comments yet. Start the discussion!</p>
        )}

        {comments.map(comment => {
          const canDelete = isAdmin;
          const isBuildAuthor = buildAuthorId != null && comment.user_id === buildAuthorId;
          const canReport = !!user && comment.user_id !== user.id;
          const reportCount = comment.report_count ?? 0;
          return (
            <div
              key={comment.id}
              id={`comment-${comment.id}`}
              className="d-flex gap-2 mb-3 p-2 rounded border border-secondary"
              style={{ transition: 'border-color 0.3s' }}
            >
              <Avatar name={comment.author_name} avatar={comment.avatar} />
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-baseline gap-2 flex-wrap mb-1">
                  <span className="fw-semibold text-info">{comment.author_name}</span>
                  {isBuildAuthor && <span className="badge bg-primary">Author</span>}
                  <small className="text-muted">{formatDate(comment.created_at)}</small>
                  {isAdmin && reportCount > 0 && (
                    <span className="badge bg-danger">
                      <i className="bi bi-flag-fill me-1"></i>Reported ({reportCount})
                      <button
                        type="button"
                        className="btn btn-link p-0 ms-2 text-white small"
                        title="Dismiss the reports (the comment is fine)"
                        onClick={() => handleDismissReports(comment.id)}
                      >
                        Dismiss
                      </button>
                    </span>
                  )}
                  <div className="ms-auto d-flex gap-2">
                    {user && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted text-decoration-none"
                        title="Quote this comment"
                        onClick={() => handleQuote(comment)}
                      >
                        <i className="bi bi-quote me-1"></i>Quote
                      </button>
                    )}
                    {canReport && (
                      comment.user_reported ? (
                        <small className="text-muted" title="You reported this comment">
                          <i className="bi bi-flag-fill"></i>
                        </small>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-muted"
                          title="Report this comment to the moderators"
                          onClick={() => setReportTarget(comment.id)}
                        >
                          <i className="bi bi-flag"></i>
                        </button>
                      )
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-danger"
                        title="Delete comment"
                        onClick={() => setDeleteTarget(comment.id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
                {comment.quote_id != null && (
                  <QuoteBlock
                    author={comment.quote_author}
                    content={comment.quote_content}
                    onClick={comment.quote_content != null ? () => scrollToComment(comment.quote_id!) : undefined}
                  />
                )}
                <p className="mb-0 text-light" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {comment.content}
                </p>
              </div>
            </div>
          );
        })}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {notice && (
          <div className="alert alert-success py-2 small d-flex justify-content-between align-items-center">
            {notice}
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setNotice('')} />
          </div>
        )}

        {user ? (
          <form onSubmit={handleSubmit}>
            {quoted && (
              <div className="d-flex align-items-start gap-2">
                <div className="flex-grow-1">
                  <QuoteBlock author={quoted.author_name} content={quoted.content} />
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white mt-1"
                  title="Remove quote"
                  onClick={() => setQuoted(null)}
                />
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="form-control bg-secondary text-white border-secondary"
              rows={3}
              maxLength={MAX_LENGTH}
              placeholder="Share your thoughts on this build..."
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              disabled={posting}
            />
            <div className="d-flex justify-content-between align-items-center mt-2">
              <small className="text-muted">{input.length}/{MAX_LENGTH}</small>
              <button type="submit" className="btn btn-info btn-sm" disabled={posting || !input.trim()}>
                <i className="bi bi-send me-1"></i>
                {posting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-muted mb-0">
            <i className="bi bi-info-circle me-2"></i>
            <Link
              to="/login"
              className="text-decoration-none"
              onClick={() => setPostLoginRedirect(`/build/${buildId}#comments`)}
            >
              Log in
            </Link>{' '}
            to join the discussion
          </p>
        )}
      </div>

      {reportTarget !== null && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setReportTarget(null); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-body text-center py-4">
                <i className="bi bi-flag text-warning fs-3 d-block mb-2"></i>
                <p className="text-white mb-1">Report this comment?</p>
                <p className="text-muted small mb-3">A moderator will review it (spam, insults, off-topic...).</p>
                <button className="btn btn-warning btn-sm me-2" onClick={handleReport}>Report</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setReportTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-body text-center py-4">
                <i className="bi bi-exclamation-triangle text-warning fs-3 d-block mb-2"></i>
                <p className="text-white mb-3">Delete this comment?</p>
                <button className="btn btn-danger btn-sm me-2" onClick={handleDelete}>Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildComments;
