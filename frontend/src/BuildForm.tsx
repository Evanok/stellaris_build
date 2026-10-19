import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { AuthModal } from './components/AuthModal';
import { GuestSubmitModal } from './components/GuestSubmitModal';
import { addGuestClaim } from './utils/guestClaims';
import { trackEvent } from './utils/analytics';
import { useNavigate } from 'react-router-dom';
import { decodeHtmlEntities } from './utils/htmlDecode';
import { DIFFICULTY_LEVELS } from './utils/difficulty';
import { normalizeBuildTags, serializeBuildTags, MAX_TAGS_PER_BUILD } from './utils/buildTags';
import { BuildTagPicker } from './components/BuildTags';
import { PredicateNode, findFieldOccurrences, getFailingNodes, describePredicateHuman } from './utils/ruleEvaluator';
import { ORIGIN_IMAGE_QUERY, iconQuery } from './utils/assetVersions';
import { Shipset, ShipsetRuleSource, getShipsetConflicts } from './utils/shipsetRules';
import { PlanetClass, PlanetRuleInput, getForcedPlanetClass, getEffectivePlanetClass, getPlanetConflicts, getTraitPlanetConflicts, isTraitBlockedByPlanet, getPlanetPickerColumns, getSpeciesPlanetConflict } from './utils/planetRules';

interface BuildFormProps {
  onBuildCreated: (newBuild: any) => void;
  initialData?: any; // Optional pre-filled data from imports
  buildId?: string; // If provided, the form is in edit mode
}

// Icon component for game elements
const GameIcon: React.FC<{ type: string; id: string; size?: number }> = ({ type, id, size = 32 }) => {
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  if (hasError) {
    return null; // Don't show anything if icon fails to load
  }

  return (
    <img
      ref={imgRef}
      src={isVisible ? `/icons/${type}/${id}.png${iconQuery(type)}` : undefined}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{
        marginRight: '8px',
        verticalAlign: 'middle',
        backgroundColor: isVisible ? 'transparent' : '#333' // Placeholder while loading
      }}
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
              src={`/icons/origin_original/${originId}.png${ORIGIN_IMAGE_QUERY}`}
              alt={origin?.name || originId}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '300px',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              loading="lazy"
              onError={() => setImageError(true)}
            />
          </div>
        )}
        <div className={imageError ? 'col-md-12' : 'col-md-8'}>
          <div className="card-body">
            <div className="d-flex align-items-center mb-2">
              <GameIcon type="origin_mini" id={originId} size={48} />
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
  allowed_archetypes?: string[];
  allowed_planet_classes?: string[];
}

interface Origin {
  id: string;
  name: string;
  description: string;
  effects: string;
  potential: PredicateNode; // Conditions that filter visibility (e.g., species_archetype)
  possible: PredicateNode;
  playable_conditions?: string;
  is_origin: boolean;
  pickable_at_start: boolean;
  modifier?: {
    [key: string]: number;
  };
  habitability_preference?: string; // Forces the homeworld planet class (e.g. Void Dwellers -> pc_habitat)
  starting_colony?: string; // Capital planet class when it differs from the species preference (e.g. Remnants -> pc_relic)
  granted_traits?: string[];
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

interface ArkTypeModifier {
  key: string;
  label: string;
  tier1: string;
  tier2: string;
  tier3: string;
}

interface ArkType {
  id: string;
  name: string;
  modifiers: ArkTypeModifier[];
  features: string[];
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
  potential?: PredicateNode;
  possible?: PredicateNode;
}

interface Civic {
  id: string;
  name: string;
  is_origin: boolean;
  playable: boolean;
  pickable_at_start: boolean;
  description: string;
  potential: PredicateNode; // Conditions that filter visibility
  possible: PredicateNode; // Requirements that must be met
  effects: string;
  modifier?: {
    [key: string]: number;
  };
  can_modify: boolean;
  granted_traits?: string[];
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

interface SpeciesClass {
  id: string;
  name: string;
  description: string;
  archetype: string;
  graphical_culture: string;
  portraits: string[];
  portrait_count: number;
}

// Stellaris 4.X base rules (can be modified by origins)
const BASE_MAX_TRAIT_POINTS = 2;
const BASE_MAX_TRAIT_COUNT = 5;
const MAX_ETHICS_POINTS = 3;
// GOVERNMENT_CIVIC_POINTS_BASE in common/defines/00_defines.txt - confirmed
// in-game. A handful of narrative/mid-game civics (Great Khan's Vision,
// Galactic Sovereign, Psionic Sovereign) grant +1 via
// country_government_civic_points_add, but those aren't real creation-time
// picks, so this stays a flat 2.
const MAX_CIVIC_SLOTS = 2;

// Nomads DLC was introduced in 4.4 "Pegasus"
const supportsNomadic = (version: string) => parseFloat(version) >= 4.4;

// Stellaris game versions
const GAME_VERSIONS = [
  { value: '4.5', label: '4.5 "Cygnus" (Latest)' },
  { value: '4.4', label: '4.4 "Pegasus"' },
  { value: '4.3', label: '4.3 "Cetus"' },
  { value: '4.2', label: '4.2 "Corvus"' },
  { value: '4.1', label: '4.1 "Lyra"' },
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

const BuildFormComponent: React.FC<BuildFormProps> = ({ onBuildCreated, initialData, buildId }) => {
  const isEditMode = !!buildId;
  // Form fields state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [game_version, setGameVersion] = useState('4.5');
  const [youtube_url, setYoutubeUrl] = useState('');
  const [source_url, setSourceUrl] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [dlcs, setDlcs] = useState('');
  const [tags, setTags] = useState('');
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

  // Nomadic empire (Nomads DLC)
  const [isNomadic, setIsNomadic] = useState(false);
  const [arkType, setArkType] = useState('');
  const [allArkTypes, setAllArkTypes] = useState<ArkType[]>([]);

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

  // Species class and portrait data from API
  const [allSpeciesClasses, setAllSpeciesClasses] = useState<SpeciesClass[]>([]);
  const [selectedSpeciesClass, setSelectedSpeciesClass] = useState<string>('');
  const [selectedPortrait, setSelectedPortrait] = useState<string>('');

  // Homeworld planet class (optional). Holds the user's own pick - an origin or
  // the Nomadic toggle can override it, see getEffectivePlanetClass().
  const [allPlanetClasses, setAllPlanetClasses] = useState<PlanetClass[]>([]);
  const [selectedPlanetClass, setSelectedPlanetClass] = useState<string>('');

  // Ship appearance (optional) - the shipset / graphical culture
  const [allShipsets, setAllShipsets] = useState<Shipset[]>([]);
  const [selectedShipset, setSelectedShipset] = useState<string>('');

  // Trait point/pick budget per archetype (BIOLOGICAL/ROBOT/MACHINE/LITHOID/PRESAPIENT) -
  // differs per archetype (e.g. MACHINE: 1 point/5 traits, ROBOT: 0 points/4 traits),
  // unlike the old flat BASE_MAX_TRAIT_POINTS/BASE_MAX_TRAIT_COUNT constants.
  const [speciesArchetypeBudgets, setSpeciesArchetypeBudgets] = useState<Record<string, { trait_points: number | null; max_traits: number | null }>>({});

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [youtubeUrlError, setYoutubeUrlError] = useState<string | null>(null);
  const [sourceUrlError, setSourceUrlError] = useState<string | null>(null);

  // Auth state
  const { user, refreshUser } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Funnel analytics: which step visitors reach in the create form, so drop-offs
  // can be located (started -> invalid / auth prompt -> created or guest-submitted).
  // form_mode tells manual entry from imports; edits are not part of the funnel.
  const formMode = buildId ? 'edit' : initialData ? 'import' : 'manual';
  const formStartedRef = useRef(false);
  const trackFunnel = (event: Parameters<typeof trackEvent>[0], params: Record<string, string | number | boolean | undefined> = {}) => {
    if (formMode === 'edit') return;
    trackEvent(event, { form_mode: formMode, logged_in: !!user, ...params });
  };
  const handleFirstInteraction = () => {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackFunnel('build_form_started');
  };
  const navigate = useNavigate();

  // Warn on submit if the description is empty (create mode only)
  const [showDescriptionWarning, setShowDescriptionWarning] = useState(false);
  const skipDescriptionWarningRef = useRef(false);

  // Warn on submit if the completed build violates a game rule we can check
  // (experimental - see ruleWarnings computation in handleSubmit)
  const [showRuleWarning, setShowRuleWarning] = useState(false);
  const [ruleWarnings, setRuleWarnings] = useState<string[]>([]);
  const skipRuleWarningRef = useRef(false);

  // "Check Build" button: same checks as submit, results only, never submits
  const [checkResult, setCheckResult] = useState<{ blocking: string[]; warnings: string[] } | null>(null);

  // Track whether the user manually changed the version (vs initial load or initialData population)
  const userChangedVersion = useRef(false);

  // Load non-versioned ark types data once on mount
  useEffect(() => {
    fetch('/api/ark-types')
      .then(res => res.json())
      .then((data: ArkType[]) => setAllArkTypes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const qs = `?version=${encodeURIComponent(game_version)}`;
    const isUserChange = userChangedVersion.current;
    userChangedVersion.current = false;

    // Load traits
    fetch(`/api/traits${qs}`)
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
            cost: typeof trait.cost === 'number' ? trait.cost : (typeof trait.cost === 'object' && trait.cost !== null && typeof trait.cost.base === 'number' ? trait.cost.base : 0),
          }))
          // Sort by cost (positive traits first, then negative, then background traits at zero)
          // Note: Traits are pre-filtered during extraction (only selectable traits are in JSON)
          .sort((a: any, b: any) => b.cost - a.cost);

        setAllTraits(sanitizedTraits);
        if (isUserChange) {
          const validTraitIds = new Set(sanitizedTraits.map((t: any) => t.id));
          setSelectedTraits(prev => prev.filter((id: string) => validTraitIds.has(id)));
          setSelectedSecondaryTraits(prev => prev.filter((id: string) => validTraitIds.has(id)));
        }
      })
      .catch(() => setError('Could not load traits data.'));

