import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';

interface FeedbackModalProps {
  show: boolean;
  onHide: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ show, onHide }) => {
  const location = useLocation();
  const [type, setType] = useState<'bug' | 'feedback' | 'suggestion'>('feedback');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      setError('Please provide a description');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('description', description);
      formData.append('pageUrl', window.location.href);

      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setDescription('');
      setScreenshot(null);

      // Auto-close after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onHide();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    setScreenshot(null);
    setError(null);
    setSuccess(false);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton className="bg-dark text-white border-secondary">
        <Modal.Title>
          <i className="bi bi-chat-dots me-2"></i>
          Send Feedback
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark text-white">
        {success ? (
          <div className="alert alert-success">
            <i className="bi bi-check-circle me-2"></i>
            Thank you for your feedback!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Type Selection */}
            <div className="mb-3">
              <label className="form-label">Type</label>
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn ${type === 'bug' ? 'btn-danger' : 'btn-outline-danger'}`}
                  onClick={() => setType('bug')}
                >
                  <i className="bi bi-bug me-1"></i>
                  Bug Report
                </button>
                <button
                  type="button"
                  className={`btn ${type === 'feedback' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setType('feedback')}
                >
                  <i className="bi bi-chat-left-text me-1"></i>
                  Feedback
                </button>
                <button
                  type="button"
                  className={`btn ${type === 'suggestion' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => setType('suggestion')}
                >
                  <i className="bi bi-lightbulb me-1"></i>
                  Suggestion
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="mb-3">
              <label htmlFor="description" className="form-label">
                Description *
              </label>
              <textarea
                id="description"
                className="form-control bg-secondary text-white border-secondary"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'Describe the bug and steps to reproduce it...'
                    : type === 'suggestion'
                    ? 'Describe your suggestion...'
                    : 'Share your feedback...'
                }
                required
              />
            </div>

            {/* Screenshot Upload */}
            <div className="mb-3">
              <label htmlFor="screenshot" className="form-label">
                Screenshot (optional)
              </label>
              <input
                id="screenshot"
                type="file"
                className="form-control bg-secondary text-white border-secondary"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              />
              <small className="text-muted d-block mt-1">
                Max 5MB. Accepted formats: JPG, PNG, GIF
              </small>
            </div>

            {/* Current Page Info */}
            <div className="mb-3">
              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                Current page: {location.pathname}
              </small>
            </div>

            {/* Error Message */}
            {error && (
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-1"></i>
                    Submit
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal.Body>
    </Modal>
  );
};
