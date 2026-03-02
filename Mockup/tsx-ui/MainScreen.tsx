import React from "react";

const sequences = [
  { name: "Sequence 01", meta: "8 keys · 2.0s", active: true },
  { name: "Sequence 02", meta: "5 keys · 1.5s", active: false },
  { name: "Sequence 03", meta: "12 keys · 3.0s", active: false },
];

const layers = [
  {
    name: "Light Leaks",
    type: "FX Video · Screen",
    thumbColor: "#5B3A8F",
    nameColor: "#AAAAAA",
    eyeColor: "#555555",
    bg: "#252525",
    fontWeight: "normal" as const,
  },
  {
    name: "Film Grain",
    type: "FX Video · Overlay",
    thumbColor: "#3A5F3A",
    nameColor: "#AAAAAA",
    eyeColor: "#444444",
    bg: "#252525",
    fontWeight: "normal" as const,
  },
  {
    name: "Base Layer (Photos)",
    type: "Keyframes · Normal",
    thumbColor: "#2E4A8F",
    nameColor: "#E0E0E0",
    eyeColor: "#555555",
    bg: "#1E1E1E",
    fontWeight: "500" as const,
  },
];

const timelineClips = [
  { label: "Sequence 01  ·  8 keys", sub: "2.0s", width: 240, bg: "#2D4A8A" },
  { label: "Sequence 02  ·  5 keys", sub: "1.5s", width: 180, bg: "#243D74" },
  { label: "Sequence 03  ·  12 keys", sub: "3.0s", width: 360, bg: "#2D4A8A" },
];

