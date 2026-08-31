import { Hono } from "hono";
import { serve } from "hono/bun";
import Database from "better-sqlite3";

const app = new Hono();
const dbPath = process.env.SCREENER_DB_PATH || "/app/data/screener.db";
let db: Database.Database;

try {
  db = new Database(dbPath);
  console.log(`✓ Connected to SQLite at ${dbPath}`);
} catch (error) {
  console.error(`✗ Failed: ${error}`);
  process.exit(1);
}

app.get("/health", (c) => {
  try {
    db.exec("SELECT 1");
    return c.json({ status: "healthy", database: "connected" });
  } catch {
    return c.json({ status: "unhealthy", database: "disconnected" }, 500);
  }
});

app.get("/tables", (c) => {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    return c.json({ tables: tables.map((t: any) => t.name) });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/schema/:table", (c) => {
  const table = c.req.param("table");
  try {
    const schema = db.pragma(`table_info(${table})`);
    return c.json({ table, schema });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.post("/query", async (c) => {
  try {
    const { sql, limit = 1000 } = await c.req.json();
    if (!sql) return c.json({ error: "SQL query required" }, 400);
    if (!/^\s*SELECT/i.test(sql)) return c.json({ error: "Only SELECT queries allowed" }, 403);
    const limitedSql = `${sql} LIMIT ${Math.min(limit, 10000)}`;
    const results = db.prepare(limitedSql).all();
    return c.json({ query: sql, rowCount: results.length, data: results });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/data/:table", (c) => {
  const table = c.req.param("table");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "100"), 1000);
  const offset = (page - 1) * limit;
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
    const data = db.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`).all(limit, offset);
    return c.json({ table, pagination: { page, limit, total: count.count, hasMore: offset + limit < count.count }, data });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/", (c) => {
  return c.json({
    service: "screener-data-api",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      tables: "GET /tables",
      schema: "GET /schema/:table",
      data: "GET /data/:table?page=1&limit=100",
      query: "POST /query { sql: 'SELECT ...' }"
    }
  });
});

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`✓ Server running at http://0.0.0.0:3000`);
});

