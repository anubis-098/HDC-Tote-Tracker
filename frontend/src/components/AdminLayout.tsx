import {useEffect,useState} from "react";
import {NavLink,useNavigate} from "react-router-dom";
import {LayoutDashboard,Store,Camera,LogOut,Download} from "lucide-react";
import {api,ApiError,message,type Identity} from "../lib/api";
import {t,useLanguage} from "../lib/i18n";
import {Layout} from "./Layout";
export function AdminLayout(){
 useLanguage();const navigate=useNavigate();const [identity,setIdentity]=useState<Identity|null>(null);const [error,setError]=useState("");
 useEffect(()=>{let active=true;api<Identity>("/admin/me").then(value=>{if(active)setIdentity(value);}).catch(error=>{if(!active)return;if(error instanceof ApiError && error.status===401)navigate('/admin/login',{replace:true});else setError(message(error));});return()=>{active=false;};},[navigate]);
 if(!identity)return <div className="panel" role="status">{error || t("กำลังโหลด…")}</div>;
 return <div className="admin-shell"><aside className="admin-sidebar"><img src="/branding/cj-logistics.png" alt="CJ Logistics" width="130"/><h2>Tote Tracker</h2><small>ADMINISTRATION</small><nav aria-label="Administrator"><NavLink to="/admin" end><LayoutDashboard size={19}/>Dashboard</NavLink><NavLink to="/admin/stores"><Store size={19}/>{t("จัดการ Store")}</NavLink><NavLink to="/admin/photos"><Download size={19}/>{t("ดาวน์โหลดรูป")}</NavLink><NavLink to="/admin/archive"><Download size={19}/>Archive</NavLink><NavLink to="/scan"><Camera size={19}/>{t("สแกน Tote")}</NavLink></nav><div className="admin-profile"><b>{identity.name}</b><small>Administrator</small><button onClick={async()=>{try{await api('/admin/logout',{method:'POST'});navigate('/admin/login',{replace:true});}catch(error){setError(message(error));}}}><LogOut size={17}/>{t("ออกจากระบบ")}</button>{error && <p role="alert">{error}</p>}</div></aside><Layout admin/></div>;
}
