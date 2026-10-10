/**
 * An array whose index must be of the branded number type `I`.
 *
 * A plain array accepts any number as an index, so a value of the wrong kind (an entity
 * handle where a slot was meant) compiles and silently reads the wrong entry. Fixing the
 * index type makes that a compile error. The methods are plain array accesses, so the
 * wrapper costs nothing in hot loops once inlined.
 *
 * Indices should be small, non-negative integers: the backing array grows to the largest
 * index written, with gaps between.
 *
 * @template I The index type, such as `TEntitySlot`.
 * @template T The value type. Reads of an unset index return `undefined`.
 */
export class IndexedArray<I extends number, T> {
  private _array: (T | undefined)[] = [];

  /** The value at `index`, or `undefined` if none is set. */
  public get(index: I): T | undefined {
    return this._array[index];
  }

  /** Stores `value` at `index`. Storing `undefined` unsets it. */
  public set(index: I, value: T | undefined): void {
    this._array[index] = value;
  }

  /** Unsets every index, without allocating. */
  public clear(): void {
    this._array.length = 0;
  }
}
