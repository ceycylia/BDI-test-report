import { useEffect, useState } from "react";
import { BarChart3, BookOpenText, ChevronDown, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserCog, Users, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppMark } from "../components/ui/AppMark";
import { useAdminAuth } from "../features/admin-auth/AuthProvider";

const primaryNavigation = [
  { label: "Dashboard", to: "/admin", end: true, icon: LayoutDashboard },
  { label: "Bank Soal", to: "/admin/bank-soal", icon: BookOpenText },
  { label: "Pelatihan/Test", to: "/admin/pelatihan", icon: GraduationCap },
  { label: "Peserta", to: "/admin/peserta", icon: Users },
  { label: "Hasil", to: "/admin/hasil", icon: BarChart3 },
];

export function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("bdi-sidebar-collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => localStorage.setItem("bdi-sidebar-collapsed", String(collapsed)), [collapsed]);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  const navItems = admin?.role === "SUPERADMIN"
    ? [...primaryNavigation, { label: "Kelola Admin", to: "/admin/admins", icon: Users }]
    : primaryNavigation;

  return (
    <div className={`admin-shell${collapsed ? " is-collapsed" : ""}`}>
      {mobileOpen && <button className="admin-drawer-backdrop" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`}>
        <div className="admin-sidebar__brand">
          <AppMark compact={collapsed && !mobileOpen} />
          <button className="icon-button admin-sidebar__mobile-close" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X /></button>
        </div>
        <nav aria-label="Navigasi admin" className="admin-sidebar__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <NavLink className={({ isActive }) => isActive ? "admin-nav-link is-active" : "admin-nav-link"} end={item.end} key={item.to} to={item.to} title={collapsed ? item.label : undefined}><Icon aria-hidden="true" /><span>{item.label}</span></NavLink>;
          })}
          <NavLink className={({ isActive }) => isActive ? "admin-nav-link is-active" : "admin-nav-link"} to="/admin/akun" title={collapsed ? "Akun Saya" : undefined}><UserCog aria-hidden="true" /><span>Akun Saya</span></NavLink>
        </nav>
        <div className="admin-sidebar__footer">
          <button className="admin-nav-link admin-logout" type="button" onClick={() => void handleLogout()} title={collapsed ? "Logout" : undefined}><LogOut aria-hidden="true" /><span>Logout</span></button>
          <button className="sidebar-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>{collapsed ? "" : "Ciutkan menu"}</span></button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="icon-button admin-menu-button" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Menu /></button>
          <div className="admin-topbar__context"><ClipboardCheck /><span>Sistem Tes Pelatihan BDI Medan</span></div>
          <div className="admin-user-menu">
            <button type="button" className="admin-user-trigger" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}>
              <span className="admin-avatar">{admin?.name?.trim().charAt(0).toUpperCase() || "A"}</span>
              <span className="admin-user-copy"><strong>{admin?.name}</strong><small>{admin?.role === "SUPERADMIN" ? "Superadmin" : "Admin"}</small></span>
              <ChevronDown aria-hidden="true" />
            </button>
            {accountOpen && <div className="admin-user-popover"><button onClick={() => { setAccountOpen(false); navigate("/admin/akun"); }}><UserCog /> Akun Saya</button><button onClick={() => void handleLogout()}><LogOut /> Logout</button></div>}
          </div>
        </header>
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
