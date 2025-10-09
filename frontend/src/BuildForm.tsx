import React, { useState, useEffect } from 'react';

interface BuildFormProps {
  onBuildCreated: (newBuild: any) => void;
}

interface Trait {
  name: string;
  point_cost: string;
  effects: string;
}

export const BuildForm: React.FC<BuildFormProps> = ({ onBuildCreated }) => {
  // Form fields state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [game_version, setGameVersion] = useState('');
  const [civics, setCivics] = useState('');
  const [dlcs, setDlcs] = useState('');
  const [tags, setTags] = useState('');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);

  // Trait data from API
  const [allTraits, setAllTraits] = useState<Trait[]>([]);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/traits')
      .then(res => res.json())
      .then(data => setAllTraits(data))
      .catch(() => setError('Could not load traits data.'));
  }, []);

  const handleTraitChange = (traitName: string) => {
    setSelectedTraits(prev => 
      prev.includes(traitName) 
        ? prev.filter(t => t !== traitName) 
        : [...prev, traitName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/builds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name, 
          description, 
          game_version, 
          civics, 
          dlcs, 
          tags, 
          traits: selectedTraits.join(', ') // Convert array to comma-separated string
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create build.');
      }

      const data = await response.json();
      onBuildCreated(data.build);
      
      // Reset form
      setName('');
      setDescription('');
      setGameVersion('');
      setCivics('');
      setDlcs('');
      setTags('');
      setSelectedTraits([]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card bg-dark border-secondary mb-4">
      <div className="card-body">
        <h3 className="card-title">Create a New Build</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}
          
          {/* ... other fields ... */}
          <div className="mb-3">
            <label htmlFor="buildName" className="form-label">Build Name</label>
            <input type="text" className="form-control bg-secondary text-white border-secondary" id="buildName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label htmlFor="buildDescription" className="form-label">Description</label>
            <textarea className="form-control bg-secondary text-white border-secondary" id="buildDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>
          {/* ... other fields ... */}

          <div className="mb-3">
            <label className="form-label">Traits</label>
            <div className="card" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <div className="card-body">
                {allTraits.map(trait => (
                  <div key={trait.name} className="form-check">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id={`trait-${trait.name}`}
                      checked={selectedTraits.includes(trait.name)}
                      onChange={() => handleTraitChange(trait.name)}
                    />
                    <label className="form-check-label" htmlFor={`trait-${trait.name}`}>
                      <strong>{trait.name}</strong> (Cost: {trait.point_cost})
                      <small className="d-block text-muted">{trait.effects}</small>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ... other fields like civics, dlcs etc. as text for now ... */}
          <div className="mb-3">
            <label htmlFor="civics" className="form-label">Civics (comma-separated)</label>
            <input type="text" className="form-control bg-secondary text-white border-secondary" id="civics" value={civics} onChange={(e) => setCivics(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Build'}
          </button>
        </form>
      </div>
    </div>
  );
};
