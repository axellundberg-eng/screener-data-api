# screener-data-api

REST API för SQLite-data från Screener-analys-hus.

## Endpoints

- `GET /health` - Health check
- `GET /tables` - Lista alla tabeller
- `GET /schema/:table` - Tabell-schema
- `GET /data/:table?page=1&limit=100` - Hämta data med pagination
- `POST /query { sql: "SELECT ..." }` - Kör SQL-queries

## Deploy

Deployas från Railway via GitHub integration.

```bash
GET /data/issuers?page=1&limit=50
