import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import RatingStars from '../components/RatingStars';
import { WhatsNewBanner, NewsItem } from '../components/WhatsNewBanner';
import './Home.css';

const VERSION_NAMES: Record<string, string> = {
  '4.4': '4.4 (Pegasus)',
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

// Ethic → color (matches in-game palette)
const ETHIC_COLORS: Record<string, string> = {
  ethic_militarist:          '#e05c5c',
  ethic_fanatic_militarist:  '#e84040',
  ethic_pacifist:            '#7eb8e8',
  ethic_fanatic_pacifist:    '#5ba3d9',
  ethic_materialist:         '#4fc3f7',
  ethic_fanatic_materialist: '#29b6f6',
  ethic_spiritualist:        '#c792ea',
  ethic_fanatic_spiritualist:'#ab47bc',
  ethic_xenophile:           '#81c784',
  ethic_fanatic_xenophile:   '#66bb6a',
  ethic_xenophobe:           '#ff8a65',
  ethic_fanatic_xenophobe:   '#ff7043',
  ethic_authoritarian:       '#ffca28',
  ethic_fanatic_authoritarian:'#ffb300',
  ethic_egalitarian:         '#aed581',
  ethic_fanatic_egalitarian: '#9ccc65',
  ethic_gestalt_consciousness:'#26c6da',
};

const getEthicTitleColor = (ethics: string): string => {
  const first = ethics.split(',')[0]?.trim();
  return ETHIC_COLORS[first] ?? '#e0e0e0';
};

// Deterministic color for origins from a Stellaris-themed palette
const ORIGIN_PALETTE = [
  '#4fc3f7', '#c792ea', '#ffca28', '#81c784',
  '#ff8a65', '#90caf9', '#f48fb1', '#80cbc4',
  '#b39ddb', '#e6ee9c', '#80deea', '#ffab91',
];

const hashOriginColor = (id: string): string => {
  const h = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ORIGIN_PALETTE[h % ORIGIN_PALETTE.length];
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
  species_class?: string;
  portrait?: string;
  is_nomadic?: number;
  ark_type?: string;
  created_at: string;
  author_username?: string;
  author_avatar?: string;
  average_rating?: number;
  rating_count?: number;
  origin_name?: string | null;
  authority_name?: string | null;
  ethics_names?: Record<string, string>;
}

export const invalidateBuildsCache = () => { /* no-op: home always fetches fresh data */ };

const IconWithFallback: React.FC<{ src: string; label: string }> = ({ src, label }) => (
  <img
    src={src}
    alt=""
    title={label}
    style={{ width: '20px', height: '20px', objectFit: 'contain' }}
    loading="lazy"
    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
  />
);

export const Home: React.FC = () => {
  const [pagedBuilds, setPagedBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [versionFilter, setVersionFilter] = useState<string>('');
  const [nomadicFilter, setNomadicFilter] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What's New data
  const latestNews: NewsItem[] = [
    {
      date: '15 Jun 2026',
      title: 'Stellaris 4.4 "Pegasus" Support',
      description: 'Build data updated for game version 4.4 "Pegasus". New traits, civics, origins and traditions extracted from the latest patch.',
      type: 'update'
    },
    {
      date: '07 Jun 2026',
      title: 'Species Portraits & Card Redesign',
      description: 'Build cards now display species portraits, with icons for civics, traits, origin, ethics and authority. Portrait selector added to the build form.',
      type: 'feature'
    }
  ];

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ page: String(currentPage), limit: '12', sort: sortBy });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (difficultyFilter) params.set('difficulty', difficultyFilter);
    if (versionFilter) params.set('version', versionFilter);
    if (nomadicFilter) params.set('nomadic', 'true');

    fetch(`/api/builds?${params}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setPagedBuilds(data.builds || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.availableVersions?.length) setAvailableVersions(data.availableVersions);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError('Failed to load builds'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [currentPage, debouncedSearch, difficultyFilter, versionFilter, nomadicFilter, sortBy]);

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
        <link rel="canonical" href="https://stellaris-build.com/" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Stellaris Community Empire Builds",
          "description": "Community-created empire builds for Stellaris by Paradox Interactive, including species traits, civics, ethics, origins, ascension perks, and tradition trees.",
          "url": "https://stellaris-build.com/",
          "numberOfItems": total,
          "itemListElement": pagedBuilds.slice(0, 20).map((build, index) => ({
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
                <h4 className="text-white mb-1">{total}</h4>
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
                  <span className="badge bg-primary text-white">Explore all →</span>
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
          <div className="col-md-4 mb-3 mb-md-0">
            <input
              type="text"
              className="form-control form-control-lg bg-secondary text-white border-secondary"
              placeholder="Search builds by name, origin, ethics, tags..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="col-md-2 mb-3 mb-md-0">
            <select
              aria-label="Filter by difficulty"
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
              aria-label="Filter by game version"
              className="form-select form-select-lg bg-secondary text-white border-secondary"
              value={versionFilter}
              onChange={(e) => {
                setVersionFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Versions</option>
              {availableVersions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2 mb-3 mb-md-0">
            <select
              aria-label="Filter by empire type"
              className="form-select form-select-lg bg-secondary text-white border-secondary"
              value={nomadicFilter ? 'nomadic' : ''}
              onChange={(e) => {
                setNomadicFilter(e.target.value === 'nomadic');
                setCurrentPage(1);
              }}
            >
              <option value="">All Empires</option>
              <option value="nomadic">Nomadic Only</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              aria-label="Sort builds"
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
              Showing {pagedBuilds.length} of {total} builds
              {(debouncedSearch || difficultyFilter || versionFilter || nomadicFilter) && ` (filtered)`}
            </p>
          </div>
        </div>

        {/* Builds Grid */}
        {pagedBuilds.length === 0 ? (
          <div className="alert alert-info">
            {searchQuery ? 'No builds match your search.' : 'No builds available yet. Be the first to create one!'}
          </div>
        ) : (
          <>
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
              {pagedBuilds.map(build => (
                <div key={build.id} className="col">
                  <Link to={`/build/${build.id}`} className="build-card-link">
                    <div className="card h-100 build-card">
                      <div className="card-body">
                        {/* Top row: portrait + nomad icons | version + difficulty */}
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex align-items-center gap-1">
                            {build.portrait ? (
                              <img
                                src={`/portraits/${build.portrait}.png`}
                                alt=""
                                loading="lazy"
                                style={{ width: '40px', height: '40px', objectFit: 'cover', objectPosition: 'top', borderRadius: '6px', border: '2px solid #0dcaf0', flexShrink: 0 }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : null}
                            {build.is_nomadic ? (
                              <>
                                <img src="/icons/home/nomad_toggle.webp" width={28} height={28} alt="Nomadic Empire" title="Nomadic Empire" />
                                {build.ark_type && (
                                  <img
                                    src={`/icons/home/${build.ark_type === 'civilian_arkship' ? 'tech_civilian_arkship' : build.ark_type === 'science_arkship' ? 'tech_science_arkship' : 'tech_military_arkship'}.webp`}
                                    width={28} height={28}
                                    alt={build.ark_type.replace(/_/g, ' ')}
                                    title={build.ark_type.replace(/_arkship$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Arkship'}
                                  />
                                )}
                              </>
                            ) : null}
                          </div>
                          <div>
                            <span className="badge bg-primary me-1">{VERSION_NAMES[build.game_version] ?? build.game_version ?? 'Unknown'}</span>
                            {getDifficultyBadge(build.difficulty)}
                          </div>
                        </div>

                        <h5
                          className="card-title mb-3 fw-bold"
                          style={{ color: build.ethics ? getEthicTitleColor(build.ethics) : '#e0e0e0' }}
                        >
                          {decodeHtmlEntities(build.name)}
                        </h5>

                        {/* Origin name */}
                        {build.origin && (
                          <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                            <small className="text-muted" style={{ minWidth: '72px', display: 'inline-block' }}>Origin:</small>
                            <small style={{ color: hashOriginColor(build.origin), fontWeight: 500 }}>
                              {build.origin_name || build.origin.replace(/^origin_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </small>
                          </div>
                        )}

                        {/* Civics icons */}
                        {build.civics && (
                          <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                            <small className="text-muted" style={{ minWidth: '72px', display: 'inline-block' }}>Civics:</small>
                            {build.civics.split(',').map(s => s.trim()).filter(Boolean).map((id, idx) => (
                              <IconWithFallback
                                key={idx}
                                src={`/icons/home/${id}.webp`}
                                label={id.replace(/^civic_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              />
                            ))}
                          </div>
                        )}

                        {/* Traits icons */}
                        {build.traits && (
                          <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                            <small className="text-muted" style={{ minWidth: '72px', display: 'inline-block' }}>Traits:</small>
                            {build.traits.split(',').map(s => s.trim()).filter(Boolean).map((id, idx) => (
                              <IconWithFallback
                                key={idx}
                                src={`/icons/home/${id}.webp`}
                                label={id.replace(/^trait_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              />
                            ))}
                          </div>
                        )}

                        {/* Ethics icons */}
                        {build.ethics && (
                          <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                            <small className="text-muted" style={{ minWidth: '72px', display: 'inline-block' }}>Ethics:</small>
                            {build.ethics.split(',').map(s => s.trim()).filter(Boolean).map((id, idx) => (
                              <img
                                key={idx}
                                src={`/icons/home/${id}.webp`}
                                alt=""
                                title={build.ethics_names?.[id] || id}
                                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ))}
                          </div>
                        )}

                        {/* Authority icon */}
                        {build.authority && (
                          <div className="d-flex align-items-center gap-1 mb-2 flex-wrap">
                            <small className="text-muted" style={{ minWidth: '72px', display: 'inline-block' }}>Authority:</small>
                            <img
                              src={`/icons/home/${build.authority}.webp`}
                              alt=""
                              title={build.authority_name || build.authority}
                              style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}

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
