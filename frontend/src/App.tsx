import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { GoogleAnalytics } from './components/GoogleAnalytics';
import { FeedbackButton } from './components/FeedbackButton';
import { Home } from './pages/Home';
import Login from './pages/Login';

// Lazy load heavy pages (with recharts, large forms, etc.)
const CreateChoice = lazy(() => import('./pages/CreateChoice'));
const CreateManual = lazy(() => import('./pages/CreateManual'));
const ImportSave = lazy(() => import('./pages/ImportSave'));
const ImportEmpireDesigns = lazy(() => import('./pages/ImportEmpireDesigns'));
const BuildDetail = lazy(() => import('./pages/BuildDetail').then(module => ({ default: module.BuildDetail })));
const Stats = lazy(() => import('./pages/Stats'));
const AdminStats = lazy(() => import('./pages/AdminStats'));
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <GoogleAnalytics />
      <FeedbackButton />
      <div className="d-flex flex-column min-vh-100 bg-dark">
        <Navbar />
        <main className="flex-grow-1">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateChoice />} />
              <Route path="/create/manual" element={<CreateManual />} />
              <Route path="/create/import-save" element={<ImportSave />} />
              <Route path="/create/import-designs" element={<ImportEmpireDesigns />} />
              <Route path="/build/:id" element={<BuildDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/admin/stats" element={<AdminStats />} />
              <Route path="/admin/feedback" element={<AdminFeedback />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
