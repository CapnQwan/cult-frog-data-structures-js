import { isNil, isNotNil } from '@cult-frog/primitives';

import { IndexedArray } from '../indexArray/IndexArray.js';

/**
 * A SparseSet is a data structure that provides efficient set operations with O(1) time complexity
 * for insertion, deletion, and membership testing, while maintaining a dense array of elements
 * for fast iteration.
 *
 * It uses three arrays:
 * - A dense array that stores the elements consecutively.
 * - A sparse array that maps an external index to its position in the dense array.
 * - An inverse array that maps each dense position back to its external index.
 *
 * External indices must be small, non-negative integers: the sparse array is indexed by
 * them directly, so its size follows the largest index written. Key by entity slot, never
 * by a packed entity handle.
 *
 * @template I The external index type, such as `TEntitySlot`.
 * @template T The type of elements stored in the set.
 */
export class SparseSet<I extends number, T> {
  private _dense: T[] = [];
  private _sparse = new IndexedArray<I, number>();
  private _inverse: I[] = [];

  /**
   * Gets the number of elements in the set.
   * @returns The number of elements.
   */
  public get size(): number {
    return this._dense.length;
  }

  /**
   * Retrieves the value associated with a given sparse index.
   * @param sparseIndex The external index to look up.
   * @returns The value if found, otherwise undefined.
   */
  public get(sparseIndex: I): T | undefined {
    const denseIndex = this._sparse.get(sparseIndex);
    if (isNil(denseIndex)) return undefined;
    return this._dense[denseIndex];
  }

  /**
   * Inserts a value into the set at the specified sparse index.
   * If the index is already occupied, the insertion fails.
   * @param sparseIndex The external index where the value should be stored.
   * @param value The value to store.
   * @returns True if the insertion was successful, false if the index was already occupied.
   */
  public insert(sparseIndex: I, value: T): boolean {
    if (isNotNil(this._sparse.get(sparseIndex))) return false;

    this._insert(sparseIndex, value);
    return true;
  }

  /**
   * Writes a value at the specified sparse index, inserting or overwriting.
   *
   * Equivalent to `insert` followed by `replace` on failure, but resolves the
   * sparse slot once instead of twice — this is the hot path for component writes.
   *
   * @param sparseIndex The external index to write.
   * @param value The value to store.
   * @returns True if the value was newly inserted, false if it replaced one.
   */
  public set(sparseIndex: I, value: T): boolean {
    const denseIndex = this._sparse.get(sparseIndex);

    if (isNotNil(denseIndex)) {
      this._dense[denseIndex] = value;
      return false;
    }

    this._insert(sparseIndex, value);
    return true;
  }

  private _insert(sparseIndex: I, value: T): void {
    const denseSize = this.size;
    this._sparse.set(sparseIndex, denseSize);
    this._inverse[denseSize] = sparseIndex;
    this._dense[denseSize] = value;
  }

  /**
   * Removes and returns the value at the specified sparse index.
   * This operation is O(1) as it moves the last element in the dense array into the gap.
   * @param sparseIndex The external index to remove.
   * @returns The removed value, or undefined if the index was not found.
   */
  public extract(sparseIndex: I): T | undefined {
    const denseIndex = this._sparse.get(sparseIndex);
    if (isNil(denseIndex)) return undefined;

    const value = this._dense[denseIndex];
    const lastDenseIndex = this.size - 1;

    if (denseIndex !== lastDenseIndex) {
      // Fill the gap with the last element.
      this._dense.copyWithin(denseIndex, lastDenseIndex);
      this._inverse.copyWithin(denseIndex, lastDenseIndex);
      const moved = this._inverse[denseIndex];
      if (isNotNil(moved)) this._sparse.set(moved, denseIndex);
    }

    this._dense.pop();
    this._inverse.pop();
    this._sparse.set(sparseIndex, undefined);
    return value;
  }

  /**
   * Replaces the value at the specified sparse index.
   * If the index is not occupied, it performs an insertion.
   * @param sparseIndex The external index to replace or insert at.
   * @param value The new value.
   * @returns The old value if it was replaced, or undefined if a new value was inserted.
   */
  public replace(sparseIndex: I, value: T): T | undefined {
    const denseIndex = this._sparse.get(sparseIndex);
    if (isNil(denseIndex)) {
      this.insert(sparseIndex, value);
      return undefined;
    }

    const oldValue = this._dense[denseIndex];
    this._dense[denseIndex] = value;
    return oldValue;
  }

  /**
   * Checks if the set contains a value at the specified sparse index.
   *
   * @param sparseIndex The external index to check.
   * @returns True if the index is occupied, false otherwise.
   */
  public has(sparseIndex: I): boolean {
    return this._sparse.get(sparseIndex) !== undefined;
  }

  /**
   * The external indices currently in the set, in dense order: the same order as
   * {@link SparseSet.toArray}. Removal swaps the last element into the gap, so the order
   * is not stable across removals.
   *
   * Returns the live array, not a copy; it changes as the set does.
   */
  public entries(): Readonly<I[]> {
    return this._inverse;
  }

  /**
   * The stored values, in dense order. Returns the live array, not a copy.
   */
  public toArray(): Readonly<T[]> {
    return this._dense;
  }

  /**
   * Removes all elements from the set.
   * This operation is O(1) and allocation-free, as it simply sets the lengths of the arrays to 0.
   */
  public clear(): void {
    this._dense.length = 0;
    this._sparse.clear();
    this._inverse.length = 0;
  }
}
