import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';

// Latest comments across every build (GET /api/comments/recent), shown on the
// Feedback page so people can follow discussions without opening each build.
// A click opens the build on that comment (BuildComments scrolls to #comment-<id>).

interface RecentComment {
  id: number;
  build_id: number;
  build_name: string;
  created_at: string;
  excerpt: string;
  truncated: number;
  author_name: string;
  avatar: string | null;
}

const POLL_INTERVAL_MS = 60000;

// SQLite CURRENT_TIMESTAMP is UTC without a zone marker ("2026-10-31 12:21:08")
const parseDbDate = (value: string) => new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');

const timeAgo = (value: string) => {
  const seconds = Math.max(0, (Date.now() - parseDbDate(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return parseDbDate(value).toLocaleDateString([], { dateStyle: 'medium' });
};

const RecentComments: React.FC = () => {
  const [comments, setComments] = useState<RecentComment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/comments/recent?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        setComments(await res.json());
      } catch {
        // network error: keep what is shown, retry on the next poll
      } finally {
        setLoaded(true);
      }
    };
    fetchComments();
    const id = setInterval(fetchComments, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card bg-dark border-secondary mt-3">
      <div className="card-header border-secondary py-2">
        <span className="fw-bold text-white">
          <i className="bi bi-chat-square-quote me-2 text-info"></i>Latest Build Comments
        </span>
      </div>
      <div className="p-2">
        {!loaded ? (
          <p className="text-muted text-center my-3 small">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-muted text-center my-3 small">
            No comments on builds yet. Discussions will show up here.
          </p>
        ) : (
          comments.map(comment => (
            <Link
              key={comment.id}
              to={`/build/${comment.build_id}#comment-${comment.id}`}
              className="recent-comment d-flex align-items-start gap-2 p-2 rounded text-decoration-none"
              onClick={() => trackEvent('recent_comment_click', { build_id: comment.build_id })}
            >
              {comment.avatar ? (
                <img
                  src={comment.avatar}
                  alt=""
                  style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}
                />
              ) : (
                <div
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                    background: '#0dcaf0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 'bold', color: '#000'
                  }}
                >
                  {comment.author_name[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-baseline gap-1 flex-wrap" style={{ fontSize: '0.8rem' }}>
                  <span className="fw-semibold text-info">{comment.author_name}</span>
                  <span className="text-muted">on</span>
                  <span className="fw-semibold text-light text-truncate" style={{ maxWidth: '100%' }}>
                    {comment.build_name}
                  </span>
                  <span className="text-muted ms-auto" style={{ fontSize: '0.7rem' }}>{timeAgo(comment.created_at)}</span>
                </div>
                <p
                  className="mb-0 text-light"
                  style={{
                    fontSize: '0.85rem', wordBreak: 'break-word',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}
                >
                  {comment.excerpt}{comment.truncated ? '…' : ''}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentComments;
