import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import WelcomeScreen from "./WelcomeScreen";
import MainScreen from "./MainScreen";
import TemplateLibraryScreen from "./TemplateLibraryScreen";
import ExportDialogScreen from "./ExportDialogScreen";
import "./globals.css";

const screens = {
  welcome: WelcomeScreen,
  main: MainScreen,
  templates: TemplateLibraryScreen,
  export: ExportDialogScreen,
} as const;

type ScreenKey = keyof typeof screens;

function App() {
  const [active, setActive] = useState<ScreenKey>("welcome");
  const ActiveScreen = screens[active];

  return (
    <div className="flex flex-col h-full w-full font-primary">
      {/* Screen Switcher */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] shrink-0 border-b border-[#222]">
        {(Object.keys(screens) as ScreenKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`rounded px-3 py-1 text-xs capitalize ${
              active === key
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[#1E1E1E] text-[#888]"
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      {/* Active Screen */}
      <div className="flex-1 min-h-0">
        <ActiveScreen />
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
