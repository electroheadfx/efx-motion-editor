import {useEffect, useState} from 'preact/hooks';
import {
  formatShortcutKeys,
  resolveShortcutsTabNumber,
  type ShortcutGroup,
} from './shortcutsHelp';
import './shortcutsModal.css';

export interface ShortcutsModalProps {
  groups: ShortcutGroup[];
  tabLabels: string[];
  initialTab: number;
  title: string;
  contextLine: string;
  ariaLabel?: string;
  onClose: () => void;
}

/**
 * The one keyboard-shortcuts modal, shared by the editor and the Physic Paint
 * Studio. It owns the backdrop, the tab bar and the capture-phase key handler;
 * each window supplies its own catalog and detected-context line.
 */
export function ShortcutsModal(props: ShortcutsModalProps) {
  const {groups, tabLabels, initialTab, title, contextLine, ariaLabel, onClose} = props;
  const tabCount = tabLabels.length;
  const [activeTab, setActiveTab] = useState(() =>
    initialTab >= 0 && initialTab < tabCount ? initialTab : 0,
  );
  const [focusedRow, setFocusedRow] = useState(0);

  // Reset focusedRow when returning to Sections tab
  useEffect(() => {
    if (activeTab === 0) setFocusedRow(0);
  }, [activeTab]);

  // Keyboard navigation — capture phase + stopPropagation to block app shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === 0) {
          setFocusedRow((prev) => (prev + 1) % groups.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === 0) {
          setFocusedRow((prev) => (prev - 1 + groups.length) % groups.length);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === 0) {
          setActiveTab(focusedRow + 1);
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((prev) => (prev + 1) % tabCount);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((prev) => (prev - 1 + tabCount) % tabCount);
        return;
      }
      // Number keys 1-N jump to their group tab (N = the group count)
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num)) {
        const tab = resolveShortcutsTabNumber(num, groups.length);
        if (tab !== null) {
          e.preventDefault();
          e.stopPropagation();
          setActiveTab(tab);
          return;
        }
      }
      // Block all other keys from reaching app while overlay is open
      e.stopPropagation();
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTab, focusedRow, groups.length, tabCount, onClose]);

  return (
    <div
      class="shortcuts-modal fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        class="shortcuts-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="shortcuts-modal__header">
          <div class="shortcuts-modal__heading">
            <h2 class="shortcuts-modal__title">{title}</h2>
            <p class="shortcuts-modal__context">{contextLine}</p>
          </div>
          <button class="shortcuts-modal__close" onClick={onClose} title="Close">
            <span aria-hidden="true">{'✕'}</span>
          </button>
        </div>

        {/* Tab bar */}
        <div class="shortcuts-modal__tabs">
          {tabLabels.map((label, index) => {
            const isActive = activeTab === index;
            return (
              <button
                key={label}
                class={`shortcuts-modal__tab${isActive ? ' shortcuts-modal__tab--active' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div class="shortcuts-modal__content">
          {activeTab === 0 ? (
            // Sections index tab: clickable group list with entry counts
            <div class="shortcuts-modal__groups">
              {groups.map((group, i) => (
                <button
                  key={group.title}
                  class={`shortcuts-modal__group${
                    focusedRow === i ? ' shortcuts-modal__group--focused' : ''
                  }`}
                  onClick={() => setActiveTab(i + 1)}
                >
                  <span>{group.title}</span>
                  <span class="shortcuts-modal__group-count">
                    {group.entries.length} {group.entries.length === 1 ? 'shortcut' : 'shortcuts'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            // Group tab: show entries for groups[activeTab - 1]
            <div class="shortcuts-modal__rows">
              {groups[activeTab - 1].entries.map((entry) => (
                <div key={entry.keys} class="shortcuts-modal__row">
                  <span class="shortcuts-modal__desc">{entry.description}</span>
                  <kbd class="shortcuts-modal__keys">{formatShortcutKeys(entry.keys)}</kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
