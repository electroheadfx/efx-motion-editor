import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
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

// Asset protocol URL conversion
export function assetUrl(filePath: string): string {
  return convertFileSrc(filePath);
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

// --- Image commands ---
export async function imageGetInfo(path: string): Promise<Result<ImageInfo>> {
  return safeInvoke<ImageInfo>('image_get_info', { path });
}

export async function importImages(paths: string[], projectDir: string): Promise<Result<ImportResult>> {
  return safeInvoke<ImportResult>('import_images', { paths, projectDir });
}
