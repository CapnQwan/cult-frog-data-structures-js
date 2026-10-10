# @cult-frog/data-structures

Strongly typed data structures for TypeScript and JavaScript, built for predictable performance and low allocation overhead. Suited to hot paths such as entity-component systems, simulations and renderers.

- **Type-safe indices.** Structures keyed by index take a branded number type, so passing an entity handle where a slot was expected is a compile error.
- **Cache-friendly.** Values are stored densely in plain or typed arrays, so iterating them is a straight walk through memory.
- **Low allocation.** Clearing allocates nothing, and row views are cached rather than created on every read.

## Installation

```sh
pnpm add @cult-frog/data-structures
# or
npm install @cult-frog/data-structures
```

Requires Node.js 20.19 or later. The package is published as ES modules with bundled type declarations.

## Usage

The index types below are branded numbers: plain numbers at runtime, but distinct types to the compiler. You can declare one inline as shown, or use `Brand` from [`@cult-frog/types`](https://www.npmjs.com/package/@cult-frog/types).

```ts
import { PackedBuffer, SparseSet } from '@cult-frog/data-structures';

type TEntitySlot = number & { readonly __brand: 'EntitySlot' };

// Component storage: look up by entity slot, iterate densely.
const velocities = new SparseSet<TEntitySlot, { x: number; y: number }>();
velocities.set(3 as TEntitySlot, { x: 1, y: 0 });
velocities.set(7 as TEntitySlot, { x: 0, y: -1 });

const slots = velocities.entries();
const values = velocities.toArray();
for (let i = 0; i < values.length; i++) {
  console.log(slots[i], values[i]); // the slot and its value, in the same order
}

velocities.extract(3 as TEntitySlot); // { x: 1, y: 0 }

// One 4x4 matrix per entity, packed into a single Float32Array.
const transforms = new PackedBuffer(1024, 16, Float32Array);
transforms.set(0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const matrix = transforms.get(0); // a live Float32Array view of row 0
matrix[12] = 5; // writes straight into the buffer
```

## API

### `SparseSet<I, T>`

Stores values of type `T` under external indices of type `I`. Insert, lookup and removal are all O(1), and the values are kept packed in a dense array for fast iteration.

| Member | Description |
| --- | --- |
| `size` | The number of values in the set. |
| `get(index)` | The value at `index`, or `undefined` if there is none. |
| `has(index)` | Whether `index` holds a value. |
| `insert(index, value)` | Stores `value` if `index` is empty. Returns `false`, and changes nothing, if it is occupied. |
| `set(index, value)` | Stores `value`, overwriting any existing one. Returns `true` if it was newly inserted. |
| `replace(index, value)` | Stores `value` and returns the value it replaced, or `undefined` if it was newly inserted. |
| `extract(index)` | Removes the value at `index` and returns it, or `undefined` if there was none. |
| `entries()` | The indices in the set, in dense order. |
| `toArray()` | The values in the set, in dense order. |
| `clear()` | Removes every value, without allocating. Takes time proportional to `size`. |

Worth knowing:

- **Indices must be small, non-negative integers.** The lookup table is indexed by them directly, so it takes 4 bytes for every index up to the largest one used. Key by entity slot, never by a packed entity handle. Storing a value at a negative or fractional index throws a `RangeError`; looking one up returns `undefined`.
- **`entries()` and `toArray()` return the live arrays,** not copies. They change as the set does, and `entries()[i]` is always the index of `toArray()[i]`.
- **Removal changes the order.** `extract` moves the last value into the gap, so the dense order isn't stable across removals.
- **`get` can't tell a stored `undefined` from a missing index.** Use `has` when `T` includes `undefined`.

### `PackedBuffer<TStorage, TView>`

Fixed-size rows of numbers, `stride` values each, packed back to back in one typed array. Use it for per-entity numeric data that's read in bulk, such as matrices or vectors: one contiguous allocation instead of one object per row.

```ts
new PackedBuffer(initialCapacity, stride, Float32Array);
```

`TStorage` is the typed array holding the rows, such as `Float32Array`, and is inferred from the constructor. `TView` is the type each row is handed out as. It defaults to `TStorage`, and can be narrowed to a branded type such as `TMat4`.

| Member | Description |
| --- | --- |
| `stride` | The number of values per row. |
| `capacity` | The number of rows the storage holds. Every row below this can be read. |
| `get(row)` | A live view of `row`. Writes through it change the buffer. Throws a `RangeError` if `row` is outside `capacity`. |
| `set(row, values)` | Copies `values` into `row`, growing the buffer if `row` is past `capacity`. Throws a `RangeError` if `values` isn't exactly `stride` long. |
| `ensureCapacity(rows)` | Grows the buffer, doubling, until it holds at least `rows` rows. |
| `move(from, to)` | Copies row `from` over row `to`. |
| `swap(row1, row2)` | Exchanges the values of two rows. |

Worth knowing:

- **The buffer holds storage, not entries.** Every row below `capacity` exists and starts as zeros; tracking which rows are in use is up to you.
- **Views are only valid until the buffer grows.** Growing copies everything into new storage, so a view kept from before reads and writes the old storage. Hold views for one operation, not across anything that might call `set` or `ensureCapacity`.
- **`get` never grows the buffer; `set` does.** Call `ensureCapacity` first if you need to read rows past the current capacity.
- **`move` takes the source first,** unlike `TypedArray.prototype.copyWithin`.
- **Rows must be integers.** A fractional row isn't caught and reads across two rows.

### `IndexedArray<I, T>`

An array whose index must be of the branded number type `I`. A plain array accepts any number as an index, so a value of the wrong kind compiles and silently reads the wrong entry; `IndexedArray` makes that a compile error. Its methods are plain array accesses, so the cost is small: a fraction of a nanosecond per access over a plain array, which only shows up in very tight loops.

| Member | Description |
| --- | --- |
| `get(index)` | The value at `index`, or `undefined` if none is set. |
| `set(index, value)` | Stores `value` at `index`. Storing `undefined` unsets it. |
| `clear()` | Unsets every index. |

Like `SparseSet`, indices should be small, non-negative integers, since the backing array grows to the largest index written.

## License

[MIT](./LICENSE) © Quin Partridge
