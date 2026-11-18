import { ArchivePage } from "./pages/ArchivePage";
import { t, useLanguage, locale } from "./lib/i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Layout } from "./components/Layout";
import { EntryPage } from "./pages/EntryPage";
import { ScanPage } from "./pages/ScanPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import "./styles/app.css";
import "./styles/language.css";
import "./styles/shared-ui.css";
import "./styles/header.css";
import "./styles/admin-compact.css";
import "./styles/admin-ui.css";
import "./styles/downloads.css";
import "@fontsource/sarabun/400.css";
import "@fontsource/sarabun/500.css";
import "@fontsource/sarabun/600.css";
import "@fontsource/sarabun/700.css";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/archive" element={<ArchivePage />} />
            <Route path="/admin/photos" element={<DashboardPage />} />
            <Route path="/admin/stores" element={<AdminPage />} />
          </Route>
          <Route element={<Layout />}>
            <Route path="/" element={<EntryPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin/login" element={<AdminPage />} />

            <Route
              path="*"
              element={
                <p className="panel">
                  {t("ไม่พบหน้านี้")}
                  <a href="/">{t("กลับหน้าแรก")}</a>
                </p>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
