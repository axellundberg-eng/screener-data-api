import { Hono } from "hono";
import { serve } from "hono/bun";

const app = new Hono();
const BACKEND_URL = process.env.BACKEND_URL || "http://screener-analys-hus-production.up.railway.app:8080";

// Proxy endpoint: GET /tables
app.get("/tables", async (c) => {
  try {
    const res = await fetch(`${BACKEND_URL}/tables`);
    const data = await res.json();
    return c.json(data, res.status);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Proxy endpoint: GET /schema/:table
app.get("/schema/:table", async (c) => {
  try {
    const table = c.req.param("table");
    const res = await fetch(`${BACKEND_URL}/schema/${table}`);
    const data = await res.json();
    return c.json(data, res.status);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Proxy endpoint: GET /data/:table
app.get("/data/:table", async (c) => {
  try {
    const table = c.req.param("table");
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "100";
    const res = await fetch(`${BACKEND_URL}/data/${table}?page=${page}&limit=${limit}`);
    const data = await res.json();
    return c.json(data, res.status);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Proxy endpoint: POST /query
app.post("/query", async (c) => {
  try {
    const body = await c.req.json();
    const res = await fetch(`${BACKEND_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return c.json(data, res.status);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "healthy", service: "gateway" });
});

// Root endpoint
app.get("/", (c) => {
  return c.json({
    service: "screener-data-api",
    version: "1.0.0",
    type: "HTTP Gateway",
    backend: BACKEND_URL,
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
  console.log(`✓ Gateway running at http://0.0.0.0:3000`);
  console.log(`✓ Backend: ${BACKEND_URL}`);
});

