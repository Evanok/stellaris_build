import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuildForm } from '../BuildForm';

const ImportEmpireDesigns: React.FC = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empireList, setEmpireList] = useState<string[] | null>(null);
  const [selectedEmpire, setSelectedEmpire] = useState<string>('');
  const [buildData, setBuildData] = useState<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setEmpireList(null);
    setSelectedEmpire('');
    setBuildData(null);

    const formData = new FormData();
    formData.append('designsfile', file);

    try {
      const response = await fetch('/api/list-empires', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to parse empire designs file');
        setUploading(false);
        return;
      }

      setEmpireList(data.empires);
      setUploading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setUploading(false);
    }
  };

  const handleEmpireSelect = async (empireName: string) => {
    setSelectedEmpire(empireName);
    setError(null);

    // Send request to extract specific empire
    const fileInput = document.getElementById('designsfile') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('designsfile', file);
    formData.append('empireName', empireName);

    try {
      const response = await fetch('/api/import-empire-designs', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to extract empire data');
        return;
      }

      setBuildData(data);
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleBuildCreated = () => {
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
              <p className="mb-0">
                <strong>Windows:</strong> <code>Documents\Paradox Interactive\Stellaris\user_empire_designs_v3.4.txt</code>
              </p>
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
