// Script envelope + payload contract (HOST-02 / D-19)
export type {
  BrushPackSnapshot,
  EngineAdapter,
  EngineId,
  StudioPoint,
  StudioScriptEnvelope,
  StudioScriptSource,
  StudioScriptThumbnail,
  StudioStroke,
  StudioStrokeMotion,
} from './payload'
export { parseStudioScriptEnvelope } from './parse'
export type { HostScriptRefusal, HostScriptRefusalCode } from './refusal'
export { classifyEnvelopeParseFailure, makeRefusal } from './refusal'
