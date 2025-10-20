import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { AuthModal } from './components/AuthModal';

interface BuildFormProps {
  onBuildCreated: (newBuild: any) => void;
  initialData?: any; // Optional pre-filled data from imports
}

// Icon component for game elements
const GameIcon: React.FC<{ type: string; id: string; size?: number }> = ({ type, id, size = 32 }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null; // Don't show anything if icon fails to load
  }

  return (
    <img
      src={`/icons/${type}/${id}.png`}
      alt=""
      width={size}
      height={size}
      style={{ marginRight: '8px', verticalAlign: 'middle' }}
      onError={() => setHasError(true)}
    />
  );
};

// Origin display card with large image
const OriginCard: React.FC<{ originId: string; origin: Origin | undefined }> = ({ originId, origin }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="card bg-dark border-primary mb-2">
      <div className="row g-0">
        {!imageError && (
          <div className="col-md-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: '#1a1a1a' }}>
            <img
              src={`/icons/origin_images/${originId}.png`}
              alt={origin?.name || originId}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '300px',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onError={() => setImageError(true)}
            />
          </div>
        )}
        <div className={imageError ? 'col-md-12' : 'col-md-8'}>
          <div className="card-body">
            <div className="d-flex align-items-center mb-2">
              <GameIcon type="origins" id={originId} size={48} />
              <h5 className="card-title text-primary mb-0 ms-2">
                {origin?.name || originId}
              </h5>
            </div>
            <p className="card-text text-light">
              {origin?.description}
            </p>
            {origin?.effects && (
              <p className="card-text">
                <small className="text-info">
                  <strong>Effects:</strong> {origin.effects}
                </small>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface Trait {
  id: string;
  name: string;
  description: string;
  cost: number | string;
  effects: string;
  tags: any[];
  opposites: any[];
  category: string;
}

interface Origin {
  id: string;
  name: string;
  description: string;
  effects: string;
  potential: any[]; // Conditions that filter visibility (e.g., species_archetype)
  possible: any[];
  playable_conditions?: string;
  is_origin: boolean;
  pickable_at_start: boolean;
  modifier?: {
    [key: string]: number;
  };
}

interface AscensionPerk {
  id: string;
  name: string;
  description: string;
  effects: string;
  modifier?: {
    [key: string]: number;
  };
  potential?: any;
  possible?: any;
  is_path_perk: boolean;
}

interface Ethic {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  category_value: number;
  fanatic_variant: string;
  regular_variant: string;
  effects: string;
  tags: string[];
  modifier?: {
    [key: string]: number;
  };
}

interface Authority {
  id: string;
  name: string;
  description: string;
  effects: string;
  election_term_years?: number;
  election_type?: string;
  has_agendas?: boolean;
  tags: string[];
  required_ethics: string[];
  blocked_ethics: string[];
  required_dlc?: string;
}

interface Civic {
  id: string;
  name: string;
  is_origin: boolean;
  playable: boolean;
  pickable_at_start: boolean;
  description: string;
  potential: any[]; // Conditions that filter visibility
  possible: any[]; // Requirements that must be met
  effects: string;
  modifier?: {
    [key: string]: number;
  };
  can_modify: boolean;
}

interface TraditionTree {
  name: string;
  adopt: any;
  finish: any;
  traditions: any[];
}

interface RulerTrait {
  id: string;
  name: string;
  description: string;
  cost: number;
  leader_class: string[];
  effects: string;
  councilor_modifier?: {
    [key: string]: number;
  };
  forbidden_origins: string[];
  allowed_ethics: string[];
  icon?: string;
}

// Stellaris 4.X base rules (can be modified by origins)
const BASE_MAX_TRAIT_POINTS = 2;
const BASE_MAX_TRAIT_COUNT = 5;
const MAX_ETHICS_POINTS = 3;
const MAX_CIVIC_SLOTS = 3;

// Stellaris game versions
const GAME_VERSIONS = [
  { value: '4.1', label: '4.1 "Lyra" (Latest)' },
  { value: '4.0', label: '4.0 "Phoenix"' },
  { value: '3.14', label: '3.14 "Circinus"' },
  { value: '3.13', label: '3.13 "Vela"' },
  { value: 'other', label: 'Other (specify in description)' },
];

// Origins that require a secondary species
const ORIGINS_WITH_SECONDARY_SPECIES = [
  'origin_necrophage',
  'origin_syncretic_evolution',
  'origin_clone_army',
  'origin_overtuned',
];

export const BuildForm: React.FC<BuildFormProps> = ({ onBuildCreated, initialData }) => {
  // Form fields state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [game_version, setGameVersion] = useState('4.1');
  const [youtube_url, setYoutubeUrl] = useState('');
  const [source_url, setSourceUrl] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [dlcs, setDlcs] = useState('');
  const [tags, setTags] = useState('');
  const [speciesType, setSpeciesType] = useState<string>('BIOLOGICAL');
  const [secondarySpeciesType, setSecondarySpeciesType] = useState<string>('BIOLOGICAL');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedSecondaryTraits, setSelectedSecondaryTraits] = useState<string[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<string>('');

  // Trait data from API
  const [allTraits, setAllTraits] = useState<Trait[]>([]);
  const [traitSearchQuery, setTraitSearchQuery] = useState('');

  // Origin data from API
  const [allOrigins, setAllOrigins] = useState<Origin[]>([]);
  const [originSearchQuery, setOriginSearchQuery] = useState('');

  // Ascension perk data from API
  const [allAscensionPerks, setAllAscensionPerks] = useState<AscensionPerk[]>([]);
  const [selectedAscensionPerks, setSelectedAscensionPerks] = useState<string[]>([]);
  const [ascensionPerkSearchQuery, setAscensionPerkSearchQuery] = useState('');

  // Ethics data from API
  const [allEthics, setAllEthics] = useState<Ethic[]>([]);
  const [selectedEthics, setSelectedEthics] = useState<string[]>([]);
  const [ethicsSearchQuery, setEthicsSearchQuery] = useState('');

  // Authority data from API
  const [allAuthorities, setAllAuthorities] = useState<Authority[]>([]);
  const [selectedAuthority, setSelectedAuthority] = useState<string>('');

  // Civics data from API
  const [allCivics, setAllCivics] = useState<Civic[]>([]);
  const [selectedCivics, setSelectedCivics] = useState<string[]>([]);
  const [civicsSearchQuery, setCivicsSearchQuery] = useState('');

  // Traditions data from API
  const [allTraditionTrees, setAllTraditionTrees] = useState<TraditionTree[]>([]);
  const [selectedTraditions, setSelectedTraditions] = useState<string[]>([]);
  const [traditionsSearchQuery, setTraditionsSearchQuery] = useState('');

  // Ruler traits data from API
  const [allRulerTraits, setAllRulerTraits] = useState<RulerTrait[]>([]);
  const [selectedRulerTrait, setSelectedRulerTrait] = useState<string>('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auth state
  const { user, refreshUser } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Load traits
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
            description: typeof trait.description === 'string' ? trait.description : '',
            cost: typeof trait.cost === 'number' ? trait.cost : 0,
          }))
          // Only show traits that are selectable during empire creation (non-zero cost)
          .filter((trait: any) => typeof trait.cost === 'number' && trait.cost !== 0)
          // Sort by cost (positive traits first, then negative)
          .sort((a: any, b: any) => b.cost - a.cost);

        setAllTraits(sanitizedTraits);
      })
      .catch(() => setError('Could not load traits data.'));

    // Load origins
    fetch('/api/origins')
      .then(res => res.json())
      .then(data => {
        // Extract origins array from response
        const originsArray = Array.isArray(data) ? data : (data.origins || []);

        // Filter and sanitize origins
        const sanitizedOrigins = originsArray
          .filter((origin: any) => origin.pickable_at_start && origin.is_origin)
          .map((origin: any) => ({
            ...origin,
            effects: typeof origin.effects === 'string' ? origin.effects : '',
            description: typeof origin.description === 'string' ? origin.description : '',
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));

        setAllOrigins(sanitizedOrigins);
      })
      .catch(() => setError('Could not load origins data.'));

    // Load ascension perks
    fetch('/api/ascension-perks')
      .then(res => res.json())
      .then(data => {
        // Get the 'all' array from the data
        const perksArray = Array.isArray(data) ? data : (data.all || []);

        // Filter and sanitize ascension perks
        const sanitizedPerks = perksArray
          .filter((perk: any) => perk.type === 'ascension_perk')
          .map((perk: any) => ({
            ...perk,
            effects: typeof perk.effects === 'string' ? perk.effects : '',
            description: typeof perk.description === 'string' ? perk.description : '',
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));

        setAllAscensionPerks(sanitizedPerks);
      })
      .catch(() => setError('Could not load ascension perks data.'));

    // Load ethics
    fetch('/api/ethics')
      .then(res => res.json())
      .then(data => {
        // Filter and sanitize ethics
        const sanitizedEthics = data
          .map((ethic: any) => ({
            ...ethic,
            effects: typeof ethic.effects === 'string' ? ethic.effects : '',
            description: typeof ethic.description === 'string' ? ethic.description : '',
            tags: Array.isArray(ethic.tags) ? ethic.tags : [],
            cost: typeof ethic.cost === 'number' ? ethic.cost : 1,
          }))
          .sort((a: any, b: any) => {
            // Sort by cost (descending) then by id
            if (b.cost !== a.cost) return b.cost - a.cost;
            return a.id.localeCompare(b.id);
          });

        setAllEthics(sanitizedEthics);
      })
      .catch(() => setError('Could not load ethics data.'));

    // Load authorities
    fetch('/api/authorities')
      .then(res => res.json())
      .then(data => {
        // Filter and sanitize authorities
        const sanitizedAuthorities = data
          .map((auth: any) => ({
            ...auth,
            description: typeof auth.description === 'string' ? auth.description : '',
            effects: typeof auth.effects === 'string' ? auth.effects : '',
            tags: Array.isArray(auth.tags) ? auth.tags : [],
            required_ethics: Array.isArray(auth.required_ethics) ? auth.required_ethics : [],
            blocked_ethics: Array.isArray(auth.blocked_ethics) ? auth.blocked_ethics : [],
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));

        setAllAuthorities(sanitizedAuthorities);
      })
      .catch(() => setError('Could not load authorities data.'));

    // Load civics
    fetch('/api/civics')
      .then(res => res.json())
      .then(data => {
        // Extract civics array from response
        const civicsArray = Array.isArray(data) ? data : (data.civics || []);

        // Filter and sanitize civics
        const sanitizedCivics = civicsArray
          .filter((civic: any) => civic.pickable_at_start && !civic.is_origin)
          .map((civic: any) => ({
            ...civic,
            description: typeof civic.description === 'string' ? civic.description : '',
            effects: typeof civic.effects === 'string' ? civic.effects : '',
            potential: Array.isArray(civic.potential) ? civic.potential : [],
            possible: Array.isArray(civic.possible) ? civic.possible : [],
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));

        setAllCivics(sanitizedCivics);
      })
      .catch(() => setError('Could not load civics data.'));

    // Load traditions
    fetch('/api/traditions')
      .then(res => res.json())
      .then(data => {
        // Extract tradition trees - only include trees with valid adopt data
        const trees: TraditionTree[] = [];
        for (const key in data) {
          // Only include trees that have an adopt field (skip duplicates without adopt)
          if (data[key].adopt && data[key].adopt.name) {
            trees.push({
              name: key,
              adopt: data[key].adopt,
              finish: data[key].finish,
              traditions: data[key].traditions || []
            });
          }
        }

        // Sort alphabetically by adopt name
        trees.sort((a, b) => {
          const nameA = a.adopt?.name || a.name;
          const nameB = b.adopt?.name || b.name;
          return nameA.localeCompare(nameB);
        });
        setAllTraditionTrees(trees);
      })
      .catch(() => setError('Could not load traditions data.'));

    // Load ruler traits
    fetch('/api/ruler-traits')
      .then(res => res.json())
      .then(data => {
        // Filter and sanitize ruler traits
        const sanitizedTraits = data
          .map((trait: any) => ({
            ...trait,
            effects: typeof trait.effects === 'string' ? trait.effects : '',
            description: typeof trait.description === 'string' ? trait.description : '',
            leader_class: Array.isArray(trait.leader_class) ? trait.leader_class : [],
            forbidden_origins: Array.isArray(trait.forbidden_origins) ? trait.forbidden_origins : [],
            allowed_ethics: Array.isArray(trait.allowed_ethics) ? trait.allowed_ethics : [],
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));

        setAllRulerTraits(sanitizedTraits);
      })
      .catch(() => setError('Could not load ruler traits data.'));
  }, []);

  // Populate form with initialData (from imports)
  useEffect(() => {
    if (initialData) {
      // Set basic fields
      if (initialData.name) setName(initialData.name);
      if (initialData.description) setDescription(initialData.description);
      if (initialData.game_version) setGameVersion(initialData.game_version);

      // Set empire selections
      if (initialData.origin) setSelectedOrigin(initialData.origin);
      if (initialData.authority) setSelectedAuthority(initialData.authority);

      // Handle ethics (array of strings)
      if (Array.isArray(initialData.ethics)) {
        setSelectedEthics(initialData.ethics);
      }

      // Handle civics (array of strings)
      if (Array.isArray(initialData.civics)) {
        setSelectedCivics(initialData.civics);
      }

      // Handle traits (array of strings)
      if (Array.isArray(initialData.traits)) {
        setSelectedTraits(initialData.traits);
      }

      // Handle species type (string: BIOLOGICAL, LITHOID, MACHINE, ROBOT)
      if (initialData.speciesType) {
        setSpeciesType(initialData.speciesType);
      }

      // Handle ruler trait (single string)
      if (initialData.ruler_trait) {
        setSelectedRulerTrait(initialData.ruler_trait);
      }

      // Handle ascension perks (array of strings)
      if (Array.isArray(initialData.ascension_perks)) {
        setSelectedAscensionPerks(initialData.ascension_perks);
      }

      // Handle traditions (array of strings)
      if (Array.isArray(initialData.traditions)) {
        setSelectedTraditions(initialData.traditions);
      }
    }
  }, [initialData]);

  // Validate authority when ethics change
  // No longer auto-clearing authority based on ethics - let user choose freely

  // Get origin bonuses for current species type
  const getOriginTraitBonuses = () => {
    if (!selectedOrigin) {
      return { pointsBonus: 0, picksBonus: 0 };
    }

    const origin = allOrigins.find(o => o.id === selectedOrigin);
    if (!origin || !origin.modifier) {
      return { pointsBonus: 0, picksBonus: 0 };
    }

    const modifier = origin.modifier;
    const speciesPrefix = speciesType; // BIOLOGICAL, LITHOID, MACHINE, ROBOT

    // Check for species-specific bonuses
    const pointsKey = `${speciesPrefix}_species_trait_points_add`;
    const picksKey = `${speciesPrefix}_species_trait_picks_add`;

    return {
      pointsBonus: modifier[pointsKey] || 0,
      picksBonus: modifier[picksKey] || 0
    };
  };

  const { pointsBonus, picksBonus } = getOriginTraitBonuses();
  const MAX_TRAIT_POINTS = BASE_MAX_TRAIT_POINTS + pointsBonus;
  const MAX_TRAIT_COUNT = BASE_MAX_TRAIT_COUNT + picksBonus;

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

  // Check if current selection exceeds limits
  const exceedsTraitCount = selectedTraits.length > MAX_TRAIT_COUNT;
  const exceedsTraitPoints = currentTraitPoints > MAX_TRAIT_POINTS;
  const hasInvalidTraits = exceedsTraitCount || exceedsTraitPoints;

  // Calculate current ethics points
  const calculateEthicsPoints = (): number => {
    return selectedEthics.reduce((total, ethicId) => {
      const ethic = allEthics.find(e => e.id === ethicId);
      if (ethic) {
        return total + ethic.cost;
      }
      return total;
    }, 0);
  };

  const currentEthicsPoints = calculateEthicsPoints();
  const exceedsEthicsPoints = currentEthicsPoints > MAX_ETHICS_POINTS;

  // Check if a civic can be selected based on current selections
  const canSelectCivic = (civic: Civic): boolean => {
    // Already selected
    if (selectedCivics.includes(civic.id)) {
      return true;
    }

    // Only check if at max slots - no complex compatibility rules
    if (selectedCivics.length >= MAX_CIVIC_SLOTS) {
      return false;
    }

    return true;
  };

  // All civics are available - no filtering based on compatibility
  const availableCivics = allCivics;

  // All authorities are available - no filtering based on ethics
  const availableAuthorities = allAuthorities;

  // Check if an ethic can be selected
  const canSelectEthic = (ethic: Ethic): boolean => {
    // Already selected
    if (selectedEthics.includes(ethic.id)) {
      return true;
    }

    // Only check if selecting this ethic would exceed max points
    if (currentEthicsPoints + ethic.cost > MAX_ETHICS_POINTS) {
      return false;
    }

    return true;
  };

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

    return true;
  };

  // Filter traits only by search query - no species archetype restrictions
  const filteredTraits = allTraits.filter(trait => {
    // Filter by search query
    if (traitSearchQuery) {
      const query = traitSearchQuery.toLowerCase();
      return (
        trait.name.toLowerCase().includes(query) ||
        trait.id.toLowerCase().includes(query) ||
        trait.effects.toLowerCase().includes(query) ||
        trait.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Filter secondary species traits only by search query
  const filteredSecondaryTraits = allTraits.filter(trait => {
    // Filter by search query
    if (traitSearchQuery) {
      const query = traitSearchQuery.toLowerCase();
      return (
        trait.name.toLowerCase().includes(query) ||
        trait.id.toLowerCase().includes(query) ||
        trait.effects.toLowerCase().includes(query) ||
        trait.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Filter origins only by search query - no species archetype restrictions
  const filteredOrigins = allOrigins.filter(origin => {
    // Filter by search query
    if (originSearchQuery) {
      const query = originSearchQuery.toLowerCase();
      return (
        origin.id.toLowerCase().includes(query) ||
        origin.description.toLowerCase().includes(query) ||
        origin.effects.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter ascension perks based on search query
  const filteredAscensionPerks = allAscensionPerks.filter(perk => {
    if (ascensionPerkSearchQuery) {
      const query = ascensionPerkSearchQuery.toLowerCase();
      return (
        perk.id.toLowerCase().includes(query) ||
        perk.effects.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter ethics based on search query
  const filteredEthics = allEthics.filter(ethic => {
    if (ethicsSearchQuery) {
      const query = ethicsSearchQuery.toLowerCase();
      return (
        ethic.id.toLowerCase().includes(query) ||
        ethic.effects.toLowerCase().includes(query) ||
        ethic.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Filter civics based on search query
  const filteredCivics = availableCivics.filter(civic => {
    if (civicsSearchQuery) {
      const query = civicsSearchQuery.toLowerCase();
      return (
        civic.id.toLowerCase().includes(query) ||
        civic.effects.toLowerCase().includes(query) ||
        civic.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter tradition trees based on search query
  const filteredTraditionTrees = allTraditionTrees.filter(tree => {
    if (traditionsSearchQuery) {
      const query = traditionsSearchQuery.toLowerCase();
      return tree.name.toLowerCase().includes(query);
    }
    return true;
  });

  // Filter ruler traits based on origin and ethics
  const filteredRulerTraits = allRulerTraits.filter(trait => {
    // Check forbidden origins
    if (selectedOrigin && trait.forbidden_origins.includes(selectedOrigin)) {
      return false;
    }

    // Check allowed ethics (for gestalt-only traits)
    if (trait.allowed_ethics.length > 0) {
      // If trait has allowed_ethics, at least one must be selected
      const hasAllowedEthic = trait.allowed_ethics.some(ethic =>
        selectedEthics.includes(ethic)
      );
      if (!hasAllowedEthic) {
        return false;
      }
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

  const handleEthicsChange = (ethicId: string) => {
    const ethic = allEthics.find(e => e.id === ethicId);
    if (!ethic) return;

    // If deselecting, always allow
    if (selectedEthics.includes(ethicId)) {
      setSelectedEthics(prev => prev.filter(e => e !== ethicId));
      return;
    }

    // If selecting, check if it's allowed
    if (canSelectEthic(ethic)) {
      setSelectedEthics(prev => [...prev, ethicId]);
    }
  };

  const handleCivicChange = (civicId: string) => {
    const civic = allCivics.find(c => c.id === civicId);
    if (!civic) return;

    // If deselecting, always allow
    if (selectedCivics.includes(civicId)) {
      setSelectedCivics(prev => prev.filter(c => c !== civicId));
      return;
    }

    // If selecting, check if it's allowed
    if (canSelectCivic(civic)) {
      setSelectedCivics(prev => [...prev, civicId]);
    }
  };

  const handleAscensionPerkChange = (perkId: string) => {
    setSelectedAscensionPerks(prev => {
      if (prev.includes(perkId)) {
        // Remove perk (order numbers will shift automatically)
        return prev.filter(p => p !== perkId);
      } else {
        // Add perk at the end (gets next order number)
        return [...prev, perkId];
      }
    });
  };

  const handleTraditionChange = (treeId: string) => {
    setSelectedTraditions(prev => {
      if (prev.includes(treeId)) {
        // Remove tradition tree (order numbers will shift automatically)
        return prev.filter(t => t !== treeId);
      } else {
        // Add tradition tree at the end (gets next order number)
        return [...prev, treeId];
      }
    });
  };

  // Get the order number of a selected perk (1-indexed)
  const getPerkOrder = (perkId: string): number | null => {
    const index = selectedAscensionPerks.indexOf(perkId);
    return index >= 0 ? index + 1 : null;
  };

  // Get the order number of a selected tradition tree (1-indexed)
  const getTraditionOrder = (treeId: string): number | null => {
    const index = selectedTraditions.indexOf(treeId);
    return index >= 0 ? index + 1 : null;
  };

  // Validation function to check if build is complete
  const isBuildComplete = (): boolean => {
    return (
      name.trim() !== '' &&
      selectedTraits.length > 0 &&
      selectedOrigin !== '' &&
      selectedEthics.length > 0 &&
      selectedAuthority !== '' &&
      selectedCivics.length > 0
    );
  };

  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (name.trim() === '') missing.push('Build Name');
    if (selectedTraits.length === 0) missing.push('Species Traits');
    if (selectedOrigin === '') missing.push('Origin');
    if (selectedEthics.length === 0) missing.push('Ethics');
    if (selectedAuthority === '') missing.push('Authority');
    if (selectedCivics.length === 0) missing.push('Civics');
    return missing;
  };

  // Save form data to localStorage
  const saveFormDataToLocalStorage = () => {
    const formData = {
      name,
      description,
      game_version,
      youtube_url,
      source_url,
      difficulty,
      dlcs,
      tags,
      speciesType,
      secondarySpeciesType,
      selectedTraits,
      selectedSecondaryTraits,
      selectedOrigin,
      selectedEthics,
      selectedAuthority,
      selectedCivics,
      selectedAscensionPerks,
      selectedTraditions,
      selectedRulerTrait,
    };
    localStorage.setItem('stellaris_build_draft', JSON.stringify(formData));
  };

  // Restore form data from localStorage
  const restoreFormDataFromLocalStorage = () => {
    const savedData = localStorage.getItem('stellaris_build_draft');
    if (savedData) {
      try {
        const formData = JSON.parse(savedData);
        setName(formData.name || '');
        setDescription(formData.description || '');
        setGameVersion(formData.game_version || '4.1');
        setYoutubeUrl(formData.youtube_url || '');
        setSourceUrl(formData.source_url || '');
        setDifficulty(formData.difficulty || '');
        setDlcs(formData.dlcs || '');
        setTags(formData.tags || '');
        setSpeciesType(formData.speciesType || 'BIOLOGICAL');
        setSecondarySpeciesType(formData.secondarySpeciesType || 'BIOLOGICAL');
        setSelectedTraits(formData.selectedTraits || []);
        setSelectedSecondaryTraits(formData.selectedSecondaryTraits || []);
        setSelectedOrigin(formData.selectedOrigin || '');
        setSelectedEthics(formData.selectedEthics || []);
        setSelectedAuthority(formData.selectedAuthority || '');
        setSelectedCivics(formData.selectedCivics || []);
        setSelectedAscensionPerks(formData.selectedAscensionPerks || []);
        setSelectedTraditions(formData.selectedTraditions || []);
        setSelectedRulerTrait(formData.selectedRulerTrait || '');
        // Clear localStorage after restoring
        localStorage.removeItem('stellaris_build_draft');
      } catch (error) {
        console.error('Failed to restore form data:', error);
      }
    }
  };

  // Handle successful authentication
  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    // Refresh user data
    await refreshUser();
    // Restore form data
    restoreFormDataFromLocalStorage();
    // Automatically submit the form
    setTimeout(() => {
      document.getElementById('build-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check if user is authenticated
    if (!user) {
      // Save form data to localStorage before showing auth modal
      saveFormDataToLocalStorage();
      setShowAuthModal(true);
      return;
    }

    // Check if build is complete
    if (!isBuildComplete()) {
      const missing = getMissingFields();
      setError(`Please complete the following required fields: ${missing.join(', ')}`);
      return;
    }

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
          youtube_url,
          source_url,
          difficulty,
          civics: selectedCivics.join(', '), // Convert array to comma-separated string
          dlcs,
          tags,
          traits: selectedTraits.join(', '), // Convert array to comma-separated string
          secondary_traits: selectedSecondaryTraits.join(', '), // Convert array to comma-separated string
          origin: selectedOrigin,
          ethics: selectedEthics.join(', '), // Convert array to comma-separated string
          authority: selectedAuthority,
          ascension_perks: selectedAscensionPerks.join(', '), // Convert array to comma-separated string
          traditions: selectedTraditions.join(', '), // Convert array to comma-separated string
          ruler_trait: selectedRulerTrait
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
      setGameVersion('4.1'); // Reset to latest version
      setYoutubeUrl('');
      setSourceUrl('');
      setDifficulty('');
      setDlcs('');
      setTags('');
      setSelectedTraits([]);
      setSelectedSecondaryTraits([]);
      setSelectedOrigin('');
      setSelectedEthics([]);
      setSelectedAuthority('');
      setSelectedCivics([]);
      setSelectedAscensionPerks([]);
      setSelectedTraditions([]);
      setSelectedRulerTrait('');

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
        <form id="build-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}

          {/* Manual entry section */}
          <div className="mb-3">
            <label htmlFor="buildName" className="form-label">Build Name</label>
            <input type="text" className="form-control bg-secondary text-white border-secondary" id="buildName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label htmlFor="buildDescription" className="form-label">Description</label>
            <textarea className="form-control bg-secondary text-white border-secondary" id="buildDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>

          <div className="mb-3">
            <label htmlFor="youtubeUrl" className="form-label">
              YouTube Video URL (Optional)
              <small className="text-muted d-block">Link to a YouTube video presenting this build</small>
            </label>
            <input
              type="url"
              className="form-control bg-secondary text-white border-secondary"
              id="youtubeUrl"
              value={youtube_url}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div className="mb-3">
            <label htmlFor="sourceUrl" className="form-label">
              Source URL (Optional)
              <small className="text-muted d-block">Original source of this build (Reddit post, forum thread, etc.)</small>
            </label>
            <input
              type="url"
              className="form-control bg-secondary text-white border-secondary"
              id="sourceUrl"
              value={source_url}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.reddit.com/r/Stellaris/..."
            />
          </div>

          <div className="mb-3">
            <label htmlFor="gameVersion" className="form-label">Game Version</label>
            <select
              className="form-select bg-secondary text-white border-secondary"
              id="gameVersion"
              value={game_version}
              onChange={(e) => setGameVersion(e.target.value)}
            >
              {GAME_VERSIONS.map(version => (
                <option key={version.value} value={version.value}>
                  {version.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="difficulty" className="form-label">
              Difficulty (Optional)
              <small className="text-muted d-block">How challenging is this build to play?</small>
            </label>
            <select
              className="form-select bg-secondary text-white border-secondary"
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">-- Select Difficulty --</option>
              <option value="overpowered">Overpowered</option>
              <option value="strong">Strong</option>
              <option value="balanced">Balanced</option>
              <option value="challenging">Challenging</option>
              <option value="extreme">Extreme Challenge</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Primary Species Type</label>
            <div className="btn-group w-100" role="group">
              {['BIOLOGICAL', 'LITHOID', 'MACHINE', 'ROBOT'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`btn ${speciesType === type ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setSpeciesType(type);
                    // Clear traits when changing species type to avoid invalid combinations
                    setSelectedTraits([]);
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Species Traits */}
          <div className="mb-3">
            <label className="form-label">
              Species Traits ({selectedTraits.length}/{MAX_TRAIT_COUNT} traits, {currentTraitPoints}/{MAX_TRAIT_POINTS} points)
            </label>

            {/* Origin Bonus Display */}
            {(pointsBonus > 0 || picksBonus > 0) && (
              <div className="alert alert-success mb-2">
                <strong>Origin Bonus:</strong>
                {pointsBonus > 0 && <span className="ms-2">+{pointsBonus} trait points</span>}
                {picksBonus > 0 && <span className="ms-2">+{picksBonus} trait pick{picksBonus > 1 ? 's' : ''}</span>}
                <small className="d-block mt-1">
                  Base limits: {BASE_MAX_TRAIT_COUNT} traits, {BASE_MAX_TRAIT_POINTS} points
                </small>
              </div>
            )}

            {/* Warning if limits exceeded */}
            {hasInvalidTraits && (
              <div className="alert alert-danger mb-2">
                <strong>⚠️ Trait limits exceeded!</strong>
                <div className="mt-1">
                  {exceedsTraitCount && (
                    <div>You have {selectedTraits.length} traits but the limit is {MAX_TRAIT_COUNT}. Please deselect {selectedTraits.length - MAX_TRAIT_COUNT} trait{selectedTraits.length - MAX_TRAIT_COUNT > 1 ? 's' : ''}.</div>
                  )}
                  {exceedsTraitPoints && (
                    <div>You have {currentTraitPoints} points but the limit is {MAX_TRAIT_POINTS}. Please adjust your trait selection.</div>
                  )}
                </div>
              </div>
            )}

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
                          title={trait.description || 'No description available'}
                        >
                          <GameIcon type="traits" id={trait.id} size={32} />
                          <strong className="text-white">{trait.name || trait.id}</strong>
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

          {/* Secondary Species Traits (for specific origins) */}
          {ORIGINS_WITH_SECONDARY_SPECIES.includes(selectedOrigin) && (
            <div className="mb-3">
              <label className="form-label">
                Secondary Species Traits ({selectedSecondaryTraits.length} traits)
                <small className="text-muted d-block">
                  {selectedOrigin === 'origin_syncretic_evolution' && 'Servile species traits'}
                  {selectedOrigin === 'origin_necrophage' && 'Pre-sapient species traits'}
                  {selectedOrigin === 'origin_clone_army' && 'Template species traits'}
                  {selectedOrigin === 'origin_overtuned' && 'Base species traits'}
                </small>
              </label>

              {/* Secondary Species Type Selector */}
              <div className="mb-3">
                <label className="form-label">Secondary Species Type</label>
                <div className="btn-group w-100" role="group">
                  {['BIOLOGICAL', 'LITHOID', 'MACHINE', 'ROBOT'].map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`btn ${secondarySpeciesType === type ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setSecondarySpeciesType(type);
                        // Clear secondary traits when changing species type to avoid invalid combinations
                        setSelectedSecondaryTraits([]);
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card bg-secondary" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div className="card-body">
                  {filteredSecondaryTraits.map(trait => {
                    const isSelected = selectedSecondaryTraits.includes(trait.id);

                    return (
                      <div
                        key={`secondary-${trait.id}`}
                        className="form-check mb-2 pb-2 border-bottom border-dark"
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`secondary-trait-${trait.id}`}
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedSecondaryTraits(selectedSecondaryTraits.filter(t => t !== trait.id));
                            } else {
                              setSelectedSecondaryTraits([...selectedSecondaryTraits, trait.id]);
                            }
                          }}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`secondary-trait-${trait.id}`}
                          style={{ cursor: 'pointer' }}
                          title={trait.description || 'No description available'}
                        >
                          <GameIcon type="traits" id={trait.id} size={32} />
                          <strong className="text-white">{trait.name || trait.id}</strong>
                          <span className={`badge ms-2 ${typeof trait.cost === 'number' && trait.cost > 0 ? 'bg-primary' : 'bg-danger'}`}>
                            Cost: {trait.cost}
                          </span>
                          <small className="d-block text-light mt-1">{trait.effects || 'No effects listed'}</small>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Origin Selection */}
          <div className="mb-3">
            <label className="form-label">
              Origin {selectedOrigin && <span className="badge bg-success ms-2">Selected</span>}
            </label>

            <input
              type="text"
              className="form-control bg-secondary text-white border-secondary mb-2"
              placeholder="Search origins by name, description, or effects..."
              value={originSearchQuery}
              onChange={(e) => setOriginSearchQuery(e.target.value)}
            />
            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredOrigins.length > 0 ? (
                  filteredOrigins.map(origin => {
                    const isSelected = selectedOrigin === origin.id;
                    return (
                      <div
                        key={origin.id}
                        className={`form-check mb-2 pb-2 border-bottom border-dark ${isSelected ? 'bg-primary bg-opacity-25' : ''}`}
                      >
                        <input
                          className="form-check-input"
                          type="radio"
                          id={`origin-${origin.id}`}
                          name="origin"
                          checked={isSelected}
                          onChange={() => setSelectedOrigin(origin.id)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`origin-${origin.id}`}
                          style={{ cursor: 'pointer' }}
                          title={origin.description || 'No description available'}
                        >
                          <img
                            src={`/icons/origin_images/${origin.id}.png`}
                            alt=""
                            width={48}
                            height={48}
                            style={{ marginRight: '8px', verticalAlign: 'middle', borderRadius: '4px', objectFit: 'cover' }}
                          />
                          <strong className="text-white">{origin.name || origin.id}</strong>
                          {origin.effects && (
                            <div className="mt-1">
                              <small className="text-info d-block">{origin.effects}</small>
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">No origins match your search.</p>
                )}
              </div>
            </div>

            {/* Display selected origin with large image BELOW the list */}
            {selectedOrigin && (
              <div className="mt-3">
                <OriginCard
                  originId={selectedOrigin}
                  origin={allOrigins.find(o => o.id === selectedOrigin)}
                />
              </div>
            )}
          </div>

          {/* Starting Ruler Trait Selection */}
          <div className="mb-3">
            <label className="form-label">
              Starting Ruler Trait {selectedRulerTrait && <span className="badge bg-success ms-2">Selected</span>}
            </label>

            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredRulerTraits.length > 0 ? (
                  filteredRulerTraits.map(trait => {
                    const isSelected = selectedRulerTrait === trait.id;
                    return (
                      <div
                        key={trait.id}
                        className={`form-check mb-2 pb-2 border-bottom border-dark ${isSelected ? 'bg-primary bg-opacity-25' : ''}`}
                      >
                        <input
                          className="form-check-input"
                          type="radio"
                          id={`ruler-trait-${trait.id}`}
                          name="ruler_trait"
                          checked={isSelected}
                          onChange={() => setSelectedRulerTrait(trait.id)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`ruler-trait-${trait.id}`}
                          style={{ cursor: 'pointer' }}
                          title={trait.description || 'No description available'}
                        >
                          {trait.icon && (
                            <img
                              src={trait.icon}
                              alt=""
                              width={32}
                              height={32}
                              style={{ marginRight: '8px', verticalAlign: 'middle' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <strong className="text-white">{trait.name || trait.id}</strong>
                          {trait.leader_class && trait.leader_class.length > 0 && (
                            <span className="ms-2">
                              {trait.leader_class.map((cls: string, idx: number) => (
                                <span key={idx} className="badge bg-secondary me-1">{cls}</span>
                              ))}
                            </span>
                          )}
                          <div className="mt-1">
                            <small className="text-light d-block">{trait.description}</small>
                          </div>
                          {trait.effects && (
                            <div className="mt-1">
                              <small className="text-info d-block"><strong>Effects:</strong> {trait.effects}</small>
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">No ruler traits available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Ethics Selection */}
          <div className="mb-3">
            <label className="form-label">
              Ethics ({currentEthicsPoints}/{MAX_ETHICS_POINTS} points)
            </label>

            {/* Warning if limits exceeded */}
            {exceedsEthicsPoints && (
              <div className="alert alert-danger mb-2">
                <strong>⚠️ Ethics points exceeded!</strong>
                <div className="mt-1">
                  You have {currentEthicsPoints} points but the limit is {MAX_ETHICS_POINTS}. Please adjust your ethics selection.
                </div>
              </div>
            )}

            {/* Ethics Points Display */}
            <div className="alert alert-info mb-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Ethics Points:</strong> {currentEthicsPoints} / {MAX_ETHICS_POINTS}
                  {currentEthicsPoints > MAX_ETHICS_POINTS && (
                    <span className="text-danger ms-2">(Exceeds maximum!)</span>
                  )}
                </div>
              </div>
              <div className="progress mt-2" style={{ height: '20px' }}>
                <div
                  className={`progress-bar ${currentEthicsPoints > MAX_ETHICS_POINTS ? 'bg-danger' : currentEthicsPoints === MAX_ETHICS_POINTS ? 'bg-warning' : 'bg-success'}`}
                  role="progressbar"
                  style={{ width: `${Math.min((currentEthicsPoints / MAX_ETHICS_POINTS) * 100, 100)}%` }}
                  aria-valuenow={currentEthicsPoints}
                  aria-valuemin={0}
                  aria-valuemax={MAX_ETHICS_POINTS}
                >
                  {currentEthicsPoints} / {MAX_ETHICS_POINTS}
                </div>
              </div>
            </div>

            <input
              type="text"
              className="form-control bg-secondary text-white border-secondary mb-2"
              placeholder="Search ethics by name, effect, or tag..."
              value={ethicsSearchQuery}
              onChange={(e) => setEthicsSearchQuery(e.target.value)}
            />
            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredEthics.length > 0 ? (
                  filteredEthics.map(ethic => {
                    const isSelected = selectedEthics.includes(ethic.id);
                    const canSelect = canSelectEthic(ethic);
                    const isDisabled = !isSelected && !canSelect;

                    return (
                      <div
                        key={ethic.id}
                        className={`form-check mb-2 pb-2 border-bottom border-dark ${isDisabled ? 'opacity-50' : ''}`}
                        style={{ opacity: isDisabled ? 0.5 : 1 }}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`ethic-${ethic.id}`}
                          checked={isSelected}
                          onChange={() => handleEthicsChange(ethic.id)}
                          disabled={isDisabled}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`ethic-${ethic.id}`}
                          style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                          title={ethic.description || 'No description available'}
                        >
                          <GameIcon type="ethics" id={ethic.id} size={32} />
                          <strong className="text-white">{ethic.name || ethic.id}</strong>
                          <span className={`badge ms-2 ${ethic.cost === 3 ? 'bg-warning text-dark' : ethic.cost === 2 ? 'bg-primary' : 'bg-info'}`}>
                            Cost: {ethic.cost} {ethic.cost === 2 ? '(Fanatic)' : ethic.cost === 3 ? '(Gestalt)' : ''}
                          </span>
                          {ethic.tags && ethic.tags.length > 0 && (
                            <span className="ms-2">
                              {ethic.tags.slice(0, 2).map((tag: string, idx: number) => (
                                <span key={idx} className="badge bg-secondary me-1">{tag}</span>
                              ))}
                            </span>
                          )}
                          {isDisabled && !isSelected && (
                            <span className="badge bg-warning text-dark ms-2">Cannot select</span>
                          )}
                          <small className="d-block text-light mt-1">{ethic.effects || 'No effects listed'}</small>
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">No ethics match your search.</p>
                )}
              </div>
            </div>
          </div>

          {/* Authority Selection */}
          <div className="mb-3">
            <label className="form-label">
              Authority {selectedAuthority && <span className="badge bg-success ms-2">Selected: {allAuthorities.find(a => a.id === selectedAuthority)?.name}</span>}
            </label>

            {/* Info about authority selection */}
            {selectedEthics.length === 0 && (
              <div className="alert alert-info mb-2">
                <strong>ℹ️ Select ethics first</strong>
                <div className="mt-1">
                  Your authority options are determined by your ethics selection.
                </div>
              </div>
            )}

            {/* Warning if selected authority became invalid */}
            {selectedEthics.length > 0 && availableAuthorities.length === 0 && (
              <div className="alert alert-warning mb-2">
                <strong>⚠️ No valid authorities</strong>
                <div className="mt-1">
                  Your current ethics combination doesn't match any authority. Please adjust your ethics.
                </div>
              </div>
            )}

            <div className="card bg-secondary" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <div className="card-body">
                {availableAuthorities.length > 0 ? (
                  availableAuthorities.map(authority => {
                    const isSelected = selectedAuthority === authority.id;
                    return (
                      <div
                        key={authority.id}
                        className={`form-check mb-3 pb-3 border-bottom border-dark ${isSelected ? 'bg-primary bg-opacity-25' : ''}`}
                      >
                        <input
                          className="form-check-input"
                          type="radio"
                          id={`authority-${authority.id}`}
                          name="authority"
                          checked={isSelected}
                          onChange={() => setSelectedAuthority(authority.id)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`authority-${authority.id}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <GameIcon type="authorities" id={authority.id} size={32} />
                          <strong className="text-white">{authority.name}</strong>
                          {authority.required_dlc && (
                            <span className="badge bg-warning text-dark ms-2">Requires: {authority.required_dlc}</span>
                          )}
                          {authority.tags.includes('GESTALT') && (
                            <span className="badge bg-info ms-2">Gestalt</span>
                          )}
                          <div className="mt-1">
                            <small className="text-light d-block">{authority.description}</small>
                          </div>
                          {authority.effects && (
                            <div className="mt-2">
                              <small className="text-info d-block"><strong>Effects:</strong> {authority.effects}</small>
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">
                    {selectedEthics.length === 0
                      ? 'Select ethics to see available authorities.'
                      : 'No authorities available for selected ethics.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Civics Selection */}
          <div className="mb-3">
            <label className="form-label">
              Civics ({selectedCivics.length}/{MAX_CIVIC_SLOTS} selected)
            </label>

            {/* Info about civic selection */}
            {selectedEthics.length === 0 && !selectedAuthority && (
              <div className="alert alert-info mb-2">
                <strong>ℹ️ Select ethics and authority first</strong>
                <div className="mt-1">
                  Available civics depend on your ethics and authority selection.
                </div>
              </div>
            )}

            {/* Display selected civics */}
            {selectedCivics.length > 0 && (
              <div className="alert alert-success mb-2">
                <strong>Selected Civics:</strong>
                <div className="mt-1">
                  {selectedCivics.map((civicId, index) => {
                    const civic = allCivics.find(c => c.id === civicId);
                    return (
                      <span key={civicId} className="badge bg-primary me-1 mb-1">
                        {index + 1}. {civic?.name || civicId}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <input
              type="text"
              className="form-control bg-secondary text-white border-secondary mb-2"
              placeholder="Search civics by name, effect, or description..."
              value={civicsSearchQuery}
              onChange={(e) => setCivicsSearchQuery(e.target.value)}
            />
            <div className="card bg-secondary" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredCivics.length > 0 ? (
                  filteredCivics.map(civic => {
                    const isSelected = selectedCivics.includes(civic.id);
                    const canSelect = canSelectCivic(civic);
                    const isDisabled = !isSelected && !canSelect;

                    return (
                      <div
                        key={civic.id}
                        className={`form-check mb-2 pb-2 border-bottom border-dark ${isDisabled ? 'opacity-50' : ''}`}
                        style={{ opacity: isDisabled ? 0.5 : 1 }}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`civic-${civic.id}`}
                          checked={isSelected}
                          onChange={() => handleCivicChange(civic.id)}
                          disabled={isDisabled}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`civic-${civic.id}`}
                          style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                          title={civic.description || 'No description available'}
                        >
                          <GameIcon type="civics" id={civic.id} size={32} />
                          <strong className="text-white">{civic.name || civic.id}</strong>
                          {!civic.can_modify && (
                            <span className="badge bg-warning text-dark ms-2">Permanent</span>
                          )}
                          {isDisabled && !isSelected && selectedCivics.length >= MAX_CIVIC_SLOTS && (
                            <span className="badge bg-danger ms-2">Max slots reached</span>
                          )}
                          {isDisabled && !isSelected && selectedCivics.length < MAX_CIVIC_SLOTS && (
                            <span className="badge bg-warning text-dark ms-2">Requirements not met</span>
                          )}
                          {civic.effects && (
                            <small className="d-block text-light mt-1">{civic.effects}</small>
                          )}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">
                    {availableCivics.length === 0
                      ? 'No civics available for current selections.'
                      : 'No civics match your search.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Recommended Ascension Perks */}
          <div className="mb-3">
            <label className="form-label">
              Recommended Ascension Perks ({selectedAscensionPerks.length} selected)
              <small className="text-muted d-block">These are strategic suggestions for your build, not requirements. Click to add in order.</small>
            </label>

            {/* Display selected perks in order */}
            {selectedAscensionPerks.length > 0 && (
              <div className="alert alert-info mb-2">
                <strong>Selection Order:</strong>
                <div className="mt-1">
                  {selectedAscensionPerks.map((perkId, index) => (
                    <span key={perkId} className="badge bg-primary me-1 mb-1">
                      {index + 1}. {perkId}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              className="form-control bg-secondary text-white border-secondary mb-2"
              placeholder="Search ascension perks..."
              value={ascensionPerkSearchQuery}
              onChange={(e) => setAscensionPerkSearchQuery(e.target.value)}
            />
            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredAscensionPerks.length > 0 ? (
                  filteredAscensionPerks.map(perk => {
                    const isSelected = selectedAscensionPerks.includes(perk.id);
                    const orderNumber = getPerkOrder(perk.id);
                    return (
                      <div
                        key={perk.id}
                        className={`form-check mb-2 pb-2 border-bottom border-dark`}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`perk-${perk.id}`}
                          checked={isSelected}
                          onChange={() => handleAscensionPerkChange(perk.id)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`perk-${perk.id}`}
                          style={{ cursor: 'pointer' }}
                          title={perk.description || 'No description available'}
                        >
                          <GameIcon type="ascension_perks" id={perk.id} size={32} />
                          <strong className="text-white">{perk.name || perk.id}</strong>
                          {orderNumber !== null && (
                            <span className="badge bg-success ms-2">#{orderNumber}</span>
                          )}
                          {perk.is_path_perk && (
                            <span className="badge bg-warning text-dark ms-2">Path Perk</span>
                          )}
                          {perk.effects && (
                            <div className="mt-1">
                              <small className="text-info d-block">{perk.effects}</small>
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">No ascension perks match your search.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recommended Tradition Trees */}
          <div className="mb-3">
            <label className="form-label">
              Recommended Tradition Trees ({selectedTraditions.length} selected)
              <small className="text-muted d-block">Select tradition trees in the order you recommend adopting them.</small>
            </label>

            {/* Display selected traditions in order */}
            {selectedTraditions.length > 0 && (
              <div className="alert alert-info mb-2">
                <strong>Tradition Order:</strong>
                <div className="mt-1">
                  {selectedTraditions.map((treeId, index) => {
                    const tree = allTraditionTrees.find(t => t.name === treeId);
                    const displayName = tree?.adopt?.name || treeId;
                    return (
                      <span key={treeId} className="badge bg-primary me-1 mb-1">
                        {index + 1}. {displayName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <input
              type="text"
              className="form-control bg-secondary text-white border-secondary mb-2"
              placeholder="Search tradition trees..."
              value={traditionsSearchQuery}
              onChange={(e) => setTraditionsSearchQuery(e.target.value)}
            />
            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {filteredTraditionTrees.length > 0 ? (
                  filteredTraditionTrees.map(tree => {
                    const isSelected = selectedTraditions.includes(tree.name);
                    const orderNumber = getTraditionOrder(tree.name);
                    return (
                      <div
                        key={tree.name}
                        className={`form-check mb-2 pb-2 border-bottom border-dark`}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`tradition-${tree.name}`}
                          checked={isSelected}
                          onChange={() => handleTraditionChange(tree.name)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`tradition-${tree.name}`}
                          style={{ cursor: 'pointer' }}
                          title={tree.adopt?.description || tree.adopt?.effects || tree.finish?.description || 'Tradition tree'}
                        >
                          <GameIcon type="traditions" id={tree.name} size={32} />
                          <strong className="text-white">{tree.adopt?.name || tree.name}</strong>
                          {orderNumber !== null && (
                            <span className="badge bg-success ms-2">#{orderNumber}</span>
                          )}
                          {tree.adopt?.description && (
                            <div className="mt-1">
                              <small className="text-light d-block">{tree.adopt.description}</small>
                            </div>
                          )}
                          {tree.adopt?.effects && (
                            <div className="mt-1">
                              <small className="text-info d-block"><strong>Adopt:</strong> {tree.adopt.effects}</small>
                            </div>
                          )}
                          {tree.finish && tree.finish.effects && (
                            <div className="mt-1">
                              <small className="text-warning d-block"><strong>Completion:</strong> {tree.finish.effects}</small>
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted">No tradition trees match your search.</p>
                )}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting || hasInvalidTraits || exceedsEthicsPoints || !isBuildComplete()}>
            {submitting ? 'Submitting...' : 'Submit Build'}
          </button>
          {hasInvalidTraits && (
            <small className="text-danger ms-2">Cannot submit: trait limits exceeded</small>
          )}
          {exceedsEthicsPoints && (
            <small className="text-danger ms-2">Cannot submit: ethics points exceeded</small>
          )}
          {!isBuildComplete() && !hasInvalidTraits && !exceedsEthicsPoints && (
            <small className="text-warning ms-2">Please fill all required fields: {getMissingFields().join(', ')}</small>
          )}
        </form>
      </div>

      {/* Auth Modal */}
      <AuthModal
        show={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};
