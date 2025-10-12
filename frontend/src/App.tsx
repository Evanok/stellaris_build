import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Create } from './pages/Create';
import { BuildDetail } from './pages/BuildDetail';

function App() {
  return (
    <Router>
      <div className="min-vh-100 bg-dark">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<Create />} />
          <Route path="/build/:id" element={<BuildDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
