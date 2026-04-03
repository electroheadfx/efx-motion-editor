import {signal} from '@preact/signals';

/** @deprecated Preview now uses canvas rendering via PreviewRenderer. Kept for potential external consumers. */
export const currentPreviewUrl = signal<string>('');
