import type { TypedArrayConstructor, TypedArrayView } from '@cult-frog/types';

/**
 * Fixed-size rows of numbers, `stride` values each, packed back to back in one typed
 * array. Row `i` is elements `[i * stride, (i + 1) * stride)`. Suited to per-entity
 * data read in bulk, such as matrices: one contiguous allocation instead of one object
 * per row.
 *
 * The buffer holds storage, not entries: every row below `capacity` exists and starts
 * as zeros, and which rows are in use is the owner's to track.
 *
 * `get` returns a view into the storage, cached per row. A view stays connected until
 * the buffer grows: growing copies everything into new storage and drops the cached
 * views, so a view kept across a growth reads and writes the old storage. Hold views
 * for the duration of an operation, not across one that may grow the buffer.
 *
 * Indices must be integers; a fractional index straddles two rows and is not caught.
 *
 * @template TStorage - The typed array holding the rows, such as `Float32Array`.
 * @template TView - The type a row is handed out as, such as `TMat4`.
 */
export class PackedBuffer<
  TStorage extends TypedArrayView<TStorage>,
  TView extends TStorage = TStorage,
> {
  private _ctor: TypedArrayConstructor<TStorage, TStorage['buffer']>;
  private _capacity: number;
  private _stride: number;
  private _data: TStorage;
  private _views: TView[] = [];

  /**
   * @param initialCapacity - Rows to allocate up front. The buffer doubles as needed.
   * @param stride - Values per row.
   * @param ctor - The typed array constructor for the storage, such as `Float32Array`.
   * @throws If either number is not a positive integer.
   */
  constructor(
    initialCapacity: number,
    stride: number,
    ctor: TypedArrayConstructor<TStorage, TStorage['buffer']>
  ) {
    if (!Number.isInteger(initialCapacity) || initialCapacity < 1)
      throw new Error('Initial capacity must be a positive integer');
    if (!Number.isInteger(stride) || stride < 1)
      throw new Error('Stride must be a positive integer');

    this._capacity = initialCapacity;
    this._stride = stride;
    this._ctor = ctor;
    this._data = this._newStorage(initialCapacity);
  }

  private _isInRange(index: number): boolean {
    return index >= 0 && index < this._capacity;
  }

  private _byteLength(rows: number): number {
    return rows * this._stride * this._ctor.BYTES_PER_ELEMENT;
  }

  private _newStorage(capacity: number): TStorage {
    // One extra row past capacity is scratch space for swap; get never hands it out.
    return new this._ctor(new ArrayBuffer(this._byteLength(capacity + 1)));
  }

  private _grow(minimum: number): void {
    let capacity = this._capacity;
    while (capacity < minimum) capacity *= 2;

    const next = this._newStorage(capacity);
    next.set(this._data);
    this._data = next;
    this._capacity = capacity;
    this._views.length = 0;
  }

  private _getOffset(index: number): number {
    return index * this._stride;
  }

  private _createView(index: number): TView {
    const offset = this._getOffset(index);
    const view = this._data.subarray(offset, offset + this._stride) as TView;
    this._views[index] = view;
    return view;
  }

  /** Values per row. */
  public get stride(): number {
    return this._stride;
  }

  /** Rows the storage currently holds. Every row below this can be read with `get`. */
  public get capacity(): number {
    return this._capacity;
  }

  /**
   * Grows the storage, doubling, until it holds at least `minimum` rows. Existing rows
   * are kept; cached views are dropped, so views from before must not be used after.
   */
  public ensureCapacity(minimum: number): void {
    if (this._capacity < minimum) this._grow(minimum);
  }

  /**
   * A live view of row `index`: writes through it change the buffer, and it sees later
   * writes to the row. Valid until the buffer next grows. Never grows the buffer.
   *
   * @throws {RangeError} If `index` is negative or not below `capacity`.
   */
  public get(index: number): TView {
    if (!this._isInRange(index))
      throw new RangeError(`Row ${index} is outside capacity ${this._capacity}`);
    return this._views[index] ?? this._createView(index);
  }

  /**
   * Copies `value` into row `index`, growing the buffer first if the row is past
   * `capacity`.
   *
   * @throws {RangeError} If `index` is negative, or `value` is not exactly `stride`
   * values long. Nothing is changed when it throws.
   */
  public set(index: number, value: ArrayLike<number>): void {
    if (index < 0) throw new RangeError(`Index ${index} is out of bounds`);
    if (this._stride !== value.length)
      throw new RangeError(`Expected ${this._stride} values, got ${value.length}`);
    this.ensureCapacity(index + 1);
    this._data.set(value, this._getOffset(index));
  }

  /**
   * Copies row `from` over row `to`, leaving `from` as it was. Note the order: source
   * first, unlike `TypedArray.copyWithin`.
   *
   * @throws {RangeError} If either row is outside `capacity`.
   */
  public move(from: number, to: number): void {
    if (!(this._isInRange(from) && this._isInRange(to)))
      throw new RangeError(`From or to index is outside capacity ${this._capacity}`);
    if (from === to) return;
    const s = this._stride;
    this._data.copyWithin(to * s, from * s, (from + 1) * s);
  }

  /**
   * Exchanges two rows' values. Views of either row see the exchanged values.
   *
   * @throws {RangeError} If either row is outside `capacity`.
   */
  public swap(index1: number, index2: number): void {
    if (!(this._isInRange(index1) && this._isInRange(index2)))
      throw new RangeError(`Index 1 or 2 is outside capacity ${this._capacity}`);
    if (index1 === index2) return;
    const s = this._stride;
    const offset1 = this._getOffset(index1);
    const offset2 = this._getOffset(index2);
    const scratch = this._getOffset(this._capacity);
    this._data.copyWithin(scratch, offset1, offset1 + s);
    this._data.copyWithin(offset1, offset2, offset2 + s);
    this._data.copyWithin(offset2, scratch, scratch + s);
  }
}
