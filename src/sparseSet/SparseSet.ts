/** Marks an index with no value in the sparse array. */
const EMPTY = -1;

/** The sparse array's length the first time it grows. */
const MIN_SPARSE_LENGTH = 16;

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
  private _sparse = new Int32Array(0);
  private _inverse: I[] = [];

  /**
   * Gets the number of elements in the set.
   * @returns The number of elements.
   */
  public get size(): number {
    return this._dense.length;
  }

  /** The position of `sparseIndex` in the dense array, or `EMPTY` if it holds no value. */
  private _denseIndexOf(sparseIndex: I): number {
    const sparse = this._sparse;
    // Check the bounds before reading: once a typed array read goes out of bounds, V8
    // switches that read to a slower mode for good, which roughly halves lookup speed.
    if (sparseIndex >= 0 && sparseIndex < sparse.length) return sparse[sparseIndex] ?? EMPTY;
    return EMPTY;
  }

  /**
   * Retrieves the value associated with a given sparse index.
   * @param sparseIndex The external index to look up.
   * @returns The value if found, otherwise undefined.
   */
  public get(sparseIndex: I): T | undefined {
    const denseIndex = this._denseIndexOf(sparseIndex);
    if (denseIndex === EMPTY) return undefined;
    return this._dense[denseIndex];
  }

  /**
   * Inserts a value into the set at the specified sparse index.
   * If the index is already occupied, the insertion fails.
   * @param sparseIndex The external index where the value should be stored.
   * @param value The value to store.
   * @returns True if the insertion was successful, false if the index was already occupied.
   * @throws {RangeError} If `sparseIndex` is not a non-negative integer.
   */
  public insert(sparseIndex: I, value: T): boolean {
    if (this._denseIndexOf(sparseIndex) !== EMPTY) return false;

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
   * @throws {RangeError} If `sparseIndex` is not a non-negative integer.
   */
  public set(sparseIndex: I, value: T): boolean {
    const denseIndex = this._denseIndexOf(sparseIndex);

    if (denseIndex !== EMPTY) {
      this._dense[denseIndex] = value;
      return false;
    }

    this._insert(sparseIndex, value);
    return true;
  }

  private _insert(sparseIndex: I, value: T): void {
    // A typed array silently ignores writes to an invalid index, which would leave the
    // value in the dense array with no way to look it up.
    if (!Number.isInteger(sparseIndex) || sparseIndex < 0)
      throw new RangeError(`Index ${sparseIndex} is not a non-negative integer`);
    if (sparseIndex >= this._sparse.length) this._growSparse(sparseIndex + 1);

    const denseSize = this.size;
    this._sparse[sparseIndex] = denseSize;
    this._inverse[denseSize] = sparseIndex;
    this._dense[denseSize] = value;
  }

  /** Grows the sparse array, doubling, until it is at least `minimum` long. */
  private _growSparse(minimum: number): void {
    let length = Math.max(this._sparse.length, MIN_SPARSE_LENGTH);
    while (length < minimum) length *= 2;

    const next = new Int32Array(length).fill(EMPTY);
    next.set(this._sparse);
    this._sparse = next;
  }

  /**
   * Removes and returns the value at the specified sparse index.
   * This operation is O(1) as it moves the last element in the dense array into the gap.
   * @param sparseIndex The external index to remove.
   * @returns The removed value, or undefined if the index was not found.
   */
  public extract(sparseIndex: I): T | undefined {
    const denseIndex = this._denseIndexOf(sparseIndex);
    if (denseIndex === EMPTY) return undefined;

    const value = this._dense[denseIndex];
    const lastDenseIndex = this.size - 1;

    if (denseIndex !== lastDenseIndex) {
      // Fill the gap with the last element.
      this._dense.copyWithin(denseIndex, lastDenseIndex);
      this._inverse.copyWithin(denseIndex, lastDenseIndex);
      const moved = this._inverse[denseIndex];
      if (moved !== undefined) this._sparse[moved] = denseIndex;
    }

    this._dense.pop();
    this._inverse.pop();
    this._sparse[sparseIndex] = EMPTY;
    return value;
  }

  /**
   * Replaces the value at the specified sparse index.
   * If the index is not occupied, it performs an insertion.
   * @param sparseIndex The external index to replace or insert at.
   * @param value The new value.
   * @returns The old value if it was replaced, or undefined if a new value was inserted.
   * @throws {RangeError} If `sparseIndex` is not a non-negative integer.
   */
  public replace(sparseIndex: I, value: T): T | undefined {
    const denseIndex = this._denseIndexOf(sparseIndex);
    if (denseIndex === EMPTY) {
      this._insert(sparseIndex, value);
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
    return this._denseIndexOf(sparseIndex) !== EMPTY;
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
   * This operation is O(size) and allocation-free: it resets only the indices in use, and
   * keeps the sparse array's storage for reuse.
   */
  public clear(): void {
    for (const sparseIndex of this._inverse) this._sparse[sparseIndex] = EMPTY;
    this._dense.length = 0;
    this._inverse.length = 0;
  }
}
