import React from "react";

const exportLayers = [
  {
    name: "Base Layer (Photos)",
    badge: "Keyframes",
    badgeBg: "#1E2A40",
    badgeColor: "#4488CC",
    checked: true,
    checkBg: "#2D5BE3",
    nameColor: "#CCCCCC",
    rowBg: "#111111",
  },
  {
    name: "Light Leaks",
    badge: "FX · Screen",
    badgeBg: "#2A1A3A",
    badgeColor: "#9966CC",
    checked: true,
    checkBg: "#2D5BE3",
    nameColor: "#CCCCCC",
    rowBg: "#111111",
  },
  {
    name: "Film Grain",
    badge: "FX · Overlay",
    badgeBg: "#1A1A1A",
    badgeColor: "#555555",
    checked: false,
    checkBg: "#1E1E1E",
    nameColor: "#666666",
    rowBg: "#0E0E0E",
  },
];

function TitleBar() {
  return (
    <div className="flex items-center h-7 w-full bg-[#111111] px-4 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
      </div>
      <span className="text-xs text-[var(--color-text-muted)] ml-4">
        EFX-Motion — My Short Film.mce
      </span>
    </div>
  );
}

function ExportToolbar() {
  return (
    <div className="flex items-center gap-1 h-11 w-full bg-[#1C1C1C] px-3 shrink-0">
      <button className="rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span className="text-xs text-[#CCCCCC]">New</span>
      </button>
      <button className="rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span className="text-xs text-[#CCCCCC]">Open</span>
      </button>
      <button className="rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span className="text-xs text-[#CCCCCC]">Save</span>
      </button>
      <div className="flex-1" />
      <button className="rounded-[5px] bg-[#F97316] px-4 py-1.5">
        <span className="text-xs font-semibold text-white">Export</span>
      </button>
    </div>
  );
}

function ExportModal() {
  return (
    <div className="flex flex-col w-[560px] rounded-xl bg-[var(--color-bg-card)] overflow-hidden">
      {/* Modal Header */}
      <div className="flex items-center justify-between h-14 px-6 bg-[#111111] rounded-t-xl">
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          Export PNG Sequence
        </span>
        <button className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-bg-settings)]">
          <span className="text-xs text-[var(--color-text-secondary)]">✕</span>
        </button>
      </div>

      {/* Modal Body */}
      <div className="flex flex-col gap-5 p-6">
        {/* Output Settings */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-semibold text-[var(--color-text-dimmer)]">
            OUTPUT SETTINGS
          </span>
          {/* Output Path */}
          <div className="flex items-center gap-2.5 rounded-md bg-[#111111] h-10 w-[512px] px-3.5">
            <div className="w-4 h-4 rounded-[3px] bg-[#333333] shrink-0" />
            <span className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">
              ~/Movies/efx-exports/my-short-film/
            </span>
            <button className="rounded bg-[#2A2A2A] px-3 py-[5px]">
              <span className="text-[11px] text-[var(--color-text-link)]">Browse</span>
            </button>
          </div>
          {/* Resolution / FPS / Format Row */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[var(--color-text-muted)]">Resolution</span>
              <div className="flex items-center rounded-md bg-[#111111] px-3.5 py-2">
                <span className="text-xs text-[#CCCCCC]">1920 × 1080  ▾</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[var(--color-text-muted)]">Frame Rate</span>
              <div className="flex items-center rounded-md bg-[#111111] px-3.5 py-2">
                <span className="text-xs text-[#CCCCCC]">15 fps  ▾</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[var(--color-text-muted)]">Format</span>
              <div className="flex items-center rounded-md bg-[#111111] px-3.5 py-2">
                <span className="text-xs text-[#CCCCCC]">PNG  ▾</span>
              </div>
            </div>
          </div>
        </div>

        {/* Layers to Export */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-semibold text-[var(--color-text-dimmer)]">
            LAYERS TO EXPORT
          </span>
          {exportLayers.map((layer) => (
            <div
              key={layer.name}
              className="flex items-center gap-3 rounded-md h-10 w-[512px] px-3.5"
              style={{ backgroundColor: layer.rowBg }}
            >
              <div
                className="w-4 h-4 rounded-[3px] shrink-0"
                style={{ backgroundColor: layer.checkBg }}
              />
              {layer.checked && (
                <span className="text-[11px] text-white -ml-2">✓</span>
              )}
              <span className="text-xs" style={{ color: layer.nameColor }}>
                {layer.name}
              </span>
              <div
                className="rounded px-2 py-[3px]"
                style={{ backgroundColor: layer.badgeBg }}
              >
                <span className="text-[10px]" style={{ color: layer.badgeColor }}>
                  {layer.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Progress Section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between w-[512px]">
            <span className="text-[10px] font-semibold text-[var(--color-text-dimmer)]">
              EXPORT PROGRESS
            </span>
            <span className="text-[10px] text-[var(--color-text-dim)]">
              0 / 120 frames
            </span>
          </div>
          <div className="w-[512px] h-1.5 rounded-[3px] bg-[var(--color-bg-input)]" />
        </div>
      </div>

      {/* Modal Footer */}
      <div className="flex items-center h-[72px] px-6 bg-[#111111] rounded-b-xl">
        <span className="text-[11px] text-[var(--color-text-dim)] flex-1">
          ~120 frames · ~1080p · ~45MB estimated
        </span>
        <div className="flex items-center gap-3">
          <button className="rounded-md bg-[var(--color-bg-input)] px-5 py-2.5">
            <span className="text-[13px] text-[var(--color-text-secondary)]">Cancel</span>
          </button>
          <button className="rounded-md bg-[#F97316] px-6 py-2.5">
            <span className="text-[13px] font-semibold text-white">Start Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExportDialogScreen() {
  return (
    <div className="flex flex-col w-full h-full bg-[#151515] font-primary">
      <TitleBar />
      <ExportToolbar />
      {/* Overlay Dimmer + Modal */}
      <div className="flex items-center justify-center flex-1 bg-[#00000099]">
        <ExportModal />
      </div>
    </div>
  );
}
