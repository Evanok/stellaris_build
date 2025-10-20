import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

interface Feedback {
  id: number;
  type: 'bug' | 'feedback' | 'suggestion';
  description: string;
  screenshot_path: string | null;
  page_url: string;
  user_agent: string;
  user_id: number | null;
  username: string | null;
  email: string | null;
  avatar: string | null;
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
}

const AdminFeedback: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredStatus, setFilteredStatus] = useState<string>('all');
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchFeedback();
  }, [filteredStatus]);

  const fetchFeedback = async () => {
    try {
      setLoadingFeedback(true);
      const url = filteredStatus === 'all'
        ? '/api/admin/feedback'
        : `/api/admin/feedback?status=${filteredStatus}`;

      const response = await fetch(url);

      if (response.status === 403) {
        setError('Access Denied. Admin privileges required.');
        setLoadingFeedback(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data = await response.json();
      setFeedbacks(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const updateStatus = async (id: number, newStatus: 'new' | 'in_progress' | 'resolved') => {
    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Refresh feedback list
      fetchFeedback();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <i className="bi bi-bug text-danger"></i>;
      case 'feedback':
        return <i className="bi bi-chat-left-text text-primary"></i>;
      case 'suggestion':
        return <i className="bi bi-lightbulb text-success"></i>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="badge bg-primary">New</span>;
      case 'in_progress':
        return <span className="badge bg-warning text-dark">In Progress</span>;
      case 'resolved':
        return <span className="badge bg-success">Resolved</span>;
      default:
        return null;
    }
  };

  if (loading || loadingFeedback) {
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
    <div className="container mt-4">
      <div className="row mb-4">
        <div className="col">
          <h2>
            <i className="bi bi-chat-dots me-2"></i>
            Feedback Management
          </h2>
        </div>
      </div>

      {/* Filter Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${filteredStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilteredStatus('all')}
          >
            All
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${filteredStatus === 'new' ? 'active' : ''}`}
            onClick={() => setFilteredStatus('new')}
          >
            New
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${filteredStatus === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilteredStatus('in_progress')}
          >
            In Progress
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${filteredStatus === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilteredStatus('resolved')}
          >
            Resolved
          </button>
        </li>
      </ul>

      {/* Feedback List */}
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
                      <a href={`/${feedback.screenshot_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary">
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
                        <strong>User:</strong> {feedback.username} ({feedback.email})
                      </div>
                    )}
                  </div>

                  {/* Status Change Buttons */}
                  <div className="mt-3">
                    <label className="me-2">Change Status:</label>
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;
