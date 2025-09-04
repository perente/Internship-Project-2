import express from "express";
import cors from "cors";
import { getConn, closePool } from "../db/oracle";

export function createApiServer() {
  const app = express();

  app.use(cors({ origin: "http://localhost:3000" }));
  app.use(express.json());

  const getRouter = express.Router();

  getRouter.get("/tables", async (_req, res) => {
    try {
      const conn = await getConn();

      const query = await conn.execute(
        `SELECT table_name, column_name
                 FROM user_tab_columns
                 WHERE table_name LIKE 'T%'
                 ORDER BY table_name, column_id`
      );

      await conn.close();

      const tablesWithColumns: Record<string, string[]> = {};
      (query.rows as string[][])?.forEach(([tableName, columnName]) => {
        if (!tablesWithColumns[tableName]) tablesWithColumns[tableName] = [];
        tablesWithColumns[tableName].push(columnName);
      });

      res.json({
        ok: true,
        tables: tablesWithColumns,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/table_data", async (req, res) => {
    const tableName = req.query.tableName as string;
    const columnName = (req.query.columnName as string) || "";
    const value = (req.query.value as string) || "";

    try {
      const conn = await getConn();
      let query;

      if (columnName && value) {
        if (value != "null") {
          query = await conn.execute(
            `SELECT * FROM ${tableName} WHERE ${columnName} = :val`,
            { val: value }
          );
        } else {
          query = await conn.execute(
            `SELECT * FROM ${tableName} WHERE ${columnName} IS NULL`
          );
        }
      } else {
        query = await conn.execute(`SELECT * FROM ${tableName}`);
      }

      await conn.execute(
        `INSERT INTO API_REQUEST_LOG (TARGET_TABLE, REQUEST_SRC, STATUS)
             VALUES (:t, :src, 'OK')`,
        {
          t: tableName,
          src: req.originalUrl,
        },
        { autoCommit: true }
      );

      await conn.close();

      const columns = query.metaData?.map((col) => col.name) ?? [];
      res.json({ ok: true, columns, rows: query.rows });
    } catch (e: any) {
      try {
        const conn = await getConn();
        await conn.execute(
          `INSERT INTO API_REQUEST_LOG (TARGET_TABLE, REQUEST_SRC, STATUS)
                 VALUES (:t, :src, 'ERROR')`,
          {
            t: (req.query.tableName as string) || "UNKNOWN",
            src: req.originalUrl,
          },
          { autoCommit: true }
        );
        await conn.close();
      } catch {}

      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/table_column_suggestions", async (req, res) => {
    try {
      const tableName = req.query.tableName as string;
      const columnName = req.query.columnName as string;
      const queryText = (req.query.query as string) || "";

      if (!tableName || !columnName) {
        return res.json({
          ok: false,
          error: "Missing tableName or columnName",
        });
      }

      const conn = await getConn();

      const sql = `
                SELECT ${columnName} AS val, COUNT(*) AS freq
                FROM ${tableName}
                WHERE UPPER(${columnName}) LIKE UPPER(:q) AND ${columnName} IS NOT NULL
                GROUP BY ${columnName}
                ORDER BY freq DESC
            `;

      const result = await conn.execute(sql, { q: `%${queryText}%` });

      await conn.close();

      const suggestions = (result.rows || []).slice(0, 3).map((row) => row[0]);

      res.json({ ok: true, suggestions });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/logs/daily-raw", async (req, res) => {
    const from = (req.query.from as string) || null; 
    const to = (req.query.to as string) || null;

    try {
      const conn = await getConn();
      try {
        const sql = `
        SELECT
          TARGET_TABLE,
          TRUNC(CREATED_AT) AS DAY,
          COUNT(*)          AS REQ_COUNT
        FROM API_REQUEST_LOG
        WHERE (:from IS NULL OR TRUNC(CREATED_AT) >= TO_DATE(:from, 'YYYY-MM-DD'))
          AND (:to   IS NULL OR TRUNC(CREATED_AT) <= TO_DATE(:to,   'YYYY-MM-DD'))
        GROUP BY TARGET_TABLE, TRUNC(CREATED_AT)
        ORDER BY DAY ASC, TARGET_TABLE ASC
      `;
        const r = await conn.execute(sql, { from, to });
        res.json({ ok: true, rows: r.rows });
      } finally {
        await conn.close();
      }
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.use("/api/get", getRouter);

  app.get("/shutdown", async (_req, res) => {
    await closePool();
    res.json({ ok: true });
  });

  app.get(/(.*)/, async (_req, res) => {
    res.json({ ok: false, error: "Wrong API url!" });
  });

  return app;
}
