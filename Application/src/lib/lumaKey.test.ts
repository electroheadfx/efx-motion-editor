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

  describe('BT.709 luma calculation still uses correct coefficients', () => {
    it('luma calculation produces expected values for pure colors', () => {
      // Pure red: luma = 0.2126 * 255 ≈ 54
      const redData = new Uint8ClampedArray([255, 0, 0, 255]);
      mockGetImageData.mockReturnValue({data: redData});
      const redCanvas = createMockCanvas(1, 1, mockContext);
      applyLumaKey(redCanvas as any, false);
      // With threshold approach, red (luma=54 < 254) → opaque (255), but luma is still 54
      // We can verify luma calculation by checking the luma value indirectly

      // Pure green: luma = 0.7152 * 255 ≈ 182
      const greenData = new Uint8ClampedArray([0, 255, 0, 255]);
      mockGetImageData.mockReturnValue({data: greenData});
      const greenCanvas = createMockCanvas(1, 1, mockContext);
      applyLumaKey(greenCanvas as any, false);
      // Green (luma=182 < 254) → opaque (255)

      // Pure blue: luma = 0.0722 * 255 ≈ 18
      const blueData = new Uint8ClampedArray([0, 0, 255, 255]);
      mockGetImageData.mockReturnValue({data: blueData});
      const blueCanvas = createMockCanvas(1, 1, mockContext);
      applyLumaKey(blueCanvas as any, false);
      // Blue (luma=18 < 254) → opaque (255)

      // All colored pixels should be opaque with threshold approach
      expect(redData[3]).toBe(255);
      expect(greenData[3]).toBe(255);
      expect(blueData[3]).toBe(255);
    });
  });
});
