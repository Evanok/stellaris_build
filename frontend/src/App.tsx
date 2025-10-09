import { useState, useEffect } from 'react';
import { BuildForm } from './BuildForm';

interface Build {
  id: number;
  name: string;
  description: string;
  game_version: string;
  tags: string;
}

function App() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/builds')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        setBuilds(data.builds);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleBuildCreated = (newBuild: Build) => {
    setBuilds([newBuild, ...builds]);
  };

  return (
    <div className="container text-white">
      <header className="text-center my-4">
        <h1>Stellaris Build Sharing</h1>
        <p className="lead">Share and discover new ways to conquer the galaxy.</p>
      </header>

      <main>
        <BuildForm onBuildCreated={handleBuildCreated} />

        <h2 className="mt-5">Community Builds</h2>
        {loading && <p>Loading builds...</p>}
        {error && <div className="alert alert-danger">Error: {error}</div>}
        {!loading && !error && (
          <div className="list-group">
            {builds.length > 0 ? (
              builds.map((build) => (
                <div key={build.id} className="list-group-item list-group-item-action bg-dark text-white mb-2 border-secondary">
                  <div className="d-flex w-100 justify-content-between">
                    <h5 className="mb-1">{build.name}</h5>
                    <small>v{build.game_version || 'N/A'}</small>
                  </div>
                  <p className="mb-1">{build.description || 'No description provided.'}</p>
                  <div>
                    {build.tags && build.tags.split(',').map(tag => tag.trim()).map(tag => (
                      <span key={tag} className="badge bg-primary me-1">{tag}</span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>No builds have been shared yet. Be the first!</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
