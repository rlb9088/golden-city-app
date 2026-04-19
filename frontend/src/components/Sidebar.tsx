'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import './Sidebar.css';

const navItems = [
  { href: '/balance', label: 'Balance', icon: '📊', adminOnly: false },
  { href: '/pagos', label: 'Pagos', icon: '💳', adminOnly: false },
  { href: '/ingresos', label: 'Ingresos', icon: '💰', adminOnly: true },
  { href: '/gastos', label: 'Gastos', icon: '📤', adminOnly: true },
  { href: '/bancos', label: 'Bancos', icon: '🏦', adminOnly: true },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️', adminOnly: true },
  { href: '/audit', label: 'Auditoría', icon: '🧾', adminOnly: true },
];

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileOpenChange: (isOpen: boolean) => void;
}

export default function Sidebar({ isMobileOpen, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, role, isAdmin, logout } = useAuth();

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    onMobileOpenChange(false);
  }, [pathname, onMobileOpenChange]);

  return (
    <aside className={`sidebar ${isMobileOpen ? 'sidebar--open' : ''}`} id="main-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🏛️</span>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">Golden City</span>
            <span className="sidebar-logo-subtitle">Backoffice</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMobileOpen}
          aria-controls="main-sidebar"
          onClick={() => onMobileOpenChange(!isMobileOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav className="sidebar-nav">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
            id={`nav-${item.href.slice(1)}`}
            onClick={() => onMobileOpenChange(false)}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-label">{item.label}</span>
            {pathname === item.href && <span className="sidebar-link-indicator" />}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-config">
          <div className="sidebar-field">
            <span className="sidebar-label">Sesión activa</span>
            <span className="sidebar-user-name">{user?.nombre || user?.username || 'Usuario'}</span>
          </div>
          <div className="sidebar-role-badge">
            <span className={`badge ${isAdmin ? 'badge-gold' : 'badge-blue'}`}>
              {role === 'admin' ? 'ADMIN' : 'AGENTE'}
            </span>
            <button type="button" className="btn btn-secondary btn-sm sidebar-logout" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
