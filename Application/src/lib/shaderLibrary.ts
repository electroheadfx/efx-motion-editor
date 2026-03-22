/**
 * GLSL Shader Library — registry of built-in Shadertoy-ported shaders.
 *
 * Each shader has: GLSL source, metadata, and parameter definitions.
 * To add a new shader, follow the spec in docs/SHADER-SPEC.md.
 */

// ---- Types ----

export type ShaderCategory = 'generator' | 'fx-image' | 'transition';

export interface ShaderParamDef {
  key: string;
  label: string;
  type: 'float' | 'color' | 'bool';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** Groups R/G/B float params together for a color picker UI */
  colorGroup?: string;
  /** Hide from individual slider rendering (used for R/G/B sub-params of a color group) */
  hidden?: boolean;
}

export interface ShaderDefinition {
  id: string;
  name: string;
  category: ShaderCategory;
  description: string;
  author?: string;
  license?: string;
  /** Shadertoy source URL */
  url?: string;
  /** Raw Shadertoy-style GLSL (mainImage function + helpers). Uniforms are auto-wrapped. */
  fragmentSource: string;
  params: ShaderParamDef[];
  /** Default blend mode when added as a layer */
  defaultBlend?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
}

// ---- Shader Imports: Generators ----

import { starNest } from './shaders/generators/starNest';
import { spiralLitClouds } from './shaders/generators/spiralLitClouds';
import { driveHome } from './shaders/generators/driveHome';
import { clouds3dFly } from './shaders/generators/clouds3dFly';
import { sunWithStars } from './shaders/generators/sunWithStars';
import { neonDoodleFuzz } from './shaders/generators/neonDoodleFuzz';
import { seascape } from './shaders/generators/seascape';
import { oceanWater } from './shaders/generators/oceanWater';
import { indefinite } from './shaders/generators/indefinite';
import { zippyZaps } from './shaders/generators/zippyZaps';

// ---- Shader Imports: FX Image ----

import { cameraPixelFilters } from './shaders/fx-image/cameraPixelFilters';
import { superFilmGrain } from './shaders/fx-image/superFilmGrain';
import { colorFusion } from './shaders/fx-image/colorFusion';
import { fastBlur } from './shaders/fx-image/fastBlur';
import { colorTemperature } from './shaders/fx-image/colorTemperature';
import { screenNoise } from './shaders/fx-image/screenNoise';
import { filmoraShake } from './shaders/fx-image/filmoraShake';

// ---- Registry ----

const SHADER_REGISTRY: ShaderDefinition[] = [
  // Generators
  starNest,
  spiralLitClouds,
  driveHome,
  clouds3dFly,
  sunWithStars,
  neonDoodleFuzz,
  seascape,
  oceanWater,
  indefinite,
  zippyZaps,
  // FX Image
  cameraPixelFilters,
  superFilmGrain,
  colorFusion,
  fastBlur,
  colorTemperature,
  screenNoise,
  filmoraShake,
];

/** Get all registered shaders */
export function getAllShaders(): ShaderDefinition[] {
  return SHADER_REGISTRY;
}

/** Get shaders filtered by category */
export function getShadersByCategory(category: ShaderCategory): ShaderDefinition[] {
  return SHADER_REGISTRY.filter(s => s.category === category);
}

/** Get a shader by ID */
export function getShaderById(id: string): ShaderDefinition | undefined {
  return SHADER_REGISTRY.find(s => s.id === id);
}

/** Get default param values for a shader */
export function getDefaultParams(shader: ShaderDefinition): Record<string, number> {
  const params: Record<string, number> = {};
  for (const p of shader.params) {
    params[p.key] = p.default;
  }
  return params;
}
