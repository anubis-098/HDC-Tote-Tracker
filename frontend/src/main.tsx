import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EntryPage } from './pages/EntryPage';
import { ScanPage } from './pages/ScanPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import './styles/app.css';
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/500.css';
import '@fontsource/sarabun/600.css';
import '@fontsource/sarabun/700.css';
import { AppErrorBoundary } from './components/AppErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppErrorBoundary><BrowserRouter><Routes><Route element={<Layout />}>
    <Route path="/" element={<EntryPage />} />
    <Route path="/scan" element={<ScanPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/admin/login" element={<AdminPage />} />
    <Route path="/admin/stores" element={<AdminPage />} />
    <Route path="*" element={<p className="panel">ไม่พบหน้านี้ <a href="/">กลับหน้าแรก</a></p>} />
  </Route></Routes></BrowserRouter></AppErrorBoundary></React.StrictMode>,
);
