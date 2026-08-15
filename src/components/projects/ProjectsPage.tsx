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
    <div className="">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Project Management</h1>
      </div>

      {/* Split from xl: at lg the sidebar has taken 16rem already, and the
          create form needs its three-across row more than the page needs
          two columns. */}
      <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-[38%_minmax(0,1fr)]">
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

      {/* Same 38% width as the hero column above, so the saved cards line up
          with it instead of running the full content width. */}
      <div className="xl:w-[38%]">
        <h2 className="mb-3 mt-7 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:mt-8">
          Saved projects
        </h2>
        <ProjectGrid
          projects={projects}
          items={items}
          activeProjectId={activeProjectId}
          onSelect={onSelectProject}
          onDelete={onDeleteProject}
        />
      </div>
    </div>
  );
}
