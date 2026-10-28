import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuildForm } from '../BuildForm';
import { invalidateBuildsCache } from './Home';
import { trackEvent } from '../utils/analytics';
import { useAuth } from '../AuthContext';

const ImportSave: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildData, setBuildData] = useState<any>(null);
  const [scriptOutput, setScriptOutput] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setBuildData(null);
    setScriptOutput(null);
    setShowPreview(false);

    const formData = new FormData();
    formData.append('savefile', file);

    try {
      const response = await fetch('/api/import-build', {
        method: 'POST',
        body: formData,
      });

      // An answer that is not ours (nginx error page) has no JSON body
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        trackImportUploaded('error', response.status);
        setError(data.error || `Failed to parse save file (error ${response.status})`);
        setUploading(false);
        return;
      }

      trackImportUploaded('success');
      // Extract buildData and output from response
      setBuildData(data.buildData || data);
      setScriptOutput(data.output || '');
      setShowPreview(true);
      setUploading(false);
    } catch (err) {
      trackImportUploaded('error', 'network');
      setError('Network error. Please try again.');
      setUploading(false);
    }
  };

  // Sent for every upload, whether a build is published afterwards or not. The
  // server also records each attempt (import_attempts), GA blockers included.
  const trackImportUploaded = (result: 'success' | 'error', errorStatus?: number | string) => {
    trackEvent('build_import_uploaded', { method: 'import_save', result, error_status: errorStatus, logged_in: !!user });
  };

  const handleBuildCreated = (newBuild: any) => {
    trackEvent('build_created', { method: 'import_save', game_version: newBuild?.game_version });
    invalidateBuildsCache();
    navigate('/');
  };

  const handleContinue = () => {
    setShowPreview(false);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // If showing preview of script output
  if (showPreview && scriptOutput) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>Extraction Results</h2>
            </div>

            <div className="card bg-dark border-secondary mb-4">
              <div className="card-body">
                <h5 className="card-title">
                  <i className="bi bi-terminal me-2"></i>
                  Script Output
                </h5>
                <pre className="bg-secondary text-white p-3 rounded" style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {scriptOutput}
                </pre>
              </div>
            </div>

            <div className="d-flex gap-3 justify-content-center">
              <button className="btn btn-primary btn-lg" onClick={handleContinue}>
                <i className="bi bi-arrow-right me-2"></i>
                Continue to Build Form
              </button>
              <button className="btn btn-secondary btn-lg" onClick={handleBackToHome}>
                <i className="bi bi-house me-2"></i>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If build data is loaded, show the form pre-filled
  if (buildData && !showPreview) {
    return (
      <div className="container mt-4">
        <div className="mb-4">
          <button className="btn btn-secondary" onClick={() => {
            setBuildData(null);
            setScriptOutput(null);
          }}>
            <i className="bi bi-arrow-left me-2"></i>
            Upload Different Save File
          </button>
        </div>
        <BuildForm initialData={buildData} onBuildCreated={handleBuildCreated} />
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Import from Save Game</h2>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/create')}>
              <i className="bi bi-arrow-left me-2"></i>
              Back
            </button>
          </div>

          <div className="card bg-dark border-secondary mb-4">
            <div className="card-body">
              <h5 className="card-title">
                <i className="bi bi-info-circle me-2"></i>
                How to find your save files
              </h5>
              <p className="card-text">
                Save files are located in your Stellaris save folder:
              </p>
              <p className="mb-2">
                <strong>Windows:</strong> <code>Documents\Paradox Interactive\Stellaris\save games\</code>
              </p>
              <div className="alert alert-warning mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                A save holds your empire <strong>as it is at that date</strong>, not as it was created.
                Civics, traits and ethics gained during the game (technologies, extra civic slots,
                genetic modification, ethics drift...) are imported too and can make the build invalid:
                remove the extra ones in the form before publishing.
              </div>
            </div>
          </div>

          <div className="card bg-dark border-secondary">
            <div className="card-body">
              <h5 className="card-title mb-4">Upload Save File (.sav)</h5>

              <div className="mb-4">
                <label htmlFor="savefile" className="form-label">
                  Select a .sav file (max 50MB)
                </label>
                <input
                  type="file"
                  className="form-control bg-secondary text-white border-secondary"
                  id="savefile"
                  accept=".sav"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>

              {uploading && (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Processing...</span>
                  </div>
                  <p className="mt-2">Extracting empire data from save file...</p>
                  <p className="text-muted small">This may take a few seconds</p>
                </div>
              )}

              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportSave;
