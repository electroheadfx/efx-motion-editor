/// <reference types="vite/client" />

interface Window {
  __TAURI_INTERNALS__?: Record<string, unknown>;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*?scene' {
  const scene: any;
  export default scene;
}
