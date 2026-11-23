import { useEffect, useRef } from 'preact/hooks';
import {
  createRotoScriptClipboardController,
  type RotoScriptClipboardController,
  type RotoScriptClipboardControllerPorts,
} from '../roto/physicsPaintRotoScriptClipboard';

export function useRotoScriptClipboardController(ports: RotoScriptClipboardControllerPorts): RotoScriptClipboardController {
  const portsRef = useRef(ports);
  portsRef.current = ports;
  const controllerRef = useRef<RotoScriptClipboardController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRotoScriptClipboardController({
      getEngine: () => portsRef.current.getEngine(),
      getSource: () => portsRef.current.getSource(),
      getMotion: () => portsRef.current.getMotion(),
      getPublicationIdentity: () => portsRef.current.getPublicationIdentity?.() ?? null,
      prepareTarget: (source) => portsRef.current.prepareTarget(source),
      flushSourcePublication: (appFrame) => portsRef.current.flushSourcePublication?.(appFrame) ?? Promise.resolve(),
      captureAquarelleCanvas: () => portsRef.current.captureAquarelleCanvas?.() ?? null,
      applyAquarelleEvents: (input) => portsRef.current.applyAquarelleEvents?.(input) ?? Promise.resolve(false),
      // quick 261124-0l5: the paste port must be forwarded through the live
      // ref or the Studio's implementation is unreachable (Apply = raster-only).
      pasteAquarelleScript: (input) => portsRef.current.pasteAquarelleScript?.(input) ?? null,
      onFirstAcceptedBrush: () => portsRef.current.onFirstAcceptedBrush?.(),
      setNavigationLocked: (locked) => portsRef.current.setNavigationLocked?.(locked),
    });
  }
  useEffect(() => () => controllerRef.current?.dispose(), []);
  return controllerRef.current;
}
