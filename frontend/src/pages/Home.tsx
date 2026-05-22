import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Helmet } from 'react-helmet-async';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import RatingStars from '../components/RatingStars';
import { WhatsNewBanner, NewsItem } from '../components/WhatsNewBanner';
import './Home.css';

const VERSION_NAMES: Record<string, string> = {
  '4.3': '4.3 (Cetus)',
  '4.2': '4.2 (Corvus)',
  '4.1': '4.1 (Lyra)',
  '4.1+ (Shadows of the Shroud DLC)': '4.1 (Lyra)',
  '4.14': '4.1 (Lyra)',
  '4.0': '4.0 (Phoenix)',
  '4.0+': '4.0 (Phoenix)',
  '3.14': '3.14 (Circinus)',
  '3.13': '3.13 (Vela)',
};

// Helper function to get difficulty badge styling
const getDifficultyBadge = (difficulty: string | undefined) => {
  if (!difficulty) return null;

  const difficultyConfig: Record<string, { label: string; className: string }> = {
    'overpowered': { label: 'Overpowered', className: 'bg-danger' },
    'strong': { label: 'Strong', className: 'bg-warning text-dark' },
    'balanced': { label: 'Balanced', className: 'bg-success' },
    'challenging': { label: 'Challenging', className: 'bg-info text-dark' },
    'extreme': { label: 'Extreme Challenge', className: 'bg-secondary' }
  };

  const config = difficultyConfig[difficulty];
  if (!config) return null;

  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
};

interface Build {
  id: number;
  name: string;
  description: string;
  game_version: string;
  difficulty?: string;
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
  author_username?: string;
  author_avatar?: string;
  average_rating?: number;
  rating_count?: number;
}

