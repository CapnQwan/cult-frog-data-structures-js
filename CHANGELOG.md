# Changelog

All notable changes to this package are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows [Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.1.0] - 2026-10-10

### Added

- `SparseSet`, which stores values under small integer indices with constant-time insert, lookup and removal, and keeps them in a dense array for fast iteration.
- `PackedBuffer`, which packs fixed-width rows of numbers into one typed array that grows by doubling, and hands out cached views of each row.
- `IndexedArray`, an array whose index must be a specific branded number type, so passing the wrong kind of index is a compile error.
