// RED skeleton (64-26 Task 1): the API shape the CPU proof is written
// against. The carry law and its induction land with the GREEN commit.

export interface TouchRect { x0: number; y0: number; x1: number; y1: number }

export interface LastTouchCarry { rect: TouchRect | null }

export function newLastTouchCarry(): LastTouchCarry {
  return { rect: null }
}

export function takeCarry(state: LastTouchCarry): TouchRect | null {
  void state
  return null
}

export function recordStamp(state: LastTouchCarry, rect: TouchRect): void {
  void state
  void rect
}

export function invalidateCarry(state: LastTouchCarry): void {
  void state
}
