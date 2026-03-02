/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import ConstantParties from './pages/ConstantParties';
import Apply from './pages/Apply';
import Applications from './pages/Applications';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateClan from './pages/CreateClan';
import Market from './pages/Market';
import Watchlist from './pages/Watchlist';
import { AuthProvider } from './contexts/AuthContext';
import { ClanDataProvider } from './contexts/ClanDataContext';

export default function App() {
  return (
    <AuthProvider>
      <ClanDataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/create-clan" element={<CreateClan />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/apply/:clanId" element={<Apply />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="cps" element={<ConstantParties />} />
              <Route path="applications" element={<Applications />} />
              <Route path="market" element={<Market />} />
              <Route path="watchlist" element={<Watchlist />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ClanDataProvider>
    </AuthProvider>
  );
}
