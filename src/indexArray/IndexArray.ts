/**
 * An array whose index must be of the branded number type `I`.
 *
 * A plain array accepts any number as an index, so a value of the wrong kind (an entity
 * handle where a slot was meant) compiles and silently reads the wrong entry. Fixing the
 * index type makes that a compile error. The methods are plain array accesses, so the
 * wrapper is cheap but not free: in a tight loop it is measurably slower than indexing an
 * array directly. It slows further when one program stores several kinds of value (numbers,
 * objects, strings) in IndexedArrays, because they all share the same `get` and `set` code.
 * Inside a structure whose own methods already enforce the index type, a plain or typed
 * array is faster.
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
