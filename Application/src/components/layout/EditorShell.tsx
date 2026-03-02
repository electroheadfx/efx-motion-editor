import {TitleBar} from './TitleBar';
import {Toolbar} from './Toolbar';
import {LeftPanel} from './LeftPanel';
import {CanvasArea} from './CanvasArea';
import {TimelinePanel} from './TimelinePanel';
import {PropertiesPanel} from './PropertiesPanel';

export function EditorShell() {
  return (
    <div class="flex flex-col w-full h-full bg-[#151515] font-primary">
      <TitleBar />
      <Toolbar />
      {/* Body Area */}
      <div class="flex flex-1 min-h-0">
        <LeftPanel />
        {/* Right Area: Canvas + Timeline */}
        <div class="flex flex-col flex-1 min-w-0">
          <CanvasArea />
          <div class="w-full h-px bg-[var(--color-separator)]" />
          <TimelinePanel />
        </div>
      </div>
      {/* Properties Divider */}
      <div class="w-full h-px bg-[var(--color-bg-card)]" />
      <PropertiesPanel />
    </div>
  );
}
