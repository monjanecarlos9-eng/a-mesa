import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import './index.css';
import { AuthProvider } from './lib/auth';
import { RotaProtegida } from './components/RotaProtegida';
import Inicio, { NaoEncontrado } from './pages/Inicio';
import MenuMesa from './pages/MenuMesa';
import EstadoPedido from './pages/EstadoPedido';
import Login from './pages/Login';
import Cozinha from './pages/Cozinha';
import AdminPratos from './pages/AdminPratos';
import AdminMesas from './pages/AdminMesas';
import AdminEstatisticas from './pages/AdminEstatisticas';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/mesa/:token" element={<MenuMesa />} />
          <Route path="/mesa/:token/pedido" element={<EstadoPedido />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/cozinha"
            element={
              <RotaProtegida papeis={['cozinha', 'admin']}>
                <Cozinha />
              </RotaProtegida>
            }
          />
          <Route path="/admin" element={<Navigate to="/admin/pratos" replace />} />
          <Route
            path="/admin/pratos"
            element={
              <RotaProtegida papeis={['admin']}>
                <AdminPratos />
              </RotaProtegida>
            }
          />
          <Route
            path="/admin/mesas"
            element={
              <RotaProtegida papeis={['admin']}>
                <AdminMesas />
              </RotaProtegida>
            }
          />
          <Route
            path="/admin/estatisticas"
            element={
              <RotaProtegida papeis={['admin']}>
                <AdminEstatisticas />
              </RotaProtegida>
            }
          />
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
