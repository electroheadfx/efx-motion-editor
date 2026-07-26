import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../index.html');
const html = () => readFileSync(htmlPath, 'utf8');
const rightPanelPath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintRightPanel.tsx');
const rightPanel = () => readFileSync(rightPanelPath, 'utf8');
const studioCssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const studioCss = () => readFileSync(studioCssPath, 'utf8');

const BASE_SELECTORS = ['html', 'body', '#app'];
// The '.physics-paint-log-messages' exception was retired with the LOG tab
// (36.15-11, UAT Gap G-6) — its only selection target no longer exists.
const EXCEPTION_SELECTORS = ['input', 'textarea', '[contenteditable="true"]'];

interface CssRule {
  selectors: string[];
  declarations: string;
  start: number;
}

function getSelectionGuardRules(code: string): CssRule[] {
  const styleMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return [];
  const block = styleMatch[1];
  const blockOffset = styleMatch.index ?? 0;
  const rules: CssRule[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(block)) !== null) {
    rules.push({
      selectors: match[1].split(',').map(selector => selector.trim()).filter(Boolean),
      declarations: match[2],
      start: blockOffset + match.index,
    });
  }
  return rules.filter(rule => rule.declarations.includes('user-select'));
}

describe('application selection guard source contract (36.15-SELECTION-GUARD)', () => {
  it('applies user-select: none (with -webkit- prefix) to exactly html, body, and #app', () => {
    const rules = getSelectionGuardRules(html());
    const base = rules.find(rule => rule.declarations.includes('user-select: none'));
    expect(base).toBeDefined();
    expect(base!.selectors).toEqual(BASE_SELECTORS);
    expect(base!.declarations).toContain('-webkit-user-select: none');
  });

  it('applies user-select: text (with -webkit- prefix) to exactly the three contract exception selectors', () => {
    const rules = getSelectionGuardRules(html());
    const exception = rules.find(rule => rule.declarations.includes('user-select: text'));
    expect(exception).toBeDefined();
    expect(exception!.selectors).toEqual(EXCEPTION_SELECTORS);
    expect(exception!.declarations).toContain('-webkit-user-select: text');
  });

  it('positions the exception rule after the base rule so it wins the cascade', () => {
    const rules = getSelectionGuardRules(html());
    const base = rules.find(rule => rule.declarations.includes('user-select: none'));
    const exception = rules.find(rule => rule.declarations.includes('user-select: text'));
    expect(base).toBeDefined();
    expect(exception).toBeDefined();
    expect(exception!.start).toBeGreaterThan(base!.start);
  });

  it('keeps the guard limited to the two contract rules with no extra selectors', () => {
    const rules = getSelectionGuardRules(html());
    expect(rules).toHaveLength(2);
    const allSelectors = rules.flatMap(rule => rule.selectors);
    expect(allSelectors.sort()).toEqual([...BASE_SELECTORS, ...EXCEPTION_SELECTORS].sort());
  });
});

describe('selection guard liveness and coexistence guardrails', () => {
  it('removes the retired .physics-paint-log-messages exception with the LOG tab (36.15-11, UAT Gap G-6)', () => {
    expect(rightPanel()).not.toContain('physics-paint-log-messages');
    expect(html()).not.toContain('physics-paint-log-messages');
  });

  it('keeps the pre-existing scoped user-select rules in physicsPaintStudio.css', () => {
    const css = studioCss();
    const demoShellRule = css.slice(css.indexOf('body:has(.demo-shell)'));
    expect(demoShellRule.slice(0, demoShellRule.indexOf('}'))).toContain('user-select: none');
    const stripRule = css.slice(css.indexOf('.physics-paint-workflow-strip {'));
    expect(stripRule.slice(0, stripRule.indexOf('}'))).toContain('user-select: none');
  });
});
