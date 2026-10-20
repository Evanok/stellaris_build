import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import Footer from './components/Footer';
import { GoogleAnalytics } from './components/GoogleAnalytics';
import { FeedbackButton } from './components/FeedbackButton';
import { SetEmailModal } from './components/SetEmailModal';
import { useAuth } from './AuthContext';
import { consumePostLoginRedirect } from './utils/postLoginRedirect';
import { getGuestClaims, removeGuestClaim, claimBuild } from './utils/guestClaims';
import { trackEvent } from './utils/analytics';
import { Home } from './pages/Home';
import Login from './pages/Login';

// Lazy load heavy pages (with recharts, large forms, etc.)
const CreateChoice = lazy(() => import('./pages/CreateChoice'));
const CreateManual = lazy(() => import('./pages/CreateManual'));
const EditBuild = lazy(() => import('./pages/EditBuild'));
const ImportSave = lazy(() => import('./pages/ImportSave'));
const ImportEmpireDesigns = lazy(() => import('./pages/ImportEmpireDesigns'));
const BuildDetail = lazy(() => import('./pages/BuildDetail').then(module => ({ default: module.BuildDetail })));
const Stats = lazy(() => import('./pages/Stats'));
const AdminStats = lazy(() => import('./pages/AdminStats'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Resources = lazy(() => import('./pages/Resources'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const GuestSubmitted = lazy(() => import('./pages/GuestSubmitted'));
const ClaimBuild = lazy(() => import('./pages/ClaimBuild'));
const PendingBuilds = lazy(() => import('./pages/PendingBuilds'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

// Helper to get a random background image
const getRandomBackground = () => {
  if (typeof window !== 'undefined' && window.innerWidth <= 768) return null;
  const images = [
    'load_12.webp', 'load_13.webp', 'load_14.webp', 'load_15.webp',
    'load_16.webp', 'load_17.webp', 'load_18.webp', 'Load_19.webp'
  ];
  return images[Math.floor(Math.random() * images.length)];
};

// AppContent component that uses useLocation
const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [showSetEmailModal, setShowSetEmailModal] = useState(false);
  const [claimedNames, setClaimedNames] = useState<string[]>([]);

  // Load background after first render so it doesn't block initial paint
  useEffect(() => {
    setBackgroundImage(getRandomBackground());
  }, [location.pathname]);

  // Back to the page that sent the visitor to log in (all login paths end on '/')
  useEffect(() => {
    if (!user) return;
    const redirect = consumePostLoginRedirect();
    if (redirect && redirect !== location.pathname) navigate(redirect, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Builds this browser submitted without an account are attached to the account
  // as soon as the visitor signs in. Tokens that can no longer be claimed (invalid,
  // rejected, taken) are dropped; network errors keep them for the next visit.
  // Never for admins: they enter builds on behalf of other people (e.g. a Reddit
  // author, credited under their name as a guest), and logging in on the same
  // browser would silently take those builds over. Their tokens are left untouched.
  useEffect(() => {
    if (!user || user.is_admin === 1) return;
    const claims = getGuestClaims();
    if (!claims.length) return;
    Promise.all(claims.map(claim =>
      claimBuild(claim.token)
        .then(result => {
          removeGuestClaim(claim.token);
          trackEvent('build_claimed', { status: result.status, source: 'auto' });
          return result.status === 'rejected' ? null : result.build_name;
        })
        .catch((err: Error & { status?: number }) => {
          if (err.status && err.status < 500) removeGuestClaim(claim.token);
          return null;
        })
    )).then(names => {
      const claimed = names.filter((n): n is string => !!n);
      if (claimed.length) setClaimedNames(claimed);
    });
  }, [user]);

  // Show email prompt for local users without an email (unless dismissed for this specific user)
  useEffect(() => {
    if (
      user &&
      user.provider === 'local' &&
      !user.email &&
      !localStorage.getItem(`skip_email_prompt_${user.id}`)
    ) {
      setShowSetEmailModal(true);
    } else {
      setShowSetEmailModal(false);
    }
  }, [user]);

  return (
    <>
      <GoogleAnalytics />
      <FeedbackButton />
      <SetEmailModal show={showSetEmailModal} onClose={() => setShowSetEmailModal(false)} />
      {claimedNames.length > 0 && (
        <div className="alert alert-success alert-dismissible position-fixed start-50 translate-middle-x mt-3 shadow" style={{ zIndex: 1100, top: '56px', maxWidth: '90vw' }}>
          <i className="bi bi-check-circle me-2"></i>
          {claimedNames.length === 1
            ? <>Your build <strong>{claimedNames[0]}</strong> is now linked to your account.</>
            : <>Your {claimedNames.length} builds are now linked to your account.</>}
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setClaimedNames([])}></button>
        </div>
      )}
      <div
        style={{
          backgroundImage: backgroundImage ? `url(/loading_screens/${backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          minHeight: '100vh'
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.80)',
            minHeight: '100vh'
          }}
        >
          <div className="d-flex flex-column min-vh-100">
            <Navbar />
            <main className="flex-grow-1">
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/create" element={<CreateChoice />} />
                  <Route path="/create/manual" element={<CreateManual />} />
                  <Route path="/edit/:id" element={<EditBuild />} />
                  <Route path="/create/import-save" element={<ImportSave />} />
                  <Route path="/create/import-designs" element={<ImportEmpireDesigns />} />
                  <Route path="/build/:id" element={<BuildDetail />} />
                  <Route path="/build-submitted" element={<GuestSubmitted />} />
                  <Route path="/claim/:token" element={<ClaimBuild />} />
                  <Route path="/admin/pending" element={<PendingBuilds />} />
                  <Route path="/admin/pending/:id" element={<BuildDetail pendingMode />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/admin/stats" element={<AdminStats />} />
                  <Route path="/feedback" element={<Feedback />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