function TitleBar() {
  return (
    <div className="flex items-center h-7 w-full bg-[#111111] px-1.5 shrink-0">
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

function Toolbar() {
  return (
    <div className="flex items-center gap-1 h-11 w-full bg-[#1C1C1C] px-3 shrink-0">
      <button className="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-accent)] px-3 py-1.5">
        <span className="text-xs text-white">New</span>
      </button>
      <button className="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span className="text-xs text-[#CCCCCC]">Open</span>
      </button>
      <button className="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span className="text-xs text-[#CCCCCC]">Save</span>
      </button>
      <div className="w-px h-6 bg-[#333333]" />
      <button className="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1.5">
        <span className="text-xs text-[#CCCCCC]">Set Folder</span>
      </button>
      <div className="w-px h-6 bg-[#333333]" />
      {/* FPS Toggle */}
      <div className="flex items-center gap-0.5 rounded-[5px] bg-[var(--color-bg-settings)] p-1">
        <div className="flex items-center rounded px-2.5 py-1 bg-[var(--color-accent)]">
          <span className="text-[11px] text-white">15fps</span>
        </div>
        <div className="flex items-center rounded px-2.5 py-1">
          <span className="text-[11px] text-[var(--color-text-secondary)]">24fps</span>
        </div>
      </div>
      {/* Spacer */}
      <div className="flex-1" />
      <span className="text-[11px] text-[var(--color-text-secondary)]">100%</span>
      <button className="rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1">
        <span className="text-sm text-[#CCCCCC]">−</span>
      </button>
      <button className="rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1">
        <span className="text-sm text-[#CCCCCC]">+</span>
      </button>
      <div className="w-px h-6 bg-[#333333]" />
      <button className="flex items-center gap-1.5 rounded-[5px] bg-[#F97316] px-4 py-1.5">
        <span className="text-xs font-semibold text-white">Export</span>
      </button>
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="flex flex-col w-[268px] h-full bg-[var(--color-bg-card-alt)] shrink-0">
      {/* Sequences Header */}
      <div className="flex items-center justify-between h-9 px-3 bg-[#111111]">
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">SEQUENCES</span>
        <button className="rounded px-2 py-1 bg-[var(--color-bg-settings)]">
          <span className="text-[10px] text-[var(--color-text-secondary)]">+ Add</span>
        </button>
      </div>
      {/* Sequence List */}
      <div className="flex flex-col gap-px h-[320px]">
        {sequences.map((seq) => (
          <div
            key={seq.name}
            className={`flex items-center gap-2 h-10 w-[268px] px-3 ${
              seq.active ? "bg-[#2D5BE320]" : "bg-transparent"
            }`}
          >
            {seq.active && (
              <div className="w-[3px] h-6 rounded-sm bg-[var(--color-accent)]" />
            )}
            <div className={`w-7 h-5 rounded-[3px] ${seq.active ? "bg-[#3D3D3D]" : "bg-[#2A2A2A]"}`} />
            <div className="flex flex-col gap-0.5">
              <span className={`text-xs ${seq.active ? "font-medium text-[#E0E0E0]" : "text-[var(--color-text-secondary)]"}`}>
                {seq.name}
              </span>
              <span className={`text-[10px] ${seq.active ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-dim)]"}`}>
                {seq.meta}
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* Panel Divider */}
      <div className="w-[268px] h-px bg-[#2A2A2A]" />
      {/* Layers Header */}
      <div className="flex items-center justify-between h-9 px-3 bg-[#111111]">
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">LAYERS</span>
        <button className="rounded px-2 py-1 bg-[var(--color-bg-settings)]">
          <span className="text-[10px] text-[var(--color-text-secondary)]">+ Add FX</span>
        </button>
      </div>
      {/* Layers List */}
      <div className="flex flex-col gap-0.5 p-2">
        {layers.map((layer) => (
          <div
            key={layer.name}
            className="flex items-center gap-2 rounded-md px-2.5 h-11 w-[252px]"
            style={{ backgroundColor: layer.bg }}
          >
            <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: layer.eyeColor }} />
            <div className="w-8 h-6 rounded-[3px] shrink-0" style={{ backgroundColor: layer.thumbColor }} />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-[11px] truncate" style={{ color: layer.nameColor, fontWeight: layer.fontWeight }}>
                {layer.name}
              </span>
              <span className="text-[9px] text-[var(--color-text-dim)] truncate">{layer.type}</span>
            </div>
            <div className="w-1.5 h-5 rounded-sm bg-[#333333] shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CanvasArea() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-[490px] bg-[var(--color-bg-card)]">
      {/* Preview Frame */}
      <div className="flex items-center justify-center w-[830px] h-[448px] rounded bg-black overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1717393766181-a660a7c91c2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzI0NTAxNjd8&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Canvas preview"
          className="w-full h-full object-cover rounded"
        />
      </div>
      {/* Canvas Controls */}
      <div className="flex items-center justify-center gap-5 w-[830px] h-[42px] px-5">
        <button className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-accent)]">
          <span className="text-sm text-white">▶</span>
        </button>
        <div className="rounded bg-[var(--color-bg-input)] px-3 py-1.5">
          <span className="text-[13px] font-semibold text-[#E0E0E0]">00:00:01.08</span>
        </div>
        <span className="text-xs text-[var(--color-text-dim)]">/ 00:00:08.00</span>
        <button className="rounded bg-[var(--color-bg-settings)] px-2.5 py-1.5">
          <span className="text-[11px] text-[var(--color-text-secondary)]">Fit</span>
        </button>
      </div>
    </div>
  );
}

function TimelinePanel() {
  return (
    <div className="flex flex-col w-full h-[280px] bg-[#111111]">
      {/* Timeline Controls */}
      <div className="flex items-center gap-2 h-9 px-3 bg-[#0F0F0F] shrink-0">
        <button className="rounded bg-[var(--color-bg-input)] px-2 py-[5px]">
          <span className="text-[11px] text-[var(--color-text-secondary)]">|◀</span>
        </button>
        <button className="rounded bg-[var(--color-accent)] px-2 py-[5px]">
          <span className="text-[11px] text-white">▶</span>
        </button>
        <button className="rounded bg-[var(--color-bg-input)] px-2 py-[5px]">
          <span className="text-[11px] text-[var(--color-text-secondary)]">▶|</span>
        </button>
        <div className="w-px h-5 bg-[#333333]" />
        <span className="text-[11px] text-[var(--color-text-secondary)]">1.08s / 8.00s</span>
        <div className="flex-1" />
        <span className="text-[10px] text-[var(--color-text-dim)]">Timeline Zoom:</span>
        <div className="flex items-center w-[100px] h-3">
          <div className="w-[88px] h-[3px] rounded-sm bg-[#333333]" />
          <div className="w-3 h-3 rounded-full bg-[var(--color-text-muted)]" />
        </div>
        <button className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span className="text-[10px] text-[var(--color-text-secondary)]">Fit All</span>
        </button>
      </div>

      {/* Time Ruler */}
      <div className="flex items-center h-6 px-3 bg-[#0D0D0D] shrink-0">
        <div className="w-0.5 h-4 bg-[#E55A2B]" />
      </div>

      {/* Tracks Area */}
      <div className="flex flex-col gap-1 p-1 bg-[#111111] flex-1">
        {/* FX Track */}
        <div className="flex items-center h-[52px]">
          <div className="flex flex-col items-start justify-center gap-0.5 w-20 h-[52px] px-2 bg-[#0D0D0D]">
            <span className="text-[10px] font-medium text-[#8888BB]">FX Layer</span>
            <span className="text-[10px] text-[var(--color-text-dim)]">👁 🔒</span>
          </div>
          <div className="flex items-center gap-[3px] flex-1 h-11 px-1 bg-[var(--color-bg-card-alt)]">
            <div className="flex items-center justify-center rounded h-10 px-2 bg-[#4A2D8A]" style={{ width: 820 }}>
              <span className="text-[10px] text-[#CCAAFF] truncate">
                Light Leaks  ·  Screen  ·  80% opacity
              </span>
            </div>
          </div>
        </div>

        {/* Photos Track */}
        <div className="flex items-center h-[52px]">
          <div className="flex flex-col items-start justify-center gap-0.5 w-20 h-[52px] px-2 bg-[#0D0D0D]">
            <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">Photos</span>
            <span className="text-[10px] text-[var(--color-text-dim)]">👁 🔒</span>
          </div>
          <div className="flex items-center gap-[3px] flex-1 h-11 px-1 bg-[var(--color-bg-card-alt)]">
            {timelineClips.map((clip) => (
              <div
                key={clip.label}
                className="flex flex-col justify-center rounded h-10 px-2"
                style={{ width: clip.width, backgroundColor: clip.bg }}
              >
                <span className="text-[10px] text-[#AACCFF] truncate">{clip.label}</span>
                <span className="text-[9px] text-[#7799CC]">{clip.sub}</span>
              </div>
            ))}
            <button className="flex items-center justify-center w-8 h-10 rounded bg-[var(--color-bg-input)]">
              <span className="text-base text-[var(--color-text-dim)]">+</span>
            </button>
          </div>
        </div>

        {/* Audio Track */}
        <div className="flex items-center h-16">
          <div className="flex flex-col items-start justify-center gap-0.5 w-20 h-16 px-2 bg-[#0D0D0D]">
            <span className="text-[10px] font-medium text-[#55BB88]">Audio</span>
            <span className="text-[9px] text-[var(--color-text-dim)]">Vol 85%</span>
          </div>
          <div className="flex items-center flex-1 h-14 px-1 bg-[var(--color-bg-card-alt)]">
            <div className="flex flex-col justify-center gap-1 rounded h-12 px-2 bg-[#1A3D2A] flex-1">
              <span className="text-[10px] font-medium text-[#55DD88]">background.mp3</span>
              <div className="w-full h-4 rounded-sm bg-[#2A7A4A]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertiesPanel() {
  return (
    <div className="flex items-center gap-5 h-14 w-full bg-[#0F0F0F] px-4 shrink-0">
      <span className="text-[9px] font-semibold text-[var(--color-text-dimmer)]">TRANSFORM</span>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-[var(--color-text-muted)]">X</span>
        <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span className="text-[11px] text-[#CCCCCC]">0.00</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-[var(--color-text-muted)]">Y</span>
        <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span className="text-[11px] text-[#CCCCCC]">0.00</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-[var(--color-text-muted)]">Scale</span>
        <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span className="text-[11px] text-[#CCCCCC]">1.00</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-[var(--color-text-muted)]">Rotation</span>
        <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span className="text-[11px] text-[#CCCCCC]">0°</span>
        </div>
      </div>
      <div className="w-px h-8 bg-[#2A2A2A]" />
      <span className="text-[9px] font-semibold text-[var(--color-text-dimmer)]">BLEND</span>
      <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
        <span className="text-[11px] text-[#CCCCCC]">Screen  ▾</span>
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)]">Opacity</span>
      <div className="flex items-center w-[100px] h-3">
        <div className="w-20 h-1 rounded-sm bg-[var(--color-accent)]" />
        <div className="w-5 h-1 rounded-sm bg-[#333333]" />
      </div>
      <span className="text-[11px] text-[#CCCCCC]">80%</span>
      <div className="w-px h-8 bg-[#2A2A2A]" />
      <span className="text-[9px] font-semibold text-[var(--color-text-dimmer)]">MIN KEYS</span>
      <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
        <span className="text-[11px] text-[#CCCCCC]">2</span>
      </div>
      <span className="text-[9px] font-semibold text-[var(--color-text-dimmer)]">MAX KEYS</span>
      <div className="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
        <span className="text-[11px] text-[#CCCCCC]">8</span>
      </div>
      <span className="text-[10px] text-[var(--color-text-dim)]">Cinematic Rate: 15fps</span>
    </div>
  );
}

export default function MainScreen() {
  return (
    <div className="flex flex-col w-full h-full bg-[#151515] font-primary">
      <TitleBar />
      <Toolbar />
      {/* Body Area */}
      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        {/* Right Area */}
        <div className="flex flex-col flex-1 min-w-0">
          <CanvasArea />
          <div className="w-full h-px bg-[var(--color-separator)]" />
          <TimelinePanel />
        </div>
      </div>
      {/* Props Divider */}
      <div className="w-full h-px bg-[var(--color-bg-card)]" />
      <PropertiesPanel />
    </div>
  );
}
