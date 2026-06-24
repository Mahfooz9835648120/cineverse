// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlayerPage from './pages/PlayerPage';
import BrowsePage from './pages/BrowsePage';
// ...
<Route path="/browse" element={<BrowsePage />} />
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                        element={<HomePage />} />
        <Route path="/player/:type/:tmdbId"    element={<PlayerPage />} />
        {/* Placeholders — add pages later */}
        <Route path="/movies"   element={<HomePage />} />
        <Route path="/shows"    element={<HomePage />} />
        <Route path="/trending" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
