import {useState, useEffect} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {exists} from '@tauri-apps/plugin-fs';
import {getRecentProjects, type RecentProject} from '../../lib/appConfig';
import {projectStore} from '../../stores/projectStore';
import {NewProjectDialog} from './NewProjectDialog';

interface RecentProjectEntry extends RecentProject {
  available: boolean;
}

const featurePills = [
  {label: 'Multi-layer FX', color: 'var(--color-accent)'},
  {label: 'Audio Sync', color: 'var(--color-dot-purple)'},
  {label: 'Beat Markers', color: 'var(--color-dot-green)'},
  {label: 'DaVinci / Premiere Export', color: 'var(--color-dot-orange)'},
];

function FeaturePill({label, color}: {label: string; color: string}) {
  return (
    <div class="flex items-center gap-2 rounded-lg bg-[var(--color-bg-card)] px-4 py-2.5">
      <div
        class="w-2 h-2 rounded-full shrink-0"
        style={{backgroundColor: color}}
      />
      <span class="text-xs text-[var(--color-text-secondary)]">{label}</span>
    </div>
  );
}

function RecentProjectItem({
  project,
  highlighted,
  onClick,
}: {
  project: RecentProjectEntry;
  highlighted: boolean;
  onClick: () => void;
}) {
  const thumbColors = [
    'var(--color-thumb-blue)',
    'var(--color-thumb-purple)',
    'var(--color-thumb-green)',
  ];
  // Deterministic color from project name
  const colorIndex =
    project.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    thumbColors.length;

  return (
    <div
      class={`flex items-center gap-3 rounded-lg px-4 h-[60px] w-[340px] cursor-pointer transition-colors ${
        highlighted
          ? 'bg-[var(--color-bg-card)]'
          : 'bg-[var(--color-bg-card-alt)] hover:bg-[var(--color-bg-card)]'
      } ${!project.available ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div
        class="w-10 h-10 rounded-md shrink-0"
        style={{backgroundColor: thumbColors[colorIndex]}}
      />
      <div class="flex flex-col gap-1 flex-1 min-w-0">
        <span
          class={`text-[13px] truncate ${
            highlighted
              ? 'font-medium text-[#E0E0E0]'
              : 'text-[var(--color-text-secondary)]'
          }`}
        >
          {project.name}
        </span>
        <span
          class={`text-[11px] truncate ${
            highlighted
              ? 'text-[var(--color-text-dim)]'
              : 'text-[var(--color-text-dimmer)]'
          }`}
        >
          {project.available
            ? formatLastOpened(project.lastOpened)
            : 'Not found'}
        </span>
      </div>
    </div>
  );
}

function formatLastOpened(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch {
    return isoDate;
  }
}

export function WelcomeScreen() {
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntry[]>(
    [],
  );
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // Load recent projects on mount, validate existence
  useEffect(() => {
    (async () => {
      const projects = await getRecentProjects();
      const validated = await Promise.all(
        projects.map(async (p) => {
          let available = false;
          try {
            available = await exists(p.path);
          } catch {
            available = false;
          }
          return {...p, available};
        }),
      );
      setRecentProjects(validated);
    })();
  }, []);

  const handleOpenProject = async () => {
    const selected = await open({
      multiple: false,
      filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
    });
    if (selected && typeof selected === 'string') {
      setIsOpening(true);
      try {
        await projectStore.openProject(selected);
      } catch (err) {
        console.error('Failed to open project:', err);
      } finally {
        setIsOpening(false);
      }
    }
  };

  const handleRecentClick = async (project: RecentProjectEntry) => {
    if (!project.available) return;
    setIsOpening(true);
    try {
      await projectStore.openProject(project.path);
    } catch (err) {
      console.error('Failed to open recent project:', err);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div class="flex w-full h-full bg-[var(--color-bg-root)] font-primary">
      {/* Left Sidebar */}
      <div class="flex flex-col gap-8 w-[420px] h-full bg-[var(--color-bg-sidebar)] px-10 pt-12 pb-12 shrink-0">
        {/* Logo */}
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-md bg-[var(--color-accent)]" />
          <span class="text-xl font-bold text-[var(--color-text-primary)]">
            EFX-Motion
          </span>
        </div>

        {/* Tagline */}
        <p class="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line">
          {'Stop-motion & capture editor\nfor cinematic sequences'}
        </p>

        {/* Separator */}
        <div class="w-[340px] h-px bg-[var(--color-separator)]" />

        {/* New Project Button */}
        <button
          class="flex items-center justify-center gap-2.5 w-[340px] h-[52px] rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors px-5"
          onClick={() => setShowNewDialog(true)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            class="shrink-0"
          >
            <rect
              x="3"
              y="3"
              width="14"
              height="14"
              rx="2"
              stroke="white"
              stroke-width="1.5"
            />
            <line
              x1="10"
              y1="6"
              x2="10"
              y2="14"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <line
              x1="6"
              y1="10"
              x2="14"
              y2="10"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span class="text-[15px] font-semibold text-[var(--color-text-white)]">
            New Project
          </span>
        </button>

        {/* Open Project Button */}
        <button
          class="flex items-center gap-2.5 w-[340px] h-[44px] rounded-lg bg-[var(--color-bg-input)] px-5 hover:bg-[var(--color-bg-settings)] transition-colors"
          onClick={handleOpenProject}
          disabled={isOpening}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            class="shrink-0"
          >
            <path
              d="M2 6V14C2 15.1 2.9 16 4 16H14C15.1 16 16 15.1 16 14V8C16 6.9 15.1 6 14 6H9L7 4H4C2.9 4 2 4.9 2 6Z"
              stroke="#AAAAAA"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
          <span class="text-sm text-[var(--color-text-link)]">
            {isOpening ? 'Opening...' : 'Open Project...'}
          </span>
        </button>

        {/* Separator */}
        <div class="w-[340px] h-px bg-[var(--color-separator)]" />

        {/* Recent Projects Label */}
        <span class="text-[10px] font-semibold text-[var(--color-text-dimmer)] tracking-wide">
          RECENT PROJECTS
        </span>

        {/* Recent Projects List */}
        <div class="flex flex-col gap-1 w-[340px] overflow-y-auto flex-1 min-h-0">
          {recentProjects.length > 0 ? (
            recentProjects.map((project, index) => (
              <RecentProjectItem
                key={project.path}
                project={project}
                highlighted={index === 0 && project.available}
                onClick={() => handleRecentClick(project)}
              />
            ))
          ) : (
            <span class="text-[11px] text-[var(--color-text-dim)]">
              No recent projects
            </span>
          )}
        </div>

        {/* Version info */}
        <div class="flex items-center gap-2 w-[340px] rounded-lg bg-[var(--color-bg-card)] p-3 px-4">
          <span class="text-[10px] text-[var(--color-text-dim)]">
            EFX Motion Editor v0.1.0
          </span>
        </div>
      </div>

      {/* Right Side - Hero Area */}
      <div class="flex flex-col items-center justify-center gap-12 flex-1 h-full bg-[var(--color-bg-right)] p-20">
        {/* Centered tagline and version (replaces hero image) */}
        <div class="flex flex-col items-center gap-6">
          <div class="flex items-center gap-2 rounded-full bg-[var(--color-badge-bg)] px-4 py-2">
            <div class="w-2 h-2 rounded-full bg-[var(--color-dot-blue)]" />
            <span class="text-xs text-[var(--color-badge-text)]">
              Stop-Motion -- 15fps / 24fps -- PNG Sequence Export
            </span>
          </div>
          <h2 class="text-2xl font-semibold text-[var(--color-text-primary)] text-center">
            Create cinematic stop-motion sequences
          </h2>
          <p class="text-sm text-[var(--color-text-muted)] text-center max-w-md leading-relaxed">
            Import key photographs, arrange them into timed sequences with FX
            layers, preview in real-time, and export as PNG image sequences.
          </p>
        </div>

        {/* Feature Pills */}
        <div class="flex items-center gap-4">
          {featurePills.map((pill) => (
            <FeaturePill
              key={pill.label}
              label={pill.label}
              color={pill.color}
            />
          ))}
        </div>
      </div>

      {/* New Project Dialog */}
      {showNewDialog && (
        <NewProjectDialog onClose={() => setShowNewDialog(false)} />
      )}
    </div>
  );
}
