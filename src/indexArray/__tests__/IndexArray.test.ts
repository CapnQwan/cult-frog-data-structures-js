import { describe, expect, expectTypeOf, it } from 'vitest';

import { IndexedArray } from '../IndexArray.js';

import type { Brand } from '@cult-frog/types';

type TSlot = Brand<number, 'Slot'>;
type THandle = Brand<number, 'Handle'>;

const slot = (index: number): TSlot => index as TSlot;

describe('IndexedArray', () => {
  describe('get', () => {
    it('returns undefined for an index that was never set', () => {
      const array = new IndexedArray<TSlot, string>();

      expect(array.get(slot(0))).toBeUndefined();
      expect(array.get(slot(10))).toBeUndefined();
    });

    it('returns undefined for unset indices below one that was set', () => {
      const array = new IndexedArray<TSlot, string>();
      array.set(slot(5), 'five');

      expect(array.get(slot(0))).toBeUndefined();
      expect(array.get(slot(4))).toBeUndefined();
    });
  });

  describe('set', () => {
    it('stores a value that get returns', () => {
      const array = new IndexedArray<TSlot, string>();
      array.set(slot(2), 'two');

      expect(array.get(slot(2))).toBe('two');
    });

    it('overwrites an existing value', () => {
      const array = new IndexedArray<TSlot, string>();
      array.set(slot(1), 'first');
      array.set(slot(1), 'second');

      expect(array.get(slot(1))).toBe('second');
    });

    it('keeps values at different indices separate', () => {
      const array = new IndexedArray<TSlot, number>();
      array.set(slot(0), 10);
      array.set(slot(1), 11);
      array.set(slot(100), 110);

      expect(array.get(slot(0))).toBe(10);
      expect(array.get(slot(1))).toBe(11);
      expect(array.get(slot(100))).toBe(110);
    });

    it.each([0, '', false, null])('stores falsy value %s as-is', (value) => {
      const array = new IndexedArray<TSlot, typeof value>();
      array.set(slot(0), value);

      expect(array.get(slot(0))).toBe(value);
    });

    it('stores object values by reference', () => {
      const array = new IndexedArray<TSlot, { id: number }>();
      const value = { id: 1 };
      array.set(slot(0), value);

      expect(array.get(slot(0))).toBe(value);
    });

    it('unsets an index when given undefined', () => {
      const array = new IndexedArray<TSlot, string>();
      array.set(slot(3), 'three');
      array.set(slot(3), undefined);

      expect(array.get(slot(3))).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('unsets every index', () => {
      const array = new IndexedArray<TSlot, string>();
      array.set(slot(0), 'zero');
      array.set(slot(7), 'seven');

      array.clear();

      expect(array.get(slot(0))).toBeUndefined();
      expect(array.get(slot(7))).toBeUndefined();
    });

    it('leaves the array usable afterwards', () => {
      const array = new IndexedArray<TSlot, string>();
      array.set(slot(0), 'before');
      array.clear();
      array.set(slot(0), 'after');

      expect(array.get(slot(0))).toBe('after');
    });

    it('is safe to call on an empty array', () => {
      const array = new IndexedArray<TSlot, string>();

      expect(() => array.clear()).not.toThrow();
    });
  });

  it('keeps separate instances independent', () => {
    const a = new IndexedArray<TSlot, string>();
    const b = new IndexedArray<TSlot, string>();
    a.set(slot(0), 'a');

    expect(b.get(slot(0))).toBeUndefined();
  });

  describe('types', () => {
    it('returns the value type or undefined', () => {
      const array = new IndexedArray<TSlot, string>();

      expectTypeOf(array.get(slot(0))).toEqualTypeOf<string | undefined>();
    });

    it('rejects indices of a different branded type', () => {
      const array = new IndexedArray<TSlot, string>();
      const handle = 0 as THandle;

      // @ts-expect-error A handle is not a slot.
      array.get(handle);
      // @ts-expect-error A plain number is not a slot.
      array.set(0, 'zero');
    });

    it('rejects values of the wrong type', () => {
      const array = new IndexedArray<TSlot, string>();

      // @ts-expect-error The array holds strings.
      array.set(slot(0), 1);
    });
  });
});
