/** Section label styled consistently across all sections */
export function SectionLabel({ text }: { text: string }) {
  return (
    <span style="font-size: 11px; font-weight: 600; color: var(--sidebar-text-secondary); letter-spacing: 2px; white-space: nowrap">
      {text}
    </span>
  );
}
