import { invoke } from '@tauri-apps/api/core';
import type { ProjectData, MceProject } from '../types/project';
import type { ImageInfo, ImportResult } from '../types/image';

// Result type mirroring Rust's Result pattern (locked decision)
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Central safe invoke wrapper
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Custom protocol URL conversion — bypasses Tauri asset scope restrictions
// that fail on macOS paths with accented characters (NFC/NFD mismatch).
export function assetUrl(filePath: string, bustKey?: string): string {
  const encoded = encodeURIComponent(filePath)
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':');
  const bust = bustKey ? `?v=${bustKey}` : '';
  return `efxasset://localhost${encoded}${bust}`;
}

// --- Project commands ---
export async function projectGetDefault(): Promise<Result<ProjectData>> {
  return safeInvoke<ProjectData>('project_get_default');
}

export async function projectCreate(name: string, fps: number, dirPath: string): Promise<Result<MceProject>> {
  return safeInvoke<MceProject>('project_create', { name, fps, dirPath });
}

export async function projectSave(project: MceProject, filePath: string): Promise<Result<null>> {
  return safeInvoke<null>('project_save', { project, filePath });
}

export async function projectOpen(filePath: string): Promise<Result<MceProject>> {
  return safeInvoke<MceProject>('project_open', { filePath });
}

export async function projectMigrateTempImages(tempDir: string, projectDir: string): Promise<Result<string[]>> {
  return safeInvoke<string[]>('project_migrate_temp_images', { tempDir, projectDir });
}

// --- Path utilities ---
export async function pathExists(filePath: string): Promise<Result<boolean>> {
  return safeInvoke<boolean>('path_exists', { filePath });
}

// --- Image commands ---
export async function imageGetInfo(path: string): Promise<Result<ImageInfo>> {
  return safeInvoke<ImageInfo>('image_get_info', { path });
}

export async function importImages(paths: string[], projectDir: string): Promise<Result<ImportResult>> {
  return safeInvoke<ImportResult>('import_images', { paths, projectDir });
}

// --- Config commands ---

export async function configGetTheme(): Promise<Result<string | null>> {
  return safeInvoke<string | null>('config_get_theme');
}

export async function configSetTheme(theme: string): Promise<Result<null>> {
  return safeInvoke<null>('config_set_theme', { theme });
}

export async function configGetCanvasBg(theme: string): Promise<Result<string | null>> {
  return safeInvoke<string | null>('config_get_canvas_bg', { theme });
}

export async function configSetCanvasBg(theme: string, color: string): Promise<Result<null>> {
  return safeInvoke<null>('config_set_canvas_bg', { theme, color });
}

export function configGetSidebarWidth() {
  return safeInvoke<number | null>('config_get_sidebar_width');
}

export function configSetSidebarWidth(width: number) {
  return safeInvoke<null>('config_set_sidebar_width', { width });
}

export function configGetPanelHeights() {
  return safeInvoke<[number, number] | null>('config_get_panel_heights');
}

export function configSetPanelHeights(seqHeight: number, layersHeight: number) {
  return safeInvoke<null>('config_set_panel_heights', { seqHeight, layersHeight });
}

export function configGetLoopEnabled() {
  return safeInvoke<boolean | null>('config_get_loop_enabled');
}

export function configSetLoopEnabled(enabled: boolean) {
  return safeInvoke<null>('config_set_loop_enabled', { enabled });
}
