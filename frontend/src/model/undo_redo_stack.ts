/**
 * undo_redo_stack — generic undo/redo stack for PGN model + cursor snapshots.
 *
 * Integration API:
 * - `createUndoRedoStack<T>()` — creates a new stack instance.
 * - Stack methods: `push`, `undo`, `redo`, `canUndo`, `canRedo`, `clear`,
 *   `current`, `depth`.
 *
 * Configuration API:
 * - `maxDepth` option (default 200) caps history length to prevent unbounded
 *   memory growth.
 *
 * Communication API:
 * - Pure value object; no side effects or React dependencies.
 * - All state is internal; callers hold the returned stack object.
 */

export type UndoRedoStack<T> = {
  /** Push a new state onto the stack, clearing any forward history. */
  push(state: T): void;
  /** Undo one step. Returns the previous state, or null if at the bottom. */
  undo(): T | null;
  /** Redo one step. Returns the next state, or null if at the top. */
  redo(): T | null;
  /** True when undo is possible. */
  readonly canUndo: boolean;
  /** True when redo is possible. */
  readonly canRedo: boolean;
  /** Current depth of the undo history (number of undoable steps). */
  readonly undoDepth: number;
  /** Current depth of the redo history (number of redoable steps). */
  readonly redoDepth: number;
  /** The current (top-of-stack) state, or null if the stack is empty. */
  readonly current: T | null;
  /** Erase all history (called after an explicit Save). */
  clear(): void;
};

type StackOptions = {
  maxDepth?: number;
};

/**
 * Create a mutable undo/redo stack with a given max history depth.
 *
 * The stack is NOT a React hook — instantiate it with `useRef` or `useMemo`
 * in a component that needs it, or hold it in a service.
 */
export const createUndoRedoStack = <T>(
  options: StackOptions = {},
): UndoRedoStack<T> => {
  const maxDepth = options.maxDepth ?? 200;
  const past: T[] = [];   // past[0] = oldest, past[n-1] = most recent past
  const future: T[] = []; // future[0] = closest future
  let _current: T | null = null;

  return {
    push(state: T): void {
      if (_current !== null) {
        past.push(_current);
        if (past.length > maxDepth) past.shift();
      }
      _current = state;
      future.length = 0; // Clear forward history on new entry.
    },

    undo(): T | null {
      if (past.length === 0) return null;
      const prev = past.pop()!;
      if (_current !== null) future.unshift(_current);
      _current = prev;
      return _current;
    },

    redo(): T | null {
      if (future.length === 0) return null;
      const next = future.shift()!;
      if (_current !== null) past.push(_current);
      _current = next;
      return _current;
    },

    get canUndo(): boolean { return past.length > 0; },
    get canRedo(): boolean { return future.length > 0; },
    get undoDepth(): number { return past.length; },
    get redoDepth(): number { return future.length; },
    get current(): T | null { return _current; },

    clear(): void {
      past.length = 0;
      future.length = 0;
    },
  };
};
