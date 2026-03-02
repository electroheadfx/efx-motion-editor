import React from "react";

interface RecentProject {
  name: string;
  meta: string;
  thumbColor: string;
  highlighted?: boolean;
}

const recentProjects: RecentProject[] = [
  {
    name: "My Short Film",
    meta: "3 sequences · 8.0s · 2 hours ago",
    thumbColor: "var(--color-thumb-blue)",
    highlighted: true,
  },
  {
    name: "Animation Test",
    meta: "2 sequences · 4.5s · Yesterday",
    thumbColor: "var(--color-thumb-purple)",
  },
  {
    name: "Test Scene",
    meta: "1 sequence · 2.0s · 3 days ago",
    thumbColor: "var(--color-thumb-green)",
  },
];

const featurePills = [
  { label: "Multi-layer FX", color: "var(--color-accent)" },
  { label: "Audio Sync", color: "var(--color-dot-purple)" },
  { label: "Beat Markers", color: "var(--color-dot-green)" },
  { label: "DaVinci / Premiere Export", color: "var(--color-dot-orange)" },
];

function RecentProjectItem({ project }: { project: RecentProject }) {
  const isHighlighted = project.highlighted;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 h-[60px] w-[340px] ${
        isHighlighted
          ? "bg-[var(--color-bg-card)]"
          : "bg-[var(--color-bg-card-alt)]"
      }`}
    >
      <div
        className="w-10 h-10 rounded-md shrink-0"
        style={{ backgroundColor: project.thumbColor }}
      />
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span
          className={`text-[13px] truncate ${
            isHighlighted
              ? "font-medium text-[#E0E0E0]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          {project.name}
        </span>
        <span
          className={`text-[11px] truncate ${
            isHighlighted
              ? "text-[var(--color-text-dim)]"
              : "text-[var(--color-text-dimmer)]"
          }`}
        >
          {project.meta}
        </span>
      </div>
    </div>
  );
}

function FeaturePill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-card)] px-4 py-2.5">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-[var(--color-text-secondary)]">
        {label}
      </span>
    </div>
  );
}

export default function WelcomeScreen() {
  return (
    <div className="flex w-full h-full bg-[var(--color-bg-root)] font-primary">
      {/* Left Sidebar */}
      <div className="flex flex-col gap-8 w-[420px] h-full bg-[var(--color-bg-sidebar)] px-10 pt-12 pb-12 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent)]" />
          <span className="text-xl font-bold text-[var(--color-text-primary)]">
            EFX-Motion
          </span>
        </div>

        {/* Tagline */}
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line">
          {"Stop-motion & capture editor\nfor cinematic sequences"}
        </p>

        {/* Separator */}
        <div className="w-[340px] h-px bg-[var(--color-separator)]" />

        {/* New Project Button */}
        <button className="flex items-center justify-center gap-2.5 w-[340px] h-[52px] rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors px-5">
          <div className="w-5 h-5 rounded bg-[var(--color-icon-placeholder)]" />
          <span className="text-[15px] font-semibold text-[var(--color-text-white)]">
            New Project
          </span>
        </button>

        {/* Open Project Button */}
        <button className="flex items-center gap-2.5 w-[340px] h-[44px] rounded-lg bg-[var(--color-bg-input)] px-5">
          <div className="w-[18px] h-[18px] rounded-[3px] bg-[var(--color-open-icon)]" />
          <span className="text-sm text-[var(--color-text-link)]">
            Open Project…
          </span>
        </button>

        {/* Separator */}
        <div className="w-[340px] h-px bg-[var(--color-separator)]" />

        {/* Recent Projects Label */}
        <span className="text-[10px] font-semibold text-[var(--color-text-dimmer)] tracking-wide">
          RECENT PROJECTS
        </span>

        {/* Recent Projects List */}
        <div className="flex flex-col gap-1 w-[340px]">
          {recentProjects.map((project) => (
            <RecentProjectItem key={project.name} project={project} />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Global Info */}
        <div className="flex flex-col gap-1.5 w-[340px] rounded-lg bg-[var(--color-bg-card)] p-3 px-4">
          <span className="text-[10px] font-semibold text-[var(--color-text-dim)]">
            Global Project
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            ~/.config/efx-mocap/global-project
          </span>
          <button className="flex items-center gap-1.5 rounded bg-[var(--color-bg-settings)] px-3 py-1.5 w-fit mt-1">
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              Settings
            </span>
          </button>
        </div>
      </div>

      {/* Right Side - Hero Area */}
      <div className="flex flex-col items-center justify-center gap-12 flex-1 h-full bg-[var(--color-bg-right)] p-20">
        {/* Hero Image */}
        <div className="relative flex items-center justify-center w-[860px] h-[480px] rounded-xl overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1699975303985-75b5a0a4b52d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzI0NTAzMjB8&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Hero preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Badge */}
          <div className="relative flex items-center gap-2 rounded-full bg-[var(--color-badge-bg)] px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-dot-blue)]" />
            <span className="text-xs text-[var(--color-badge-text)]">
              Stop-Motion · 15fps · PNG Sequence Export
            </span>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex items-center gap-4">
          {featurePills.map((pill) => (
            <FeaturePill
              key={pill.label}
              label={pill.label}
              color={pill.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
