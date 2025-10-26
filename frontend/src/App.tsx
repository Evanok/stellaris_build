import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import Footer from './components/Footer';
import { GoogleAnalytics } from './components/GoogleAnalytics';
import { FeedbackButton } from './components/FeedbackButton';
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
const LoadingScreensPreview = lazy(() => import('./pages/LoadingScreensPreview').then(module => ({ default: module.LoadingScreensPreview })));

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
  // Only load background on desktop (screen width > 768px)
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return null;
  }
  const images = [
    'load_12.jpg', 'load_13.jpg', 'load_14.jpg', 'load_15.jpg',
    'load_16.jpg', 'load_17.jpg', 'load_18.jpg', 'Load_19.jpg'
  ];
  return images[Math.floor(Math.random() * images.length)];
};

// AppContent component that uses useLocation
const AppContent = () => {
  const location = useLocation();
  const [backgroundImage, setBackgroundImage] = useState<string | null>(getRandomBackground);

  // Change background image on every page navigation
  useEffect(() => {
    setBackgroundImage(getRandomBackground());
  }, [location.pathname]);

  return (
    <>
      <GoogleAnalytics />
      <FeedbackButton />
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
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/admin/stats" element={<AdminStats />} />
                  <Route path="/admin/feedback" element={<AdminFeedback />} />
                  <Route path="/loading-screens" element={<LoadingScreensPreview />} />
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
