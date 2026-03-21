import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../AuthContext';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import RatingStars from '../components/RatingStars';

interface Build {
  id: number;
  name: string;
  description: string;
  game_version: string;
  youtube_url?: string;
  source_url?: string;
  difficulty?: string;
  species_class?: string;
  origin: string;
  authority: string;
  ethics: string;
  civics: string;
  traits: string;
  secondary_traits?: string;
  ascension_perks: string;
  traditions: string;
  ruler_trait: string;
  dlcs: string;
  tags: string;
  author_id: number;
  author_username?: string;
  author_avatar?: string;
  created_at: string;
  updated_at: string;
}

interface Trait {
  id: string;
  name: string;
  description: string;
  cost: number;
  effects: string;
}

interface Origin {
  id: string;
  name: string;
  description: string;
  effects: string;
}

interface Ethic {
  id: string;
  name: string;
  description: string;
  cost: number;
  effects: string;
}

interface Authority {
  id: string;
  name: string;
  description: string;
  effects: string;
}

interface Civic {
  id: string;
  name: string;
  description: string;
  effects: string;
  tooltip?: string;
}

interface AscensionPerk {
  id: string;
  name: string;
  description: string;
  effects: string;
}

interface TraditionTree {
  name: string;
  adopt: {
    name: string;
    description: string;
    effects: string;
  };
  finish: {
    name: string;
    description: string;
    effects: string;
  };
}

interface RulerTrait {
  id: string;
  name: string;
  description: string;
  effects: string;
  icon?: string;
}

interface SpeciesClass {
  id: string;
  name: string;
  description: string;
  archetype: string;
}

// Helper to safely get numeric cost from trait (handles both number and {base, modifier} object)
const getTraitCost = (cost: any): number => {
  if (typeof cost === 'number') return cost;
  if (typeof cost === 'object' && cost !== null && typeof cost.base === 'number') return cost.base;
  return 0;
};

// Reusable icon component
const GameIcon: React.FC<{ type: string; id: string; size?: number }> = ({ type, id, size = 48 }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    <img
      src={`/icons/${type}/${id}.png`}
      alt=""
      width={size}
      height={size}
      style={{ marginRight: '12px', borderRadius: '4px' }}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
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
    <span className={`badge ${config.className} fs-6`}>
      {config.label}
    </span>
  );
};

