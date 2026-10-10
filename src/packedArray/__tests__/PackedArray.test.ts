import { describe, expect, expectTypeOf, it } from 'vitest';

import { PackedBuffer } from '../PackedArray.js';

import type { Brand } from '@cult-frog/types';

type TVec2 = Brand<Float32Array<ArrayBuffer>, 'Vec2'>;

const createBuffer = (capacity = 4, stride = 2) => new PackedBuffer(capacity, stride, Float32Array);

describe('PackedBuffer', () => {
  describe('constructor', () => {
    it('sets the capacity and stride', () => {
      const buffer = createBuffer(4, 3);

      expect(buffer.capacity).toBe(4);
      expect(buffer.stride).toBe(3);
    });

    it('starts every row as zeros', () => {
      const buffer = createBuffer(3, 2);

      for (let row = 0; row < buffer.capacity; row++) {
        expect(Array.from(buffer.get(row))).toEqual([0, 0]);
      }
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'throws for initial capacity %s',
      (capacity) => {
        expect(() => new PackedBuffer(capacity, 2, Float32Array)).toThrow(
          'Initial capacity must be a positive integer'
        );
      }
    );

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'throws for stride %s',
      (stride) => {
        expect(() => new PackedBuffer(4, stride, Float32Array)).toThrow(
          'Stride must be a positive integer'
        );
      }
    );
  });

  describe('get', () => {
    it('returns a view of the storage type that is stride values long', () => {
      const buffer = createBuffer(4, 3);
      const view = buffer.get(0);

      expect(view).toBeInstanceOf(Float32Array);
      expect(view).toHaveLength(3);
    });

    it('returns a view that sees writes made with set', () => {
      const buffer = createBuffer();
      const view = buffer.get(1);

      buffer.set(1, [5, 6]);

      expect(Array.from(view)).toEqual([5, 6]);
    });

    it('returns a view that writes through to the buffer', () => {
      const buffer = createBuffer();
      buffer.get(2)[0] = 9;

      expect(buffer.get(2)[0]).toBe(9);
    });

    it('returns the same view on repeated calls', () => {
      const buffer = createBuffer();

      expect(buffer.get(1)).toBe(buffer.get(1));
    });

    it('returns views of adjacent rows that do not overlap', () => {
      const buffer = createBuffer(4, 2);
      buffer.get(0).fill(1);
      buffer.get(1).fill(2);

      expect(Array.from(buffer.get(0))).toEqual([1, 1]);
      expect(Array.from(buffer.get(1))).toEqual([2, 2]);
    });

    it('can read the last row', () => {
      const buffer = createBuffer(4, 2);
      buffer.set(3, [7, 8]);

      expect(Array.from(buffer.get(3))).toEqual([7, 8]);
    });

    it.each([-1, 4, 100])('throws a RangeError for row %s', (row) => {
      const buffer = createBuffer(4, 2);

      expect(() => buffer.get(row)).toThrow(RangeError);
    });

    it('never grows the buffer', () => {
      const buffer = createBuffer(4, 2);

      expect(() => buffer.get(4)).toThrow(RangeError);
      expect(buffer.capacity).toBe(4);
    });

    it('stores values using the storage type', () => {
      const buffer = new PackedBuffer(2, 2, Int32Array);
      buffer.set(0, [1.9, -1.9]);

      expect(buffer.get(0)).toBeInstanceOf(Int32Array);
      expect(Array.from(buffer.get(0))).toEqual([1, -1]);
    });
  });

  describe('set', () => {
    it('copies values into the row', () => {
      const buffer = createBuffer();
      buffer.set(1, [3, 4]);

      expect(Array.from(buffer.get(1))).toEqual([3, 4]);
    });

    it('leaves other rows unchanged', () => {
      const buffer = createBuffer();
      buffer.set(1, [3, 4]);

      expect(Array.from(buffer.get(0))).toEqual([0, 0]);
      expect(Array.from(buffer.get(2))).toEqual([0, 0]);
    });

    it('accepts typed arrays as the source', () => {
      const buffer = createBuffer();
      buffer.set(0, new Float64Array([1.5, 2.5]));

      expect(Array.from(buffer.get(0))).toEqual([1.5, 2.5]);
    });

    it('copies the values rather than keeping the source', () => {
      const buffer = createBuffer();
      const source = [1, 2];
      buffer.set(0, source);
      source[0] = 99;

      expect(Array.from(buffer.get(0))).toEqual([1, 2]);
    });

    it('grows by doubling when the row is past capacity', () => {
      const buffer = createBuffer(2, 2);
      buffer.set(5, [1, 2]);

      expect(buffer.capacity).toBe(8);
      expect(Array.from(buffer.get(5))).toEqual([1, 2]);
    });

    it('grows when the row is exactly at capacity', () => {
      const buffer = createBuffer(2, 2);
      buffer.set(2, [1, 2]);

      expect(buffer.capacity).toBe(4);
    });

    it('keeps existing rows when it grows', () => {
      const buffer = createBuffer(2, 2);
      buffer.set(0, [1, 2]);
      buffer.set(1, [3, 4]);

      buffer.set(10, [5, 6]);

      expect(Array.from(buffer.get(0))).toEqual([1, 2]);
      expect(Array.from(buffer.get(1))).toEqual([3, 4]);
    });

    it('starts new rows as zeros after growing', () => {
      const buffer = createBuffer(2, 2);
      buffer.set(3, [1, 2]);

      expect(Array.from(buffer.get(2))).toEqual([0, 0]);
    });

    it('throws a RangeError for a negative row', () => {
      const buffer = createBuffer();

      expect(() => buffer.set(-1, [1, 2])).toThrow(RangeError);
    });

    it.each([[[1]], [[1, 2, 3]], [[]]])(
      'throws a RangeError when given %j instead of stride values',
      (value) => {
        const buffer = createBuffer(4, 2);

        expect(() => buffer.set(0, value)).toThrow(RangeError);
      }
    );

    it('changes nothing when the value has the wrong length', () => {
      const buffer = createBuffer(2, 2);
      buffer.set(0, [1, 2]);

      expect(() => buffer.set(0, [9])).toThrow(RangeError);
      expect(() => buffer.set(10, [9])).toThrow(RangeError);

      expect(Array.from(buffer.get(0))).toEqual([1, 2]);
      expect(buffer.capacity).toBe(2);
    });
  });

  describe('ensureCapacity', () => {
    it('does nothing when the capacity is already enough', () => {
      const buffer = createBuffer(4, 2);
      const view = buffer.get(0);

      buffer.ensureCapacity(4);
      buffer.ensureCapacity(1);

      expect(buffer.capacity).toBe(4);
      expect(buffer.get(0)).toBe(view);
    });

    it('doubles until the capacity is at least the minimum', () => {
      const buffer = createBuffer(3, 2);
      buffer.ensureCapacity(10);

      expect(buffer.capacity).toBe(12);
    });

    it('keeps existing rows', () => {
      const buffer = createBuffer(2, 2);
      buffer.set(1, [3, 4]);

      buffer.ensureCapacity(16);

      expect(Array.from(buffer.get(1))).toEqual([3, 4]);
    });

    it('makes the new rows readable', () => {
      const buffer = createBuffer(2, 2);
      buffer.ensureCapacity(5);

      expect(Array.from(buffer.get(buffer.capacity - 1))).toEqual([0, 0]);
    });

    it('drops cached views so get returns a new view', () => {
      const buffer = createBuffer(2, 2);
      const before = buffer.get(0);

      buffer.ensureCapacity(4);

      expect(buffer.get(0)).not.toBe(before);
    });

    it('disconnects views taken before it grew', () => {
      const buffer = createBuffer(2, 2);
      const stale = buffer.get(0);

      buffer.ensureCapacity(4);
      stale[0] = 42;
      buffer.set(0, [7, 8]);

      expect(buffer.get(0)[0]).toBe(7);
      expect(stale[0]).toBe(42);
    });
  });

  describe('move', () => {
    it('copies row from over row to', () => {
      const buffer = createBuffer();
      buffer.set(0, [1, 2]);
      buffer.set(3, [5, 6]);

      buffer.move(0, 3);

      expect(Array.from(buffer.get(3))).toEqual([1, 2]);
    });

    it('leaves row from unchanged', () => {
      const buffer = createBuffer();
      buffer.set(0, [1, 2]);

      buffer.move(0, 3);

      expect(Array.from(buffer.get(0))).toEqual([1, 2]);
    });

    it('takes the source row first', () => {
      const buffer = createBuffer();
      buffer.set(1, [1, 1]);
      buffer.set(2, [2, 2]);

      buffer.move(2, 1);

      expect(Array.from(buffer.get(1))).toEqual([2, 2]);
      expect(Array.from(buffer.get(2))).toEqual([2, 2]);
    });

    it('updates views of the destination row', () => {
      const buffer = createBuffer();
      const view = buffer.get(1);
      buffer.set(0, [1, 2]);

      buffer.move(0, 1);

      expect(Array.from(view)).toEqual([1, 2]);
    });

    it('leaves other rows unchanged', () => {
      const buffer = createBuffer();
      buffer.set(0, [1, 2]);
      buffer.set(1, [3, 4]);
      buffer.set(2, [5, 6]);

      buffer.move(0, 2);

      expect(Array.from(buffer.get(1))).toEqual([3, 4]);
    });

    it('does nothing when from and to are the same row', () => {
      const buffer = createBuffer();
      buffer.set(1, [1, 2]);

      buffer.move(1, 1);

      expect(Array.from(buffer.get(1))).toEqual([1, 2]);
    });

    it.each([
      [-1, 0],
      [0, -1],
      [4, 0],
      [0, 4],
    ])('throws a RangeError for move(%s, %s)', (from, to) => {
      const buffer = createBuffer(4, 2);

      expect(() => buffer.move(from, to)).toThrow(RangeError);
    });
  });

  describe('swap', () => {
    it('exchanges the values of two rows', () => {
      const buffer = createBuffer();
      buffer.set(0, [1, 2]);
      buffer.set(3, [3, 4]);

      buffer.swap(0, 3);

      expect(Array.from(buffer.get(0))).toEqual([3, 4]);
      expect(Array.from(buffer.get(3))).toEqual([1, 2]);
    });

    it('lets existing views of either row see the exchanged values', () => {
      const buffer = createBuffer();
      const first = buffer.get(0);
      const second = buffer.get(1);
      buffer.set(0, [1, 2]);
      buffer.set(1, [3, 4]);

      buffer.swap(0, 1);

      expect(Array.from(first)).toEqual([3, 4]);
      expect(Array.from(second)).toEqual([1, 2]);
    });

    it('leaves other rows unchanged', () => {
      const buffer = createBuffer();
      buffer.set(0, [1, 2]);
      buffer.set(1, [3, 4]);
      buffer.set(2, [5, 6]);

      buffer.swap(0, 2);

      expect(Array.from(buffer.get(1))).toEqual([3, 4]);
    });

    it('does nothing when both rows are the same', () => {
      const buffer = createBuffer();
      buffer.set(2, [1, 2]);

      buffer.swap(2, 2);

      expect(Array.from(buffer.get(2))).toEqual([1, 2]);
    });

    it('swaps every value in a row', () => {
      const buffer = createBuffer(2, 16);
      const a = Array.from({ length: 16 }, (_, i) => i);
      const b = Array.from({ length: 16 }, (_, i) => 100 + i);
      buffer.set(0, a);
      buffer.set(1, b);

      buffer.swap(0, 1);

      expect(Array.from(buffer.get(0))).toEqual(b);
      expect(Array.from(buffer.get(1))).toEqual(a);
    });

    it.each([
      [-1, 0],
      [0, -1],
      [4, 0],
      [0, 4],
    ])('throws a RangeError for swap(%s, %s)', (index1, index2) => {
      const buffer = createBuffer(4, 2);

      expect(() => buffer.swap(index1, index2)).toThrow(RangeError);
    });
  });

  describe('types', () => {
    it('infers the storage type from the constructor', () => {
      const buffer = new PackedBuffer(2, 2, Float32Array);

      expectTypeOf(buffer.get(0)).toEqualTypeOf<Float32Array<ArrayBuffer>>();
    });

    it('hands out rows as the view type', () => {
      const buffer = new PackedBuffer<Float32Array<ArrayBuffer>, TVec2>(2, 2, Float32Array);

      expectTypeOf(buffer.get(0)).toEqualTypeOf<TVec2>();
    });

    it('rejects a view type that is not the storage type', () => {
      // @ts-expect-error An Int32Array view cannot sit on Float32Array storage.
      new PackedBuffer<Float32Array<ArrayBuffer>, Int32Array<ArrayBuffer>>(2, 2, Float32Array);
    });
  });
});
