import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Build {
  id: number;
  name: string;
  description: string;
  game_version: string;
  origin: string;
  authority: string;
  ethics: string;
  civics: string;
  traits: string;
  ascension_perks: string;
  traditions: string;
  ruler_trait: string;
  tags: string;
  created_at: string;
}

export const Home: React.FC = () => {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const buildsPerPage = 12;

  useEffect(() => {
    fetch('/api/builds')
      .then(res => res.json())
      .then(data => {
        setBuilds(data.builds || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load builds');
        setLoading(false);
      });
  }, []);

  // Filter builds based on search query
  const filteredBuilds = builds.filter(build => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      build.name.toLowerCase().includes(query) ||
      build.description?.toLowerCase().includes(query) ||
      build.tags?.toLowerCase().includes(query) ||
      build.origin?.toLowerCase().includes(query) ||
      build.ethics?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const indexOfLastBuild = currentPage * buildsPerPage;
  const indexOfFirstBuild = indexOfLastBuild - buildsPerPage;
  const currentBuilds = filteredBuilds.slice(indexOfFirstBuild, indexOfLastBuild);
  const totalPages = Math.ceil(filteredBuilds.length / buildsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-md-8">
          <h1 className="text-white">Community Builds</h1>
          <p className="text-muted">Browse and discover builds created by the community</p>
        </div>
        <div className="col-md-4 text-end">
          <Link to="/create" className="btn btn-primary btn-lg">
            <i className="bi bi-plus-circle me-2"></i>
            Create New Build
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="row mb-4">
        <div className="col-12">
          <input
            type="text"
            className="form-control form-control-lg bg-secondary text-white border-secondary"
            placeholder="Search builds by name, origin, ethics, tags..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
        </div>
      </div>

      {/* Build Count */}
      <div className="row mb-3">
        <div className="col-12">
          <p className="text-muted">
            Showing {currentBuilds.length} of {filteredBuilds.length} builds
            {searchQuery && ` (filtered from ${builds.length} total)`}
          </p>
        </div>
      </div>

      {/* Builds Grid */}
      {currentBuilds.length === 0 ? (
        <div className="alert alert-info">
          {searchQuery ? 'No builds match your search.' : 'No builds available yet. Be the first to create one!'}
        </div>
      ) : (
        <>
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
            {currentBuilds.map(build => (
              <div key={build.id} className="col">
                <div className="card bg-dark border-secondary h-100">
                  <div className="card-body">
                    <h5 className="card-title text-white">
                      <Link to={`/build/${build.id}`} className="text-decoration-none text-white">
                        {build.name}
                      </Link>
                    </h5>

                    {/* Game Version Badge */}
                    <div className="mb-2">
                      <span className="badge bg-primary">{build.game_version || 'Unknown'}</span>
                    </div>

                    {/* Description */}
                    <p className="card-text text-light small">
                      {build.description
                        ? build.description.substring(0, 100) + (build.description.length > 100 ? '...' : '')
                        : 'No description provided.'}
                    </p>

                    {/* Key Features */}
                    <div className="mb-2">
                      {build.origin && (
                        <div className="mb-1">
                          <small className="text-muted">Origin:</small>
                          <small className="text-info ms-2">{build.origin}</small>
                        </div>
                      )}
                      {build.ethics && (
                        <div className="mb-1">
                          <small className="text-muted">Ethics:</small>
                          <small className="text-warning ms-2">
                            {build.ethics.split(',').slice(0, 2).join(', ')}
                            {build.ethics.split(',').length > 2 && '...'}
                          </small>
                        </div>
                      )}
                      {build.authority && (
                        <div className="mb-1">
                          <small className="text-muted">Authority:</small>
                          <small className="text-success ms-2">{build.authority}</small>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {build.tags && (
                      <div className="mt-2">
                        {build.tags.split(',').slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="badge bg-secondary me-1">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card-footer bg-dark border-secondary">
                    <small className="text-muted">
                      Created: {new Date(build.created_at).toLocaleDateString()}
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-4">
              <ul className="pagination justify-content-center">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link bg-secondary text-white border-secondary"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                  <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
                    <button
                      className={`page-link ${
                        currentPage === number
                          ? 'bg-primary border-primary'
                          : 'bg-secondary text-white border-secondary'
                      }`}
                      onClick={() => paginate(number)}
                    >
                      {number}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link bg-secondary text-white border-secondary"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}
    </div>
  );
};
