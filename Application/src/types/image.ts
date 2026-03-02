export interface ImageInfo {
  path: string;
  width: number;
  height: number;
  format: string;
}

export interface ImportedImage {
  id: string;
  original_path: string;
  project_path: string;
  thumbnail_path: string;
  width: number;
  height: number;
  format: string;
}

export interface ImportResult {
  imported: ImportedImage[];
  errors: ImportError[];
}

export interface ImportError {
  path: string;
  error: string;
}
