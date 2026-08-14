import type { ProcurementItem, Project } from '@/types';
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
  projects, items, activeProject, activeProjectId, form, onFormChange,
  onCreateProject, onSelectProject, onDeleteProject, onGoOverview, onDeleteActiveProject,
}: ProjectsPageProps) {
  return (
    <div className="animate-page-in">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Project Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih project yang ada, atau buat yang baru untuk mulai.
        </p>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[38%_minmax(0,1fr)]">
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

      <h2 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Project tersimpan
      </h2>
      <ProjectGrid
        projects={projects}
        items={items}
        activeProjectId={activeProjectId}
        onSelect={onSelectProject}
        onDelete={onDeleteProject}
      />
    </div>
  );
}
