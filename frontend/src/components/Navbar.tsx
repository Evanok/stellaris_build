import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export const Navbar: React.FC = () => {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          <strong>Stellaris Build Sharing</strong>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/">
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/stats">
                Stats
              </Link>
            </li>
            {user && (
              <li className="nav-item">
                <Link className="nav-link" to="/create">
                  Create Build
                </Link>
              </li>
            )}
            {!loading && (
              <>
                {user ? (
                  <>
                    <li className="nav-item d-flex align-items-center">
                      <span className="navbar-text text-light me-3">
                        {user.avatar && (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="rounded-circle me-2"
                            style={{ width: '32px', height: '32px' }}
                          />
                        )}
                        {user.username}
                      </span>
                    </li>
                    <li className="nav-item">
                      <button
                        className="nav-link btn btn-link text-danger"
                        onClick={logout}
                      >
                        Logout
                      </button>
                    </li>
                  </>
                ) : (
                  <li className="nav-item">
                    <Link className="nav-link btn btn-link text-light" to="/login">
                      Sign In
                    </Link>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};