export const BuildDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [build, setBuild] = useState<Build | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Game data
  const [allSpeciesClasses, setAllSpeciesClasses] = useState<SpeciesClass[]>([]);
  const [allTraits, setAllTraits] = useState<Trait[]>([]);
  const [allOrigins, setAllOrigins] = useState<Origin[]>([]);
  const [allEthics, setAllEthics] = useState<Ethic[]>([]);
  const [allAuthorities, setAllAuthorities] = useState<Authority[]>([]);
  const [allCivics, setAllCivics] = useState<Civic[]>([]);
  const [allAscensionPerks, setAllAscensionPerks] = useState<AscensionPerk[]>([]);
  const [allTraditionTrees, setAllTraditionTrees] = useState<TraditionTree[]>([]);
  const [allRulerTraits, setAllRulerTraits] = useState<RulerTrait[]>([]);

  // Image error states
  const [originImageError, setOriginImageError] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Rating state
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    // First fetch the build to know its game version, then load matching game data
    fetch(`/api/builds/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Build not found');
        return res.json();
      })
      .then(({ build: foundBuild }) => {
        const v = foundBuild.game_version || '';
        const qs = v ? `?version=${encodeURIComponent(v)}` : '';

        return Promise.all([
          fetch(`/api/species-classes${qs}`).then(res => res.json()),
          fetch(`/api/traits${qs}`).then(res => res.json()),
          fetch(`/api/origins${qs}`).then(res => res.json()),
          fetch(`/api/ethics${qs}`).then(res => res.json()),
          fetch(`/api/authorities${qs}`).then(res => res.json()),
          fetch(`/api/civics${qs}`).then(res => res.json()),
          fetch(`/api/ascension-perks${qs}`).then(res => res.json()),
          fetch(`/api/traditions${qs}`).then(res => res.json()),
          fetch(`/api/ruler-traits${qs}`).then(res => res.json()),
        ]).then(([speciesClasses, traits, origins, ethics, authorities, civics, perks, traditions, rulerTraits]) => {
          setAllSpeciesClasses(speciesClasses);
          setAllTraits(traits);
          setAllOrigins(Array.isArray(origins) ? origins : (origins.origins || []));
          setAllEthics(ethics);
          setAllAuthorities(authorities);
          setAllCivics(Array.isArray(civics) ? civics : (civics.civics || []));
          setAllAscensionPerks(Array.isArray(perks) ? perks : (perks.all || []));

          const trees: TraditionTree[] = [];
          for (const key in traditions) {
            if (traditions[key].adopt && traditions[key].adopt.name) {
              trees.push({
                name: key,
                adopt: traditions[key].adopt,
                finish: traditions[key].finish
              });
            }
          }
          setAllTraditionTrees(trees);
          setAllRulerTraits(rulerTraits);
          setBuild(foundBuild);
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setError('Failed to load build');
        setLoading(false);
      });
  }, [id]);

  // Load rating data
  useEffect(() => {
    if (!id) return;

    fetch(`/api/builds/${id}/rating`)
      .then(res => res.json())
      .then(data => {
        setAverageRating(data.average_rating || 0);
        setRatingCount(data.rating_count || 0);
        setUserRating(data.user_rating);
      })
      .catch(err => {
        console.error('Failed to load rating:', err);
      });
  }, [id]);

  // Submit rating
  const handleRate = async (rating: number) => {
    if (!user) {
      alert('You must be logged in to rate builds');
      return;
    }

    setRatingLoading(true);
    try {
      const response = await fetch(`/api/builds/${id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      const data = await response.json();
      setAverageRating(data.average_rating);
      setRatingCount(data.rating_count);
      setUserRating(data.user_rating);
    } catch (err: any) {
      console.error('Failed to submit rating:', err);
      alert(err.message || 'Failed to submit rating');
    } finally {
      setRatingLoading(false);
    }
  };

  const parseList = (str: string | null | undefined): string[] => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(s => s);
  };

  // Extract YouTube video ID from various URL formats
  const getYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;

    // Regular YouTube URLs: https://www.youtube.com/watch?v=VIDEO_ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);

    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getSpeciesClassData = (classId: string) => allSpeciesClasses.find(sc => sc.id === classId);
  const getTraitData = (traitId: string) => allTraits.find(t => t.id === traitId);
  const getOriginData = (originId: string) => allOrigins.find(o => o.id === originId);
  const getEthicData = (ethicId: string) => allEthics.find(e => e.id === ethicId);
  const getAuthorityData = (authId: string) => allAuthorities.find(a => a.id === authId);
  const getCivicData = (civicId: string) => allCivics.find(c => c.id === civicId);
  const getAscensionPerkData = (perkId: string) => allAscensionPerks.find(p => p.id === perkId);
  const getTraditionData = (treeId: string) => allTraditionTrees.find(t => t.name === treeId);
  const getRulerTraitData = (traitId: string) => allRulerTraits.find(t => t.id === traitId);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this build? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/builds/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete build');
      }

      // Redirect to home after successful deletion
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

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

  // Prepare meta tags (keep it simple to avoid render issues)
  const buildTitle = build.name ? `${build.name} - Stellaris Build` : 'Stellaris Build';
  const buildDescription = build.description
    ? build.description.substring(0, 155)
    : `Stellaris ${build.game_version || ''} empire build. View species traits, civics, ethics, and strategy.`;
  const buildUrl = `https://stellaris-build.com/build/${build.id}`;

  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>{buildTitle}</title>
        <meta name="title" content={buildTitle} />
        <meta name="description" content={buildDescription} />
        <link rel="canonical" href={buildUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={buildUrl} />
        <meta property="og:title" content={buildTitle} />
        <meta property="og:description" content={buildDescription} />
        <meta property="og:image" content="https://stellaris-build.com/og-image.jpg" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={buildUrl} />
        <meta property="twitter:title" content={buildTitle} />
        <meta property="twitter:description" content={buildDescription} />
        <meta property="twitter:image" content="https://stellaris-build.com/og-image.jpg" />

        {/* Structured Data (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Guide",
            "name": build.name || "Stellaris Build",
            "description": buildDescription,
            "about": {
              "@type": "VideoGame",
              "name": "Stellaris"
            },
            "author": {
              "@type": "Person",
              "name": "Arthur LAMBERT"
            },
            "datePublished": build.created_at || new Date().toISOString(),
            "dateModified": build.updated_at || build.created_at || new Date().toISOString(),
            "version": build.game_version || "4.1",
            "keywords": build.tags || "",
            "url": buildUrl
          })}
        </script>
      </Helmet>

      <div className="container mt-4">
        {/* Header */}
        <div className="row mb-4">
        <div className="col-12">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/" className="text-decoration-none">Home</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                <ReactMarkdown>{decodeHtmlEntities(build.name)}</ReactMarkdown>
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Build Title */}
      <div className="card bg-dark border-secondary mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-8">
              <h1 className="text-white mb-3">
                <ReactMarkdown>{decodeHtmlEntities(build.name)}</ReactMarkdown>
              </h1>
              {build.description && (
                <div className="text-light fs-5">
                  <ReactMarkdown>{decodeHtmlEntities(build.description)}</ReactMarkdown>
                </div>
              )}
            </div>
            <div className="col-md-4 text-end">
              <div className="mb-2">
                <span className="badge bg-primary fs-6 me-2">{build.game_version}</span>
                {getDifficultyBadge(build.difficulty)}
              </div>
              {build.species_class && (() => {
                const speciesClass = getSpeciesClassData(build.species_class);
                return (
                  <div className="mb-2">
                    <span className="badge bg-info fs-6">
                      <i className="bi bi-person-badge me-1"></i>
                      {speciesClass?.name || build.species_class}
                    </span>
                  </div>
                );
              })()}
              {build.author_username && (
                <div className="text-info mb-2">
                  <small>By {build.author_username}</small>
                </div>
              )}
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

      {/* Rating System */}
      <div className="card bg-dark border-secondary mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h5 className="text-white mb-3">
                <i className="bi bi-star-fill me-2 text-warning"></i>
                Community Rating
              </h5>
              <RatingStars
                rating={averageRating}
                ratingCount={ratingCount}
                interactive={false}
                size="lg"
              />
            </div>
            {user && (
              <div className="col-md-6 border-start border-secondary">
                <h6 className="text-white mb-3">
                  {userRating !== null ? 'Your Rating' : 'Rate this Build'}
                </h6>
                {ratingLoading ? (
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                ) : (
                  <RatingStars
                    rating={userRating || 0}
                    interactive={true}
                    onRate={handleRate}
                    size="lg"
                  />
                )}
                {userRating !== null && (
                  <p className="text-muted mt-2 mb-0">
                    <small>Click a star to update your rating</small>
                  </p>
                )}
              </div>
            )}
            {!user && (
              <div className="col-md-6 border-start border-secondary">
                <p className="text-muted mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  <Link to="/login" className="text-decoration-none">Log in</Link> to rate this build
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Source URL */}
      {build.source_url && (
        <div className="card bg-dark border-secondary mb-4">
          <div className="card-header bg-secondary">
            <h4 className="mb-0 text-white">
              <i className="bi bi-link-45deg me-2"></i>
              Original Source
            </h4>
          </div>
          <div className="card-body">
            <p className="text-muted mb-2">This build was shared from:</p>
            <a
              href={build.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-outline-primary"
            >
              <i className="bi bi-box-arrow-up-right me-2"></i>
              View Original Post
            </a>
          </div>
        </div>
      )}

      {/* YouTube Video */}
      {build.youtube_url && (() => {
        const videoId = getYoutubeVideoId(build.youtube_url);
        if (!videoId) return null;

        return (
          <div className="card bg-dark border-secondary mb-4">
            <div className="card-header bg-secondary">
              <h4 className="mb-0 text-white">
                <i className="bi bi-play-circle me-2"></i>
                Video Presentation
              </h4>
            </div>
            <div className="card-body">
              <div className="ratio ratio-16x9">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ borderRadius: '8px' }}
                ></iframe>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="row">
        {/* Left Column */}
        <div className="col-lg-6">
          {/* Species Traits */}
          {build.traits && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-dna me-2"></i>
                  Primary Species Traits
                </h4>
              </div>
              <div className="card-body">
                {parseList(build.traits).map((traitId, idx) => {
                  const trait = getTraitData(traitId);
                  return (
                    <div key={idx} className="mb-3 pb-3 border-bottom border-secondary">
                      <div className="d-flex align-items-start">
                        <GameIcon type="traits" id={traitId} size={48} />
                        <div className="flex-grow-1">
                          <h5 className="text-white mb-1">
                            {trait?.name || traitId}
                            <span className={`badge ms-2 ${trait && getTraitCost(trait.cost) > 0 ? 'bg-success' : 'bg-danger'}`}>
                              {getTraitCost(trait?.cost)} points
                            </span>
                          </h5>
                          {trait?.description && (
                            <p className="text-light mb-2">{trait.description}</p>
                          )}
                          {trait?.effects && (
                            <p className="text-info mb-0">
                              <strong>Effects:</strong> {trait.effects}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Secondary Species Traits */}
          {build.secondary_traits && build.secondary_traits.trim() !== '' && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-dna me-2"></i>
                  Secondary Species Traits
                </h4>
              </div>
              <div className="card-body">
                {parseList(build.secondary_traits).map((traitId, idx) => {
                  const trait = getTraitData(traitId);
                  return (
                    <div key={idx} className="mb-3 pb-3 border-bottom border-secondary">
                      <div className="d-flex align-items-start">
                        <GameIcon type="traits" id={traitId} size={48} />
                        <div className="flex-grow-1">
                          <h5 className="text-white mb-1">
                            {trait?.name || traitId}
                            <span className={`badge ms-2 ${trait && getTraitCost(trait.cost) > 0 ? 'bg-success' : 'bg-danger'}`}>
                              {getTraitCost(trait?.cost)} points
                            </span>
                          </h5>
                          {trait?.description && (
                            <p className="text-light mb-2">{trait.description}</p>
                          )}
                          {trait?.effects && (
                            <p className="text-info mb-0">
                              <strong>Effects:</strong> {trait.effects}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Origin */}
          {build.origin && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-globe me-2"></i>
                  Origin
                </h4>
              </div>
              <div className="card-body">
                {(() => {
                  const origin = getOriginData(build.origin);

                  return (
                    <div>
                      {/* Large origin image */}
                      {!originImageError && (
                        <div className="mb-3 text-center" style={{ backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '8px' }}>
                          <img
                            src={`/icons/origin_original/${build.origin}.png`}
                            alt={origin?.name || build.origin}
                            style={{
                              width: '100%',
                              maxWidth: '400px',
                              maxHeight: '300px',
                              borderRadius: '8px',
                              objectFit: 'cover'
                            }}
                            loading="lazy"
                            onError={() => setOriginImageError(true)}
                          />
                        </div>
                      )}

                      <div className="d-flex align-items-start">
                        <GameIcon type="origin_mini" id={build.origin} size={64} />
                        <div className="flex-grow-1">
                          <h4 className="text-primary mb-2">{origin?.name || build.origin}</h4>
                          {origin?.description && (
                            <p className="text-light mb-2">{origin.description}</p>
                          )}
                          {origin?.effects && (
                            <div className="alert alert-info mb-0">
                              <strong>Effects:</strong> {origin.effects}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Ruler Trait */}
          {build.ruler_trait && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-person-badge me-2"></i>
                  Starting Ruler Trait
                </h4>
              </div>
              <div className="card-body">
                {(() => {
                  const trait = getRulerTraitData(build.ruler_trait);
                  return (
                    <div className="d-flex align-items-start">
                      {trait?.icon && (
                        <img
                          src={trait.icon}
                          alt=""
                          width={64}
                          height={64}
                          style={{ marginRight: '12px', borderRadius: '4px' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-grow-1">
                        <h5 className="text-warning mb-2">{trait?.name || build.ruler_trait}</h5>
                        {trait?.description && (
                          <p className="text-light mb-2">{trait.description}</p>
                        )}
                        {trait?.effects && (
                          <p className="text-info mb-0">
                            <strong>Effects:</strong> {trait.effects}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Ethics */}
          {build.ethics && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-compass me-2"></i>
                  Ethics
                </h4>
              </div>
              <div className="card-body">
                {parseList(build.ethics).map((ethicId, idx) => {
                  const ethic = getEthicData(ethicId);
                  return (
                    <div key={idx} className="mb-3 pb-3 border-bottom border-secondary">
                      <div className="d-flex align-items-start">
                        <GameIcon type="ethics" id={ethicId} size={48} />
                        <div className="flex-grow-1">
                          <h5 className="text-warning mb-1">
                            {ethic?.name || ethicId}
                            <span className={`badge ms-2 ${ethic?.cost === 3 ? 'bg-danger' : ethic?.cost === 2 ? 'bg-warning text-dark' : 'bg-info'}`}>
                              {ethic?.cost === 3 ? 'Gestalt' : ethic?.cost === 2 ? 'Fanatic' : 'Normal'}
                            </span>
                          </h5>
                          {ethic?.description && (
                            <p className="text-light mb-2">{ethic.description}</p>
                          )}
                          {ethic?.effects && (
                            <p className="text-info mb-0">
                              <strong>Effects:</strong> {ethic.effects}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Authority */}
          {build.authority && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-building me-2"></i>
                  Authority
                </h4>
              </div>
              <div className="card-body">
                {(() => {
                  const authority = getAuthorityData(build.authority);
                  return (
                    <div className="d-flex align-items-start">
                      <GameIcon type="authorities" id={build.authority} size={64} />
                      <div className="flex-grow-1">
                        <h4 className="text-success mb-2">{authority?.name || build.authority}</h4>
                        {authority?.description && (
                          <p className="text-light mb-2">{authority.description}</p>
                        )}
                        {authority?.effects && (
                          <div className="alert alert-success mb-0">
                            <strong>Effects:</strong> {authority.effects}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Civics */}
          {build.civics && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-gear me-2"></i>
                  Civics
                </h4>
              </div>
              <div className="card-body">
                {parseList(build.civics).map((civicId, idx) => {
                  const civic = getCivicData(civicId);
                  const effectsText = civic?.effects || civic?.tooltip || '';
                  return (
                    <div key={idx} className="mb-3 pb-3 border-bottom border-secondary">
                      <div className="d-flex align-items-start">
                        <GameIcon type="civics" id={civicId} size={48} />
                        <div className="flex-grow-1">
                          <h5 className="text-info mb-1">{civic?.name || civicId}</h5>
                          {civic?.description && (
                            <p className="text-light mb-2">{civic.description}</p>
                          )}
                          {effectsText && (
                            <div className="alert alert-info mb-0">
                              <strong>Effects:</strong> {effectsText}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="col-lg-6">
          {/* Ascension Perks */}
          {build.ascension_perks && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-star me-2"></i>
                  Recommended Ascension Perks
                </h4>
              </div>
              <div className="card-body">
                {parseList(build.ascension_perks).map((perkId, idx) => {
                  const perk = getAscensionPerkData(perkId);
                  return (
                    <div key={idx} className="mb-3 pb-3 border-bottom border-secondary">
                      <div className="d-flex align-items-start">
                        <span className="badge bg-primary me-3" style={{ fontSize: '1.2rem', padding: '0.5rem 0.75rem' }}>
                          #{idx + 1}
                        </span>
                        <GameIcon type="ascension_perks" id={perkId} size={48} />
                        <div className="flex-grow-1">
                          <h5 className="text-white mb-1">{perk?.name || perkId}</h5>
                          {perk?.description && (
                            <p className="text-light mb-2">{perk.description}</p>
                          )}
                          {perk?.effects && (
                            <p className="text-info mb-0">
                              <strong>Effects:</strong> {perk.effects}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Traditions */}
          {build.traditions && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-tree me-2"></i>
                  Recommended Tradition Trees
                </h4>
              </div>
              <div className="card-body">
                {parseList(build.traditions).map((treeId, idx) => {
                  const tree = getTraditionData(treeId);
                  return (
                    <div key={idx} className="mb-4 pb-4 border-bottom border-secondary">
                      <div className="d-flex align-items-start mb-3">
                        <span className="badge bg-primary me-3" style={{ fontSize: '1.2rem', padding: '0.5rem 0.75rem' }}>
                          #{idx + 1}
                        </span>
                        <GameIcon type="traditions" id={treeId} size={48} />
                        <div className="flex-grow-1">
                          <h5 className="text-white mb-1">{tree?.adopt?.name || treeId}</h5>
                          {tree?.adopt?.description && (
                            <p className="text-light mb-0">{tree.adopt.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Adopt bonus */}
                      {tree?.adopt?.effects && (
                        <div className="alert alert-info mb-2">
                          <strong>Adopt:</strong> {tree.adopt.effects}
                        </div>
                      )}

                      {/* Completion bonus */}
                      {tree?.finish?.effects && (
                        <div className="alert alert-warning mb-0">
                          <strong>Completion:</strong> {tree.finish.effects}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DLCs */}
          {build.dlcs && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-box me-2"></i>
                  Required DLCs
                </h4>
              </div>
              <div className="card-body">
                <p className="text-light mb-0">{build.dlcs}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {build.tags && (
            <div className="card bg-dark border-secondary mb-4">
              <div className="card-header bg-secondary">
                <h4 className="mb-0 text-white">
                  <i className="bi bi-tags me-2"></i>
                  Tags
                </h4>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {parseList(build.tags).map((tag, idx) => (
                    <span key={idx} className="badge bg-secondary fs-6 px-3 py-2">
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
          <Link to="/" className="btn btn-secondary btn-lg me-3">
            <i className="bi bi-arrow-left me-2"></i>
            Back to Builds
          </Link>
          {user && build.author_id === user.id && (
            <>
              <Link
                to={`/edit/${id}`}
                className="btn btn-warning btn-lg me-3"
              >
                <i className="bi bi-pencil me-2"></i>
                Edit Build
              </Link>
              <button
                onClick={handleDelete}
                className="btn btn-danger btn-lg"
                disabled={deleting}
              >
                <i className="bi bi-trash me-2"></i>
                {deleting ? 'Deleting...' : 'Delete Build'}
              </button>
            </>
          )}
          {deleteError && (
            <div className="alert alert-danger mt-3">
              <strong>Error:</strong> {deleteError}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};
