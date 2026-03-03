import {signal} from '@preact/signals';

/** Current preview image URL, updated by Preview component effect on frame change */
export const currentPreviewUrl = signal<string>('');
