import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BuildForm } from '../BuildForm';

export const Create: React.FC = () => {
  const navigate = useNavigate();

  const handleBuildCreated = () => {
    // Redirect to home page after successful creation
    navigate('/');
  };

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