    // Load all version-specific game data in parallel so we can do cleanup after
    Promise.all([
      fetch(`/api/origins${qs}`).then(res => res.json()),
      fetch(`/api/ascension-perks${qs}`).then(res => res.json()),
      fetch(`/api/ethics${qs}`).then(res => res.json()),
      fetch(`/api/authorities${qs}`).then(res => res.json()),
      fetch(`/api/civics${qs}`).then(res => res.json()),
      fetch(`/api/traditions${qs}`).then(res => res.json()),
      fetch(`/api/ruler-traits${qs}`).then(res => res.json()),
      fetch(`/api/species-classes${qs}`).then(res => res.json()),
      fetch(`/api/species-archetypes${qs}`).then(res => res.json()),
      fetch(`/api/planet-classes${qs}`).then(res => res.json()),
      fetch(`/api/shipsets${qs}`).then(res => res.json()),
    ]).then(([originsRaw, perksRaw, ethicsRaw, authoritiesRaw, civicsRaw, traditionsRaw, rulerTraitsRaw, classesRaw, archetypeBudgetsRaw, planetClassesRaw, shipsetsRaw]) => {
      setAllShipsets(Array.isArray(shipsetsRaw) ? shipsetsRaw : []);
      setSpeciesArchetypeBudgets(archetypeBudgetsRaw && typeof archetypeBudgetsRaw === 'object' ? archetypeBudgetsRaw : {});
      setAllPlanetClasses(Array.isArray(planetClassesRaw) ? planetClassesRaw : []);
      const originsArray = Array.isArray(originsRaw) ? originsRaw : (originsRaw.origins || []);
      const sanitizedOrigins = originsArray
        .filter((o: any) => o.pickable_at_start && o.is_origin)
        .map((o: any) => ({ ...o, effects: typeof o.effects === 'string' ? o.effects : '', description: typeof o.description === 'string' ? o.description : '' }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      setAllOrigins(sanitizedOrigins);

      const perksArray = Array.isArray(perksRaw) ? perksRaw : (perksRaw.all || []);
      const sanitizedPerks = perksArray
        .filter((p: any) => p.type === 'ascension_perk' && p.name !== p.id)
        .map((p: any) => ({ ...p, effects: typeof p.effects === 'string' ? p.effects : '', description: typeof p.description === 'string' ? p.description : '' }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      const seenNames = new Set<string>();
      const uniquePerks = sanitizedPerks.filter((p: any) => { if (seenNames.has(p.name)) return false; seenNames.add(p.name); return true; });
      setAllAscensionPerks(uniquePerks);

      const sanitizedEthics = ethicsRaw
        .map((e: any) => ({ ...e, effects: typeof e.effects === 'string' ? e.effects : '', description: typeof e.description === 'string' ? e.description : '', tags: Array.isArray(e.tags) ? e.tags : [], cost: typeof e.cost === 'number' ? e.cost : 1 }))
        .sort((a: any, b: any) => b.cost !== a.cost ? b.cost - a.cost : a.id.localeCompare(b.id));
      setAllEthics(sanitizedEthics);

      const sanitizedAuthorities = authoritiesRaw
        .map((a: any) => ({ ...a, description: typeof a.description === 'string' ? a.description : '', effects: typeof a.effects === 'string' ? a.effects : '', tags: Array.isArray(a.tags) ? a.tags : [], required_ethics: Array.isArray(a.required_ethics) ? a.required_ethics : [], blocked_ethics: Array.isArray(a.blocked_ethics) ? a.blocked_ethics : [] }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      setAllAuthorities(sanitizedAuthorities);

      const civicsArray = Array.isArray(civicsRaw) ? civicsRaw : (civicsRaw.civics || []);
      const sanitizedCivics = civicsArray
        .filter((c: any) => c.pickable_at_start && !c.is_origin)
        .map((c: any) => ({ ...c, description: typeof c.description === 'string' ? c.description : '', effects: typeof c.effects === 'string' ? c.effects : '', potential: c.potential && typeof c.potential === 'object' ? c.potential : { all: [] }, possible: c.possible && typeof c.possible === 'object' ? c.possible : { all: [] } }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      setAllCivics(sanitizedCivics);

      const trees: TraditionTree[] = [];
      for (const key in traditionsRaw) {
        if (traditionsRaw[key].adopt && traditionsRaw[key].adopt.name) {
          trees.push({ name: key, adopt: traditionsRaw[key].adopt, finish: traditionsRaw[key].finish, traditions: traditionsRaw[key].traditions || [] });
        }
      }
      trees.sort((a, b) => (a.adopt?.name || a.name).localeCompare(b.adopt?.name || b.name));
      setAllTraditionTrees(trees);

      const sanitizedRulerTraits = rulerTraitsRaw
        .map((t: any) => ({ ...t, effects: typeof t.effects === 'string' ? t.effects : '', description: typeof t.description === 'string' ? t.description : '', leader_class: Array.isArray(t.leader_class) ? t.leader_class : [], forbidden_origins: Array.isArray(t.forbidden_origins) ? t.forbidden_origins : [], allowed_ethics: Array.isArray(t.allowed_ethics) ? t.allowed_ethics : [] }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      setAllRulerTraits(sanitizedRulerTraits);

      const sanitizedClasses = classesRaw
        .map((sc: any) => ({ ...sc, portraits: Array.isArray(sc.portraits) ? sc.portraits : [] }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      setAllSpeciesClasses(sanitizedClasses);

      // If the user manually changed the version, deselect items that no longer exist
      if (isUserChange) {
        const validOriginIds = new Set(sanitizedOrigins.map((o: any) => o.id));
        const validPerkIds = new Set(uniquePerks.map((p: any) => p.id));
        const validEthicIds = new Set(sanitizedEthics.map((e: any) => e.id));
        const validAuthorityIds = new Set(sanitizedAuthorities.map((a: any) => a.id));
        const validCivicIds = new Set(sanitizedCivics.map((c: any) => c.id));
        const validTreeNames = new Set(trees.map((t: any) => t.name));
        const validRulerTraitIds = new Set(sanitizedRulerTraits.map((t: any) => t.id));

        setSelectedOrigin(prev => (prev && validOriginIds.has(prev) ? prev : ''));
        setSelectedEthics(prev => prev.filter((id: string) => validEthicIds.has(id)));
        setSelectedAuthority(prev => (prev && validAuthorityIds.has(prev) ? prev : ''));
        setSelectedCivics(prev => prev.filter((id: string) => validCivicIds.has(id)));
        setSelectedAscensionPerks(prev => prev.filter((id: string) => validPerkIds.has(id)));
        setSelectedTraditions(prev => prev.filter((id: string) => validTreeNames.has(id)));
        setSelectedRulerTrait(prev => (prev && validRulerTraitIds.has(prev) ? prev : ''));
        if (!supportsNomadic(game_version)) {
          setIsNomadic(false);
          setArkType('');
        }
      }
    }).catch(() => setError('Could not load game data.'));

    // Load species traits separately (same version param applied above in the traits fetch)
  }, [game_version]);

  // Populate form with initialData (from imports)
  useEffect(() => {
    if (initialData) {
      // Set basic fields - decode HTML entities for proper display in form inputs
      if (initialData.name) setName(decodeHtmlEntities(initialData.name));
      if (initialData.description) setDescription(decodeHtmlEntities(initialData.description));
      if (initialData.game_version) setGameVersion(initialData.game_version);
      if (initialData.youtube_url) setYoutubeUrl(initialData.youtube_url);
      if (initialData.source_url) setSourceUrl(initialData.source_url);
      if (initialData.difficulty) setDifficulty(initialData.difficulty);
      if (initialData.dlcs) setDlcs(initialData.dlcs);
      if (initialData.tags) setTags(normalizeBuildTags(initialData.tags));

      // Set empire selections
      if (initialData.origin) setSelectedOrigin(initialData.origin);
      if (initialData.authority) setSelectedAuthority(initialData.authority);
      setIsNomadic(!!initialData.is_nomadic);
      if (initialData.ark_type) setArkType(initialData.ark_type);
      if (initialData.planet_class) setSelectedPlanetClass(initialData.planet_class);
      if (initialData.graphical_culture) setSelectedShipset(initialData.graphical_culture);

      // Handle ethics (array of strings) - trim whitespace
      if (Array.isArray(initialData.ethics)) {
        setSelectedEthics(initialData.ethics.map((e: string) => e.trim()));
      }

      // Handle civics (array of strings) - trim whitespace
      if (Array.isArray(initialData.civics)) {
        setSelectedCivics(initialData.civics.map((c: string) => c.trim()));
      }

      // Handle traits (array of strings) - trim whitespace
      if (Array.isArray(initialData.traits)) {
        setSelectedTraits(initialData.traits.map((t: string) => t.trim()));
      }

      // Handle secondary traits (array of strings) - trim whitespace
      if (Array.isArray(initialData.secondary_traits)) {
        setSelectedSecondaryTraits(initialData.secondary_traits.map((t: string) => t.trim()));
      }

      // Handle species class and portrait
      if (initialData.species_class) {
        setSelectedSpeciesClass(initialData.species_class);
      }
      if (initialData.portrait) {
        setSelectedPortrait(initialData.portrait);
      }

      // Handle ruler trait (single string)
      if (initialData.ruler_trait) {
        setSelectedRulerTrait(initialData.ruler_trait);
      }

      // Handle ascension perks (array of strings) - trim whitespace
      if (Array.isArray(initialData.ascension_perks)) {
        setSelectedAscensionPerks(initialData.ascension_perks.map((p: string) => p.trim()));
      }

      // Handle traditions (array of strings) - trim whitespace
      if (Array.isArray(initialData.traditions)) {
        setSelectedTraditions(initialData.traditions.map((t: string) => t.trim()));
      }
    }
  }, [initialData]);

  // Validate authority when ethics change
  // No longer auto-clearing authority based on ethics - let user choose freely

  // Helper: Get archetype from selected species class
  const getSpeciesArchetype = (speciesClassId: string): string => {
    if (!speciesClassId) return 'BIOLOGICAL';
    const speciesClass = allSpeciesClasses.find(sc => sc.id === speciesClassId);
    return speciesClass?.archetype || 'BIOLOGICAL';
  };

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
    const speciesArchetype = getSpeciesArchetype(selectedSpeciesClass); // BIOLOGICAL, LITHOID, MACHINE, ROBOT

    // Check for species-specific bonuses
    const pointsKey = `${speciesArchetype}_species_trait_points_add`;
    const picksKey = `${speciesArchetype}_species_trait_picks_add`;

    return {
      pointsBonus: modifier[pointsKey] || 0,
      picksBonus: modifier[picksKey] || 0
    };
  };

  const { pointsBonus, picksBonus } = getOriginTraitBonuses();
  const archetypeBudget = speciesArchetypeBudgets[getSpeciesArchetype(selectedSpeciesClass)];
  const baseMaxTraitPoints = archetypeBudget?.trait_points ?? BASE_MAX_TRAIT_POINTS;
  const baseMaxTraitCount = archetypeBudget?.max_traits ?? BASE_MAX_TRAIT_COUNT;
  const MAX_TRAIT_POINTS = baseMaxTraitPoints + pointsBonus;
  const MAX_TRAIT_COUNT = baseMaxTraitCount + picksBonus;

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

  // Count traits that count towards the limit (exclude cost 0 traits like background traits)
  const countTraitsTowardsLimit = (): number => {
    return selectedTraits.filter(traitId => {
      const trait = allTraits.find(t => t.id === traitId);
      // Only count traits with non-zero cost
      return trait && typeof trait.cost === 'number' && trait.cost !== 0;
    }).length;
  };

  const currentTraitPoints = calculateTraitPoints();
  const currentTraitCount = countTraitsTowardsLimit();

  // Check if current selection exceeds limits
  const exceedsTraitCount = currentTraitCount > MAX_TRAIT_COUNT;
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

  // Homeworld planet rules (see utils/planetRules.ts). The planet is optional:
  // with no pick and nothing forcing one, every planet check below is skipped.
  const selectedOriginData = allOrigins.find(o => o.id === selectedOrigin);
  const traitById: Record<string, Trait> = Object.fromEntries(allTraits.map(t => [t.id, t]));
  const planetLabel = (planetId: string) => allPlanetClasses.find(p => p.id === planetId)?.name || planetId;
  const speciesLabel = (classId: string) => allSpeciesClasses.find(sc => sc.id === classId)?.name || classId;

  // An imported or saved portrait the picker does not offer (no image on the site) is dropped:
  // no portrait at all rather than a selection nobody can see
  useEffect(() => {
    if (!selectedPortrait) return;
    const speciesClass = allSpeciesClasses.find(sc => sc.id === selectedSpeciesClass);
    if (speciesClass && !speciesClass.portraits.includes(selectedPortrait)) {
      setSelectedPortrait('');
    }
  }, [allSpeciesClasses, selectedSpeciesClass, selectedPortrait]);
  const forcedPlanetClass = getForcedPlanetClass(isNomadic, selectedOriginData);
  // Only a selectable class counts as the user's pick - e.g. pc_habitat loaded
  // from a build saved with Void Dwellers is dropped once the origin changes.
  const pickedPlanetClass = allPlanetClasses.some(p => p.id === selectedPlanetClass && p.selectable) ? selectedPlanetClass : '';
  const effectivePlanetClass = getEffectivePlanetClass(isNomadic, selectedOriginData, pickedPlanetClass);
  // Ship appearance rules (see utils/shipsetRules.ts)
  const shipsetLabel = (shipsetId: string) => allShipsets.find(s => s.id === shipsetId)?.name || shipsetId;
  const pickedShipset = allShipsets.some(s => s.id === selectedShipset) ? selectedShipset : '';
  const shipsetSourceFor = (kind: 'Origin' | 'Civic' | 'Authority', item: { name: string; possible?: PredicateNode; potential?: PredicateNode }): ShipsetRuleSource =>
    ({ label: `${kind} "${item.name}"`, possible: item.possible, potential: item.potential });
  const selectedAuthorityData = allAuthorities.find(a => a.id === selectedAuthority);
  const shipsetRuleSources: ShipsetRuleSource[] = [
    ...(selectedOriginData ? [shipsetSourceFor('Origin', selectedOriginData)] : []),
    ...(selectedAuthorityData ? [shipsetSourceFor('Authority', selectedAuthorityData)] : []),
    ...selectedCivics.map(id => allCivics.find(c => c.id === id)).filter((c): c is Civic => !!c).map(c => shipsetSourceFor('Civic', c)),
  ];

  const planetRuleInput: PlanetRuleInput = {
    isNomadic,
    origin: selectedOriginData,
    civics: selectedCivics.map(id => allCivics.find(c => c.id === id)).filter((c): c is Civic => !!c),
    traitIds: selectedTraits,
    traitById,
  };

  // Check if a civic can be selected based on current selections
  const canSelectCivic = (civic: Civic): boolean => {
    // Already selected
    if (selectedCivics.includes(civic.id)) {
      return true;
    }

    // Incompatible with the picked ship appearance (e.g. a civic that forbids Biological ships)
    if (pickedShipset && getShipsetConflicts(pickedShipset, [shipsetSourceFor('Civic', civic)], shipsetLabel).length > 0) {
      return false;
    }

    // Incompatible with the homeworld (e.g. Anglers grants Aquatic, which needs an Ocean world)
    if (effectivePlanetClass && getPlanetConflicts(effectivePlanetClass, { isNomadic, civics: [civic], traitIds: [], traitById }, planetLabel).length > 0) {
      return false;
    }

    // Only check if at max slots - no complex compatibility rules
    if (selectedCivics.length >= MAX_CIVIC_SLOTS) {
      return false;
    }

    return true;
  };

  // Filter civics that require origins not available at empire creation
  const availableCivics = allCivics.filter(civic => {
    // Hardcoded filter: civic_galactic_sovereign_megacorp is not selectable at empire creation
    // despite having pickable_at_start: true. It's obtained during gameplay (Galactic Imperium).
    // Note: alternate_version field is empty, so we can't filter it automatically.
    if (civic.id === 'civic_galactic_sovereign_megacorp') {
      return false;
    }

    // Check if civic requires a specific origin that isn't offered at empire
    // creation (negated occurrences don't count - "NOT origin X" can't make an
    // origin unavailable, only a positive "origin == X" requirement can).
    const requiredOrigins = findFieldOccurrences(civic.potential, 'origin')
      .filter(o => !o.negated)
      .map(o => o.value as string);
    const hasUnavailableRequiredOrigin = requiredOrigins.some(
      requiredOrigin => !allOrigins.some(o => o.id === requiredOrigin)
    );
    if (hasUnavailableRequiredOrigin) {
      return false;
    }
    return true;
  });

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

  // Filter traits by species type and search query
  const filteredTraits = allTraits.filter(trait => {
    // Traits are restricted to specific archetypes both ways (e.g. Very Strong
    // is BIOLOGICAL/LITHOID only, Machine Unit is MACHINE/ROBOT only) - an
    // empty/missing list means no restriction (only 1 vanilla trait is like this).
    const speciesArchetype = getSpeciesArchetype(selectedSpeciesClass);
    const allowedArchetypes = Array.isArray(trait.allowed_archetypes) ? trait.allowed_archetypes : [];
    if (allowedArchetypes.length > 0 && !allowedArchetypes.includes(speciesArchetype)) {
      return false;
    }

    // Traits restricted to some homeworlds (e.g. Aquatic = Ocean only). A
    // selected one stays listed so it can still be unticked.
    if (!selectedTraits.includes(trait.id) && isTraitBlockedByPlanet(trait, effectivePlanetClass)) {
      return false;
    }

    // Filter by search query
    if (traitSearchQuery) {
      const query = traitSearchQuery.toLowerCase();
      return trait.name.toLowerCase().includes(query);
    }

    return true;
  });

  // Filter secondary species traits only by search query
  const filteredSecondaryTraits = allTraits.filter(trait => {
    // Filter by search query
    if (traitSearchQuery) {
      const query = traitSearchQuery.toLowerCase();
      return trait.name.toLowerCase().includes(query);
    }

    return true;
  });

  // Filter origins only by search query - no species archetype restrictions
  const filteredOrigins = allOrigins.filter(origin => {
    // Filter by species type (MACHINE vs NOT MACHINE). Origin is picked before
    // ethics/authority/civics in this form, so we deliberately only check the
    // species_archetype occurrences here rather than running the full
    // evaluator against `possible` - a full evaluation would read those
    // as-yet-unselected fields as "not chosen" and wrongly hide origins that
    // require a specific authority/ethic the user just hasn't picked yet.
    const speciesArchetypeOccurrences = findFieldOccurrences(origin.possible, 'species_archetype');
    const requiresMachine = speciesArchetypeOccurrences.some(o => !o.negated && o.value === 'MACHINE');
    const requiresNotMachine = speciesArchetypeOccurrences.some(o => o.negated && o.value === 'MACHINE');

    const speciesArchetype = getSpeciesArchetype(selectedSpeciesClass);
    const isMachineSpecies = speciesArchetype === 'MACHINE' || speciesArchetype === 'ROBOT';

    if (requiresMachine && !isMachineSpecies) {
      return false; // Origin requires MACHINE but species is not machine
    }
    if (requiresNotMachine && isMachineSpecies) {
      return false; // Origin requires NOT MACHINE but species is machine
    }

    // Origin incompatible with the picked ship appearance (Wilderness needs a Biological set, Red Giant forbids them)
    if (pickedShipset && origin.id !== selectedOrigin &&
        getShipsetConflicts(pickedShipset, [shipsetSourceFor('Origin', origin)], shipsetLabel).length > 0) {
      return false;
    }

    // Origin incompatible with the homeworld the user picked (e.g. Wilderness
    // forbids Volcanic). Origins that force their own planet are never hidden:
    // choosing one simply overrides the pick.
    const userPlanetClass = isNomadic ? 'pc_ark' : pickedPlanetClass;
    if (userPlanetClass && !origin.habitability_preference && origin.id !== selectedOrigin &&
        getPlanetConflicts(userPlanetClass, { isNomadic, origin, civics: [], traitIds: [], traitById }, planetLabel).length > 0) {
      return false;
    }

    // Filter by search query
    if (originSearchQuery) {
      const query = originSearchQuery.toLowerCase();
      return origin.name.toLowerCase().includes(query);
    }
    return true;
  });

  // Filter ascension perks based on search query
  const filteredAscensionPerks = allAscensionPerks.filter(perk => {
    if (ascensionPerkSearchQuery) {
      const query = ascensionPerkSearchQuery.toLowerCase();
      return perk.name.toLowerCase().includes(query);
    }
    return true;
  });

  // Filter ethics based on search query
  const filteredEthics = allEthics.filter(ethic => {
    if (ethicsSearchQuery) {
      const query = ethicsSearchQuery.toLowerCase();
      return ethic.name.toLowerCase().includes(query);
    }
    return true;
  });

  // Filter civics based on search query
  const filteredCivics = availableCivics.filter(civic => {
    if (civicsSearchQuery) {
      const query = civicsSearchQuery.toLowerCase();
      return civic.name.toLowerCase().includes(query);
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

    // Toggle selection
    if (selectedTraits.includes(traitId)) {
      setSelectedTraits(prev => prev.filter(t => t !== traitId));
    } else {
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

  // URL validation helper
  const isValidUrl = (urlString: string): boolean => {
    if (!urlString || urlString.trim() === '') {
      return true; // Empty is valid (optional field)
    }
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Validate URL and set error
  const validateYoutubeUrl = (url: string) => {
    if (url && !isValidUrl(url)) {
      setYoutubeUrlError('Please enter a valid URL starting with http:// or https://');
    } else {
      setYoutubeUrlError(null);
    }
  };

  const validateSourceUrl = (url: string) => {
    if (url && !isValidUrl(url)) {
      setSourceUrlError('Please enter a valid URL starting with http:// or https://');
    } else {
      setSourceUrlError(null);
    }
  };

  // Validation function to check if build is complete
  const isBuildComplete = (): boolean => {
    return (
      name.trim() !== '' &&
      selectedTraits.length > 0 &&
      // selectedOrigin is now optional (some builds may not specify an origin)
      selectedEthics.length > 0 &&
      selectedAuthority !== '' &&
      selectedCivics.length > 0
    );
  };

  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (name.trim() === '') missing.push('Build Name');
    if (selectedTraits.length === 0) missing.push('Species Traits');
    // Origin is optional, not included in missing fields
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
      isNomadic,
      arkType,
      selectedPlanetClass,
      selectedShipset,
      selectedSpeciesClass,
      selectedPortrait,
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
        setGameVersion(formData.game_version || '4.5');
        setYoutubeUrl(formData.youtube_url || '');
        setSourceUrl(formData.source_url || '');
        setDifficulty(formData.difficulty || '');
        setDlcs(formData.dlcs || '');
        setTags(normalizeBuildTags(formData.tags));
        setSelectedSpeciesClass(formData.selectedSpeciesClass || '');
        setSelectedPortrait(formData.selectedPortrait || '');
        setSelectedTraits(formData.selectedTraits || []);
        setSelectedSecondaryTraits(formData.selectedSecondaryTraits || []);
        setSelectedOrigin(formData.selectedOrigin || '');
        setSelectedEthics(formData.selectedEthics || []);
        setSelectedAuthority(formData.selectedAuthority || '');
        setIsNomadic(!!formData.isNomadic);
        setArkType(formData.arkType || '');
        setSelectedPlanetClass(formData.selectedPlanetClass || '');
        setSelectedShipset(formData.selectedShipset || '');
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

  // Google/Steam sign-in leaves the page: the draft saved before the redirect is
  // restored when the visitor comes back here logged in (App.tsx brings them back).
  // Not auto-submitted, unlike the in-modal local login: after a full round trip
  // the visitor should see what they are about to publish.
  useEffect(() => {
    if (!user || buildId || initialData) return;
    if (!localStorage.getItem('stellaris_build_draft')) return;
    restoreFormDataFromLocalStorage();
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const handleConfirmSubmitWithoutDescription = () => {
    setShowDescriptionWarning(false);
    skipDescriptionWarningRef.current = true;
    setTimeout(() => {
      document.getElementById('build-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 100);
  };

  const handleBackToDescription = () => {
    setShowDescriptionWarning(false);
    document.getElementById('buildDescription')?.focus();
  };

  // Resolves a raw predicate field/value (e.g. ethics="ethic_authoritarian")
  // to a human-readable label ("Authoritarian") using the game data already
  // loaded for this form, for use in the rule-warning messages below.
  const resolveRuleLabel = (field: string, value: unknown): string => {
    const id = String(value);
    switch (field) {
      case 'ethics': return allEthics.find(e => e.id === id)?.name || id;
      case 'civics': return allCivics.find(c => c.id === id)?.name || id;
      case 'authority': return allAuthorities.find(a => a.id === id)?.name || id;
      case 'origin': return allOrigins.find(o => o.id === id)?.name || id;
      case 'species_archetype': return id.charAt(0) + id.slice(1).toLowerCase();
      case 'preferred_planet_class': return planetLabel(id);
      case 'graphical_culture': return shipsetLabel(id);
      case 'traits': return allTraits.find(t => t.id === id)?.name || id;
      default: return id;
    }
  };

  // Experimental: check the completed build against the rules we can extract
  // from the game files. Only run once every relevant field is filled in
  // (submit time) - checking mid-form would misfire on fields the user
  // hasn't reached yet (origin is picked before ethics/authority/civics).
  const getRuleWarnings = (): string[] => {
    const ctx = {
      ethics: selectedEthics,
      authority: selectedAuthority,
      civics: selectedCivics,
      origin: selectedOrigin || undefined,
      species_archetype: getSpeciesArchetype(selectedSpeciesClass),
      species_class: selectedSpeciesClass || undefined,
      traits: selectedTraits,
      is_nomadic: isNomadic,
      preferred_planet_class: effectivePlanetClass,
      graphical_culture: pickedShipset || undefined,
    };

    const warnings: string[] = [];
    const addWarnings = (label: string, node: PredicateNode | undefined) => {
      getFailingNodes(node, ctx).forEach(failing =>
        warnings.push(`${label} requires ${describePredicateHuman(failing, resolveRuleLabel)}`)
      );
    };

    // Double-check civic count independently of the live MAX_CIVIC_SLOTS
    // disable - matters for edit mode, where a build published before this
    // was fixed (2026-08-10, was flat 3) can still have 3 loaded in.
    if (selectedCivics.length > MAX_CIVIC_SLOTS) {
      warnings.push(`Civics: ${selectedCivics.length} selected, but the game only allows ${MAX_CIVIC_SLOTS} at empire creation`);
    }

    // Double-check the archetype trait budget independently of the live
    // hasInvalidTraits button-disable, in case the two ever drift apart.
    if (currentTraitPoints > MAX_TRAIT_POINTS) {
      warnings.push(`Species traits: ${currentTraitPoints} trait points spent, but ${resolveRuleLabel('species_archetype', ctx.species_archetype)} species allow only ${MAX_TRAIT_POINTS}`);
    }
    if (currentTraitCount > MAX_TRAIT_COUNT) {
      warnings.push(`Species traits: ${currentTraitCount} traits selected, but ${resolveRuleLabel('species_archetype', ctx.species_archetype)} species allow only ${MAX_TRAIT_COUNT}`);
    }

    // Double-check trait/archetype compatibility independently of the live
    // filteredTraits list - matters for edit mode on a build saved before
    // this filter existed (e.g. biological-only traits on a Machine species).
    // Only when the archetype is actually known - an unset species class must
    // not be treated as "matches no archetype".
    if (ctx.species_archetype) {
      selectedTraits.forEach(traitId => {
        const trait = allTraits.find(t => t.id === traitId);
        const allowed = trait?.allowed_archetypes;
        if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(ctx.species_archetype)) {
          warnings.push(`Trait "${trait?.name || traitId}" is not allowed for ${resolveRuleLabel('species_archetype', ctx.species_archetype)} species`);
        }
      });
    }

    // Traits (picked or granted by the origin/civics) that the homeworld does
    // not allow. Origin/civic `preferred_planet_class` rules are covered by the
    // possible/potential checks below through ctx.preferred_planet_class.
    if (effectivePlanetClass) {
      warnings.push(...getTraitPlanetConflicts(effectivePlanetClass, planetRuleInput, planetLabel));
    }
    // A picked (not origin-forced) planet the species class is not offered
    // (Volcanic is Infernal-only, Infernals cannot pick cold worlds)
    const pickedPlanetData = allPlanetClasses.find(p => p.id === pickedPlanetClass);
    if (pickedPlanetData && !forcedPlanetClass) {
      const speciesConflict = getSpeciesPlanetConflict(pickedPlanetData, selectedSpeciesClass || undefined, speciesLabel);
      if (speciesConflict) warnings.push(speciesConflict);
    }

    if (selectedAuthority) {
      const authority = allAuthorities.find(a => a.id === selectedAuthority);
      if (authority) {
        addWarnings(`Authority "${authority.name}"`, authority.possible);
        addWarnings(`Authority "${authority.name}"`, authority.potential);
      }
    }

    if (selectedOrigin) {
      const origin = allOrigins.find(o => o.id === selectedOrigin);
      if (origin) {
        addWarnings(`Origin "${origin.name}"`, origin.possible);
        addWarnings(`Origin "${origin.name}"`, origin.potential);
      }
    }

    for (const civicId of selectedCivics) {
      const civic = allCivics.find(c => c.id === civicId);
      if (!civic) continue;
      addWarnings(`Civic "${civic.name}"`, civic.possible);
      addWarnings(`Civic "${civic.name}"`, civic.potential);
    }

    return warnings;
  };

  const handleConfirmSubmitWithRuleWarning = () => {
    setShowRuleWarning(false);
    skipRuleWarningRef.current = true;
    setTimeout(() => {
      document.getElementById('build-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 100);
  };

  const handleBackToEditFromRuleWarning = () => {
    setShowRuleWarning(false);
  };

  // Request body shared by account submissions (POST/PUT /api/builds) and guest ones
  const getBuildPayload = () => ({
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
    ruler_trait: selectedRulerTrait,
    species_class: selectedSpeciesClass,
    portrait: selectedPortrait,
    is_nomadic: isNomadic ? 1 : 0,
    ark_type: isNomadic ? arkType : null,
    planet_class: effectivePlanetClass || null,
    graphical_culture: pickedShipset || null,
  });

  // Publishing without an account: the build goes to the moderation queue. Only
  // reachable from the auth modal, i.e. after handleSubmit validated everything.
  const handleGuestSubmit = async (guestName: string, guestEmail: string, website: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/builds/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getBuildPayload(), guest_name: guestName, guest_email: guestEmail, website }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(data.details) ? `: ${data.details.join(', ')}` : '';
        trackFunnel('build_submit_error', { status: response.status, guest: true });
        return (data.error || 'Failed to submit the build') + details;
      }
      addGuestClaim({ token: data.claim_token, name });
      localStorage.removeItem('stellaris_build_draft');
      skipDescriptionWarningRef.current = false;
      skipRuleWarningRef.current = false;
      setShowGuestModal(false);
      trackEvent('build_submitted_guest', { game_version });
      navigate('/build-submitted', { state: { name, claimToken: data.claim_token, emailed: !!data.emailed } });
      return null;
    } catch {
      return 'Network error, please try again.';
    }
  };

  const handleCheckBuild = () => {
    const blocking: string[] = [];
    if (!isBuildComplete()) {
      blocking.push(`Missing required fields: ${getMissingFields().join(', ')}`);
    }
    if (hasInvalidTraits) blocking.push('Species trait limits exceeded');
    if (exceedsEthicsPoints) blocking.push('Ethics points exceeded');
    if ((youtube_url && !isValidUrl(youtube_url)) || (source_url && !isValidUrl(source_url))) {
      blocking.push('Invalid YouTube or source URL');
    }
    // Rule checks need the whole build (see getRuleWarnings), so only once it is complete
    const warnings = isBuildComplete() ? getRuleWarnings() : [];
    setCheckResult({ blocking, warnings });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate URLs before submission
    validateYoutubeUrl(youtube_url);
    validateSourceUrl(source_url);

    // Check if there are URL errors
    if (youtubeUrlError || sourceUrlError) {
      setError('Please fix the URL errors before submitting.');
      trackFunnel('build_form_invalid', { reason: 'url' });
      // Scroll to top to show the error and the invalid field
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check if URLs are valid (validate again in case state hasn't updated)
    if ((youtube_url && !isValidUrl(youtube_url)) || (source_url && !isValidUrl(source_url))) {
      setError('Please enter valid URLs or leave the fields empty.');
      trackFunnel('build_form_invalid', { reason: 'url' });
      // Scroll to top to show the error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check if build is complete
    if (!isBuildComplete()) {
      const missing = getMissingFields();
      setError(`Please complete the following required fields: ${missing.join(', ')}`);
      trackFunnel('build_form_invalid', { reason: 'missing_fields', missing_fields: missing.join(', ') });
      // Scroll to top to show the error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Warn if description is empty (create mode only), unless the user already confirmed
    if (!isEditMode && !description.trim() && !skipDescriptionWarningRef.current) {
      setShowDescriptionWarning(true);
      trackFunnel('build_form_warning', { warning: 'empty_description' });
      return;
    }

    // Experimental non-blocking check against extracted game rules (origin +
    // civics only for now). See TODO.md section 3b for the full plan.
    if (!skipRuleWarningRef.current) {
      const warnings = getRuleWarnings();
      if (warnings.length > 0) {
        setRuleWarnings(warnings);
        setShowRuleWarning(true);
        trackFunnel('build_form_warning', { warning: 'rule_conflict' });
        return;
      }
    }

    // Asked last, once the build is known to be complete: a visitor who did all the
    // work is far more likely to sign in (or publish as a guest) than one asked up
    // front. The warning skip flags are kept so the automatic resubmission after
    // an in-modal login does not ask the same questions again.
    if (!user) {
      // Save form data to localStorage before showing auth modal
      saveFormDataToLocalStorage();
      setShowAuthModal(true);
      trackFunnel('build_auth_prompt');
      return;
    }
    skipDescriptionWarningRef.current = false;
    skipRuleWarningRef.current = false;

    setSubmitting(true);

    try {
      const url = isEditMode ? `/api/builds/${buildId}` : '/api/builds';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(getBuildPayload()),
      });

      if (!response.ok) {
        // Try to get error message from response body
        const errorData = await response.json().catch(() => null);
        trackFunnel('build_submit_error', { status: response.status, guest: false });
        throw new Error(errorData?.error || 'Failed to create build.');
      }

      const data = await response.json();
      onBuildCreated(data.build);

      // Reset form
      setName('');
      setDescription('');
      setGameVersion('4.5'); // Reset to latest version
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
      setIsNomadic(false);
      setArkType('');
      setSelectedPlanetClass('');
      setSelectedShipset('');
      setSelectedCivics([]);
      setSelectedAscensionPerks([]);
      setSelectedTraditions([]);
      setSelectedRulerTrait('');

    } catch (err: any) {
      setError(err.message);
      // Scroll to top to show the error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card bg-dark border-secondary mb-4">
      <div className="card-body">
        <h3 className="card-title">{isEditMode ? 'Edit Build' : 'Create a New Build'}</h3>
        <form id="build-form" onSubmit={handleSubmit} onChangeCapture={handleFirstInteraction} onClickCapture={handleFirstInteraction}>
          {draftRestored && (
            <div className="alert alert-success alert-dismissible">
              <i className="bi bi-check-circle me-2"></i>
              Welcome back! Your build was restored - review it and click submit to publish it.
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setDraftRestored(false)}></button>
            </div>
          )}
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
              type="text"
              className={`form-control bg-secondary text-white border-secondary ${youtubeUrlError ? 'is-invalid' : ''}`}
              id="youtubeUrl"
              value={youtube_url}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                validateYoutubeUrl(e.target.value);
              }}
              onBlur={(e) => validateYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {youtubeUrlError && (
              <div className="text-danger small mt-1">
                {youtubeUrlError}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="sourceUrl" className="form-label">
              Source URL (Optional)
              <small className="text-muted d-block">Original source of this build (Reddit post, forum thread, etc.)</small>
            </label>
            <input
              type="text"
              className={`form-control bg-secondary text-white border-secondary ${sourceUrlError ? 'is-invalid' : ''}`}
              id="sourceUrl"
              value={source_url}
              onChange={(e) => {
                setSourceUrl(e.target.value);
                validateSourceUrl(e.target.value);
              }}
              onBlur={(e) => validateSourceUrl(e.target.value)}
              placeholder="https://www.reddit.com/r/Stellaris/..."
            />
            {sourceUrlError && (
              <div className="text-danger small mt-1">
                {sourceUrlError}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="gameVersion" className="form-label">Game Version</label>
            <select
              className="form-select bg-secondary text-white border-secondary"
              id="gameVersion"
              value={game_version}
              onChange={(e) => { userChangedVersion.current = true; setGameVersion(e.target.value); }}
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
              {DIFFICULTY_LEVELS.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label mb-2">
              Tags (Optional)
              <small className="text-muted d-block">
                Pick up to {MAX_TAGS_PER_BUILD} tags that describe how this build plays. Read each description - a wrong tag misleads players.
              </small>
            </label>
            <BuildTagPicker
              selected={tags ? tags.split(',') : []}
              onChange={(ids) => setTags(serializeBuildTags(ids))}
            />
          </div>

          {/* Species Class Selector */}
          <div className="mb-3">
            <label className="form-label">Species Class</label>
            <select
              className="form-select bg-secondary text-white border-secondary"
              value={selectedSpeciesClass}
              onChange={(e) => {
                setSelectedSpeciesClass(e.target.value);
                // Clear traits when changing species class to avoid invalid combinations
                setSelectedTraits([]);
                setSelectedSecondaryTraits([]);
              }}
            >
              <option value="">-- Select Species Class --</option>
              {allSpeciesClasses.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
            {selectedSpeciesClass && (
              <small className="text-muted">
                Archetype: {allSpeciesClasses.find(sc => sc.id === selectedSpeciesClass)?.archetype || 'Unknown'}
              </small>
            )}
          </div>

          {selectedSpeciesClass && (
            <div className="mb-3">
              <label className="form-label">
                Portrait ({allSpeciesClasses.find(sc => sc.id === selectedSpeciesClass)?.portraits.length || 0} available)
              </label>
              <div className="row g-2">
                {allSpeciesClasses
                  .find(sc => sc.id === selectedSpeciesClass)
                  ?.portraits.map(portraitId => (
                    <div key={portraitId} className="col-auto">
                      <div
                        className={`border rounded ${selectedPortrait === portraitId ? 'border-primary border-3' : 'border-secondary'}`}
                        style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onClick={() => setSelectedPortrait(portraitId)}
                        title={portraitId}
                      >
                        <img
                          src={`/portraits/${portraitId}.png`}
                          alt={portraitId}
                          loading="lazy"
                          style={{
                            width: '72px',
                            height: '72px',
                            objectFit: 'cover',
                            objectPosition: 'top',
                            display: 'block',
                            borderRadius: '4px',
                            opacity: selectedPortrait === portraitId ? 1 : 0.6,
                            transition: 'opacity 0.15s',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
              {!selectedPortrait && (
                <small className="text-muted d-block mt-1">
                  Click on a portrait to select it
                </small>
              )}
            </div>
          )}

          {/* Species Traits */}
          <div className="mb-3">
            <label className="form-label">
              Species Traits ({currentTraitCount}/{MAX_TRAIT_COUNT} traits, {currentTraitPoints}/{MAX_TRAIT_POINTS} points)
            </label>

            {/* Origin Bonus Display */}
            {(pointsBonus > 0 || picksBonus > 0) && (
              <div className="alert alert-success mb-2">
                <strong>Origin Bonus:</strong>
                {pointsBonus > 0 && <span className="ms-2">+{pointsBonus} trait points</span>}
                {picksBonus > 0 && <span className="ms-2">+{picksBonus} trait pick{picksBonus > 1 ? 's' : ''}</span>}
                <small className="d-block mt-1">
                  Base limits: {baseMaxTraitCount} traits, {baseMaxTraitPoints} points
                </small>
              </div>
            )}

            {/* Warning if limits exceeded */}
            {hasInvalidTraits && (
              <div id="trait-validation-error" className="alert alert-danger mb-2">
                <strong>⚠️ Trait limits exceeded!</strong>
                <div className="mt-1">
                  {exceedsTraitCount && (
                    <div id="trait-count-error">You have {currentTraitCount} traits but the limit is {MAX_TRAIT_COUNT}. Please deselect {currentTraitCount - MAX_TRAIT_COUNT} trait{currentTraitCount - MAX_TRAIT_COUNT > 1 ? 's' : ''}.</div>
                  )}
                  {exceedsTraitPoints && (
                    <div id="trait-points-error">You have {currentTraitPoints} points but the limit is {MAX_TRAIT_POINTS}. Please adjust your trait selection.</div>
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
                  <strong>Traits:</strong> {currentTraitCount} / {MAX_TRAIT_COUNT}
                  {selectedTraits.length !== currentTraitCount && (
                    <span className="text-muted ms-1">({selectedTraits.length} total)</span>
                  )}
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

                    // Check if this is a background trait and if another background trait is already selected
                    const isBackgroundTrait = Array.isArray(trait.tags) && trait.tags.includes('background');
                    const selectedBackgroundTrait = selectedTraits.find(id => {
                      const t = allTraits.find(trait => trait.id === id);
                      return t && Array.isArray(t.tags) && t.tags.includes('background');
                    });

                    // Disable if this is a background trait and another background trait is selected
                    const isDisabled = !!(isBackgroundTrait && selectedBackgroundTrait && selectedBackgroundTrait !== trait.id);

                    return (
                      <div
                        key={trait.id}
                        className="form-check mb-2 pb-2 border-bottom border-dark"
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`trait-${trait.id}`}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => handleTraitChange(trait.id)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`trait-${trait.id}`}
                          style={{
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.5 : 1
                          }}
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

              {/* Secondary Species Class Selector - for origins with secondary species */}
              {/* TODO: Implement secondary species class selector for compatible origins */}

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
                {/* None option - Origin is optional */}
                <div className={`form-check mb-2 pb-2 border-bottom border-dark ${!selectedOrigin ? 'bg-primary bg-opacity-25' : ''}`}>
                  <input
                    className="form-check-input"
                    type="radio"
                    id="origin-none"
                    name="origin"
                    checked={!selectedOrigin}
                    onChange={() => setSelectedOrigin('')}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="origin-none"
                    style={{ cursor: 'pointer' }}
                  >
                    <strong className="text-muted">None (standard origin)</strong>
                  </label>
                </div>

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
                          onChange={() => {
                            // Toggle: if already selected, deselect it
                            setSelectedOrigin(isSelected ? '' : origin.id);
                          }}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`origin-${origin.id}`}
                          style={{ cursor: 'pointer' }}
                          title={origin.description || 'No description available'}
                          onClick={(e) => {
                            // Allow clicking on label to toggle selection
                            e.preventDefault();
                            setSelectedOrigin(isSelected ? '' : origin.id);
                          }}
                        >
                          <img
                            src={`/icons/origin_original/${origin.id}.png${ORIGIN_IMAGE_QUERY}`}
                            alt=""
                            width={48}
                            height={48}
                            loading="lazy"
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

          {/* Homeworld Planet Class (optional) - same layout as the in-game picker */}
          {allPlanetClasses.length > 0 && (() => {
            const COLUMN_COLORS: Record<string, string> = { dry: '#e0d050', wet: '#5cd65c', cold: '#6fd3e0', volcanic: '#ff6a4d' };
            const forcedPlanet = forcedPlanetClass ? allPlanetClasses.find(p => p.id === forcedPlanetClass) : undefined;
            // The grid stays visible (locked) when the origin forces one of its own
            // planets (Red Giant -> Volcanic, Ocean Paradise -> Ocean), like in-game.
            // Planets outside the grid (Habitat, Gaia, Arkship...) get a simple card.
            const isLocked = !!forcedPlanetClass;
            const showGrid = !forcedPlanetClass || !!forcedPlanet?.selectable;
            const columns = getPlanetPickerColumns(allPlanetClasses, selectedSpeciesClass || undefined, forcedPlanetClass);
            const shownPlanet = allPlanetClasses.find(p => p.id === effectivePlanetClass);
            const lockReason = isNomadic
              ? 'Nomadic empires always live on an Arkship.'
              : `Set by the origin "${selectedOriginData?.name || selectedOrigin}".`;
            const pickedPlanet = allPlanetClasses.find(p => p.id === pickedPlanetClass);
            const pickWarnings = !isLocked && pickedPlanet ? [
              getSpeciesPlanetConflict(pickedPlanet, selectedSpeciesClass || undefined, speciesLabel),
              ...getPlanetConflicts(pickedPlanet.id, planetRuleInput, planetLabel),
            ].filter((w): w is string => !!w) : [];

            const renderPlanetTile = (planet: PlanetClass) => {
              const isSelected = effectivePlanetClass === planet.id;
              const conflicts = isLocked ? [] : getPlanetConflicts(planet.id, planetRuleInput, planetLabel);
              const isDisabled = isLocked ? !isSelected : (!isSelected && conflicts.length > 0);
              return (
                <button
                  key={planet.id}
                  type="button"
                  className="btn btn-link text-decoration-none d-flex flex-column align-items-center p-1"
                  disabled={isDisabled}
                  title={[planet.name, isLocked ? lockReason : '', ...conflicts].filter(Boolean).join('\n')}
                  onClick={() => { if (!isLocked) setSelectedPlanetClass(isSelected ? '' : planet.id); }}
                  style={{ opacity: isDisabled ? 0.3 : 1, cursor: isLocked ? 'default' : (isDisabled ? 'not-allowed' : 'pointer') }}
                >
                  <img
                    src={planet.icon}
                    alt=""
                    width={72}
                    height={72}
                    loading="lazy"
                    style={{
                      borderRadius: '50%',
                      // Only the selected planet gets a ring - colored rings on every planet made the pick hard to spot
                      border: `3px solid ${isSelected ? '#fd7e14' : 'transparent'}`,
                      boxShadow: isSelected ? '0 0 10px #fd7e14' : undefined,
                    }}
                  />
                  <span className={`small mt-1 ${isSelected ? 'text-warning fw-bold' : 'text-light'}`}>{planet.name}</span>
                </button>
              );
            };

            return (
              <div className="mb-3">
                <label className="form-label">
                  Homeworld / Climate preference <small className="text-muted">(optional)</small>
                  {effectivePlanetClass && <span className="badge bg-success ms-2">Selected</span>}
                </label>
                {selectedOriginData?.starting_colony && !isLocked && (
                  <small className="d-block text-info mb-2">
                    With "{selectedOriginData.name}" your capital starts on a {planetLabel(selectedOriginData.starting_colony)} -
                    the choice below sets your species' climate preference.
                  </small>
                )}
                {showGrid ? (
                  <>
                    <div className="row g-2">
                      {/* Selected planet info, like the in-game left panel */}
                      <div className="col-12 col-lg-3">
                        <div className="border border-secondary rounded p-3 h-100">
                          {shownPlanet ? (
                            <>
                              <h6 className="text-white mb-1">{shownPlanet.name}</h6>
                              {shownPlanet.climate_name && (
                                <small className="d-block fw-bold mb-2" style={{ color: COLUMN_COLORS[shownPlanet.climate || ''] }}>
                                  {shownPlanet.climate_name} climate
                                </small>
                              )}
                              <small className="text-light d-block">{shownPlanet.description}</small>
                              {isLocked && <small className="d-block text-info mt-2"><i className="bi bi-lock-fill me-1"></i>{lockReason}</small>}
                            </>
                          ) : (
                            <small className="text-muted">No homeworld specified. Pick a planet to record the species' climate preference.</small>
                          )}
                        </div>
                      </div>
                      {columns.map(column => (
                        <div key={column.id} className="col-4 col-lg-3">
                          <div className="border border-secondary rounded py-2 h-100 d-flex flex-column align-items-center">
                            <span className="fw-bold mb-1" style={{ color: COLUMN_COLORS[column.id] || '#adb5bd' }}>{column.name}</span>
                            <div className="flex-grow-1 d-flex flex-column justify-content-center">
                              {column.planets.map(renderPlanetTile)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        className={`btn btn-sm mt-2 ${!pickedPlanetClass ? 'btn-primary' : 'btn-outline-light'}`}
                        onClick={() => setSelectedPlanetClass('')}
                      >
                        Not specified
                      </button>
                    )}
                  </>
                ) : (
                  <div className="d-flex align-items-center p-3 border border-secondary rounded" style={{ maxWidth: '520px' }}>
                    <img src={`/icons/planets/${forcedPlanetClass}.png`} alt="" width={76} height={76} style={{ marginRight: '16px' }} />
                    <div>
                      <strong className="text-white fs-5">{planetLabel(forcedPlanetClass!)}</strong>
                      <small className="d-block text-muted"><i className="bi bi-lock-fill me-1"></i>{lockReason}</small>
                    </div>
                  </div>
                )}
                {pickWarnings.map((warning, idx) => (
                  <small key={idx} className="d-block text-warning mt-1">{warning}</small>
                ))}
              </div>
            );
          })()}

          {/* Ship Appearance (optional) - grouped like the in-game "Ship models" list */}
          {allShipsets.length > 0 && (
            <div className="mb-3">
              <label className="form-label">
                Ship appearance <small className="text-muted">(optional)</small>
                {pickedShipset && <span className="badge bg-success ms-2">{shipsetLabel(pickedShipset)}</span>}
              </label>
              {(['biological', 'mechanical'] as const).map(category => {
                const shipsets = allShipsets.filter(s => s.category === category);
                if (shipsets.length === 0) return null;
                return (
                  <div key={category} className="mb-2">
                    <small className="d-block text-muted fw-bold mb-1">{category === 'biological' ? 'Biological' : 'Mechanical'}</small>
                    <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-5 g-2">
                      {shipsets.map(shipset => {
                        const isSelected = pickedShipset === shipset.id;
                        const conflicts = getShipsetConflicts(shipset.id, shipsetRuleSources, shipsetLabel);
                        const isDisabled = !isSelected && conflicts.length > 0;
                        return (
                          <div key={shipset.id} className="col">
                            <button
                              type="button"
                              className="btn btn-link text-decoration-none w-100 p-1 rounded d-flex flex-column align-items-center"
                              disabled={isDisabled}
                              title={[shipset.name, ...conflicts].join('\n')}
                              onClick={() => setSelectedShipset(isSelected ? '' : shipset.id)}
                              style={{
                                // Inline border (Bootstrap's .border is !important and would hide the selection color)
                                border: `${isSelected ? 2 : 1}px solid ${isSelected ? '#fd7e14' : '#495057'}`,
                                boxShadow: isSelected ? '0 0 8px rgba(253, 126, 20, 0.6)' : undefined,
                                backgroundColor: '#14191b',
                                opacity: isDisabled ? 0.3 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <img src={shipset.image} alt="" loading="lazy" style={{ width: '100%', maxWidth: '160px', aspectRatio: '2 / 1', objectFit: 'contain' }} />
                              <span className={`small ${isSelected ? 'text-warning fw-bold' : 'text-light'}`}>{shipset.name}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={`btn btn-sm mt-1 ${!pickedShipset ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setSelectedShipset('')}
              >
                Not specified
              </button>
              {pickedShipset && getShipsetConflicts(pickedShipset, shipsetRuleSources, shipsetLabel).map((conflict, idx) => (
                <small key={idx} className="d-block text-warning mt-1">{conflict}</small>
              ))}
            </div>
          )}

          {/* Starting Ruler Trait Selection */}
          <div className="mb-3">
            <label className="form-label">
              Starting Ruler Trait {selectedRulerTrait && <span className="badge bg-success ms-2">Selected</span>}
            </label>

            <div className="card bg-secondary" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="card-body">
                {/* None option */}
                <div className={`form-check mb-2 pb-2 border-bottom border-dark ${!selectedRulerTrait ? 'bg-primary bg-opacity-25' : ''}`}>
                  <input
                    className="form-check-input"
                    type="radio"
                    id="ruler-trait-none"
                    name="ruler_trait"
                    checked={!selectedRulerTrait}
                    onChange={() => setSelectedRulerTrait('')}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="ruler-trait-none"
                    style={{ cursor: 'pointer' }}
                  >
                    <strong className="text-muted">None (no starting ruler trait)</strong>
                  </label>
                </div>

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
                          onChange={() => {
                            // Toggle: if already selected, deselect it
                            setSelectedRulerTrait(isSelected ? '' : trait.id);
                          }}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`ruler-trait-${trait.id}`}
                          style={{ cursor: 'pointer' }}
                          title={trait.description || 'No description available'}
                          onClick={(e) => {
                            // Allow clicking on label to toggle selection
                            e.preventDefault();
                            setSelectedRulerTrait(isSelected ? '' : trait.id);
                          }}
                        >
                          {trait.icon && (
                            <img
                              src={trait.icon}
                              alt=""
                              width={32}
                              height={32}
                              loading="lazy"
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

          {/* Nomadic Empire (Nomads DLC) — only available in 4.4+ */}
          {supportsNomadic(game_version) && <div className="mb-3">
            <div
              className="card border-2"
              style={{ borderColor: isNomadic ? '#e8a838' : '#6c757d', backgroundColor: isNomadic ? 'rgba(232, 168, 56, 0.08)' : undefined }}
            >
              <div className="card-body p-3">
                <div className="d-flex align-items-center gap-3">
                  <img src="/icons/nomad_toggle.png" width={64} height={64} alt="Nomadic Empire" style={{ flexShrink: 0 }} />
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        id="is-nomadic"
                        checked={isNomadic}
                        onChange={(e) => {
                          setIsNomadic(e.target.checked);
                          if (!e.target.checked) setArkType('');
                        }}
                      />
                      <label className="form-check-label mb-0" htmlFor="is-nomadic" style={{ cursor: 'pointer' }}>
                        <strong className="text-white fs-6">Nomadic Empire</strong>
                        <span className="badge bg-warning text-dark ms-2 fw-normal">Nomads DLC</span>
                      </label>
                    </div>
                    <p className="text-muted small mb-0">Your empire starts aboard a fleet of ark ships instead of a home planet.</p>
                  </div>
                </div>
                {isNomadic && (
                  <div className="mt-3 pt-3 border-top border-secondary">
                    <div className="form-label mb-2">Ark Ship Type</div>
                    <div className="d-flex gap-2 flex-wrap mb-2">
                      {[
                        { value: 'civilian_arkship', label: 'Civilian', icon: '/icons/tech_civilian_arkship.png' },
                        { value: 'science_arkship', label: 'Science', icon: '/icons/tech_science_arkship.png' },
                        { value: 'military_arkship', label: 'Military', icon: '/icons/tech_military_arkship.png' },
                      ].map(opt => {
                        const selected = arkType === opt.value;
                        const arkData = allArkTypes.find(a => a.id === opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setArkType(selected ? '' : opt.value)}
                            title={arkData ? arkData.modifiers.map(m => `${m.label}: ${m.tier1}`).join(' | ') : ''}
                            className={`btn d-flex align-items-center gap-2 ${selected ? 'btn-success' : 'btn-outline-secondary'}`}
                          >
                            <img src={opt.icon} width={32} height={32} alt={opt.label} />
                            {arkData?.name || `${opt.label} Arkship`}
                          </button>
                        );
                      })}
                    </div>
                    {/* Show selected ark type characteristics */}
                    {arkType && (() => {
                      const arkData = allArkTypes.find(a => a.id === arkType);
                      if (!arkData) return null;
                      return (
                        <div className="alert alert-secondary py-2 px-3 mb-0">
                          <div className="small text-white-50 mb-1">Unique modifiers per tier (I / II / III)</div>
                          {arkData.modifiers.map(mod => (
                            <div key={mod.key} className="small">
                              <span className="text-light">{mod.label}:</span>{' '}
                              <span className="text-success">{mod.tier1}</span>
                              {' / '}
                              <span className="text-success">{mod.tier2}</span>
                              {' / '}
                              <span className="text-success">{mod.tier3}</span>
                            </div>
                          ))}
                          {arkData.features.length > 0 && (
                            <div className="mt-1 text-white-50 small">
                              {arkData.features.map((f, i) => <div key={i}>{f}</div>)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>}

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
                          onChange={() => {
                            // Toggle: if already selected, deselect it
                            setSelectedAuthority(isSelected ? '' : authority.id);
                          }}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`authority-${authority.id}`}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            // Allow clicking on label to toggle selection
                            e.preventDefault();
                            setSelectedAuthority(isSelected ? '' : authority.id);
                          }}
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
            {submitting ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update Build' : 'Submit Build')}
          </button>
          <button type="button" className="btn btn-outline-info ms-2" onClick={handleCheckBuild} disabled={submitting}>
            <i className="bi bi-clipboard-check me-1"></i>
            Check Build
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
        onClose={() => {
          setShowAuthModal(false);
          // Back to editing: the warnings must be shown again on the next submit
          skipDescriptionWarningRef.current = false;
          skipRuleWarningRef.current = false;
        }}
        onSuccess={handleAuthSuccess}
        onContinueAsGuest={isEditMode ? undefined : () => {
          setShowAuthModal(false);
          setShowGuestModal(true);
          trackFunnel('build_guest_started');
        }}
      />
      <GuestSubmitModal
        show={showGuestModal}
        onClose={() => {
          setShowGuestModal(false);
          skipDescriptionWarningRef.current = false;
          skipRuleWarningRef.current = false;
        }}
        onBack={() => {
          setShowGuestModal(false);
          setShowAuthModal(true);
        }}
        onSubmit={handleGuestSubmit}
      />

      {/* Description Warning Modal */}
      {showDescriptionWarning && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleBackToDescription(); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-white border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                  No Description Yet
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={handleBackToDescription}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  Your build doesn't have a description. Adding one helps other players quickly understand its
                  theme and playstyle. Do you want to go back and add one, or submit as is?
                </p>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary" onClick={handleBackToDescription}>
                  Go Back &amp; Add Description
                </button>
                <button type="button" className="btn btn-warning" onClick={handleConfirmSubmitWithoutDescription}>
                  Submit Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check Build result modal */}
      {checkResult && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setCheckResult(null); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-white border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">
                  {checkResult.blocking.length === 0 && checkResult.warnings.length === 0 ? (
                    <><i className="bi bi-check-circle text-success me-2"></i>Build looks valid</>
                  ) : (
                    <><i className="bi bi-exclamation-triangle text-warning me-2"></i>Build Check</>
                  )}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setCheckResult(null)}></button>
              </div>
              <div className="modal-body">
                {checkResult.blocking.length === 0 && checkResult.warnings.length === 0 && (
                  <p className="mb-0">
                    No problem found. The build can be submitted. The rule check is experimental and may miss
                    some conflicts, so use it as a hint, not a guarantee.
                  </p>
                )}
                {checkResult.blocking.length > 0 && (
                  <>
                    <p className="mb-1 text-danger"><strong>Must be fixed before submitting:</strong></p>
                    <ul className={checkResult.warnings.length > 0 ? 'mb-3' : 'mb-0'}>
                      {checkResult.blocking.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </>
                )}
                {checkResult.warnings.length > 0 && (
                  <>
                    <p className="mb-1">
                      <span className="badge bg-secondary me-2">Experimental</span>
                      <strong>Possible rule conflicts:</strong>
                    </p>
                    <ul className="mb-0">
                      {checkResult.warnings.map((warning, idx) => (
                        <li key={idx}><code className="text-warning-emphasis">{warning}</code></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary" onClick={() => setCheckResult(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Violation Warning Modal (experimental) */}
      {showRuleWarning && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleBackToEditFromRuleWarning(); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-white border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                  Possible Rule Conflict
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={handleBackToEditFromRuleWarning}></button>
              </div>
              <div className="modal-body">
                <p>
                  <span className="badge bg-secondary me-2">Experimental</span>
                  This build combination might not be valid in-game, based on rules we extract from the game
                  files. This check is new and may have false positives or miss real conflicts - use it as a hint,
                  not a guarantee.
                </p>
                <ul className="mb-0">
                  {ruleWarnings.map((warning, idx) => (
                    <li key={idx}><code className="text-warning-emphasis">{warning}</code></li>
                  ))}
                </ul>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary" onClick={handleBackToEditFromRuleWarning}>
                  Go Back &amp; Edit
                </button>
                <button type="button" className="btn btn-warning" onClick={handleConfirmSubmitWithRuleWarning}>
                  Submit Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom comparison function: only re-render if initialData or buildId changes
const arePropsEqual = (prevProps: BuildFormProps, nextProps: BuildFormProps) => {
  return prevProps.initialData === nextProps.initialData && prevProps.buildId === nextProps.buildId;
};

// Wrap with React.memo to prevent unnecessary re-renders
export const BuildForm = React.memo(BuildFormComponent, arePropsEqual);
