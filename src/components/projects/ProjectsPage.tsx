import type { Project, ProcurementItem } from '@/types';
import ProjectHero from './ProjectHero';
import ProjectForm from './ProjectForm';
import ProjectGrid from './ProjectGrid';

interface ProjectFormState {
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
}

interface ProjectsPageProps {
  projects: Project[];
  items: ProcurementItem[];
  activeProject: Project | null;
  activeProjectId: string | null;
  form: ProjectFormState;
  onFormChange: (field: string, value: string) => void;
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (proj: Project) => void;
  onGoOverview: () => void;
  onDeleteActiveProject: () => void;
}

export default function ProjectsPage({
  projects,
  items,
  activeProject,
  activeProjectId,
  form,
  onFormChange,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onGoOverview,
  onDeleteActiveProject,
}: ProjectsPageProps) {
  return (
    <section className="page">
      <div className="page-header">
        <h1 className="page-title">Project Management</h1>
        <p className="page-sub">Select a project or create a new one to begin.</p>
      </div>

      <div className="proj-layout">
        <ProjectHero
          project={activeProject}
          items={items}
          onGoOverview={onGoOverview}
          onDeleteProject={onDeleteActiveProject}
        />
        <ProjectForm
          name={form.name}
          client={form.client}
          location={form.location}
          pic={form.pic}
          contractNo={form.contractNo}
          handover={form.handover}
          onChange={onFormChange}
          onSubmit={onCreateProject}
        />
      </div>

      <div className="section-head">Saved Projects</div>
      <ProjectGrid
        projects={projects}
        items={items}
        activeProjectId={activeProjectId}
        onSelect={onSelectProject}
        onDelete={onDeleteProject}
      />
    </section>
  );
}
