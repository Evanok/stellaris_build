import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { DisplayNameModal } from './DisplayNameModal';

export const Navbar: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <img src="/icon.svg" alt="" width="32" height="32" />
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
              <Link className="nav-link" to="/resources">
                Resources
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
                      <span className="navbar-text text-light me-2">
                        {user.avatar && (
                          <img
                            src={user.avatar}
                            alt={user.display_name || user.username}
                            className="rounded-circle me-2"
                            style={{ width: '32px', height: '32px' }}
                          />
                        )}
                        {user.display_name || user.username}
                      </span>
                      {user.provider !== 'local' && (
                        <button
                          className="btn btn-sm btn-link text-info p-0 me-3"
                          onClick={() => setShowDisplayNameModal(true)}
                          title="Change display name"
                          style={{ textDecoration: 'none', fontSize: '0.85rem' }}
                        >
                          <i className="bi bi-pencil-square"></i> Edit
                        </button>
                      )}
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

      {/* Display Name Modal */}
      <DisplayNameModal
        show={showDisplayNameModal}
        onClose={() => setShowDisplayNameModal(false)}
      />
    </nav>
  );
};
