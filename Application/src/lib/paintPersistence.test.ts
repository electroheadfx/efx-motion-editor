import {describe, it, expect} from 'vitest';

describe('paintPersistence brush FX round-trip', () => {
  it.todo('PaintStroke with brushStyle serializes to JSON correctly');
  it.todo('PaintStroke with brushParams serializes all FX param values');
  it.todo('PaintStroke without brushStyle deserializes with undefined (backward compat)');
  it.todo('Old sidecar JSON without brushStyle/brushParams loads without error');
  it.todo('Round-trip: serialize then deserialize preserves brushStyle and brushParams');
});
