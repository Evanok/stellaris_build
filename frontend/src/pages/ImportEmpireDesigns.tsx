import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuildForm } from '../BuildForm';
import { trackEvent } from '../utils/analytics';
import { useAuth } from '../AuthContext';

const DESIGNS_FILE = 'user_empire_designs_v3.4.txt';

// A web page cannot choose the folder the file picker opens in, but every OS
// picker accepts a full path typed or pasted into it. The Windows picker expands
// environment variables, so no need to know the user name.
const DESIGNS_FILE_PATHS = [
  {
    os: 'Windows',
    path: `%USERPROFILE%\\Documents\\Paradox Interactive\\Stellaris\\${DESIGNS_FILE}`,
    hint: 'In the file picker, paste it into the "File name" field at the bottom (not the address bar at the top) and press Enter.',
  },
  {
    os: 'macOS',
    path: `~/Documents/Paradox Interactive/Stellaris/${DESIGNS_FILE}`,
    hint: 'In the file picker, press Cmd+Shift+G, paste it and press Enter.',
  },
  {
    os: 'Linux',
    path: `~/.local/share/Paradox Interactive/Stellaris/${DESIGNS_FILE}`,
    hint: 'In the file picker, press Ctrl+L, paste it and press Enter.',
  },
];

const ImportEmpireDesigns: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copiedOs, setCopiedOs] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empireList, setEmpireList] = useState<string[] | null>(null);
  const [selectedEmpire, setSelectedEmpire] = useState<string>('');
  const [buildData, setBuildData] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setEmpireList(null);
    setSelectedEmpire('');
    setBuildData(null);
    setUploadedFile(file); // Store the file in state

    const formData = new FormData();
    formData.append('designsfile', file);

    try {
      const response = await fetch('/api/list-empires', {
        method: 'POST',
        body: formData,
      });

      // An answer that is not ours (nginx error page) has no JSON body
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        trackImportStep('build_import_uploaded', 'error', { error_status: response.status });
        setError(data.error || `Failed to parse empire designs file (error ${response.status})`);
        setUploading(false);
        return;
      }

      trackImportStep('build_import_uploaded', 'success', { empire_count: data.empires?.length ?? 0 });
      setEmpireList(data.empires);
      setUploading(false);
    } catch (err) {
      trackImportStep('build_import_uploaded', 'error', { error_status: 'network' });
      setError('Network error. Please try again.');
      setUploading(false);
    }
  };

  // Sent for every upload / empire pick, whether a build is published afterwards or
  // not. The server also records each attempt (import_attempts), GA blockers included.
  const trackImportStep = (
    event: 'build_import_uploaded' | 'build_import_empire_selected',
    result: 'success' | 'error',
    params: Record<string, string | number> = {}
  ) => {
    trackEvent(event, { method: 'import_designs', result, logged_in: !!user, ...params });
  };

  const handleCopyPath = async (os: string, path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedOs(os);
      setTimeout(() => setCopiedOs(current => (current === os ? null : current)), 2000);
    } catch {
      // Clipboard unavailable (permission denied, insecure context): the path stays visible to copy by hand
    }
  };

  const handleEmpireSelect = async (empireName: string) => {
    setSelectedEmpire(empireName);
    setError(null);

    // Use the stored file instead of retrieving from DOM
    if (!uploadedFile) {
      setError('File not found. Please upload the file again.');
      return;
    }

    const formData = new FormData();
    formData.append('designsfile', uploadedFile);
    formData.append('empireName', empireName);

    try {
      const response = await fetch('/api/import-empire-designs', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        trackImportStep('build_import_empire_selected', 'error', { error_status: response.status });
        setError(data.error || `Failed to extract empire data (error ${response.status})`);
        return;
      }

      trackImportStep('build_import_empire_selected', 'success');
      setBuildData(data);
    } catch (err) {
      trackImportStep('build_import_empire_selected', 'error', { error_status: 'network' });
      setError('Network error. Please try again.');
    }
  };

  const handleBuildCreated = (newBuild: any) => {
    trackEvent('build_created', { method: 'import_designs', game_version: newBuild?.game_version });
    navigate('/');
  };

  // If build data is loaded, show the form pre-filled
  if (buildData) {
    return (
      <div className="container mt-4">
        <div className="mb-4">
          <button className="btn btn-secondary" onClick={() => {
            setBuildData(null);
            setSelectedEmpire('');
          }}>
            <i className="bi bi-arrow-left me-2"></i>
            Back to Empire Selection
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
            <h2>Import from Empire Designs</h2>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/create')}>
              <i className="bi bi-arrow-left me-2"></i>
              Back
            </button>
          </div>

          <div className="card bg-dark border-secondary mb-4">
            <div className="card-body">
              <h5 className="card-title">
                <i className="bi bi-info-circle me-2"></i>
                How to find your empire designs file
              </h5>
              <p className="card-text">
                The empire designs file contains all your custom-created empires from Stellaris.
              </p>
              <p className="card-text">
                Copy the path for your system, then paste it into the file picker to open the file directly.
              </p>
              {DESIGNS_FILE_PATHS.map(({ os, path, hint }, index) => (
                <div key={os} className={index < DESIGNS_FILE_PATHS.length - 1 ? 'mb-3' : ''}>
                  <strong>{os}:</strong>
                  <div className="input-group input-group-sm mt-1">
                    <input
                      type="text"
                      className="form-control bg-secondary text-white border-secondary font-monospace"
                      value={path}
                      readOnly
                      onFocus={e => e.target.select()}
                      aria-label={`${os} path`}
                    />
                    <button
                      type="button"
                      className={`btn ${copiedOs === os ? 'btn-success' : 'btn-outline-light'}`}
                      onClick={() => handleCopyPath(os, path)}
                    >
                      <i className={`bi ${copiedOs === os ? 'bi-check-lg' : 'bi-clipboard'} me-1`}></i>
                      {copiedOs === os ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="form-text text-light opacity-75">{hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card bg-dark border-secondary">
            <div className="card-body">
              <h5 className="card-title mb-4">Upload Empire Designs File</h5>

              <div className="mb-4">
                <label htmlFor="designsfile" className="form-label">
                  Select user_empire_designs_v3.4.txt file
                </label>
                <input
                  type="file"
                  className="form-control bg-secondary text-white border-secondary"
                  id="designsfile"
                  accept=".txt"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>

              {uploading && (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Processing...</span>
                  </div>
                  <p className="mt-2">Reading empire designs file...</p>
                </div>
              )}

              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}

              {empireList && empireList.length > 0 && (
                <div>
                  <h6 className="mb-3">
                    Found {empireList.length} empire{empireList.length > 1 ? 's' : ''} - Select one:
                  </h6>
                  <div className="list-group">
                    {empireList.map((empireName, index) => (
                      <button
                        key={index}
                        className={`list-group-item list-group-item-action bg-secondary text-white ${selectedEmpire === empireName ? 'active' : ''}`}
                        onClick={() => handleEmpireSelect(empireName)}
                      >
                        <i className="bi bi-flag me-2"></i>
                        {empireName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {empireList && empireList.length === 0 && (
                <div className="alert alert-warning" role="alert">
                  <i className="bi bi-exclamation-circle me-2"></i>
                  No empires found in the uploaded file.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportEmpireDesigns;
