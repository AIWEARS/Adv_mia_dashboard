import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Contesto di autenticazione
const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato dentro un AuthProvider');
  }
  return context;
}

// Componente per le rotte protette
function ProtectedRoute({ children }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('mia_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mia_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleLogin = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('mia_token', newToken);
    if (userData) {
      localStorage.setItem('mia_user', JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mia_token');
    localStorage.removeItem('mia_user');
  };

  const authValue = {
    token,
    user,
    login: handleLogin,
    logout: handleLogout,
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/diagnosi"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
}

export default App;
