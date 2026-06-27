import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import Footer from './components/Footer';
import { GoogleAnalytics } from './components/GoogleAnalytics';
import { FeedbackButton } from './components/FeedbackButton';
import { SetEmailModal } from './components/SetEmailModal';
import { useAuth } from './AuthContext';
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
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Resources = lazy(() => import('./pages/Resources'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

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
  const { user } = useAuth();
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [showSetEmailModal, setShowSetEmailModal] = useState(false);

  // Load background after first render so it doesn't block initial paint
  useEffect(() => {
    setBackgroundImage(getRandomBackground());
  }, [location.pathname]);

  // Show email prompt for local users without an email (unless dismissed)
  useEffect(() => {
    if (
      user &&
      user.provider === 'local' &&
      !user.email &&
      !localStorage.getItem('skip_email_prompt')
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
                  <Route path="/login" element={<Login />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/admin/stats" element={<AdminStats />} />
                  <Route path="/feedback" element={<Feedback />} />
                  <Route path="/admin/feedback" element={<AdminFeedback />} />
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
