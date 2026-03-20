import { signal, computed } from '@preact/signals';
import { getLoopEnabled, setLoopEnabled } from '../lib/appConfig';

const isolatedSequenceIds = signal<Set<string>>(new Set());
const loopEnabled = signal(false);

export const isolationStore = {
  isolatedSequenceIds,
  loopEnabled,
  hasIsolation: computed(() => isolatedSequenceIds.value.size > 0),

  toggleIsolation(sequenceId: string) {
    const current = new Set(isolatedSequenceIds.peek());
    if (current.has(sequenceId)) {
      current.delete(sequenceId);
    } else {
      current.add(sequenceId);
    }
    isolatedSequenceIds.value = current;
  },

  isIsolated(sequenceId: string): boolean {
    return isolatedSequenceIds.peek().has(sequenceId);
  },

  clearIsolation() {
    if (isolatedSequenceIds.peek().size > 0) {
      isolatedSequenceIds.value = new Set();
    }
  },

  removeSequence(sequenceId: string) {
    const current = isolatedSequenceIds.peek();
    if (current.has(sequenceId)) {
      const next = new Set(current);
      next.delete(sequenceId);
      isolatedSequenceIds.value = next;
    }
  },

  toggleLoop() {
    loopEnabled.value = !loopEnabled.value;
    setLoopEnabled(loopEnabled.value);
  },

  setLoopEnabled(v: boolean) {
    loopEnabled.value = v;
  },

  async loadLoopPreference() {
    const saved = await getLoopEnabled();
    loopEnabled.value = saved;
  },
};
