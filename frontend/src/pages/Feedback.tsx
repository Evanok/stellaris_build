import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../AuthContext';
import ChatPanel from '../components/ChatPanel';

interface FeedbackItem {
  id: number;
  type: 'bug' | 'feedback' | 'suggestion';
  description: string;
  screenshot_path: string | null;
  page_url: string;
  username: string | null;
  avatar: string | null;
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
}

const Feedback: React.FC = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [filteredStatus, setFilteredStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.is_admin === 1;

  useEffect(() => {
    fetchFeedback();
  }, [filteredStatus]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const url = filteredStatus === 'all'
        ? '/api/feedback'
        : `/api/feedback?status=${filteredStatus}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data = await response.json();
      setFeedbacks(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: 'new' | 'in_progress' | 'resolved') => {
    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      fetchFeedback();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <i className="bi bi-bug text-danger"></i>;
      case 'feedback': return <i className="bi bi-chat-left-text text-primary"></i>;
      case 'suggestion': return <i className="bi bi-lightbulb text-warning"></i>;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <span className="badge bg-primary">New</span>;
      case 'in_progress': return <span className="badge bg-warning text-dark">In Progress</span>;
      case 'resolved': return <span className="badge bg-success">Resolved</span>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Feedback & Bug Reports - Stellaris Build Sharing</title>
        <meta name="description" content="Community feedback, bug reports, and suggestions for Stellaris Build Sharing." />
      </Helmet>

      <div className="container mt-4">
        {/* Header — full width above both columns */}
        <div className="mb-3">
          <h2>
            <i className="bi bi-chat-dots me-2"></i>
            Feedback & Bug Reports
          </h2>
          <p className="text-muted mb-0">
            Community-reported bugs and suggestions. Use the feedback button at the bottom of any page to submit your own.
          </p>
        </div>

        {/* Tabs — full width */}
        <ul className="nav nav-tabs mb-4">
          {['all', 'new', 'in_progress', 'resolved'].map((s) => (
            <li className="nav-item" key={s}>
              <button
                className={`nav-link ${filteredStatus === s ? 'active' : ''}`}
                onClick={() => setFilteredStatus(s)}
              >
                {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            </li>
          ))}
        </ul>

        <div className="row">
          {/* Main feedback list */}
          <div className="col-lg-8">
            {feedbacks.length === 0 ? (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                No feedback found.
              </div>
            ) : (
              <div className="row">
                {feedbacks.map((feedback) => (
                  <div key={feedback.id} className="col-12 mb-3">
                    <div className="card bg-dark border-secondary">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <div>
                          {getTypeIcon(feedback.type)}
                          <span className="ms-2 text-capitalize">{feedback.type}</span>
                          <span className="ms-3 text-muted small">
                            {new Date(feedback.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          {getStatusBadge(feedback.status)}
                        </div>
                      </div>
                      <div className="card-body">
                        <p className="card-text">{feedback.description}</p>

                        {feedback.screenshot_path && (
                          <div className="mb-3">
                            <a
                              href={`/${feedback.screenshot_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-secondary"
                            >
                              <i className="bi bi-image me-1"></i>
                              View Screenshot
                            </a>
                          </div>
                        )}

                        <div className="row text-muted small">
                          <div className="col-md-6">
                            <strong>Page:</strong> {feedback.page_url}
                          </div>
                          {feedback.username && (
                            <div className="col-md-6">
                              <strong>Submitted by:</strong> {feedback.username}
                            </div>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="mt-3">
                            <label className="me-2 text-muted small">Change Status:</label>
                            <div className="btn-group" role="group">
                              <button
                                type="button"
                                className={`btn btn-sm ${feedback.status === 'new' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => updateStatus(feedback.id, 'new')}
                                disabled={feedback.status === 'new'}
                              >
                                New
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm ${feedback.status === 'in_progress' ? 'btn-warning' : 'btn-outline-warning'}`}
                                onClick={() => updateStatus(feedback.id, 'in_progress')}
                                disabled={feedback.status === 'in_progress'}
                              >
                                In Progress
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm ${feedback.status === 'resolved' ? 'btn-success' : 'btn-outline-success'}`}
                                onClick={() => updateStatus(feedback.id, 'resolved')}
                                disabled={feedback.status === 'resolved'}
                              >
                                Resolved
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat sidebar */}
          <div className="col-lg-4 mt-4 mt-lg-0">
            <div style={{ position: 'sticky', top: '1rem' }}>
              <ChatPanel />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Feedback;
