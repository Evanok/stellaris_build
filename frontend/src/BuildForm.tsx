import React, { useState } from 'react';

interface BuildFormProps {
  onBuildCreated: (newBuild: any) => void;
}

export const BuildForm: React.FC<BuildFormProps> = ({ onBuildCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/builds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        throw new Error('Failed to create build.');
      }

      const data = await response.json();
      onBuildCreated(data.build);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card bg-dark border-secondary mb-4">
      <div className="card-body">
        <h3 className="card-title">Create a New Build</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="mb-3">
            <label htmlFor="buildName" className="form-label">Build Name</label>
            <input
              type="text"
              className="form-control bg-dark text-white border-secondary"
              id="buildName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="buildDescription" className="form-label">Description</label>
            <textarea
              className="form-control bg-dark text-white border-secondary"
              id="buildDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Build'}
          </button>
        </form>
      </div>
    </div>
  );
};
