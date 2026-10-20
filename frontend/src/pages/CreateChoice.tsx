import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

interface CreateOption {
  path: string;
  icon: string;
  color: string;
  title: string;
  description: React.ReactNode;
  badge: string;
  badgeClass: string;
}

// Ordered fastest first: most visitors who share builds elsewhere (Reddit...) have
// already played the empire, so it is sitting in their game files.
const CREATE_OPTIONS: CreateOption[] = [
  {
    path: '/create/import-designs',
    icon: 'bi-collection',
    color: '#ffc107',
    title: 'Import from Empire Designs',
    description: (
      <>
        Already made the empire in-game? Upload your <code>user_empire_designs</code> file,
        pick the empire, done. Traits, civics, ethics and origin are filled in for you.
      </>
    ),
    badge: 'Fastest - about 30 seconds',
    badgeClass: 'bg-success',
  },
  {
    path: '/create/import-save',
    icon: 'bi-file-earmark-arrow-up',
    color: '#198754',
    title: 'Import from Save Game',
    description: <>Upload a <code>.sav</code> file from a running game and extract your empire's build automatically.</>,
    badge: 'From a game in progress',
    badgeClass: 'bg-info text-dark',
  },
  {
    path: '/create/manual',
    icon: 'bi-pencil-square',
    color: '#0d6efd',
    title: 'Manual Build',
    description: 'Create your build from scratch with the full build form. Perfect for theory-crafting.',
    badge: 'Most flexible',
    badgeClass: 'bg-primary',
  },
];

const CreateChoice: React.FC = () => {
  const navigate = useNavigate();

  // Public page, and so are all three paths: the login is only asked when the
  // build is published, once the visitor has already done the work
  const handleSelect = (option: CreateOption) => navigate(option.path);

  return (
    <div className="container mt-5">
      <Helmet>
        <title>Share Your Stellaris Build - Stellaris Build</title>
        <meta name="description" content="Share your Stellaris empire build in seconds: import it from your empire designs file or save game, or create it with the full build form." />
        <link rel="canonical" href="https://stellaris-build.com/create" />
      </Helmet>
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <h1 className="text-center mb-4">Share Your Build</h1>
          <p className="text-center text-muted mb-2">
            Choose how you want to create your Stellaris empire build
          </p>

          <p className="text-center text-muted small mb-4">
            <i className="bi bi-unlock me-1"></i>
            No account needed - sign in when you publish, or publish as a guest (reviewed by a moderator).
          </p>

          <div className="row g-4">
            {CREATE_OPTIONS.map((option, index) => (
              <div key={option.path} className="col-md-4">
                <div
                  className={`card bg-dark h-100 hover-card ${index === 0 ? 'border-success' : 'border-secondary'}`}
                  onClick={() => handleSelect(option)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(option); } }}
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div className="card-body text-center p-4">
                    <div className="mb-3">
                      <i className={`bi ${option.icon}`} style={{ fontSize: '4rem', color: option.color }}></i>
                    </div>
                    <h3 className="card-title">{option.title}</h3>
                    <p className="card-text text-muted">{option.description}</p>
                    <div className="mt-3">
                      <span className={`badge ${option.badgeClass}`}>{option.badge}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-5">
            <p className="text-muted">
              <i className="bi bi-info-circle me-2"></i>
              All import methods pre-fill the build form for you to review before submitting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChoice;
