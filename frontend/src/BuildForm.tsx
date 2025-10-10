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

// Stellaris 4.X rules
const MAX_TRAIT_POINTS = 2;
const MAX_TRAIT_COUNT = 5;

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

  // Calculate current trait points
  const calculateTraitPoints = (): number => {
    return selectedTraits.reduce((total, traitId) => {
      const trait = allTraits.find(t => t.id === traitId);
      if (trait && typeof trait.cost === 'number') {
        return total + trait.cost;
      }
      return total;
    }, 0);
  };

  const currentTraitPoints = calculateTraitPoints();

  // Check if a trait can be selected
  const canSelectTrait = (trait: Trait): boolean => {
    // Already selected
    if (selectedTraits.includes(trait.id)) {
      return true;
    }

    // Check max trait count
    if (selectedTraits.length >= MAX_TRAIT_COUNT) {
      return false;
    }

    // Check if selecting this trait would exceed max points
    const traitCost = typeof trait.cost === 'number' ? trait.cost : 0;
    if (currentTraitPoints + traitCost > MAX_TRAIT_POINTS) {
      return false;
    }

    // Check for opposite traits
    const opposites = trait.opposites || [];
    for (const opposite of opposites) {
      if (selectedTraits.includes(opposite)) {
        return false;
      }
    }

    return true;
  };

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
    const trait = allTraits.find(t => t.id === traitId);
    if (!trait) return;

    // If deselecting, always allow
    if (selectedTraits.includes(traitId)) {
      setSelectedTraits(prev => prev.filter(t => t !== traitId));
      return;
    }

    // If selecting, check if it's allowed
    if (canSelectTrait(trait)) {
      setSelectedTraits(prev => [...prev, traitId]);
    }
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
        // Try to get error message from response body
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to create build.');
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
              Traits ({selectedTraits.length}/{MAX_TRAIT_COUNT} traits, {currentTraitPoints}/{MAX_TRAIT_POINTS} points)
            </label>

            {/* Trait Points Display */}
            <div className="alert alert-info mb-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Trait Points:</strong> {currentTraitPoints} / {MAX_TRAIT_POINTS}
                  {currentTraitPoints > MAX_TRAIT_POINTS && (
                    <span className="text-danger ms-2">(Exceeds maximum!)</span>
                  )}
                </div>
                <div>
                  <strong>Traits:</strong> {selectedTraits.length} / {MAX_TRAIT_COUNT}
                </div>
              </div>
              <div className="progress mt-2" style={{ height: '20px' }}>
                <div
                  className={`progress-bar ${currentTraitPoints > MAX_TRAIT_POINTS ? 'bg-danger' : currentTraitPoints === MAX_TRAIT_POINTS ? 'bg-warning' : 'bg-success'}`}
                  role="progressbar"
                  style={{ width: `${Math.min((currentTraitPoints / MAX_TRAIT_POINTS) * 100, 100)}%` }}
                  aria-valuenow={currentTraitPoints}
                  aria-valuemin={-10}
                  aria-valuemax={MAX_TRAIT_POINTS}
                >
                  {currentTraitPoints} points
                </div>
              </div>
            </div>

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
                  filteredTraits.map(trait => {
                    const isSelected = selectedTraits.includes(trait.id);
                    const canSelect = canSelectTrait(trait);
                    const isDisabled = !isSelected && !canSelect;

                    return (
                      <div
                        key={trait.id}
                        className={`form-check mb-2 pb-2 border-bottom border-dark ${isDisabled ? 'opacity-50' : ''}`}
                        style={{ opacity: isDisabled ? 0.5 : 1 }}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`trait-${trait.id}`}
                          checked={isSelected}
                          onChange={() => handleTraitChange(trait.id)}
                          disabled={isDisabled}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`trait-${trait.id}`}
                          style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                        >
                          <strong className="text-white">{trait.id}</strong>
                          <span className={`badge ms-2 ${typeof trait.cost === 'number' && trait.cost > 0 ? 'bg-primary' : 'bg-danger'}`}>
                            Cost: {trait.cost}
                          </span>
                          {trait.tags && trait.tags.length > 0 && (
                            <span className="ms-2">
                              {trait.tags.slice(0, 3).map((tag: string, idx: number) => (
                                <span key={idx} className="badge bg-secondary me-1">{tag}</span>
                              ))}
                            </span>
                          )}
                          {isDisabled && !isSelected && (
                            <span className="badge bg-warning text-dark ms-2">Cannot select</span>
                          )}
                          <small className="d-block text-light mt-1">{trait.effects || 'No effects listed'}</small>
                        </label>
                      </div>
                    );
                  })
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
