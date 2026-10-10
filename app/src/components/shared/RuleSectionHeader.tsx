/**
 * Studio section header — 1px rule + centered uppercase label + 1px rule.
 *
 * These values are the ONLY home of the section-header numbers (they were
 * previously forked in physicsPaintStudio.css .physics-paint-audio-section*;
 * those three rules are gone). Used by the Studio audio-modal headers and the
 * main-app AudioProperties sidebar so the two surfaces cannot drift.
 *
 * 261010-en9 R1: rule + label share the softer rgb(205, 201, 201) so headers
 * stop reading as harsh white bars.
 *
 * Purely presentational — no state, no store reads.
 */
export function RuleSectionHeader({ text }: { text: string }) {
  const ruleStyle = {
    flex: '1 1 0',
    height: '1px',
    background: 'rgb(205, 201, 201)',
  } as const;

  return (
    <div
      class="rule-section-header"
      data-testid="rule-section-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
      }}
    >
      <span aria-hidden="true" style={ruleStyle} />
      <span
        style={{
          fontSize: '9.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12px',
          color: 'rgb(205, 201, 201)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
      <span aria-hidden="true" style={ruleStyle} />
    </div>
  );
}