export const Home: React.FC = () => {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [versionFilter, setVersionFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const buildsPerPage = 12;

  // What's New data
  const latestNews: NewsItem[] = [
    {
      date: '20 Mar 2026',
      title: 'Stellaris 4.3 "Cetus" Support',
      description: 'Build data updated for game version 4.3 "Cetus". Builds now load the correct game data for their version, preserving older builds accuracy.',
      type: 'update'
    },
    {
      date: '19 May 2026',
      title: 'Mobile Navigation Fix',
      description: 'Fixed the hamburger menu not working on mobile devices.',
      type: 'fix'
    }
  ];

  useEffect(() => {
    fetch('/api/builds')
      .then(res => res.json())
      .then(data => {
        setBuilds(data.builds || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load builds');
        setLoading(false);
      });
  }, []);

  // Filter and sort builds
  const filteredBuilds = builds
    .filter(build => {
      // Search filter
      const matchesSearch = !searchQuery || (() => {
        const query = searchQuery.toLowerCase();
        return (
          build.name.toLowerCase().includes(query) ||
          build.description?.toLowerCase().includes(query) ||
          build.tags?.toLowerCase().includes(query) ||
          build.origin?.toLowerCase().includes(query) ||
          build.ethics?.toLowerCase().includes(query)
        );
      })();

      // Difficulty filter
      const matchesDifficulty = !difficultyFilter || build.difficulty === difficultyFilter;

      // Version filter — compare normalized labels so "4.1", "4.14", "4.1+ (...)" all match "4.1 (Lyra)"
      const matchesVersion = !versionFilter ||
        (VERSION_NAMES[build.game_version] ?? build.game_version) === (VERSION_NAMES[versionFilter] ?? versionFilter);

      return matchesSearch && matchesDifficulty && matchesVersion;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          // Sort by average rating (descending), then by rating count
          const ratingDiff = (b.average_rating || 0) - (a.average_rating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          return (b.rating_count || 0) - (a.rating_count || 0);
        case 'oldest':
          // Sort by creation date (ascending)
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'newest':
        default:
          // Sort by creation date (descending)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
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
    <>
      <Helmet>
        <title>Stellaris Build Sharing - Discover Community Empire Builds</title>
        <meta name="description" content="Browse community-created Stellaris empire builds. Find optimized species traits, civics, ethics, origins, and strategies. Share your own builds with the community." />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Stellaris Community Empire Builds",
          "description": "Community-created empire builds for Stellaris by Paradox Interactive, including species traits, civics, ethics, origins, ascension perks, and tradition trees.",
          "url": "https://stellaris-build.com/",
          "numberOfItems": builds.length,
          "itemListElement": builds.slice(0, 20).map((build, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "url": `https://stellaris-build.com/builds/${build.id}`,
            "name": build.name,
            "description": build.description || `Stellaris empire build - ${build.game_version}`
          }))
        })}</script>
      </Helmet>

      <div className="container-fluid p-0">
        {/* Hero Banner */}
      <div
        className="position-relative mb-4"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '2rem 0',
          borderBottom: '3px solid #e94560'
        }}
      >
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1 className="display-5 fw-bold text-white mb-2">
                Stellaris Build Archive
              </h1>
              <p className="text-light mb-0">
                Discover, share, and master powerful empire builds from the community
              </p>
            </div>
            <div className="col-md-4 text-end">
              <div className="d-inline-block p-2 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                <h4 className="text-white mb-1">{builds.length}</h4>
                <p className="text-light mb-0 small">Community Builds</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-4">
        {/* Resources CTA and What's New - Side by Side */}
        <div className="row mb-4">
          {/* Resources Call-to-Action */}
          <div className="col-lg-6 mb-3 mb-lg-0">
            <div
              className="border-0 shadow-sm h-100"
              style={{
                background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                borderRadius: '0.375rem',
                padding: '0.75rem 1rem'
              }}
            >
              {/* Header */}
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center">
                  <span className="fs-5 me-2">📚</span>
                  <h6 className="mb-0 text-white fw-bold">Curated Resources</h6>
                </div>
                <Link to="/resources" className="text-decoration-none">
                  <span className="badge bg-light text-primary">Explore all →</span>
                </Link>
              </div>
              {/* Featured guides */}
              <div className="d-flex flex-column gap-1">
                {[
                  {
                    title: 'The COMPLETE Economy Guide for Stellaris 4.3',
                    url: 'https://youtu.be/FSAfATg-8Uk?si=R9M_HtozIPrNSLds'
                  },
                  {
                    title: 'How To Start Every Game Of Stellaris 4.3 - Every Single Click',
                    url: 'https://youtu.be/omVc01TjWdE?si=O0YaXjg0XJe-_rqr'
                  }
                ].map((guide, i) => (
                  <a
                    key={i}
                    href={guide.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-decoration-none"
                  >
                    <div
                      className="d-flex align-items-center gap-2 px-2 py-1 rounded"
                      style={{ background: 'rgba(0,0,0,0.2)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
                    >
                      <span style={{ fontSize: '0.85rem' }}>▶</span>
                      <small className="text-white fw-semibold text-truncate">{guide.title}</small>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* What's New Section */}
          <div className="col-lg-6">
            <WhatsNewBanner news={latestNews} />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="row mb-4">
          <div className="col-md-6 mb-3 mb-md-0">
            <input
              type="text"
              className="form-control form-control-lg bg-secondary text-white border-secondary"
              placeholder="Search builds by name, origin, ethics, tags..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="col-md-2 mb-3 mb-md-0">
            <select
              className="form-select form-select-lg bg-secondary text-white border-secondary"
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Difficulties</option>
              <option value="overpowered">Overpowered</option>
              <option value="strong">Strong</option>
              <option value="balanced">Balanced</option>
              <option value="challenging">Challenging</option>
              <option value="extreme">Extreme Challenge</option>
            </select>
          </div>
          <div className="col-md-2 mb-3 mb-md-0">
            <select
              className="form-select form-select-lg bg-secondary text-white border-secondary"
              value={versionFilter}
              onChange={(e) => {
                setVersionFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Versions</option>
              {(() => {
                const seen = new Set<string>();
                const parseVer = (v: string) => { const label = VERSION_NAMES[v] ?? v; const m = label.match(/(\d+)\.(\d+)/); return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 0; };
                return Array.from(new Set(builds.map(b => b.game_version).filter(v => v && v !== 'other')))
                  .sort((a, b) => parseVer(b) - parseVer(a))
                  .filter(v => {
                    const label = VERSION_NAMES[v] ?? v;
                    if (seen.has(label)) return false;
                    seen.add(label);
                    return true;
                  })
                  .map(v => (
                    <option key={v} value={v}>{VERSION_NAMES[v] ?? v}</option>
                  ));
              })()}
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select form-select-lg bg-secondary text-white border-secondary"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Build Count */}
        <div className="row mb-3">
          <div className="col-12">
            <p className="text-muted">
              Showing {currentBuilds.length} of {filteredBuilds.length} builds
              {(searchQuery || difficultyFilter || versionFilter) && ` (filtered from ${builds.length} total)`}
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
                  <Link to={`/build/${build.id}`} className="build-card-link">
                    <div className="card bg-dark border-secondary h-100 build-card">
                      <div className="card-body">
                        {/* Icon Gallery Header */}
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div className="d-flex gap-2">
                            {/* Origin Icon */}
                            {build.origin && (
                              <div
                                className="d-flex align-items-center justify-content-center rounded"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  border: '2px solid rgba(255, 255, 255, 0.2)'
                                }}
                              >
                                <img
                                  src={`/icons/origin_mini/${build.origin}.png`}
                                  alt=""
                                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.opacity = '0';
                                    const container = img.parentElement as HTMLElement;
                                    if (container) {
                                      container.style.visibility = 'hidden';
                                      container.style.width = '0';
                                      container.style.minWidth = '0';
                                      container.style.padding = '0';
                                      container.style.margin = '0';
                                      container.style.border = 'none';
                                    }
                                  }}
                                />
                              </div>
                            )}
                            {/* First Ethic Icon */}
                            {build.ethics && build.ethics.split(',')[0] && (
                              <div
                                className="d-flex align-items-center justify-content-center rounded"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  background: 'rgba(255, 193, 7, 0.1)',
                                  border: '2px solid rgba(255, 193, 7, 0.3)'
                                }}
                              >
                                <img
                                  src={`/icons/ethics/${build.ethics.split(',')[0].trim()}.png`}
                                  alt=""
                                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.opacity = '0';
                                    const container = img.parentElement as HTMLElement;
                                    if (container) {
                                      container.style.visibility = 'hidden';
                                      container.style.width = '0';
                                      container.style.minWidth = '0';
                                      container.style.padding = '0';
                                      container.style.margin = '0';
                                      container.style.border = 'none';
                                    }
                                  }}
                                />
                              </div>
                            )}
                            {/* Authority Icon */}
                            {build.authority && (
                              <div
                                className="d-flex align-items-center justify-content-center rounded"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  background: 'rgba(40, 167, 69, 0.1)',
                                  border: '2px solid rgba(40, 167, 69, 0.3)'
                                }}
                              >
                                <img
                                  src={`/icons/authorities/${build.authority}.png`}
                                  alt=""
                                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.opacity = '0';
                                    const container = img.parentElement as HTMLElement;
                                    if (container) {
                                      container.style.visibility = 'hidden';
                                      container.style.width = '0';
                                      container.style.minWidth = '0';
                                      container.style.padding = '0';
                                      container.style.margin = '0';
                                      container.style.border = 'none';
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="badge bg-primary me-1">{VERSION_NAMES[build.game_version] ?? build.game_version ?? 'Unknown'}</span>
                            {getDifficultyBadge(build.difficulty)}
                          </div>
                        </div>

                        <h5 className="card-title text-white mb-3">
                          <ReactMarkdown>{decodeHtmlEntities(build.name)}</ReactMarkdown>
                        </h5>

                        {/* Description */}
                        <div className="card-text text-light small mb-3">
                          {build.description ? (
                            <ReactMarkdown>
                              {decodeHtmlEntities(build.description).substring(0, 100) + (build.description.length > 100 ? '...' : '')}
                            </ReactMarkdown>
                          ) : (
                            <p className="mb-0">No description provided.</p>
                          )}
                        </div>

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

                        {/* Rating */}
                        {build.average_rating !== undefined && build.rating_count !== undefined && (
                          <div className="mt-3 pt-3 border-top border-secondary">
                            <RatingStars
                              rating={build.average_rating}
                              ratingCount={build.rating_count}
                              interactive={false}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                      <div className="card-footer bg-dark border-secondary d-flex justify-content-between align-items-center">
                        <div className="d-flex flex-column">
                          {build.author_username && (
                            <small className="text-info mb-1">
                              By {build.author_username}
                            </small>
                          )}
                          <small className="text-muted">
                            {new Date(build.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <span className="btn btn-sm btn-primary">View Build</span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-4 mb-4">
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
    </div>
    </>
  );
};
