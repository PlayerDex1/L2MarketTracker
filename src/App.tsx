import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MarketHome from './pages/MarketHome';
import ItemDetail from './pages/ItemDetail';
import Watchlist from './pages/Watchlist';
import Analytics from './pages/Analytics';
import { AuthProvider } from './lib/AuthContext';
import { ServerProvider } from './lib/ServerContext';

export default function App() {
  const isPrideTenant = import.meta.env.VITE_TENANT === 'pride';

  return (
    <AuthProvider>
      <ServerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<MarketHome />} />
              <Route path="item/:name" element={<ItemDetail />} />
              <Route path="watchlist" element={isPrideTenant ? <Navigate to="/" replace /> : <Watchlist />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ServerProvider>
    </AuthProvider>
  );
}

