import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import './Resources.css';

interface Resource {
  title: string;
  url: string;
  description: string;
  tags: string[];
  featured: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  resources: Resource[];
}

interface ResourcesData {
  categories: Category[];
}

export const Resources: React.FC = () => {
  const [resourcesData, setResourcesData] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetch('/api/resources')
      .then(res => res.json())
      .then(data => {
        setResourcesData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load resources');
        setLoading(false);
      });
  }, []);

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

  if (error || !resourcesData) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">{error || 'Failed to load resources'}</div>
      </div>
    );
  }

  const filteredCategories = selectedCategory === 'all'
    ? resourcesData.categories
    : resourcesData.categories.filter(cat => cat.id === selectedCategory);

  return (
    <>
      <Helmet>
        <title>Stellaris Resources - Guides, Tools, YouTubers & Communities</title>
        <meta name="description" content="Curated collection of Stellaris resources: YouTube channels, written guides, online tools, Twitch streamers, essential mods, and active communities. Everything you need to master Stellaris." />
        <meta name="keywords" content="stellaris guides, stellaris youtube, stellaris mods, stellaris tools, stellaris community, stellaris tutorial, stellaris wiki" />
      </Helmet>

      <div className="container-fluid p-0">
        {/* Hero Banner */}
        <div
          className="position-relative mb-4"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            padding: '4rem 0',
            borderBottom: '3px solid #e94560'
          }}
        >
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-8">
                <h1 className="display-3 fw-bold text-white mb-3">
                  <i className="bi bi-collection me-3"></i>
                  Community Resources
                </h1>
                <p className="lead text-light mb-0">
                  Curated guides, tools, and content creators to help you master Stellaris
                </p>
              </div>
              <div className="col-md-4 text-end">
                <div className="d-inline-block p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                  <h3 className="text-white mb-2">{resourcesData.categories.reduce((sum, cat) => sum + cat.resources.length, 0)}</h3>
                  <p className="text-light mb-0">Curated Resources</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mt-4">
          {/* Category Filter Tabs */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="d-flex flex-wrap gap-2">
                <button
                  className={`btn ${selectedCategory === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <i className="bi bi-grid me-2"></i>
                  All Resources
                </button>
                {resourcesData.categories.map(category => (
                  <button
                    key={category.id}
                    className={`btn ${selectedCategory === category.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <i className={`${category.icon} me-2`}></i>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categories */}
          {filteredCategories.map(category => (
            <div key={category.id} className="mb-5">
              <div className="card bg-dark border-secondary mb-3">
                <div className="card-header bg-secondary">
                  <h2 className="mb-0 text-white">
                    <i className={`${category.icon} me-3`}></i>
                    {category.name}
                  </h2>
                  <p className="text-light mb-0 mt-2">{category.description}</p>
                </div>
              </div>

              {/* Featured Resources */}
              {category.resources.filter(r => r.featured).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-warning mb-3">
                    <i className="bi bi-star-fill me-2"></i>
                    Featured
                  </h4>
                  <div className="row row-cols-1 row-cols-md-2 g-3">
                    {category.resources.filter(r => r.featured).map((resource, idx) => (
                      <div key={idx} className="col">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="resource-card-link"
                        >
                          <div className="card bg-dark border-warning h-100 resource-card">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <h5 className="text-white mb-0">
                                  {resource.title}
                                  <i className="bi bi-box-arrow-up-right ms-2 text-muted small"></i>
                                </h5>
                                <span className="badge bg-warning text-dark">Featured</span>
                              </div>
                              <p className="text-light mb-3">{resource.description}</p>
                              <div className="d-flex flex-wrap gap-1">
                                {resource.tags.map((tag, tagIdx) => (
                                  <span key={tagIdx} className="badge bg-secondary">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Resources */}
              {category.resources.filter(r => !r.featured).length > 0 && (
                <div className="mb-4">
                  {category.resources.filter(r => r.featured).length > 0 && (
                    <h4 className="text-secondary mb-3 mt-4">More Resources</h4>
                  )}
                  <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
                    {category.resources.filter(r => !r.featured).map((resource, idx) => (
                      <div key={idx} className="col">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="resource-card-link"
                        >
                          <div className="card bg-dark border-secondary h-100 resource-card">
                            <div className="card-body">
                              <h6 className="text-white mb-2">
                                {resource.title}
                                <i className="bi bi-box-arrow-up-right ms-2 text-muted small"></i>
                              </h6>
                              <p className="text-light small mb-2">{resource.description}</p>
                              <div className="d-flex flex-wrap gap-1">
                                {resource.tags.map((tag, tagIdx) => (
                                  <span key={tagIdx} className="badge bg-secondary small">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Contribution CTA */}
          <div className="card bg-dark border-primary mb-5">
            <div className="card-body text-center py-5">
              <h3 className="text-white mb-3">
                <i className="bi bi-plus-circle me-2"></i>
                Know a Great Resource?
              </h3>
              <p className="text-light mb-4">
                Help the community grow by suggesting YouTube channels, guides, tools, mods, or any Stellaris content worth sharing.
              </p>
              <a
                href="https://www.reddit.com/r/Stellaris/comments/1oapp5k/i_made_a_website_to_share_stellaris_builds/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
              >
                <i className="bi bi-reddit me-2"></i>
                Suggest a Resource
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Resources;
