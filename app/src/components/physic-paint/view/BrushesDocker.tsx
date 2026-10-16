// ============================================================
//  BrushesDocker — Krita-style category-grouped tip list
//  (AQUA-03 / D-07). Vertical list, toolbar add/import, category
//  filter + search, collapsible categories with counts, footer.
//
//  Categories are a data-model concern (D-07) — grouping is
//  derived from each tip's category field. Import failures show
//  the named inline line (T-56-20) and never throw.
// ============================================================

import { signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { ChevronDown, ChevronRight, FolderOpen, Plus, Star } from 'lucide-preact';
import {
  IMPORT_TIP_FAILURE_COPY,
  TIPS,
  importTip,
  type AquarelleTip,
  type AquarelleTipCategory,
} from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleSelectedTipId,
  selectAquarelleTip,
} from './aquarelleRecordState';

const CATEGORY_ORDER: readonly AquarelleTipCategory[] = Object.freeze([
  'round',
  'flat',
  'texture',
  'experimental',
  'custom',
]);

const CATEGORY_LABELS: Readonly<Record<AquarelleTipCategory, string>> = Object.freeze({
  round: 'Round',
  flat: 'Flat',
  texture: 'Texture',
  experimental: 'Experimental',
  custom: 'Custom',
});

const search = signal('');
const category = signal<'all' | AquarelleTipCategory>('all');
const importFailure = signal(false);
const collapsed = signal<Record<string, boolean>>({});
const customTips = signal<readonly AquarelleTip[]>([]);
const importing = signal(false);

export function setBrushesDockerSearch(value: string): void {
  search.value = value;
}

export function setBrushesDockerCategory(value: 'all' | AquarelleTipCategory): void {
  category.value = value;
}

export function setBrushesDockerImportFailure(value: boolean): void {
  importFailure.value = value;
}

export function resetBrushesDockerUi(): void {
  search.value = '';
  category.value = 'all';
  importFailure.value = false;
  collapsed.value = {};
  customTips.value = [];
  importing.value = false;
}

export interface BrushesDockerProps {
  /** Ids a script references that the pack snapshot does not carry (AQUA-03). */
  missingTipIds?: readonly string[];
}

function matchesFilter(tip: AquarelleTip, query: string, cat: 'all' | AquarelleTipCategory): boolean {
  if (cat !== 'all' && tip.category !== cat) return false;
  if (query.length === 0) return true;
  return tip.name.toLowerCase().includes(query.toLowerCase());
}

