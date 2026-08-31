import { Hono } from "hono";
import { serve } from "hono/bun";
import initSqlJs from "sql.js";
import * as fs from "fs";

const app = new Hono();
const dbPath = process.env.SCREENER_DB_PATH || "/app/data/screener.db";

let db: any = null;

// Initialize SQL.js and load database
async function initDb() {
  const SQL = await initSqlJs();
  
  try {
    // Load database file
    const buffer = await Bun.file(dbPath).bytes();
    db = new SQL.Database(new Uint8Array(buffer));
    console.log(`✓ Loaded SQLite from ${dbPath}`);
  } catch (error) {
    console.error(`✗ Failed to load DB: ${error}`);
    // Create empty database
    db = new SQL.Database();
    console.log(`✓ Created empty database`);
  }
}

app.get("/health", (c) => {
  try {
    if (!db) {
      return c.json({ status: "initializing", database: "not ready" }, 503);
    }
    db.run("SELECT 1");
    return c.json({ status: "healthy", database: "connected" });
  } catch {
    return c.json({ status: "unhealthy", database: "error" }, 500);
  }
});

app.get("/tables", (c) => {
  try {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tables = result[0]?.values?.map((row: any) => row[0]) || [];
    return c.json({ tables });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/schema/:table", (c) => {
  const table = c.req.param("table");
  try {
    const result = db.exec(`PRAGMA table_info(${table})`);
    const schema = result[0]?.values || [];
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
    const result = db.exec(limitedSql);
    
    const data = result[0]?.values || [];
    return c.json({ query: sql, rowCount: data.length, data });
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
    const countResult = db.exec(`SELECT COUNT(*) as count FROM ${table}`);
    const total = countResult[0]?.values?.[0]?.[0] || 0;
    
    const dataResult = db.exec(`SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`);
    const data = dataResult[0]?.values || [];
    
    return c.json({
      table,
      pagination: { page, limit, total, hasMore: offset + limit < total },
      data
    });
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

// Start server after DB is initialized
await initDb();
serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`✓ Server running at http://0.0.0.0:3000`);
});

