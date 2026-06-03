/**
 * tests/setup.ts  — bun test --preload ./tests/setup.ts
 *
 * Replaces the real Drizzle/Neon DB and Gemini service with lightweight
 * in-memory fakes so tests never need DATABASE_URL or GEMINI_API_KEY.
 *
 * How eq() is decoded:
 *   eq(col, val) → SQL { queryChunks: [StringChunk, Column, StringChunk, Param, StringChunk] }
 *   → colName  = queryChunks[1].name   (e.g. 'email', 'user_id')
 *   → colValue = queryChunks[3].value  (e.g. 'alice@test.com')
 *   Column names are snake_case from the schema; rows are stored with
 *   the camelCase key that the route passes to .values().
 *   We try both forms when filtering.
 */

import { mock } from 'bun:test';
import { getTableName } from 'drizzle-orm';

// ─── in-memory store keyed by Drizzle table name ────────────────────────────

const store: Record<string, Record<string, unknown>[]> = {};

function getTable(name: string): Record<string, unknown>[] {
  if (!store[name]) store[name] = [];
  return store[name];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function newId(): string {
  return `mock-${++_idCounter}-${Date.now()}`;
}

/** snake_case → camelCase */
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Try to evaluate a Drizzle SQL object produced by eq(col, val).
 * Returns a plain-function predicate, or null if the chunk layout is unexpected.
 */
function sqlToPredicate(
  sql: unknown
): ((row: Record<string, unknown>) => boolean) | null {
  const chunks = (sql as any)?.queryChunks;
  if (!Array.isArray(chunks) || chunks.length < 4) return null;

  // chunks: [StringChunk, Column, StringChunk, Param, StringChunk]
  const colChunk = chunks[1];
  const valChunk = chunks[3];
  const colName: string | undefined = colChunk?.name;   // e.g. 'user_id'
  const colValue: unknown = valChunk?.value;

  if (colName === undefined) return null;

  const camelName = toCamel(colName); // e.g. 'userId'

  return (row) =>
    row[colName] === colValue || row[camelName] === colValue;
}

// ─── fluent query builder ─────────────────────────────────────────────────────

class SelectBuilder {
  private rows: Record<string, unknown>[] = [];
  private predicates: ((r: Record<string, unknown>) => boolean)[] = [];
  private _limit = Infinity;

  from(table: unknown): this {
    try {
      const name = getTableName(table as any);
      this.rows = getTable(name);
    } catch {
      this.rows = [];
    }
    return this;
  }

  where(condition: unknown): this {
    if (typeof condition === 'function') {
      this.predicates.push(condition as any);
    } else {
      const pred = sqlToPredicate(condition);
      if (pred) this.predicates.push(pred);
      // if pred is null we cannot filter — return all rows (safe for most tests)
    }
    return this;
  }

  orderBy(..._args: unknown[]): this { return this; }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  private execute(): Record<string, unknown>[] {
    let result = [...this.rows];
    for (const p of this.predicates) result = result.filter(p);
    if (this._limit < Infinity) result = result.slice(0, this._limit);
    return result;
  }

  // Thenable so the builder can be awaited
  then(
    resolve: (v: Record<string, unknown>[]) => unknown,
    reject: (e: unknown) => unknown
  ) {
    try { resolve(this.execute()); }
    catch (e) { reject(e); }
  }
}

class InsertBuilder {
  private tableRows: Record<string, unknown>[] = [];
  private _values: Record<string, unknown>[] = [];
  private _returning = false;

  constructor(table: unknown) {
    try {
      const name = getTableName(table as any);
      this.tableRows = getTable(name);
    } catch {
      this.tableRows = [];
    }
  }

  values(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this._values = Array.isArray(data) ? data : [data];
    return this;
  }

  returning(): this {
    this._returning = true;
    return this;
  }

  private execute(): Record<string, unknown>[] | { rowCount: number } {
    const inserted = this._values.map((v) => {
      const row = { id: newId(), createdAt: new Date().toISOString(), ...v };
      this.tableRows.push(row);
      return row;
    });
    return this._returning ? inserted : { rowCount: inserted.length };
  }

  then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
    try { resolve(this.execute()); }
    catch (e) { reject(e); }
  }
class DeleteBuilder {
  private tableRows: Record<string, unknown>[] = [];

  constructor(table: unknown) {
    try {
      const name = getTableName(table as any);
      this.tableRows = getTable(name);
    } catch {
      this.tableRows = [];
    }
  }

  where(condition: unknown): this {
    if (typeof condition === 'function') {
      const pred = condition as any;
      const toKeep = this.tableRows.filter((r) => !pred(r));
      this.tableRows.length = 0;
      this.tableRows.push(...toKeep);
    } else {
      const pred = sqlToPredicate(condition);
      if (pred) {
        const toKeep = this.tableRows.filter((r) => !pred(r));
        this.tableRows.length = 0;
        this.tableRows.push(...toKeep);
      }
    }
    return this;
  }

  then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
    try { resolve({ rowCount: 1 }); }
    catch (e) { reject(e); }
  }
}

