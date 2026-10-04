import { DatabaseSync } from "node:sqlite";

/**
 * D1-shaped wrapper over node:sqlite so the Worker handle can run
 * with no Cloudflare account and no deploy.
 */
export function createLocalEnv(schemaSql) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schemaSql);
  return { DB: new D1Like(sqlite) };
}

class D1Like {
  constructor(sqlite) {
    this.sqlite = sqlite;
  }

  prepare(sql) {
    return new D1Prepared(this.sqlite, sql);
  }

  exec(sql) {
    this.sqlite.exec(sql);
  }
}

class D1Prepared {
  constructor(sqlite, sql, params = []) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new D1Prepared(this.sqlite, this.sql, params);
  }

  first() {
    const row = this.sqlite.prepare(this.sql).get(...this.params);
    return row ?? null;
  }

  all() {
    const results = this.sqlite.prepare(this.sql).all(...this.params);
    return { results };
  }

  run() {
    const info = this.sqlite.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: info.changes } };
  }
}
