import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import CreateChoice from './pages/CreateChoice';
import CreateManual from './pages/CreateManual';
import ImportSave from './pages/ImportSave';
import ImportEmpireDesigns from './pages/ImportEmpireDesigns';
import { BuildDetail } from './pages/BuildDetail';
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <div className="d-flex flex-column min-vh-100 bg-dark">
        <Navbar />
        <main className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateChoice />} />
            <Route path="/create/manual" element={<CreateManual />} />
            <Route path="/create/import-save" element={<ImportSave />} />
            <Route path="/create/import-designs" element={<ImportEmpireDesigns />} />
            <Route path="/build/:id" element={<BuildDetail />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
