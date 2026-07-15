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
      prepareEmptyTarget: () => portsRef.current.prepareEmptyTarget(),
      onFirstAcceptedBrush: () => portsRef.current.onFirstAcceptedBrush?.(),
      setNavigationLocked: (locked) => portsRef.current.setNavigationLocked?.(locked),
    });
  }
  useEffect(() => () => controllerRef.current?.dispose(), []);
  return controllerRef.current;
}
