import {useState, useEffect} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {pathExists} from '../../lib/ipc';
import {getRecentProjects, removeRecentProject, updateRecentProjectPath, type RecentProject} from '../../lib/appConfig';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
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
    <div class="flex items-center gap-2 rounded-lg bg-(--color-bg-card) px-4 py-2.5">
      <div
        class="w-2 h-2 rounded-full shrink-0"
        style={{backgroundColor: color}}
      />
      <span class="text-xs text-(--color-text-secondary)">{label}</span>
    </div>
  );
}

function RecentProjectItem({
  project,
  highlighted,
  onClick,
  onRemove,
  onLocate,
}: {
  project: RecentProjectEntry;
  highlighted: boolean;
  onClick: () => void;
  onRemove: () => void;
  onLocate: () => void;
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
      class={`flex items-center gap-3 rounded-lg px-4 h-[60px] w-[340px] transition-colors ${
        highlighted
          ? 'bg-(--color-bg-card)'
          : 'bg-(--color-bg-card-alt) hover:bg-(--color-bg-card)'
      } ${project.available ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={onClick}
    >
      <div
        class="w-10 h-10 rounded-md shrink-0"
        style={{
          backgroundColor: thumbColors[colorIndex],
          opacity: project.available ? 1 : 0.4,
        }}
      />
      <div class="flex flex-col gap-1 flex-1 min-w-0">
        <span
          class={`text-[13px] truncate ${
            highlighted
              ? 'font-medium text-(--color-text-heading)'
              : 'text-(--color-text-button)'
          }`}
        >
          {project.name}
        </span>
        {project.available ? (
          <span
            class={`text-[11px] truncate ${
              highlighted
                ? 'text-(--color-text-dim)'
                : 'text-(--color-text-secondary)'
            }`}
          >
            {formatLastOpened(project.lastOpened)}
          </span>
        ) : (
          <span class="flex items-center gap-1.5 text-[11px]">
            <button
              class="text-(--color-error-text) hover:brightness-125 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              Remove
            </button>
            <span class="text-(--color-text-muted)">&middot;</span>
            <button
              class="text-(--color-text-link) hover:brightness-125 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onLocate(); }}
            >
              Locate...
            </button>
          </span>
        )}
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
  const showNewDialog = uiStore.showNewProjectDialog.value;
  const [isOpening, setIsOpening] = useState(false);

  // Load recent projects on mount, validate existence
  useEffect(() => {
    (async () => {
      const projects = await getRecentProjects();
      const validated = await Promise.all(
        projects.map(async (p) => {
          let available = false;
          try {
            const result = await pathExists(p.path);
            available = result.ok ? result.data : false;
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

  const handleRemove = async (project: RecentProjectEntry) => {
    await removeRecentProject(project.path);
    setRecentProjects((prev) => prev.filter((p) => p.path !== project.path));
  };

  const handleLocate = async (project: RecentProjectEntry) => {
    const selected = await open({
      multiple: false,
      filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
    });
    if (selected && typeof selected === 'string') {
      const result = await pathExists(selected);
      const valid = result.ok ? result.data : false;
      if (valid) {
        await updateRecentProjectPath(project.path, selected);
        setRecentProjects((prev) =>
          prev.map((p) =>
            p.path === project.path
              ? { ...p, path: selected, available: true }
              : p,
          ),
        );
      }
    }
  };

  return (
    <div class="flex w-full h-full bg-(--color-bg-root) font-primary">
      {/* Left Sidebar */}
      <div class="flex flex-col gap-8 w-[420px] h-full bg-(--color-bg-sidebar) px-10 pt-12 pb-12 shrink-0">
        {/* Logo */}
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-md bg-(--color-accent)" />
          <span class="text-xl font-bold text-(--color-text-primary)">
            EFX-Motion
          </span>
        </div>

        {/* Tagline */}
        <p class="text-sm text-(--color-text-muted) leading-relaxed whitespace-pre-line">
          {'Stop-motion & capture editor\nfor cinematic sequences'}
        </p>

        {/* Separator */}
        <div class="w-[340px] h-px bg-(--color-separator)" />

        {/* New Project Button */}
        <button
          class="flex items-center justify-center gap-2.5 w-[340px] h-[52px] rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) transition-colors px-5"
          onClick={() => { uiStore.showNewProjectDialog.value = true; }}
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
          <span class="text-[15px] font-semibold text-(--color-text-white)">
            New Project
          </span>
        </button>

        {/* Open Project Button */}
        <button
          class="flex items-center gap-2.5 w-[340px] h-[44px] rounded-lg bg-(--color-bg-input) px-5 hover:bg-(--color-bg-settings) transition-colors"
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
              stroke="var(--color-text-link)"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
          <span class="text-sm text-(--color-text-link)">
            {isOpening ? 'Opening...' : 'Open Project...'}
          </span>
        </button>

        {/* Separator */}
        <div class="w-[340px] h-px bg-(--color-separator)" />

        {/* Recent Projects Label */}
        <span class="text-[10px] font-semibold text-(--color-text-dimmer) tracking-wide">
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
                onRemove={() => handleRemove(project)}
                onLocate={() => handleLocate(project)}
              />
            ))
          ) : (
            <span class="text-[11px] text-(--color-text-dim)">
              No recent projects
            </span>
          )}
        </div>

        {/* Version info */}
        <div class="flex items-center gap-2 w-[340px] rounded-lg bg-(--color-bg-card) p-3 px-4">
          <span class="text-[10px] text-(--color-text-dim)">
            EFX Motion Editor v0.1.0
          </span>
        </div>
      </div>

      {/* Right Side - Hero Area */}
      <div class="flex flex-col items-center justify-center gap-12 flex-1 h-full bg-(--color-bg-right) p-20">
        {/* Centered tagline and version (replaces hero image) */}
        <div class="flex flex-col items-center gap-6">
          <div class="flex items-center gap-2 rounded-full bg-(--color-badge-bg) px-4 py-2">
            <div class="w-2 h-2 rounded-full bg-(--color-dot-blue)" />
            <span class="text-xs text-(--color-badge-text)">
              Stop-Motion -- 15fps / 24fps -- PNG Sequence Export
            </span>
          </div>
          <h2 class="text-2xl font-semibold text-(--color-text-primary) text-center">
            Create cinematic stop-motion sequences
          </h2>
          <p class="text-sm text-(--color-text-muted) text-center max-w-md leading-relaxed">
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
        <NewProjectDialog onClose={() => { uiStore.showNewProjectDialog.value = false; }} />
      )}
    </div>
  );
}
