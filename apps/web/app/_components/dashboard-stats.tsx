import type { Copy } from '../_lib/dashboard-i18n';

type DashboardStatsProps = {
  total: number | null;
  active: number | null;
  completed: number | null;
  copy: Copy;
};

export function DashboardStats({
  total,
  active,
  completed,
  copy,
}: DashboardStatsProps) {
  return (
    <section className="stats-grid">
      <article className="stat-card">
        <div className="stat-heading">
          <span>{copy.totalVideos}</span>
          <span className="stat-icon purple">▷</span>
        </div>
        <strong className="stat-value">{total ?? '—'}</strong>
        <p>{copy.latestVideos}</p>
      </article>

      <article className="stat-card">
        <div className="stat-heading">
          <span>{copy.processingPipeline}</span>
          <span className="stat-icon blue">↗</span>
        </div>
        <strong className="stat-value">{active ?? '—'}</strong>
        <p>{copy.asyncJobs}</p>
      </article>

      <article className="stat-card">
        <div className="stat-heading">
          <span>{copy.completedVideos}</span>
          <span className="stat-icon green">✓</span>
        </div>
        <strong className="stat-value">{completed ?? '—'}</strong>
        <p>{copy.completedDetails}</p>
      </article>
    </section>
  );
}
