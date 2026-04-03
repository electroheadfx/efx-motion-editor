import type { BrushStyle } from '../types/paint';

/**
 * Static SVG data URIs for brush style preview thumbnails.
 * Each SVG is a 120x40 viewBox showing a characteristic stroke.
 * Used in PaintProperties BRUSH STYLE selector strip.
 * Zero runtime cost — pre-rendered inline SVGs (per D-04).
 */

const flat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path d="M10 25 Q30 10, 60 20 Q90 30, 110 15" stroke="#CCCCCC" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const watercolor = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><defs><filter id="wc"><feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="3" result="turb"/><feDisplacementMap in="SourceGraphic" in2="turb" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></defs><path d="M10 25 Q30 8, 60 22 Q90 36, 110 14" stroke="#CCCCCC" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" filter="url(#wc)"/></svg>`;

const ink = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><defs><filter id="ik"><feTurbulence type="turbulence" baseFrequency="0.15" numOctaves="2" result="turb"/><feDisplacementMap in="SourceGraphic" in2="turb" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter></defs><path d="M10 28 Q25 12, 45 18 Q60 24, 75 14 Q90 6, 110 20" stroke="#CCCCCC" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#ik)"/><path d="M45 18 Q60 24, 75 14" stroke="#CCCCCC" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9" filter="url(#ik)"/></svg>`;

const charcoal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><defs><filter id="ch"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" result="turb"/><feDisplacementMap in="SourceGraphic" in2="turb" scale="3" xChannelSelector="R" yChannelSelector="G"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 0.4 0.7 0.9 1"/></feComponentTransfer></filter></defs><path d="M10 24 Q30 12, 60 22 Q90 32, 110 16" stroke="#CCCCCC" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" filter="url(#ch)"/></svg>`;

const pencil = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><defs><filter id="pn"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="turb"/><feDisplacementMap in="SourceGraphic" in2="turb" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs><path d="M10 26 Q30 14, 60 20 Q90 26, 110 16" stroke="#CCCCCC" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5" filter="url(#pn)"/></svg>`;

const marker = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path d="M10 24 Q30 12, 60 20 Q90 28, 110 16" stroke="#CCCCCC" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>`;

export const BRUSH_PREVIEW_URLS: Record<BrushStyle, string> = {
  flat: `data:image/svg+xml,${encodeURIComponent(flat)}`,
  watercolor: `data:image/svg+xml,${encodeURIComponent(watercolor)}`,
  ink: `data:image/svg+xml,${encodeURIComponent(ink)}`,
  charcoal: `data:image/svg+xml,${encodeURIComponent(charcoal)}`,
  pencil: `data:image/svg+xml,${encodeURIComponent(pencil)}`,
  marker: `data:image/svg+xml,${encodeURIComponent(marker)}`,
};
