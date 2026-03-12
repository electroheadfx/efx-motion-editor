import {useState, useEffect, useRef} from 'preact/hooks';
import {open as openDialog} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../../stores/projectStore';

interface NewProjectDialogProps {
  onClose: () => void;
}

export function NewProjectDialog({onClose}: NewProjectDialogProps) {
  const [name, setName] = useState('Untitled Project');
  const [fps, setFps] = useState(24);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus the name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const handleChooseFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Choose Project Folder',
    });
    if (selected && typeof selected === 'string') {
      setDirPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!dirPath) {
      setError('Please choose a folder for the project.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a project name.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Build the project directory path: dirPath/projectName
      const projectDirPath = `${dirPath}/${name.trim()}`;

      // Create the project via projectStore (handles IPC + temp migration)
      await projectStore.createProject(name.trim(), fps, projectDirPath);

      // Auto-save an initial .mce file
      const mcePath = `${projectDirPath}/${name.trim()}.mce`;
      await projectStore.saveProjectAs(mcePath);

      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !isCreating) handleCreate();
  };

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Dialog Card */}
      <div class="relative bg-[var(--color-bg-card)] rounded-xl shadow-2xl w-[440px] p-8 flex flex-col gap-6">
        {/* Title */}
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
          New Project
        </h2>

        {/* Project Name */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-[var(--color-text-dim)] tracking-wide">
            PROJECT NAME
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full h-10 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-separator)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            placeholder="Enter project name"
          />
        </div>

        {/* Frame Rate */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-[var(--color-text-dim)] tracking-wide">
            FRAME RATE
          </label>
          <div class="flex items-center gap-1 rounded-lg bg-[var(--color-bg-input)] p-1 w-fit">
            <div
              class={`flex items-center rounded-md px-4 py-2 cursor-pointer transition-colors ${
                fps === 15 ? 'bg-[var(--color-accent)]' : ''
              }`}
              onClick={() => setFps(15)}
            >
              <span
                class={`text-sm ${fps === 15 ? 'text-white font-medium' : 'text-[var(--color-text-secondary)]'}`}
              >
                15 fps
              </span>
            </div>
            <div
              class={`flex items-center rounded-md px-4 py-2 cursor-pointer transition-colors ${
                fps === 24 ? 'bg-[var(--color-accent)]' : ''
              }`}
              onClick={() => setFps(24)}
            >
              <span
                class={`text-sm ${fps === 24 ? 'text-white font-medium' : 'text-[var(--color-text-secondary)]'}`}
              >
                24 fps
              </span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-[var(--color-text-dim)] tracking-wide">
            LOCATION
          </label>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-10 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-separator)] px-3 flex items-center overflow-hidden">
              <span class="text-sm text-[var(--color-text-secondary)] truncate">
                {dirPath ?? 'No folder selected'}
              </span>
            </div>
            <button
              class="h-10 rounded-lg bg-[var(--color-bg-settings)] px-4 hover:bg-[var(--color-bg-input)] transition-colors shrink-0"
              onClick={handleChooseFolder}
            >
              <span class="text-sm text-[var(--color-text-secondary)]">
                Choose...
              </span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div class="rounded-lg bg-[var(--color-error-bg)] px-3 py-2">
            <span class="text-xs text-[var(--color-error-text)]">{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            class="h-9 rounded-lg bg-[var(--color-bg-settings)] px-5 hover:bg-[var(--color-bg-input)] transition-colors"
            onClick={onClose}
            disabled={isCreating}
          >
            <span class="text-sm text-[var(--color-text-secondary)]">
              Cancel
            </span>
          </button>
          <button
            class="h-9 rounded-lg bg-[var(--color-accent)] px-5 hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
            onClick={handleCreate}
            disabled={isCreating || !dirPath}
          >
            <span class="text-sm font-medium text-white">
              {isCreating ? 'Creating...' : 'Create'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
