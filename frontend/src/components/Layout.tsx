import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, ScanLine, LayoutDashboard, Settings } from 'lucide-react';
import { Clock } from './Clock';
import { useEffect, useState } from 'react';

export function Layout() {
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <div className="handheld"><header className="site-header">
    <Link className="icon-button" to="/" aria-label="กลับหน้าแรก"><ArrowLeft size={20} /></Link>
    <img src="/branding/cj-logistics.png" alt="CJ Logistics" width="64" height="40" />
    <div className="brand"><strong>HDC Tote tracker</strong><small>ระบบติดตามกล่อง Tote</small></div><Clock />
  </header>
    {!online && <div className="offline-banner" role="alert">ขาดการเชื่อมต่อเครือข่าย กรุณาเชื่อมต่อก่อนสแกนหรือบันทึก ระบบยังไม่รองรับการบันทึกออฟไลน์</div>}
    {location.pathname !== '/' && <nav className="tabs" aria-label="เมนูหลัก">
      <NavLink to="/scan"><ScanLine size={17} />สแกน Tote</NavLink>
      <NavLink to="/dashboard"><LayoutDashboard size={17} />ภาพรวม</NavLink>
      <NavLink to="/admin/stores"><Settings size={17} />Store</NavLink>
    </nav>}
    <main><Outlet /></main><footer className="credit">CJ Logistics · HDC Tote tracker</footer>
  </div>;
}
