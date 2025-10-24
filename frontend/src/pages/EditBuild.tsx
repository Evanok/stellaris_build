import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BuildForm } from '../BuildForm';
import { useAuth } from '../AuthContext';

const EditBuild: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [buildData, setBuildData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No build ID provided');
      setLoading(false);
      return;
    }

    // Fetch the build data
    fetch(`/api/builds/${id}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Build not found');
        }
        return res.json();
      })
      .then(data => {
        // Check if user is the owner
        if (!user || data.build.author_id !== user.id) {
          setError('You can only edit your own builds');
          setLoading(false);
          return;
        }

        setBuildData(data.build);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load build');
        setLoading(false);
      });
  }, [id, user]);

  const handleBuildUpdated = () => {
    // Redirect to build detail page after successful update
    navigate(`/build/${id}`);
  };

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
        <button onClick={() => navigate('/')} className="btn btn-secondary">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row mb-3">
        <div className="col-12">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="/" className="text-decoration-none">Home</a>
              </li>
              <li className="breadcrumb-item">
                <a href={`/build/${id}`} className="text-decoration-none">Build Detail</a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">Edit</li>
            </ol>
          </nav>
        </div>
      </div>

      <BuildForm
        initialData={buildData}
        buildId={id}
        onBuildCreated={handleBuildUpdated}
      />
    </div>
  );
};

export default EditBuild;
