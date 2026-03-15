/** Section label styled consistently across all sections */
export function SectionLabel({ text }: { text: string }) {
  return (
    <span class="text-[9px] font-semibold text-[var(--color-text-dimmer)] whitespace-nowrap">
      {text}
    </span>
  );
}
