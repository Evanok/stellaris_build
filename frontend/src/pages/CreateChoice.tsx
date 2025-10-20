import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const CreateChoice: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

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
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <h1 className="text-center mb-4">Create a New Build</h1>
          <p className="text-center text-muted mb-5">
            Choose how you want to create your Stellaris empire build
          </p>

          <div className="row g-4">
            {/* Manual Build */}
            <div className="col-md-4">
              <div
                className="card bg-dark border-secondary h-100 cursor-pointer hover-card"
                onClick={() => navigate('/create/manual')}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div className="card-body text-center p-4">
                  <div className="mb-3">
                    <i className="bi bi-pencil-square" style={{ fontSize: '4rem', color: '#0d6efd' }}></i>
                  </div>
                  <h3 className="card-title">Manual Build</h3>
                  <p className="card-text text-muted">
                    Create your build from scratch using the comprehensive build form.
                    Perfect for theory-crafting and custom builds.
                  </p>
                  <div className="mt-3">
                    <span className="badge bg-primary">Most Flexible</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Import from Save Game */}
            <div className="col-md-4">
              <div
                className="card bg-dark border-secondary h-100 cursor-pointer hover-card"
                onClick={() => navigate('/create/import-save')}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div className="card-body text-center p-4">
                  <div className="mb-3">
                    <i className="bi bi-file-earmark-arrow-up" style={{ fontSize: '4rem', color: '#198754' }}></i>
                  </div>
                  <h3 className="card-title">Import from Save Game</h3>
                  <p className="card-text text-muted">
                    Upload a .sav file from your current game and automatically extract
                    your empire's build.
                  </p>
                  <div className="mt-3">
                    <span className="badge bg-success">Fastest</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Import from Empire Designs */}
            <div className="col-md-4">
              <div
                className="card bg-dark border-secondary h-100 cursor-pointer hover-card"
                onClick={() => navigate('/create/import-designs')}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div className="card-body text-center p-4">
                  <div className="mb-3">
                    <i className="bi bi-collection" style={{ fontSize: '4rem', color: '#ffc107' }}></i>
                  </div>
                  <h3 className="card-title">Import from Empire Designs</h3>
                  <p className="card-text text-muted">
                    Upload your user_empire_designs file and choose from all your
                    saved custom empires.
                  </p>
                  <div className="mt-3">
                    <span className="badge bg-warning text-dark">Convenient</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-5">
            <p className="text-muted">
              <i className="bi bi-info-circle me-2"></i>
              All import methods will pre-fill the build form for you to review before submitting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChoice;
