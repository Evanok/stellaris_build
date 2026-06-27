import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../AuthContext';

const CATEGORIES = [
  'Early Game', 'Population', 'Economy', 'Science', 'Military',
  'Diplomacy', 'Optimization', 'Planet Management', 'Species & Traits',
  'Traditions & Perks', 'General'
];

const GAME_VERSIONS = [
  { value: '4.4', label: '4.4 "Pegasus"' },
  { value: '4.3', label: '4.3 "Cetus"' },
  { value: '4.2', label: '4.2 "Corvus"' },
  { value: '4.1', label: '4.1 "Lyra"' },
  { value: '4.0', label: '4.0 "Phoenix"' },
  { value: '3.14', label: '3.14 "Circinus"' },
  { value: '3.13', label: '3.13 "Vela"' },
];

const LATEST_VERSION = '4.4';
const TIP_MAX_LENGTH = 500;

interface Tip {
  id: number;
  title: string;
  content: string;
  categories: string;
  game_version: string;
  author_id: number;
  author_name: string;
  created_at: string;
  vote_count: number;
  user_voted: boolean;
}

export default function Tips() {
  const { user } = useAuth();

  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVersion, setFilterVersion] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sort, setSort] = useState<'top' | 'new'>('top');

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formVersion, setFormVersion] = useState(LATEST_VERSION);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTips = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterVersion) params.set('version', filterVersion);
    if (filterCategory) params.set('category', filterCategory);
    params.set('sort', sort);

    fetch(`/api/tips?${params}`)
      .then(r => r.json())
      .then(data => { setTips(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterVersion, filterCategory, sort]);

  useEffect(() => { fetchTips(); }, [fetchTips]);

  const handleVote = (tip: Tip) => {
    if (!user) return;
    fetch(`/api/tips/${tip.id}/vote`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setTips(prev => prev.map(t =>
          t.id === tip.id ? { ...t, vote_count: data.vote_count, user_voted: data.voted } : t
        ));
      });
  };

  const handleDelete = (tipId: number) => {
    if (!confirm('Delete this tip?')) return;
    fetch(`/api/tips/${tipId}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => { if (data.success) setTips(prev => prev.filter(t => t.id !== tipId)); });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formTitle.trim()) { setFormError('Title is required.'); return; }
    if (!formContent.trim()) { setFormError('Content is required.'); return; }
    setSubmitting(true);

    fetch('/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formTitle,
        content: formContent,
        categories: formCategories,
        game_version: formVersion,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setFormError(data.error); setSubmitting(false); return; }
        setFormTitle('');
        setFormContent('');
        setFormCategories([]);
        setFormVersion(LATEST_VERSION);
        setShowForm(false);
        setSubmitting(false);
        fetchTips();
      })
      .catch(() => { setFormError('Network error.'); setSubmitting(false); });
  };

  const toggleCategory = (cat: string) => {
    setFormCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <Helmet>
        <title>Tips & Tricks — Stellaris Build</title>
        <meta name="description" content="Community tips and tricks for Stellaris. Browse, vote, and share your knowledge." />
      </Helmet>

      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h2 className="mb-0 text-white fw-bold">Tips & Tricks</h2>
            <p className="text-muted small mb-0">Community knowledge base — vote for the most useful tips</p>
          </div>
          {user && (
            <button className="btn btn-success" onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cancel' : '+ Submit a tip'}
            </button>
          )}
          {!user && (
            <span className="text-muted small">Sign in to submit tips and vote</span>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <div className="card bg-dark border-success mb-4">
            <div className="card-body">
              <h5 className="text-white mb-3">New tip</h5>
              <form onSubmit={handleSubmit}>
                {formError && <div className="alert alert-danger py-2">{formError}</div>}

                <div className="mb-3">
                  <label className="form-label text-white">Title</label>
                  <input
                    type="text"
                    className="form-control bg-secondary text-white border-secondary"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    maxLength={120}
                    placeholder="Short, descriptive title"
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-white d-flex justify-content-between">
                    <span>Tip</span>
                    <span className={`small ${formContent.length > TIP_MAX_LENGTH * 0.9 ? 'text-warning' : 'text-muted'}`}>
                      {formContent.length}/{TIP_MAX_LENGTH}
                    </span>
                  </label>
                  <textarea
                    className="form-control bg-secondary text-white border-secondary"
                    rows={4}
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    maxLength={TIP_MAX_LENGTH}
                    placeholder="Share your knowledge in 2-3 sentences..."
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-white">Categories</label>
                  <div className="d-flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`btn btn-sm ${formCategories.includes(cat) ? 'btn-success' : 'btn-outline-secondary'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label text-white">Game Version</label>
                  <select
                    className="form-select bg-secondary text-white border-secondary"
                    value={formVersion}
                    onChange={e => setFormVersion(e.target.value)}
                    style={{ width: 'auto' }}
                  >
                    {GAME_VERSIONS.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit tip'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
          <select
            className="form-select form-select-sm bg-dark text-white border-secondary"
            style={{ width: 'auto' }}
            value={filterVersion}
            onChange={e => setFilterVersion(e.target.value)}
            aria-label="Filter by version"
          >
            <option value="">All versions</option>
            {GAME_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>

          <select
            className="form-select form-select-sm bg-dark text-white border-secondary"
            style={{ width: 'auto' }}
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="btn-group btn-group-sm ms-auto">
            <button
              className={`btn ${sort === 'top' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSort('top')}
            >
              Top
            </button>
            <button
              className={`btn ${sort === 'new' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSort('new')}
            >
              New
            </button>
          </div>
        </div>

        {/* Tips list */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : tips.length === 0 ? (
          <div className="text-center py-5 text-muted">
            No tips yet.{user ? ' Be the first to submit one!' : ' Sign in to submit one.'}
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {tips.map(tip => (
              <div key={tip.id} className="card bg-dark border-secondary">
                <div className="card-body">
                  <div className="d-flex gap-3">
                    {/* Vote column */}
                    <div className="d-flex flex-column align-items-center" style={{ minWidth: '48px' }}>
                      <button
                        className={`btn btn-sm px-2 py-1 ${tip.user_voted ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => handleVote(tip)}
                        disabled={!user}
                        title={user ? (tip.user_voted ? 'Remove vote' : 'Upvote') : 'Sign in to vote'}
                        style={{ fontSize: '1rem', lineHeight: 1 }}
                      >
                        ▲
                      </button>
                      <span className="fw-bold text-white mt-1" style={{ fontSize: '0.95rem' }}>{tip.vote_count}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-1 mb-1">
                        <h6 className="text-white fw-bold mb-0">{tip.title}</h6>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-primary">{tip.game_version}</span>
                          {(user?.id === tip.author_id || user?.is_admin) && (
                            <button
                              className="btn btn-sm btn-outline-danger py-0 px-1"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => handleDelete(tip.id)}
                              title="Delete tip"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-light mb-2" style={{ whiteSpace: 'pre-wrap' }}>{tip.content}</p>

                      <div className="d-flex flex-wrap gap-1 align-items-center">
                        {tip.categories && tip.categories.split(',').map(cat => (
                          <span key={cat} className="badge bg-secondary">{cat}</span>
                        ))}
                        <span className="text-muted small ms-auto">
                          {tip.author_name} · {formatDate(tip.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
