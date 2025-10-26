import React, { useState, useEffect } from 'react';

interface VersionInfo {
  version: string;
  commitHash: string;
  commitDate: string;
  buildDate: string;
}

const Footer: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersionInfo(data))
      .catch(err => console.error('Failed to load version info:', err));
  }, []);

  return (
    <footer className="bg-dark text-light py-3 mt-5 border-top border-secondary">
      <div className="container">
        <div className="row">
          <div className="col-md-6">
            <p className="mb-0 text-muted">
              <small>
                Stellaris Build Sharing - Community-driven build database
              </small>
            </p>
          </div>
          <div className="col-md-6 text-end">
            {versionInfo && (
              <p className="mb-0 text-muted">
                <small>
                  <i className="bi bi-code-square me-1"></i>
                  {versionInfo.version}
                  <span className="ms-2 opacity-75">
                    ({versionInfo.commitHash})
                  </span>
                </small>
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
