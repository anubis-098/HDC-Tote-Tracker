import { t, useLanguage, locale } from "../lib/i18n";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, ScanLine, LayoutDashboard, Settings } from "lucide-react";
import { Clock } from "./Clock";
import { ConnectionStatus } from "./ConnectionStatus";
import { LanguageSwitch } from "../lib/i18n";
import { useEffect, useState } from "react";

export function Layout({admin = false}: {admin?: boolean}) {
  useLanguage();
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div className={admin ? "handheld admin-workspace" : "handheld"}>
      <header className="site-header">
        <img
          src="/branding/cj-logistics.png"
          alt="CJ Logistics"
          width="64"
          height="40"
        />
        <div className="brand">
          <strong>HDC Tote tracker</strong>
          <small>{t("ระบบติดตามกล่อง Tote")}</small>
        </div>
        <LanguageSwitch />
        <Clock />
        {!admin && <ConnectionStatus />}
      </header>
      {!online && (
        <div className="offline-banner" role="alert">
          {t(
            "ขาดการเชื่อมต่อเครือข่าย กรุณาเชื่อมต่อก่อนสแกนหรือบันทึก ระบบยังไม่รองรับการบันทึกออฟไลน์",
          )}
        </div>
      )}
      {!admin && location.pathname !== "/" && (
        <nav className="tabs" aria-label={t("เมนูหลัก")}>
          <NavLink to="/scan">
            <ScanLine size={17} />
            {t("สแกน Tote")}
          </NavLink>
          <NavLink to="/dashboard">
            <LayoutDashboard size={17} />
            {t("ภาพรวม")}
          </NavLink>

        </nav>
      )}
      <main>
        <Outlet />
      </main>
      <footer className="credit">CJ Logistics · HDC Tote tracker</footer>
    </div>
  );
}
