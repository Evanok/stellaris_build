import React, { useState, useEffect } from 'react';

interface BuildFormProps {
  onBuildCreated: (newBuild: any) => void;
}

interface Trait {
  id: string;
  name: string;
  cost: number | string;
  effects: string;
  tags: any[];
  opposites: any[];
  category: string;
}

export const BuildForm: React.FC<BuildFormProps> = ({ onBuildCreated }) => {
  // Form fields state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [game_version, setGameVersion] = useState('');
  const [civics, setCivics] = useState('');
  const [dlcs, setDlcs] = useState('');
  const [tags, setTags] = useState('');
  const [speciesType, setSpeciesType] = useState<string>('BIOLOGICAL');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);

  // Trait data from API
  const [allTraits, setAllTraits] = useState<Trait[]>([]);
  const [traitSearchQuery, setTraitSearchQuery] = useState('');
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/traits')
      .then(res => res.json())
      .then(data => {
        // Filter and sanitize traits to prevent rendering errors
        const sanitizedTraits = data
          .map((trait: any) => ({
            ...trait,
            // Ensure all fields are safe to render
            tags: Array.isArray(trait.tags) ? trait.tags.filter((t: any) => typeof t === 'string') : [],
            opposites: Array.isArray(trait.opposites) ? trait.opposites.filter((o: any) => typeof o === 'string') : [],
            effects: typeof trait.effects === 'string' ? trait.effects : '',
            cost: typeof trait.cost === 'number' ? trait.cost : 0,
          }))
          // Only show traits that are selectable during empire creation (non-zero cost)
          .filter((trait: any) => typeof trait.cost === 'number' && trait.cost !== 0)
          // Sort by cost (positive traits first, then negative)
          .sort((a: any, b: any) => b.cost - a.cost);

        setAllTraits(sanitizedTraits);
      })
      .catch(() => setError('Could not load traits data.'));
  }, []);

  // Filter traits based on species type and search query
  const filteredTraits = allTraits.filter(trait => {
    // Filter by species archetype
    const archetypes = (trait as any).allowed_archetypes || [];
    if (archetypes.length > 0 && !archetypes.includes(speciesType)) {
      return false;
    }

    // Filter by search query
    if (traitSearchQuery) {
      const query = traitSearchQuery.toLowerCase();
      return (
        trait.id.toLowerCase().includes(query) ||
        trait.effects.toLowerCase().includes(query) ||
        trait.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return true;
  });

  const handleTraitChange = (traitId: string) => {
    setSelectedTraits(prev =>
      prev.includes(traitId)
        ? prev.filter(t => t !== traitId)
        : [...prev, traitId]
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

          <div className="mb-3">
            <label htmlFor="speciesType" className="form-label">Species Type</label>
            <select
              className="form-select bg-secondary text-white border-secondary"
              id="speciesType"
              value={speciesType}
              onChange={(e) => setSpeciesType(e.target.value)}
            >
              <option value="BIOLOGICAL">Biological</option>
              <option value="LITHOID">Lithoid</option>
              <option value="MACHINE">Machine</option>
              <option value="ROBOT">Robot</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">
              Traits ({selectedTraits.length} selected, {filteredTraits.length} shown of {allTraits.length} total)
            </label>
            <input
              type="text"
              className="form-control bg-secondary text-white border-secondary mb-2"
              placeholder="Search traits by name, effect, or tag..."
              value={traitSearchQuery}
              onChange={(e) => setTraitSearchQuery(e.target.value)}
            />
            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredTraits.length > 0 ? (
                  filteredTraits.map(trait => (
                  <div key={trait.id} className="form-check mb-2 pb-2 border-bottom border-dark">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`trait-${trait.id}`}
                      checked={selectedTraits.includes(trait.id)}
                      onChange={() => handleTraitChange(trait.id)}
                    />
                    <label className="form-check-label" htmlFor={`trait-${trait.id}`}>
                      <strong className="text-white">{trait.id}</strong>
                      <span className="badge bg-primary ms-2">Cost: {trait.cost}</span>
                      {trait.tags && trait.tags.length > 0 && (
                        <span className="ms-2">
                          {trait.tags.slice(0, 3).map((tag: string, idx: number) => (
                            <span key={idx} className="badge bg-secondary me-1">{tag}</span>
                          ))}
                        </span>
                      )}
                      <small className="d-block text-light mt-1">{trait.effects || 'No effects listed'}</small>
                    </label>
                  </div>
                  ))
                ) : (
                  <p className="text-center text-muted">No traits match your search.</p>
                )}
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
