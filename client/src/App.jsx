import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/" element={<Navigate to="/diagnosi" replace />} />
        <Route path="/diagnosi" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/diagnosi" replace />} />
      </Routes>
    </div>
  );
}

export default App;