// ─── mock db object ───────────────────────────────────────────────────────────

const mockDb = {
  select: () => new SelectBuilder(),
  insert: (table: unknown) => new InsertBuilder(table),
  delete: (table: unknown) => new DeleteBuilder(table),
  /** Used by markets routes for raw PostGIS SQL – return empty rows. */
  execute: async (_sql: unknown) => ({ rows: [] as unknown[] }),
};

console.log('--- TEST SETUP LOADED ---');

// ─── register module mocks ────────────────────────────────────────────────────

function mockModuleUniversal(specifier: string, factory: () => unknown) {
  console.log('Universal Mock called for:', specifier);
  // 1. Mock direct specifier
  mock.module(specifier, factory);

  try {
    // 2. Resolve absolute URL
    const resolvedUrl = import.meta.resolve(specifier);
    console.log(`Mocking resolved URL: ${resolvedUrl}`);
    mock.module(resolvedUrl, factory);

    // 3. Plain path
    const plainPath = resolvedUrl.replace('file:///', '');
    console.log(`Mocking plain path: ${plainPath}`);
    mock.module(plainPath, factory);

    // 4. Windows path
    const winPath = plainPath.replace(/\//g, '\\');
    console.log(`Mocking win path: ${winPath}`);
    mock.module(winPath, factory);

    // 5. Casing variations for drive letters (d: vs D:)
    const driveMatch = resolvedUrl.match(/^file:\/\/\/([a-zA-Z]):/);
    if (driveMatch && driveMatch[1]) {
      const drive = driveMatch[1];
      const altDrive = drive === drive.toLowerCase() ? drive.toUpperCase() : drive.toLowerCase();
      const altUrl = resolvedUrl.replace(`file:///${drive}:`, `file:///${altDrive}:`);
      console.log(`Mocking alt URL: ${altUrl}`);
      mock.module(altUrl, factory);
      
      const altPlainPath = altUrl.replace('file:///', '');
      console.log(`Mocking alt plain path: ${altPlainPath}`);
      mock.module(altPlainPath, factory);
      console.log(`Mocking alt win path: ${altPlainPath.replace(/\//g, '\\')}`);
      mock.module(altPlainPath.replace(/\//g, '\\'), factory);
    }
  } catch (err) {
    console.error('Failed to resolve and mock path for:', specifier, err);
  }
}

// Apply universal mocks
mockModuleUniversal('../src/db', () => ({ db: mockDb }));
mockModuleUniversal('../src/db/index', () => ({ db: mockDb }));
mockModuleUniversal('../src/services/groq', () => ({
  generateInsights: async () => ['Insight 1', 'Insight 2', 'Insight 3'],
  generateDemandForecast: async () => [
    { date: '2025-02-01', forecastDemand: 4600, confidence: 0.91 },
  ],
  mapLocationsToDivisions: async (locations: string[]) => {
    const mapping: Record<string, string> = {};
    for (const loc of locations) {
      mapping[loc] = loc === 'Chattogram' || loc === 'Chittagong' ? 'Chattogram' : 'Dhaka';
    }
    return mapping;
  },
  getDivisionFallback: (location: string) => {
    return location === 'Chattogram' || location === 'Chittagong' ? 'Chattogram' : 'Dhaka';
  },
}));
