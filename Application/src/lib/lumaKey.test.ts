import {describe, it, expect, vi, beforeEach} from 'vitest';

// Define mock functions before vi.mock so they're available when the module is imported
const mockGetImageData = vi.fn();
const mockPutImageData = vi.fn();

// Create a mock context
const mockContext = {
  getImageData: mockGetImageData,
  putImageData: mockPutImageData,
  fillStyle: '',
  fillRect: vi.fn(),
};

// Create mock canvas factory
function createMockCanvas(width: number, height: number, ctx: any) {
  return {
    width,
    height,
    getContext: () => ctx,
  };
}

// Mock the DOM
global.document = {
  createElement: (tagName: string) => {
    if (tagName === 'canvas') {
      return createMockCanvas(10, 10, mockContext);
    }
    return {};
  },
} as any;

// Import after setting up mocks
import {applyLumaKey} from './lumaKey';

describe('lumaKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockContext with fresh functions
    mockGetImageData.mockReset();
    mockPutImageData.mockReset();
  });

  describe('Luma Key (invert=false)', () => {
    it('white pixels (255,255,255) → transparent (alpha=0)', () => {
      // Simulate white canvas: all pixels are (255,255,255,255)
      const data = new Uint8ClampedArray([
        // pixel 1: white
        255, 255, 255, 255,
        // pixel 2: white
        255, 255, 255, 255,
      ]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(2, 1, mockContext);
      (canvas as any).width = 2;
      (canvas as any).height = 1;

      applyLumaKey(canvas as any, false);

      // White (luma=255) → alpha = 255 - 255 = 0
      expect(data[3]).toBe(0); // pixel 1 alpha
      expect(data[7]).toBe(0); // pixel 2 alpha
    });

    it('black pixels (0,0,0) → opaque (alpha=255)', () => {
      // Simulate black canvas: all pixels are (0,0,0,255)
      const data = new Uint8ClampedArray([
        0, 0, 0, 255,
        0, 0, 0, 255,
      ]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(2, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // Black (luma=0) → alpha = 255 - 0 = 255
      expect(data[3]).toBe(255);
      expect(data[7]).toBe(255);
    });

    it('grayscale gradient → correct alpha mapping', () => {
      // Simulate grayscale gradient: 0, 128, 255
      const data = new Uint8ClampedArray([
        0, 0, 0, 255,           // black: luma=0 → alpha=255
        128, 128, 128, 255,     // gray: luma≈128 → alpha≈127
        255, 255, 255, 255,     // white: luma=255 → alpha=0
      ]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(3, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // Black: luma=0 → alpha=255
      expect(data[3]).toBe(255);
      // Gray: luma=128 → alpha=127 (128*0.2126 + 128*0.7152 + 128*0.0722 = 128)
      expect(data[7]).toBe(127);
      // White: luma=255 → alpha=0
      expect(data[11]).toBe(0);
    });

    it('red channel uses correct BT.709 weight (0.2126)', () => {
      // Pure red: RGB(255, 0, 0)
      // Luma = 0.2126 * 255 + 0 + 0 = 54.213
      // Alpha = 255 - 54.213 = 200.787
      const data = new Uint8ClampedArray([255, 0, 0, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      const expectedLuma = Math.round(0.2126 * 255);
      const expectedAlpha = 255 - expectedLuma;
      expect(data[3]).toBe(expectedAlpha); // ~201
    });

    it('green channel uses correct BT.709 weight (0.7152)', () => {
      // Pure green: RGB(0, 255, 0)
      // Luma = 0.7152 * 255 = 182.376
      // Alpha = 255 - 182.376 = 72.624
      const data = new Uint8ClampedArray([0, 255, 0, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      const expectedLuma = Math.round(0.7152 * 255);
      const expectedAlpha = 255 - expectedLuma;
      expect(data[3]).toBe(expectedAlpha); // ~73
    });

    it('blue pixels (0,0,255) → opaque (alpha=255) - threshold approach', () => {
      // Pure blue: RGB(0, 0, 255)
      // Luma = 0.0722 * 255 ≈ 18
      // Threshold approach: luma < 254 → alpha=255 (opaque)
      // Blue stays fully opaque (NOT semi-transparent like the old buggy formula)
      const data = new Uint8ClampedArray([0, 0, 255, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // Blue should be fully opaque with threshold approach
      expect(data[3]).toBe(255);
    });

    it('gray pixels (128,128,128) → opaque (alpha=255) - threshold approach', () => {
      // Gray: RGB(128, 128, 128)
      // Luma = 128 (exact, all weights equal)
      // Threshold approach: luma < 254 → alpha=255 (opaque)
      // Gray stays fully opaque (NOT semi-transparent like the old buggy formula)
      const data = new Uint8ClampedArray([128, 128, 128, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // Gray should be fully opaque with threshold approach
      expect(data[3]).toBe(255);
    });

    it('near-white pixels (253,253,253) → opaque (alpha=255) - below threshold', () => {
      // Near-white: RGB(253, 253, 253)
      // Luma ≈ 253
      // Threshold: luma >= 254 → transparent, else opaque
      // Since 253 < 254, near-white should still be opaque
      const data = new Uint8ClampedArray([253, 253, 253, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // Near-white (253) is below threshold, so opaque
      expect(data[3]).toBe(255);
    });

    it('threshold boundary: luma=254 → transparent (alpha=0)', () => {
      // Threshold is luma >= 254 for transparency
      // Pure white (255,255,255) has luma=255, should be transparent
      const data = new Uint8ClampedArray([255, 255, 255, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // Pure white (luma=255) >= 254 → transparent
      expect(data[3]).toBe(0);
    });

    it('threshold boundary: luma=253 → opaque (alpha=255)', () => {
      // At luma=253 (e.g., very light gray 253,253,253), should be opaque
      // because threshold is luma >= 254
      const data = new Uint8ClampedArray([253, 253, 253, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      // luma=253 < 254 → opaque
      expect(data[3]).toBe(255);
    });
  });

  describe('Luma Invert (invert=true)', () => {
    it('white canvas → fully opaque (alpha=255) - threshold approach', () => {
      // Luma Invert (invert=true): luma < 10 → transparent, else opaque
      // White (luma=255) >= 10 → opaque (alpha=255)
      const data = new Uint8ClampedArray([255, 255, 255, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, true);

      // White (luma=255) >= 10 → opaque
      expect(data[3]).toBe(255);
    });

    it('near-black canvas → fully transparent (alpha=0) - threshold approach', () => {
      // Near-black (luma < 10) → transparent
      // Pure black (0,0,0): luma=0 < 10 → transparent
      const data = new Uint8ClampedArray([0, 0, 0, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, true);

      // Black (luma=0) < 10 → transparent
      expect(data[3]).toBe(0);
    });

    it('dark gray (10,10,10) → opaque (alpha=255) - at threshold boundary', () => {
      // Dark gray (10,10,10): luma ≈ 10 >= 10 → opaque
      const data = new Uint8ClampedArray([10, 10, 10, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, true);

      // luma=10 >= 10 → opaque
      expect(data[3]).toBe(255);
    });

    it('near-black (9,9,9) → transparent (alpha=0) - below threshold', () => {
      // Near-black (9,9,9): luma ≈ 9 < 10 → transparent
      const data = new Uint8ClampedArray([9, 9, 9, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, true);

      // luma=9 < 10 → transparent
      expect(data[3]).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('canvas.width=0 → guard clause prevents crash', () => {
      const canvas = createMockCanvas(0, 10, mockContext);

      // Should not throw
      expect(() => applyLumaKey(canvas as any, false)).not.toThrow();
    });

    it('canvas.height=0 → guard clause prevents crash', () => {
      const canvas = createMockCanvas(10, 0, mockContext);

      // Should not throw
      expect(() => applyLumaKey(canvas as any, false)).not.toThrow();
    });

    it('null context → guard clause prevents crash', () => {
      const canvas = {
        width: 10,
        height: 10,
        getContext: () => null,
      };

      // Should not throw
      expect(() => applyLumaKey(canvas as any, false)).not.toThrow();
    });
  });

  describe('ITU-R BT.709 coefficients', () => {
    it('uses correct weights for red channel (0.2126)', () => {
      // Red: luma = 0.2126 * 255 ≈ 54
      // alpha = 255 - 54 = 201
      const data = new Uint8ClampedArray([255, 0, 0, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      expect(data[3]).toBeGreaterThan(200);
      expect(data[3]).toBeLessThan(202);
    });

    it('uses correct weights for green channel (0.7152)', () => {
      // Green: luma = 0.7152 * 255 ≈ 182
      // alpha = 255 - 182 = 73
      const data = new Uint8ClampedArray([0, 255, 0, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      expect(data[3]).toBeGreaterThan(72);
      expect(data[3]).toBeLessThan(74);
    });

    it('uses correct weights for blue channel (0.0722)', () => {
      // Blue: luma = 0.0722 * 255 ≈ 18
      // alpha = 255 - 18 = 237
      const data = new Uint8ClampedArray([0, 0, 255, 255]);
      mockGetImageData.mockReturnValue({data});

      const canvas = createMockCanvas(1, 1, mockContext);

      applyLumaKey(canvas as any, false);

      expect(data[3]).toBeGreaterThan(236);
      expect(data[3]).toBeLessThan(238);
    });
  });
});
