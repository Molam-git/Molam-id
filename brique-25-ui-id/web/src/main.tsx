// web/src/main.tsx
// Molam ID Management - Web Application Entry Point

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import IdDashboard from './pages/IdDashboard';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IdDashboard />} />
        <Route path="/id" element={<IdDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
