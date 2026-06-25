import type { Project, ProcurementItem } from '@/types';

interface ProjectGridProps {
  projects: Project[];
  items: ProcurementItem[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete: (proj: Project) => void;
}

export default function ProjectGrid({
  projects,
  items,
  activeProjectId,
  onSelect,
  onDelete,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">📁</div>
        <div>No projects yet. Create your first one above.</div>
      </div>
    );
  }

  return (
    <div className="proj-grid">
      {projects.map(proj => {
        const isActive = activeProjectId === proj.id;
        const itemCount = items.filter(i => i.projectId === proj.id).length;
        return (
          <div
            key={proj.id}
            className={`proj-card${isActive ? ' active-proj' : ''}`}
            onClick={() => onSelect(proj.id)}
          >
            <div className="proj-card-icon">{isActive ? '📂' : '📁'}</div>
            <div className="proj-card-body">
              <div className="proj-card-name">{proj.name}</div>
              <div className="proj-card-meta">
                {proj.client || 'No client'} · {itemCount} item{itemCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="proj-card-actions">
              <button
                className="proj-card-act del"
                title="Delete project"
                onClick={e => { e.stopPropagation(); onDelete(proj); }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