function TipRow(props: { tip: AquarelleTip }) {
  const selected = aquarelleSelectedTipId.value === props.tip.id;
  return (
    <button
      type="button"
      data-testid={`brush-row-${props.tip.id}`}
      title={props.tip.name}
      onClick={() => selectAquarelleTip(props.tip.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: '32px',
        width: '100%',
        padding: '0 4px',
        border: 'none',
        borderLeft: selected ? '2px solid var(--color-accent, #2D5BE3)' : '2px solid transparent',
        background: selected ? 'var(--color-hover-overlay, rgba(255, 255, 255, 0.06))' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '24px',
          height: '24px',
          flexShrink: 0,
          background: 'var(--color-icon-placeholder, rgba(127, 131, 138, 0.35))',
          borderRadius: '2px',
        }}
      />
      <span
        style={{
          flex: '1 1 0',
          minWidth: 0,
          fontSize: '12px',
          fontWeight: 400,
          lineHeight: 1.5,
          color: 'var(--sidebar-text-primary, #eceff2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {props.tip.name}
      </span>
      <span
        title="Favorite"
        aria-hidden="true"
        style={{
          width: '24px',
          height: '24px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--color-text-dim, #6b7280)',
        }}
      >
        <Star size={16} />
      </span>
    </button>
  );
}

function CategoryGroup(props: {
  id: AquarelleTipCategory;
  tips: readonly AquarelleTip[];
}) {
  const open = collapsed.value[props.id] !== true;
  const label = `${CATEGORY_LABELS[props.id]} — ${props.tips.length}`;
  return (
    <div data-testid={`brush-category-${props.id}`}>
      <button
        type="button"
        data-testid={`brush-category-toggle-${props.id}`}
        aria-expanded={open}
        onClick={() => {
          collapsed.value = { ...collapsed.value, [props.id]: !open };
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          height: '24px',
          padding: '0 4px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--sidebar-text-secondary, #9aa5b1)',
          fontSize: '11px',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</span>
      </button>
      {open
        ? props.tips.map((tip) => <TipRow key={tip.id} tip={tip} />)
        : null}
    </div>
  );
}

export function BrushesDocker(props: BrushesDockerProps = {}) {
  const query = search.value;
  const cat = category.value;
  const failed = importFailure.value;
  const busy = importing.value;
  const selectedId = aquarelleSelectedTipId.value;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allTips: readonly AquarelleTip[] = [...TIPS, ...customTips.value];
  const visible = allTips.filter((tip) => matchesFilter(tip, query, cat));
  const selectedTip = selectedId ? allTips.find((t) => t.id === selectedId) : undefined;
  const footerName = selectedTip ? selectedTip.name : 'No brush';
  const totalCount = allTips.length;

  const onImportFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importing.value = true;
    importFailure.value = false;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await importTip(bytes, file.name);
      if (result.ok) {
        customTips.value = [...customTips.value, result.tip];
        selectAquarelleTip(result.tip.id);
      } else {
        importFailure.value = true;
      }
    } catch {
      importFailure.value = true;
    } finally {
      importing.value = false;
    }
  };

  return (
    <div
      data-testid="brushes-docker"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minHeight: 0,
      }}
    >
      {/* Toolbar: Add + Import */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <button
          type="button"
          data-testid="brushes-add"
          title="Add brush"
          aria-label="Add brush"
          style={{
            width: '24px',
            height: '24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--sidebar-text-primary, #eceff2)',
          }}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          data-testid="brushes-import"
          title="Import brush tip (PNG/JPG)"
          aria-label="Import brush tip (PNG/JPG)"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '24px',
            height: '24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
            color: 'var(--sidebar-text-primary, #eceff2)',
          }}
        >
          <FolderOpen size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          data-testid="brushes-import-input"
          style={{ display: 'none' }}
          onChange={(event) => {
            void onImportFile(event);
          }}
        />
      </div>

      {/* Import failure line (T-56-20) */}
      {failed ? (
        <span
          data-testid="brushes-import-failure"
          style={{
            fontSize: '10px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-error-text, #FF6666)',
          }}
        >
          {IMPORT_TIP_FAILURE_COPY}
        </span>
      ) : null}

      {/* Category filter + search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <select
          data-testid="brushes-category-filter"
          aria-label="All categories"
          value={cat}
          onChange={(event) => {
            const next = (event.currentTarget as HTMLSelectElement).value;
            setBrushesDockerCategory(next as 'all' | AquarelleTipCategory);
          }}
          style={{
            flex: '0 0 auto',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--sidebar-text-primary, #eceff2)',
            background: 'var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))',
            border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
            borderRadius: '3px',
          }}
        >
          <option value="all">All categories</option>
          {CATEGORY_ORDER.map((id) => (
            <option key={id} value={id}>
              {CATEGORY_LABELS[id]}
            </option>
          ))}
        </select>
        <input
          type="search"
          data-testid="brushes-search"
          placeholder="Search brushes"
          aria-label="Search brushes"
          value={query}
          onInput={(event) => {
            setBrushesDockerSearch((event.currentTarget as HTMLInputElement).value);
          }}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--sidebar-text-primary, #eceff2)',
            background: 'var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))',
            border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
            borderRadius: '3px',
            padding: '0 4px',
            height: '20px',
          }}
        />
      </div>

      {/* Vertical scrolling list */}
      <div
        data-testid="brushes-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          minHeight: '64px',
          maxHeight: '240px',
        }}
      >
        {visible.length === 0 ? (
          <div style={{ padding: '8px 4px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--sidebar-text-primary, #eceff2)',
              }}
            >
              No brushes match
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--sidebar-text-secondary, #9aa5b1)',
              }}
            >
              Try another search term or choose All categories.
            </div>
          </div>
        ) : (
          CATEGORY_ORDER.map((id) => {
            const tips = visible.filter((t) => t.category === id);
            if (tips.length === 0) return null;
            return <CategoryGroup key={id} id={id} tips={tips} />;
          })
        )}

        {/* Missing-id placeholder rows (AQUA-03 partial) */}
        {(props.missingTipIds ?? []).map((id) => (
          <div
            key={id}
            data-testid={`brush-missing-${id}`}
            style={{
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--color-text-dim, #6b7280)',
            }}
          >
            {`Missing brush — ${id}`}
          </div>
        ))}
      </div>

      {/* Footer (pinned) */}
      <div
        data-testid="brushes-footer"
        style={{
          fontSize: '13px',
          fontWeight: 600,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--sidebar-text-primary, #eceff2)',
          paddingTop: '4px',
        }}
      >
        {`${footerName} — ${totalCount} brushes`}
      </div>
    </div>
  );
}
