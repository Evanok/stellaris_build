import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { DisplayNameModal } from './DisplayNameModal';

export const Navbar: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  const isAdmin = user?.is_admin === 1;

  // Admins only: how many builds submitted without an account wait for review.
  // Refreshed on navigation so it drops after reviewing.
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/pending-builds-count')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setPendingCount(data?.count || 0))
      .catch(() => setPendingCount(0));
  }, [isAdmin, location.pathname]);

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
            <li className="nav-item">
              <Link className="nav-link" to="/feedback">
                Feedback
              </Link>
            </li>
            {/* Shown to everyone: /create explains the options and asks for a login only when needed */}
            <li className="nav-item">
              <Link className="nav-link" to="/create">
                Create Build
              </Link>
            </li>
            {isAdmin && (
              <li className="nav-item">
                <Link className="nav-link" to="/admin/pending">
                  Moderation
                  {pendingCount > 0 && <span className="badge bg-warning text-dark ms-1">{pendingCount}</span>}
                </Link>
              </li>
            )}
            {isAdmin && (
              <li className="nav-item">
                <Link className="nav-link" to="/admin/stats">
                  Admin Stats
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
