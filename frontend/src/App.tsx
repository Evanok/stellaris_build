import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Create } from './pages/Create';
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
            <Route path="/create" element={<Create />} />
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
