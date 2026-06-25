import type { Project, ProcurementItem } from '@/types';
import { computeOverallProgress, fmtDate } from '@/lib/utils';

interface ProjectHeroProps {
  project: Project | null;
  items: ProcurementItem[];
  onGoOverview: () => void;
  onDeleteProject: () => void;
}

export default function ProjectHero({ project, items, onGoOverview, onDeleteProject }: ProjectHeroProps) {
  if (!project) {
    return (
      <div
        className="proj-hero-compact"
        style={{ borderTopColor: 'var(--text-tertiary)', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No project selected</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Create or select a project from below.</div>
        </div>
      </div>
    );
  }

  const projItems = items.filter(i => i.projectId === project.id);
  const progress = computeOverallProgress(projItems);
  const late   = projItems.filter(i => i.status === 'late').length;
  const atrisk = projItems.filter(i => i.status === 'atrisk').length;

  return (
    <div className="proj-hero-compact has-project">
      <div className="phc-eyebrow">Active Project</div>
      <div className="phc-name">{project.name}</div>
      <div className="phc-meta">
        {project.client   && <>{project.client} · </>}
        {project.location && <>{project.location} · </>}
        {project.pic      && <>PIC: {project.pic}</>}
        {project.contractNo && <><br />Contract: {project.contractNo}</>}
      </div>

      <div className="phc-progress">
        <div className="phc-prog-top">
          <span className="phc-prog-label">Overall Progress</span>
          <span className="phc-prog-pct">{progress}%</span>
        </div>
        <div className="phc-prog-bar">
          <div className="phc-prog-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="phc-stats">
        <div className="phc-stat">
          <div className="phc-stat-label">Items</div>
          <div className="phc-stat-value">{projItems.length}</div>
        </div>
        <div className="phc-stat">
          <div className="phc-stat-label">Late</div>
          <div className={`phc-stat-value${late > 0 ? ' warn' : ''}`}>{late}</div>
        </div>
        <div className="phc-stat">
          <div className="phc-stat-label">At Risk</div>
          <div className={`phc-stat-value${atrisk > 0 ? ' warn' : ''}`}>{atrisk}</div>
        </div>
      </div>

      {project.handover && (
        <div className="phc-handover">
          <span className="phc-handover-label">Target Handover</span>
          <span className="phc-handover-value">{fmtDate(project.handover)}</span>
        </div>
      )}

      <div className="phc-actions">
        <button className="btn btn-secondary" onClick={onGoOverview}>View Overview</button>
        <button className="btn btn-danger" onClick={onDeleteProject}>Delete Project</button>
      </div>
    </div>
  );
}
