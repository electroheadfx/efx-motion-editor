import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./RuleSectionHeader.tsx', import.meta.url)),
  'utf8',
);

describe('RuleSectionHeader color literal (261010-en9 R1)', () => {
  it('pins the rule background to rgb(205, 201, 201)', () => {
    expect(source).toContain("background: 'rgb(205, 201, 201)'");
  });

  it('pins the label color to rgb(205, 201, 201)', () => {
    expect(source).toContain("color: 'rgb(205, 201, 201)'");
  });

  it('retires the harsh white header color', () => {
    expect(source).not.toContain('#ffffff');
    expect(source).not.toContain('rgb(255, 255, 255)');
  });
});
