import Link from 'next/link';
import type { Copy } from '../_lib/dashboard-i18n';

export function DashboardSidebar({ copy }: { copy: Copy }) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/">
        <span className="brand-icon">S</span>
        <span>SubFlow</span>
      </Link>

      <p className="nav-label">{copy.workspace}</p>

      <nav className="navigation">
        <Link className="nav-item active" href="/">
          <span>▦</span> {copy.dashboard}
        </Link>
        <a className="nav-item" href="#videos">
          <span>▷</span> {copy.myVideos}
        </a>
      </nav>

      <div className="sidebar-bottom">
        <div className="local-status">
          <span className="status-dot" />
          <div>
            <strong>{copy.localEnvironment}</strong>
            <small>{copy.development}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
