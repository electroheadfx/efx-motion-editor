import React from "react";

const filters = [
  { label: "All", active: true },
  { label: "FX Video", active: false },
  { label: "Audio Presets", active: false },
  { label: "Overlays", active: false },
];

const localTemplates = [
  {
    name: "Vintage Film Look",
    sub: "this project only",
    dotColor: "#2D5BE3",
    nameColor: "#AACCFF",
    bg: "#1A2840",
    selected: true,
  },
  {
    name: "Cinematic Intro",
    sub: null,
    dotColor: "#444444",
    nameColor: "#777777",
    bg: "#161616",
    selected: false,
  },
];

const globalTemplates = [
  {
    name: "Light Leaks Collection",
    sub: "available everywhere",
    dotColor: "#444444",
    nameColor: "#777777",
    bg: "#161616",
  },
  {
    name: "Beat Flash Presets",
    sub: null,
    dotColor: "#444444",
    nameColor: "#777777",
    bg: "#161616",
  },
];

const templateCards = [
  {
    name: "Light Leaks Pack",
    meta: "FX Video · Global",
    nameColor: "#E0E0E0",
    metaColor: "#555555",
    bg: "#1A1A1A",
    image:
      "https://images.unsplash.com/photo-1649366381763-ebf8262581e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzI0NTAzNzh8&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    name: "Film Grain Texture",
    meta: "FX Video · Global",
    nameColor: "#E0E0E0",
    metaColor: "#555555",
    bg: "#1A1A1A",
    image:
      "https://images.unsplash.com/photo-1707473614664-d201fac5f04e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzI0NTAzNzl8&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    name: "Vintage Film Look",
    meta: "Composition · Local  ✓ Selected",
    nameColor: "#AACCFF",
    metaColor: "#4488CC",
    bg: "#1E2040",
    image:
      "https://images.unsplash.com/photo-1536854150886-354a3b64b7d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzI0NTAzODB8&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    name: "Beat Flash Preset",
    meta: "Audio Preset · Global",
    nameColor: "#E0E0E0",
    metaColor: "#555555",
    bg: "#1A1A1A",
    image:
      "https://images.unsplash.com/photo-1738168504657-7e9f3119a0f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzI0NTAzODF8&ixlib=rb-4.1.0&q=80&w=1080",
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
        EFX-Motion — Template Library
      </span>
    </div>
  );
}

function TemplateToolbar() {
  return (
    <div className="flex items-center gap-1 h-11 w-full bg-[#1C1C1C] px-3 shrink-0">
      <button className="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span className="text-xs text-[var(--color-text-secondary)]">← Back to Editor</span>
      </button>
      <span className="text-sm font-semibold text-[#CCCCCC] ml-1">Template Library</span>
      <div className="flex-1" />
      <button className="rounded-[5px] bg-[var(--color-bg-settings)] px-4 py-1.5">
        <span className="text-xs text-[var(--color-text-link)]">Import Template</span>
      </button>
      <button className="rounded-[5px] bg-[var(--color-accent)] px-4 py-1.5">
        <span className="text-xs text-white">Export Selected</span>
      </button>
    </div>
  );
}

function TemplateSidebar() {
  return (
    <div className="flex flex-col gap-1 w-[260px] h-full bg-[#111111] p-4 px-3 shrink-0">
      {/* Local Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 px-1 py-2">
          <span className="text-[10px] text-[var(--color-text-dim)]">▼</span>
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Local (Project) Templates
          </span>
        </div>
        {localTemplates.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-2.5 rounded-md h-11 w-[236px] px-3"
            style={{ backgroundColor: t.bg }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: t.dotColor }}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium" style={{ color: t.nameColor }}>
                {t.name}
              </span>
              {t.sub && (
                <span className="text-[9px] text-[#556688]">{t.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="w-[236px] h-px bg-[var(--color-bg-input)]" />

      {/* Global Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 px-1 py-2">
          <span className="text-[10px] text-[var(--color-text-dim)]">▼</span>
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Global Templates
          </span>
        </div>
        {globalTemplates.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-2.5 rounded-md h-11 w-[236px] px-3"
            style={{ backgroundColor: t.bg }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: t.dotColor }}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs" style={{ color: t.nameColor }}>
                {t.name}
              </span>
              {t.sub && (
                <span className="text-[9px] text-[#444455]">{t.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateMain() {
  return (
    <div className="flex flex-col gap-6 flex-1 h-full bg-[#151515] p-6 min-w-0">
      {/* Search Row */}
      <div className="flex items-center gap-3 h-10">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-card)] h-10 w-[320px] px-3.5">
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-text-dimmer)]" />
          <span className="text-[13px] text-[var(--color-text-dim)]">Search templates…</span>
        </div>
        {filters.map((f) => (
          <button
            key={f.label}
            className={`rounded-md px-3.5 py-2 ${
              f.active
                ? "bg-[var(--color-accent)]"
                : "bg-[var(--color-bg-input)]"
            }`}
          >
            <span
              className={`text-xs ${
                f.active ? "font-medium text-white" : "text-[#777777]"
              }`}
            >
              {f.label}
            </span>
          </button>
        ))}
      </div>

      {/* Grid Label */}
      <span className="text-[10px] font-semibold text-[var(--color-text-dimmer)]">
        AVAILABLE TEMPLATES
      </span>

      {/* Template Grid */}
      <div className="flex gap-4 flex-wrap">
        {templateCards.map((card) => (
          <div
            key={card.name}
            className="flex flex-col w-[260px] h-[200px] rounded-[10px] overflow-hidden"
            style={{ backgroundColor: card.bg }}
          >
            <div className="w-full h-[140px] overflow-hidden">
              <img
                src={card.image}
                alt={card.name}
                className="w-full h-full object-cover rounded-t-[10px]"
              />
            </div>
            <div className="flex flex-col gap-1 px-3 py-2.5">
              <span className="text-[13px] font-medium" style={{ color: card.nameColor }}>
                {card.name}
              </span>
              <span className="text-[11px]" style={{ color: card.metaColor }}>
                {card.meta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TemplateLibraryScreen() {
  return (
    <div className="flex flex-col w-full h-full bg-[#151515] font-primary">
      <TitleBar />
      <TemplateToolbar />
      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <TemplateSidebar />
        <TemplateMain />
      </div>
    </div>
  );
}
