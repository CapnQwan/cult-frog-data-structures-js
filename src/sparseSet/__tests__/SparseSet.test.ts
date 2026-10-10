import { describe, expect, expectTypeOf, it } from 'vitest';

import { SparseSet } from '../SparseSet.js';

import type { Brand } from '@cult-frog/types';

type TSlot = Brand<number, 'Slot'>;
type THandle = Brand<number, 'Handle'>;

const slot = (index: number): TSlot => index as TSlot;

/** Builds a set with `values[i]` stored at slot `i`. */
const createSet = <T>(values: T[]): SparseSet<TSlot, T> => {
  const set = new SparseSet<TSlot, T>();
  values.forEach((value, index) => {
    set.insert(slot(index), value);
  });
  return set;
};

/**
 * Checks the set's internal arrays agree with each other: every entry maps back to its own
 * value, and no index appears twice.
 */
const expectConsistent = <T>(set: SparseSet<TSlot, T>): void => {
  const entries = set.entries();
  const values = set.toArray();

  expect(entries).toHaveLength(set.size);
  expect(values).toHaveLength(set.size);
  expect(new Set(entries).size).toBe(set.size);

  entries.forEach((index, denseIndex) => {
    expect(set.has(index)).toBe(true);
    expect(set.get(index)).toBe(values[denseIndex]);
  });
};

