import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MarketHome from './pages/MarketHome';
import ItemDetail from './pages/ItemDetail';
import Watchlist from './pages/Watchlist';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MarketHome />} />
          <Route path="item/:name" element={<ItemDetail />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

