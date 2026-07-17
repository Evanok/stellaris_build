import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// --- Tree data types (mirrors backend/data/build_finder_tree.json) ---
interface TreeOption {
  label: string;
  description?: string;
  next: string;
}

interface QuestionNode {
  type: 'question';
  question: string;
  subtitle?: string;
  options: TreeOption[];
}

interface ResultNode {
  type: 'result';
  title: string;
  blurb?: string;
  build_ids: number[];
}

type TreeNode = QuestionNode | ResultNode;

interface FinderTree {
  version: number;
  root: string;
  nodes: Record<string, TreeNode>;
}

// --- Resolved build (subset of the enriched build returned by the API) ---
interface FinderBuild {
  id: number;
  name: string;
  description?: string;
  game_version?: string;
  difficulty?: string;
  origin?: string;
  authority?: string;
  ethics?: string;
  portrait?: string;
  author_username?: string;
  origin_name?: string | null;
  authority_name?: string | null;
}

const DIFFICULTY_BADGE: Record<string, { label: string; className: string }> = {
  balanced: { label: 'Balanced', className: 'bg-success' },
  challenging: { label: 'Challenging', className: 'bg-warning text-dark' },
  strong: { label: 'Strong', className: 'bg-info text-dark' },
};

const decodeHtmlEntities = (text: string): string => {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
};

const prettifyId = (id: string, prefix: RegExp): string =>
  id.replace(prefix, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const ResultBuildCard: React.FC<{ build: FinderBuild }> = ({ build }) => {
  const diff = build.difficulty ? DIFFICULTY_BADGE[build.difficulty] : undefined;
  return (
    <div className="col">
      <Link to={`/build/${build.id}`} className="text-decoration-none">
        <div className="card h-100 bg-secondary border-secondary finder-result-card">
          <div className="card-body">
            <div className="d-flex align-items-start gap-2 mb-2">
              {build.portrait && (
                <img
                  src={`/portraits/${build.portrait}.png`}
                  alt=""
                  loading="lazy"
                  style={{ width: '48px', height: '48px', objectFit: 'cover', objectPosition: 'top', borderRadius: '6px', border: '2px solid #0dcaf0', flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-grow-1">
                <h5 className="card-title text-white fw-bold mb-1">{decodeHtmlEntities(build.name)}</h5>
                {diff && <span className={`badge ${diff.className}`}>{diff.label}</span>}
              </div>
            </div>
            {build.origin && (
              <div className="mb-1">
                <small className="text-muted">Origin: </small>
                <small className="text-info">
                  {build.origin_name || prettifyId(build.origin, /^origin_/)}
                </small>
              </div>
            )}
            {build.authority && (
              <div className="mb-2">
                <small className="text-muted">Authority: </small>
                <small className="text-light">
                  {build.authority_name || prettifyId(build.authority, /^auth_/)}
                </small>
              </div>
            )}
            {build.author_username && (
              <div className="text-muted small">by {build.author_username}</div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

const BuildFinder: React.FC = () => {
  const [tree, setTree] = useState<FinderTree | null>(null);
  const [error, setError] = useState<string | null>(null);

  // path = ids of every node visited, last element is the current node.
  const [path, setPath] = useState<string[]>([]);
  // answers = the option label picked at each question, aligned with path.
  const [answers, setAnswers] = useState<string[]>([]);

  // Result screen state
  const [results, setResults] = useState<FinderBuild[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/build-finder-tree')
      .then(res => res.json())
      .then((data: FinderTree) => {
        setTree(data);
        setPath([data.root]);
      })
      .catch(() => setError('Failed to load the build finder.'));
  }, []);

  const currentNode: TreeNode | null =
    tree && path.length ? tree.nodes[path[path.length - 1]] : null;

  // When we land on a result node, resolve its build ids into full builds.
  useEffect(() => {
    if (!currentNode || currentNode.type !== 'result') {
      setResults([]);
      return;
    }
    let cancelled = false;
    setResultsLoading(true);
    fetch(`/api/finder/builds?ids=${currentNode.build_ids.join(',')}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) { setResults(data.builds || []); setResultsLoading(false); } })
      .catch(() => { if (!cancelled) { setResults([]); setResultsLoading(false); } });
    return () => { cancelled = true; };
  }, [currentNode]);

  const chooseOption = (option: TreeOption) => {
    setPath(prev => [...prev, option.next]);
    setAnswers(prev => [...prev, option.label]);
  };

  const goBack = () => {
    setPath(prev => prev.slice(0, -1));
    setAnswers(prev => prev.slice(0, -1));
  };

  const restart = () => {
    if (!tree) return;
    setPath([tree.root]);
    setAnswers([]);
  };

  const questionCount = tree
    ? Object.values(tree.nodes).filter(n => n.type === 'question').length
    : 0;
  const currentStep = answers.length + 1;

  return (
    <div className="container py-4">
      <Helmet>
        <title>Find Your Build - Stellaris Build Finder</title>
        <meta name="description" content="Answer a few questions and get Stellaris empire builds tailored to how you want to play." />
      </Helmet>

      <div className="text-center mb-4">
        <h1 className="fw-bold text-white">Find Your Build</h1>
        <p className="text-muted">Answer a few questions and we'll suggest builds that fit your style.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!tree && !error && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {currentNode && currentNode.type === 'question' && (
        <div className="mx-auto" style={{ maxWidth: '720px' }}>
          <div className="text-muted small mb-2">Question {currentStep} of {questionCount}</div>
          <h2 className="text-white mb-1">{currentNode.question}</h2>
          {currentNode.subtitle && <p className="text-muted mb-4">{currentNode.subtitle}</p>}

          <div className="d-grid gap-3">
            {currentNode.options.map((option, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-outline-info text-start p-3 finder-option"
                onClick={() => chooseOption(option)}
              >
                <span className="fw-bold d-block">{option.label}</span>
                {option.description && (
                  <small className="text-muted d-block mt-1">{option.description}</small>
                )}
              </button>
            ))}
          </div>

          {path.length > 1 && (
            <button type="button" className="btn btn-link text-muted mt-4 px-0" onClick={goBack}>
              &larr; Back
            </button>
          )}
        </div>
      )}

      {currentNode && currentNode.type === 'result' && (
        <div className="mx-auto" style={{ maxWidth: '960px' }}>
          <div className="text-center mb-4">
            <h2 className="text-white">{currentNode.title}</h2>
            {currentNode.blurb && <p className="text-muted">{currentNode.blurb}</p>}
            {answers.length > 0 && (
              <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
                {answers.map((answer, idx) => (
                  <span key={idx} className="badge bg-dark border border-secondary text-light">{answer}</span>
                ))}
              </div>
            )}
          </div>

          {resultsLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="alert alert-warning">
              No matching builds are available yet for this combination. Try different answers, or browse all builds.
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
              {results.map(build => <ResultBuildCard key={build.id} build={build} />)}
            </div>
          )}

          <div className="d-flex justify-content-center gap-3 mt-4">
            <button type="button" className="btn btn-outline-light" onClick={goBack}>
              &larr; Back
            </button>
            <button type="button" className="btn btn-primary" onClick={restart}>
              Start over
            </button>
            <Link to="/" className="btn btn-outline-secondary">Browse all builds</Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildFinder;
