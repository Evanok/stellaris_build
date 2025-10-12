import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

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
  dlcs: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export const BuildDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [build, setBuild] = useState<Build | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/builds`)
      .then(res => res.json())
      .then(data => {
        const foundBuild = data.builds.find((b: Build) => b.id === parseInt(id));
        if (foundBuild) {
          setBuild(foundBuild);
        } else {
          setError('Build not found');
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load build');
        setLoading(false);
      });
  }, [id]);

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

  if (error || !build) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">{error || 'Build not found'}</div>
        <Link to="/" className="btn btn-secondary">Back to Home</Link>
      </div>
    );
  }

  const parseList = (str: string | null | undefined): string[] => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(s => s);
  };

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/" className="text-decoration-none">Home</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">{build.name}</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Build Title */}
      <div className="card bg-dark border-secondary mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-8">
              <h1 className="text-white mb-3">{build.name}</h1>
              {build.description && (
                <p className="text-light">{build.description}</p>
              )}
            </div>
            <div className="col-md-4 text-end">
              <div className="mb-2">
                <span className="badge bg-primary fs-6">{build.game_version}</span>
              </div>
              <div className="text-muted">
                <small>Created: {new Date(build.created_at).toLocaleString()}</small>
              </div>
              {build.updated_at !== build.created_at && (
                <div className="text-muted">
                  <small>Updated: {new Date(build.updated_at).toLocaleString()}</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Left Column */}
        <div className="col-md-6">
          {/* Species Traits */}
          {build.traits && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Species Traits</h5>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {parseList(build.traits).map((trait, idx) => (
                    <span key={idx} className="badge bg-primary">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Origin */}
          {build.origin && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Origin</h5>
              </div>
              <div className="card-body">
                <h6 className="text-info">{build.origin}</h6>
              </div>
            </div>
          )}

          {/* Ruler Trait */}
          {build.ruler_trait && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Starting Ruler Trait</h5>
              </div>
              <div className="card-body">
                <h6 className="text-warning">{build.ruler_trait}</h6>
              </div>
            </div>
          )}

          {/* Ethics */}
          {build.ethics && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Ethics</h5>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {parseList(build.ethics).map((ethic, idx) => (
                    <span key={idx} className="badge bg-warning text-dark">
                      {ethic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Authority */}
          {build.authority && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Authority</h5>
              </div>
              <div className="card-body">
                <h6 className="text-success">{build.authority}</h6>
              </div>
            </div>
          )}

          {/* Civics */}
          {build.civics && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Civics</h5>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {parseList(build.civics).map((civic, idx) => (
                    <span key={idx} className="badge bg-info">
                      {civic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="col-md-6">
          {/* Ascension Perks */}
          {build.ascension_perks && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Recommended Ascension Perks</h5>
              </div>
              <div className="card-body">
                <ol className="list-group list-group-numbered">
                  {parseList(build.ascension_perks).map((perk, idx) => (
                    <li key={idx} className="list-group-item bg-dark text-light border-secondary">
                      {perk}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Traditions */}
          {build.traditions && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Recommended Tradition Trees</h5>
              </div>
              <div className="card-body">
                <ol className="list-group list-group-numbered">
                  {parseList(build.traditions).map((tradition, idx) => (
                    <li key={idx} className="list-group-item bg-dark text-light border-secondary">
                      {tradition}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* DLCs */}
          {build.dlcs && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Required DLCs</h5>
              </div>
              <div className="card-body">
                <p className="text-light">{build.dlcs}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {build.tags && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h5 className="mb-0 text-white">Tags</h5>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {parseList(build.tags).map((tag, idx) => (
                    <span key={idx} className="badge bg-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="row mb-4">
        <div className="col-12">
          <Link to="/" className="btn btn-secondary">
            <i className="bi bi-arrow-left me-2"></i>
            Back to Builds
          </Link>
        </div>
      </div>
    </div>
  );
};
