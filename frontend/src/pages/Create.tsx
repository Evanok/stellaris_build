import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuildForm } from '../BuildForm';
import { useAuth } from '../AuthContext';

export const Create: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleBuildCreated = () => {
    // Redirect to home page after successful creation
    navigate('/');
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
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
              <li className="breadcrumb-item active" aria-current="page">Create Build</li>
            </ol>
          </nav>
        </div>
      </div>

      <BuildForm onBuildCreated={handleBuildCreated} />
    </div>
  );
};
