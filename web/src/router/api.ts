import express from "express";
import cors from "cors";
import session from "express-session";
import { buildAuthRouter } from "./auth";
import { getConn, closePool } from "../db/oracle";

export function createApiServer() {
  const app = express();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json());

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax" },
    })
  );

  const getRouter = express.Router();
  const postRouter = express.Router();

  const DISPLAY_JS = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear(),
      m = pad(d.getMonth() + 1),
      day = pad(d.getDate());
    const hh = pad(d.getHours()),
      mm = pad(d.getMinutes()),
      ss = pad(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  };

  function toDisplayTime(v: any): any {
    if (v == null) return v;
    if (v instanceof Date) return DISPLAY_JS(v);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)) {
      const d = new Date(s);
      if (!Number.isNaN(+d)) return DISPLAY_JS(d);
    }
    return v;
  }

  async function isDateLikeColumn(
    conn: any,
    tableName: string,
    columnName: string
  ) {
    const r = await conn.execute(
      `SELECT DATA_TYPE FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = :t AND COLUMN_NAME = :c`,
      { t: tableName.toUpperCase(), c: columnName.toUpperCase() }
    );
    const dt = r.rows?.[0]?.[0] as string | undefined;
    if (!dt) return false;
    return /^(DATE|TIMESTAMP)/i.test(dt);
  }

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
    try {
      const tableName = req.query.tableName as string;
      const columnName = (req.query.columnName as string) || "";
      const value = (req.query.value as string) || "";

      const validIdent = /^[A-Z0-9_]+$/i;
      if (
        !validIdent.test(tableName) ||
        (columnName && !validIdent.test(columnName))
      ) {
        return res.status(400).json({ ok: false, error: "invalid identifier" });
      }

      const conn = await getConn();
      let query;

      if (columnName && value) {
        const isDate = await isDateLikeColumn(conn, tableName, columnName);

        if (value !== "null") {
          if (isDate) {
            query = await conn.execute(
              `SELECT * FROM ${tableName}
              WHERE ${columnName} = TO_TIMESTAMP(:val,'YYYY-MM-DD HH24:MI:SS')`,
              { val: value }
            );
          } else {
            query = await conn.execute(
              `SELECT * FROM ${tableName} WHERE ${columnName} = :val`,
              { val: value }
            );
          }
        } else {
          query = await conn.execute(
            `SELECT * FROM ${tableName} WHERE ${columnName} IS NULL`
          );
        }
      } else {
        query = await conn.execute(`SELECT * FROM ${tableName}`);
      }

      await conn.close();

      const columns = query.metaData?.map((c: any) => c.name) ?? [];
      const rowsRaw = (query.rows as any[][]) ?? [];

      const rows = rowsRaw.map((r) => r.map(toDisplayTime));

      res.json({ ok: true, columns, rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/table_column_suggestions", async (req, res) => {
    try {
      const tableName = req.query.tableName as string;
      const columnName = req.query.columnName as string;
      const queryText = (req.query.query as string) || "";
      const validIdent = /^[A-Z0-9_]+$/i;

      if (!validIdent.test(tableName) || !validIdent.test(columnName)) {
        return res.status(400).json({ ok: false, error: "invalid identifier" });
      }

      if (!tableName || !columnName || !queryText) {
        return res.json({ ok: true, suggestions: [] });
      }

      const conn = await getConn();
      const isDate = await isDateLikeColumn(conn, tableName, columnName);

      let sql: string;
      let binds: any = {};

      if (isDate) {
        sql = `
        SELECT DISTINCT TO_CHAR(${columnName}, 'YYYY-MM-DD HH24:MI:SS') AS VAL
        FROM ${tableName}
        WHERE TO_CHAR(${columnName}, 'YYYY-MM-DD HH24:MI:SS') LIKE :q
        ORDER BY VAL
        FETCH FIRST 10 ROWS ONLY`;
        binds = { q: `${queryText}%` };
      } else {
        sql = `
        SELECT DISTINCT ${columnName} AS VAL
        FROM ${tableName}
        WHERE CAST(${columnName} AS VARCHAR2(4000)) LIKE :q
        ORDER BY VAL
        FETCH FIRST 10 ROWS ONLY`;
        binds = { q: `${queryText}%` };
      }

      const r = await conn.execute(sql, binds, {
        outFormat: undefined,
      });
      await conn.close();

      const suggestions = (r.rows ?? []).map((row) => toDisplayTime(row[0]));

      res.json({ ok: true, suggestions });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/logs/totals", async (req, res) => {
    const fromDate = (req.query.from as string) || null;
    const toDate = (req.query.to as string) || null;

    try {
      const conn = await getConn();
      try {
        const sql = `
        SELECT TARGET_TABLE,
               COUNT(*) AS REQ_COUNT
        FROM API_REQUEST_LOG
        WHERE (:fromDate IS NULL OR CREATED_AT >= TO_TIMESTAMP(:fromDate,'YYYY-MM-DD'))
          AND (:toDate   IS NULL OR CREATED_AT <  TO_TIMESTAMP(:toDate,  'YYYY-MM-DD') + INTERVAL '1' DAY)
        GROUP BY TARGET_TABLE
        ORDER BY REQ_COUNT DESC, TARGET_TABLE ASC
      `;
        const r = await conn.execute(sql, { fromDate, toDate });
        res.json({ ok: true, rows: r.rows });
        await conn.close();
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e.message });
      }
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/logs/by-column", async (req, res) => {
    try {
      const tableName = ((req.query.tableName as string) || "").trim();

      if (!tableName) {
        return res.status(400).json({ ok: false, error: "tableName required" });
      }

      if (!/^[A-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ ok: false, error: "invalid tableName" });
      }

      const conn = await getConn();

      const sql = `
      SELECT REGEXP_SUBSTR(request_src, 'columnName=([^&]+)', 1, 1, NULL, 1) AS COLUMN_NAME,
             COUNT(*) AS REQ_COUNT
      FROM API_REQUEST_LOG
      WHERE TARGET_TABLE = :tbl
        AND request_src LIKE '%columnName=%'      -- sadece sütun özelinde olanlar
      GROUP BY REGEXP_SUBSTR(request_src, 'columnName=([^&]+)', 1, 1, NULL, 1)
      ORDER BY REQ_COUNT DESC, COLUMN_NAME ASC
    `;

      const r = await conn.execute(sql, { tbl: tableName });
      await conn.close();

      res.json({ ok: true, rows: r.rows ?? [] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  getRouter.get("/table_constraints", async (req, res) => {
    const tableName = String(req.query.tableName || "").toUpperCase();
    if (!tableName) return res.json({ ok: false, error: "tableName required" });

    const conn = await getConn();
    try {
      const pk = await conn.execute(
        `SELECT acc.COLUMN_NAME
         FROM USER_CONSTRAINTS ac
         JOIN USER_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
        WHERE ac.TABLE_NAME = :t AND ac.CONSTRAINT_TYPE = 'P'
        ORDER BY acc.POSITION`,
        { t: tableName }
      );

      const fks = await conn.execute(
        `SELECT acc.COLUMN_NAME AS FK_COLUMN
         FROM USER_CONSTRAINTS ac
         JOIN USER_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
        WHERE ac.TABLE_NAME = :t AND ac.CONSTRAINT_TYPE = 'R'
        ORDER BY acc.POSITION`,
        { t: tableName }
      );

      res.json({
        ok: true,
        pk: (pk.rows || []).map((r) => r[0]),
        fks: (fks.rows || []).map((r) => ({ column: r[0] })),
      });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    } finally {
      await conn.close();
    }
  });

  postRouter.post("/delete_row", async (req, res) => {
    try {
      const { tableName, pkName, pkValue } = req.body;
      if (!tableName || !pkName || pkValue === undefined)
        return res.json({
          ok: false,
          error: "Received incomplete parameters.",
        });

      const conn = await getConn();

      const sql = `DELETE FROM ${tableName} WHERE ${pkName} = :val`;
      await conn.execute(sql, { val: pkValue }, { autoCommit: true });

      await conn.close();
      res.json({ ok: true });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    }
  });

  postRouter.post("/update_row", async (req, res) => {
    const { tableName, pkName, oldPkValue, newValues } = req.body || {};
    if (!tableName || !pkName || !newValues) {
      return res.json({
        ok: false,
        error: "tableName, pkName, newValues required",
      });
    }

    const conn = await getConn();
    try {
      const pkRows = await conn.execute(
        `SELECT acc.COLUMN_NAME
         FROM USER_CONSTRAINTS ac
         JOIN USER_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
        WHERE ac.TABLE_NAME = :t AND ac.CONSTRAINT_TYPE = 'P'`,
        { t: tableName.toUpperCase() }
      );
      const fkRows = await conn.execute(
        `SELECT acc.COLUMN_NAME
         FROM USER_CONSTRAINTS ac
         JOIN USER_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
        WHERE ac.TABLE_NAME = :t AND ac.CONSTRAINT_TYPE = 'R'`,
        { t: tableName.toUpperCase() }
      );
      const pkSet = new Set((pkRows.rows || []).map((r) => String(r[0])));
      const fkSet = new Set((fkRows.rows || []).map((r) => String(r[0])));

      const filtered = Object.fromEntries(
        Object.entries(newValues || {}).filter(
          ([k]) => !(pkSet.has(k) || fkSet.has(k))
        )
      );
      if (Object.keys(filtered).length === 0) {
        return res.json({ ok: true }); 
      }

      const sets: string[] = [];
      const binds: Record<string, any> = { pk: oldPkValue }; 
      let i = 0;

      for (const [col, raw] of Object.entries(filtered)) {
        const b = `b${i++}`; 
        const v = raw === "" ? null : raw; 
        sets.push(`${col} = :${b}`);
        binds[b] = v; 
      }

      const sql = `UPDATE ${tableName} SET ${sets.join(
        ", "
      )} WHERE ${pkName} = :pk`;
      await conn.execute(sql, binds, { autoCommit: true });

      res.json({ ok: true });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    } finally {
      await conn.close();
    }
  });

  postRouter.post("/insert_row", async (req, res) => {
    const { tableName, values } = req.body || {};
    if (!tableName || !values) {
      return res.json({ ok: false, error: "tableName & values required" });
    }

    const cols = Object.keys(values);
    if (cols.length === 0) {
      return res.json({ ok: false, error: "No columns to insert" });
    }

    const binds: Record<string, any> = {};
    const placeholders = cols
      .map((_, i) => {
        const key = `b${i}`;
        let v = values[cols[i]];

        if (v === "") v = null;

        binds[key] = v;
        return `:${key}`;
      })
      .join(",");

    const sql = `INSERT INTO ${tableName} (${cols.join(
      ","
    )}) VALUES (${placeholders})`;

    const conn = await getConn();
    try {
      await conn.execute(sql, binds, { autoCommit: true });
      res.json({ ok: true });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    } finally {
      await conn.close();
    }
  });

  app.use("/api/get", getRouter);
  app.use("/api/post", postRouter);
  app.use("/api/auth", buildAuthRouter());

  app.get("/shutdown", async (_req, res) => {
    await closePool();
    res.json({ ok: true });
  });

  app.get(/(.*)/, async (_req, res) => {
    res.json({ ok: false, error: "Wrong API url!" });
  });

  return app;
}
