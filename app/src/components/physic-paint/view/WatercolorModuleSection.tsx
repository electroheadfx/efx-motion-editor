import { SectionLabel } from '../../shared/SectionLabel';

/**
 * 56-02 (D-05): the Water color module-only block — empty-tolerant shell.
 * Body lands in 56-07. The module block never shows mode selectors (D-14).
 */
export function WatercolorModuleSection() {
  return (
    <div class="physics-paint-module-section" data-module="watercolor">
      <SectionLabel text="Water color" />
    </div>
  );
}
