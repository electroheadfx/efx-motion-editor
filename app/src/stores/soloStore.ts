import { signal, computed } from '@preact/signals';

const soloEnabled = signal(false);

export const soloStore = {
  soloEnabled,
  isSolo: computed(() => soloEnabled.value),

  toggleSolo() {
    soloEnabled.value = !soloEnabled.value;
  },

  setSolo(v: boolean) {
    soloEnabled.value = v;
  },
};