/** A small seeded PRNG (mulberry32), so randomized tests are repeatable. */
const createRandom = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('SparseSet', () => {
  describe('when empty', () => {
    it('has a size of 0', () => {
      expect(new SparseSet<TSlot, string>().size).toBe(0);
    });

    it('has no entries or values', () => {
      const set = new SparseSet<TSlot, string>();

      expect(set.entries()).toEqual([]);
      expect(set.toArray()).toEqual([]);
    });

    it('returns undefined and false for any index', () => {
      const set = new SparseSet<TSlot, string>();

      expect(set.get(slot(0))).toBeUndefined();
      expect(set.has(slot(0))).toBe(false);
    });

    it('returns undefined from extract', () => {
      const set = new SparseSet<TSlot, string>();

      expect(set.extract(slot(0))).toBeUndefined();
      expect(set.size).toBe(0);
    });
  });

  describe('insert', () => {
    it('stores the value and returns true', () => {
      const set = new SparseSet<TSlot, string>();

      expect(set.insert(slot(3), 'three')).toBe(true);
      expect(set.get(slot(3))).toBe('three');
      expect(set.has(slot(3))).toBe(true);
      expect(set.size).toBe(1);
    });

    it('returns false and keeps the old value when the index is occupied', () => {
      const set = new SparseSet<TSlot, string>();
      set.insert(slot(3), 'first');

      expect(set.insert(slot(3), 'second')).toBe(false);
      expect(set.get(slot(3))).toBe('first');
      expect(set.size).toBe(1);
    });

    it('appends values in insertion order', () => {
      const set = new SparseSet<TSlot, string>();
      set.insert(slot(5), 'five');
      set.insert(slot(1), 'one');
      set.insert(slot(9), 'nine');

      expect(set.entries()).toEqual([5, 1, 9]);
      expect(set.toArray()).toEqual(['five', 'one', 'nine']);
    });

    it('supports indices with large gaps between them', () => {
      const set = new SparseSet<TSlot, string>();
      set.insert(slot(0), 'zero');
      set.insert(slot(10_000), 'ten thousand');

      expect(set.get(slot(10_000))).toBe('ten thousand');
      expect(set.has(slot(5000))).toBe(false);
      expect(set.size).toBe(2);
    });
  });

  describe('set', () => {
    it('inserts a new value and returns true', () => {
      const set = new SparseSet<TSlot, string>();

      expect(set.set(slot(2), 'two')).toBe(true);
      expect(set.get(slot(2))).toBe('two');
      expect(set.size).toBe(1);
    });

    it('overwrites an existing value and returns false', () => {
      const set = new SparseSet<TSlot, string>();
      set.set(slot(2), 'first');

      expect(set.set(slot(2), 'second')).toBe(false);
      expect(set.get(slot(2))).toBe('second');
      expect(set.size).toBe(1);
    });

    it('keeps the dense position when overwriting', () => {
      const set = createSet(['a', 'b', 'c']);

      set.set(slot(1), 'B');

      expect(set.entries()).toEqual([0, 1, 2]);
      expect(set.toArray()).toEqual(['a', 'B', 'c']);
    });
  });

  describe('replace', () => {
    it('returns the old value and stores the new one', () => {
      const set = new SparseSet<TSlot, string>();
      set.insert(slot(4), 'old');

      expect(set.replace(slot(4), 'new')).toBe('old');
      expect(set.get(slot(4))).toBe('new');
      expect(set.size).toBe(1);
    });

    it('inserts and returns undefined when the index is empty', () => {
      const set = new SparseSet<TSlot, string>();

      expect(set.replace(slot(4), 'new')).toBeUndefined();
      expect(set.get(slot(4))).toBe('new');
      expect(set.size).toBe(1);
    });
  });

  describe('has', () => {
    it('returns false for an index that was never inserted', () => {
      const set = createSet(['a']);

      expect(set.has(slot(1))).toBe(false);
    });

    it.each([0, '', false, null])('returns true for a stored falsy value %s', (value) => {
      const set = new SparseSet<TSlot, typeof value>();
      set.insert(slot(0), value);

      expect(set.has(slot(0))).toBe(true);
      expect(set.get(slot(0))).toBe(value);
    });

    it('tells a stored undefined apart from a missing index', () => {
      const set = new SparseSet<TSlot, string | undefined>();
      set.insert(slot(0), undefined);

      expect(set.get(slot(0))).toBeUndefined();
      expect(set.has(slot(0))).toBe(true);
      expect(set.has(slot(1))).toBe(false);
    });
  });

  describe('extract', () => {
    it('removes and returns the value', () => {
      const set = createSet(['a', 'b', 'c']);

      expect(set.extract(slot(1))).toBe('b');
      expect(set.has(slot(1))).toBe(false);
      expect(set.get(slot(1))).toBeUndefined();
      expect(set.size).toBe(2);
    });

    it('returns undefined and changes nothing for a missing index', () => {
      const set = createSet(['a', 'b']);

      expect(set.extract(slot(5))).toBeUndefined();
      expect(set.size).toBe(2);
      expect(set.toArray()).toEqual(['a', 'b']);
    });

    it('returns undefined when extracting the same index twice', () => {
      const set = createSet(['a', 'b']);
      set.extract(slot(0));

      expect(set.extract(slot(0))).toBeUndefined();
      expect(set.size).toBe(1);
    });

    it('moves the last element into the gap', () => {
      const set = createSet(['a', 'b', 'c', 'd']);

      set.extract(slot(1));

      expect(set.entries()).toEqual([0, 3, 2]);
      expect(set.toArray()).toEqual(['a', 'd', 'c']);
    });

    it('keeps the moved element reachable by its index', () => {
      const set = createSet(['a', 'b', 'c', 'd']);

      set.extract(slot(0));

      expect(set.get(slot(3))).toBe('d');
      expectConsistent(set);
    });

    it('removes the last element without moving anything', () => {
      const set = createSet(['a', 'b', 'c']);

      expect(set.extract(slot(2))).toBe('c');
      expect(set.entries()).toEqual([0, 1]);
      expect(set.toArray()).toEqual(['a', 'b']);
      expectConsistent(set);
    });

    it('removes the only element', () => {
      const set = createSet(['a']);

      expect(set.extract(slot(0))).toBe('a');
      expect(set.size).toBe(0);
      expect(set.has(slot(0))).toBe(false);
    });

    it('allows the index to be inserted again afterwards', () => {
      const set = createSet(['a', 'b']);
      set.extract(slot(0));

      expect(set.insert(slot(0), 'again')).toBe(true);
      expect(set.get(slot(0))).toBe('again');
      expect(set.get(slot(1))).toBe('b');
      expectConsistent(set);
    });

    it.each([
      ['front to back', [0, 1, 2, 3, 4]],
      ['back to front', [4, 3, 2, 1, 0]],
      ['interleaved', [2, 0, 4, 1, 3]],
    ])('empties the set when extracting every index %s', (_, order) => {
      const values = ['a', 'b', 'c', 'd', 'e'];
      const set = createSet(values);

      for (const index of order) {
        expect(set.extract(slot(index))).toBe(values[index]);
        expect(set.has(slot(index))).toBe(false);
        expectConsistent(set);
      }

      expect(set.size).toBe(0);
    });
  });

  describe('invalid indices', () => {
    const invalid = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];

    it.each(invalid)('throws a RangeError when inserting at %s', (index) => {
      const set = new SparseSet<TSlot, string>();

      expect(() => set.insert(slot(index), 'value')).toThrow(RangeError);
      expect(() => set.set(slot(index), 'value')).toThrow(RangeError);
      expect(() => set.replace(slot(index), 'value')).toThrow(RangeError);
    });

    it.each(invalid)('changes nothing when inserting at %s fails', (index) => {
      const set = createSet(['a', 'b']);

      expect(() => set.insert(slot(index), 'value')).toThrow(RangeError);

      expect(set.size).toBe(2);
      expect(set.toArray()).toEqual(['a', 'b']);
      expectConsistent(set);
    });

    it.each(invalid)('reads %s as missing', (index) => {
      const set = createSet(['a', 'b']);

      expect(set.has(slot(index))).toBe(false);
      expect(set.get(slot(index))).toBeUndefined();
      expect(set.extract(slot(index))).toBeUndefined();
      expect(set.size).toBe(2);
    });
  });

  describe('growth', () => {
    it('keeps every value reachable as larger indices are added', () => {
      const set = new SparseSet<TSlot, number>();
      const indices = [0, 15, 16, 17, 31, 32, 100, 1000, 4097];

      for (const index of indices) set.insert(slot(index), index * 10);

      for (const index of indices) expect(set.get(slot(index))).toBe(index * 10);
      expect(set.has(slot(50))).toBe(false);
      expectConsistent(set);
    });

    it('reads indices past the largest one inserted as missing', () => {
      const set = createSet(['a']);

      expect(set.has(slot(1_000_000))).toBe(false);
      expect(set.get(slot(1_000_000))).toBeUndefined();
    });
  });

  describe('entries and toArray', () => {
    it('return the live arrays, which change as the set does', () => {
      const set = new SparseSet<TSlot, string>();
      const entries = set.entries();
      const values = set.toArray();

      set.insert(slot(7), 'seven');

      expect(entries).toEqual([7]);
      expect(values).toEqual(['seven']);
    });

    it('stay in the same order as each other', () => {
      const set = createSet(['a', 'b', 'c', 'd', 'e']);
      set.extract(slot(1));
      set.extract(slot(3));
      set.insert(slot(8), 'i');

      expectConsistent(set);
    });
  });

  describe('clear', () => {
    it('removes every element', () => {
      const set = createSet(['a', 'b', 'c']);

      set.clear();

      expect(set.size).toBe(0);
      expect(set.entries()).toEqual([]);
      expect(set.toArray()).toEqual([]);
      expect(set.has(slot(0))).toBe(false);
      expect(set.get(slot(2))).toBeUndefined();
    });

    it('removes values at large and scattered indices', () => {
      const set = new SparseSet<TSlot, string>();
      set.insert(slot(3), 'three');
      set.insert(slot(500), 'five hundred');
      set.insert(slot(9000), 'nine thousand');

      set.clear();

      expect(set.has(slot(3))).toBe(false);
      expect(set.has(slot(500))).toBe(false);
      expect(set.has(slot(9000))).toBe(false);
      expect(set.insert(slot(500), 'again')).toBe(true);
      expect(set.size).toBe(1);
      expectConsistent(set);
    });

    it('leaves the set usable afterwards', () => {
      const set = createSet(['a', 'b', 'c']);
      set.clear();

      expect(set.insert(slot(1), 'new')).toBe(true);
      expect(set.get(slot(1))).toBe('new');
      expect(set.has(slot(0))).toBe(false);
      expect(set.size).toBe(1);
      expectConsistent(set);
    });
  });

  it('behaves like a Map across a long random sequence of operations', () => {
    const random = createRandom(0x5eed);
    const set = new SparseSet<TSlot, number>();
    const model = new Map<number, number>();
    const maxIndex = 64;

    for (let step = 0; step < 5000; step++) {
      const index = Math.floor(random() * maxIndex);
      const value = Math.floor(random() * 1000);
      const operation = Math.floor(random() * 6);

      switch (operation) {
        case 0:
          expect(set.insert(slot(index), value)).toBe(!model.has(index));
          if (!model.has(index)) model.set(index, value);
          break;
        case 1:
          expect(set.set(slot(index), value)).toBe(!model.has(index));
          model.set(index, value);
          break;
        case 2:
          expect(set.replace(slot(index), value)).toBe(model.get(index));
          model.set(index, value);
          break;
        case 3:
        case 4:
          expect(set.extract(slot(index))).toBe(model.get(index));
          model.delete(index);
          break;
        default:
          if (random() < 0.02) {
            set.clear();
            model.clear();
          }
      }

      expect(set.size).toBe(model.size);
    }

    for (let index = 0; index < maxIndex; index++) {
      expect(set.has(slot(index))).toBe(model.has(index));
      expect(set.get(slot(index))).toBe(model.get(index));
    }
    expectConsistent(set);
  });

  describe('types', () => {
    it('returns the value type or undefined', () => {
      const set = new SparseSet<TSlot, string>();

      expectTypeOf(set.get(slot(0))).toEqualTypeOf<string | undefined>();
      expectTypeOf(set.extract(slot(0))).toEqualTypeOf<string | undefined>();
    });

    it('returns read-only arrays', () => {
      const set = new SparseSet<TSlot, string>();

      expectTypeOf(set.entries()).toEqualTypeOf<readonly TSlot[]>();
      expectTypeOf(set.toArray()).toEqualTypeOf<readonly string[]>();
    });

    it('rejects indices of a different branded type', () => {
      const set = new SparseSet<TSlot, string>();

      // @ts-expect-error A handle is not a slot.
      set.get(0 as THandle);
      // @ts-expect-error A plain number is not a slot.
      set.insert(0, 'zero');
    });
  });
});
