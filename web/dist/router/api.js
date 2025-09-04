"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiServer = createApiServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const oracle_1 = require("../db/oracle");
function createApiServer() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: [/^http:\/\/localhost:3000$/, /^http:\/\/127\.0\.0\.1:3000$/],
    }));
    app.use(express_1.default.json());
    const getRouter = express_1.default.Router();
    // --- /tables ---
    getRouter.get("/tables", async (_req, res) => {
        try {
            const conn = await (0, oracle_1.getConn)();
            const query = await conn.execute(`SELECT table_name FROM user_tables ORDER BY table_name`);
            await conn.close();
            const tables = (query.rows ?? [])
                .map(row => row[0])
                .filter(name => name.startsWith("T"));
            res.json({ ok: true, tables });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    // --- /table_data ---
    getRouter.get("/table_data", async (req, res) => {
        const rawName = (req.query.tableName || "").toUpperCase();
        const id = req.query.id ?? "";
        const rawLimit = Number(req.query.limit ?? 200);
        const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 200 : rawLimit, 1000));
        if (!/^[A-Z0-9_]+$/.test(rawName)) {
            return res.status(400).json({ ok: false, error: "Invalid tableName" });
        }
        try {
            const conn = await (0, oracle_1.getConn)();
            const exists = await conn.execute(`SELECT 1 FROM user_tables WHERE table_name = :t`, { t: rawName });
            if ((exists.rows?.length ?? 0) === 0) {
                await conn.close();
                return res.status(400).json({ ok: false, error: "Table not found or not allowed" });
            }
            const baseSql = id
                ? `SELECT * FROM ${rawName} WHERE id = :id`
                : `SELECT * FROM ${rawName}`;
            const sql = `SELECT * FROM (${baseSql}) WHERE ROWNUM <= :limit`;
            const binds = id ? { id, limit } : { limit };
            const query = await conn.execute(sql, binds);
            await conn.close();
            const columns = query.metaData?.map((c) => c?.name) ?? [];
            res.json({ ok: true, columns, rows: query.rows });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    // --- /id_suggest ---
    getRouter.get("/id_suggest", async (req, res) => {
        const rawName = (req.query.tableName || "").toUpperCase();
        const q = (req.query.q || "").toUpperCase();
        const rawLimit = Number(req.query.limit ?? 10);
        const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 10 : rawLimit, 50));
        if (!/^[A-Z0-9_]+$/.test(rawName)) {
            return res.status(400).json({ ok: false, error: "Invalid tableName" });
        }
        if (q.length < 2)
            return res.json({ ok: true, ids: [] });
        const esc = (s) => s.replace(/[%_\\]/g, m => "\\" + m);
        const pattern = `%${esc(q)}%`;
        try {
            const conn = await (0, oracle_1.getConn)();
            const t = await conn.execute(`SELECT 1 FROM user_tables WHERE table_name = :t`, { t: rawName });
            if ((t.rows?.length ?? 0) === 0) {
                await conn.close();
                return res.status(400).json({ ok: false, error: "Table not found" });
            }
            const meta = await conn.execute(`SELECT data_type
           FROM user_tab_cols
          WHERE table_name = :t AND column_name = 'ID'`, { t: rawName });
            if ((meta.rows?.length ?? 0) === 0) {
                await conn.close();
                return res.status(400).json({ ok: false, error: "ID column not found" });
            }
            const dataType = (meta.rows[0][0] || "");
            let sql;
            let binds;
            if (dataType.includes("CHAR")) {
                sql = `
          SELECT id
            FROM ${rawName}
           WHERE UPPER(id) LIKE :p ESCAPE '\\'
             AND ROWNUM <= :limit`;
                binds = { p: pattern, limit };
            }
            else {
                if (!/^[0-9A-Z\-]+$/.test(q)) {
                    await conn.close();
                    return res.json({ ok: true, ids: [] });
                }
                sql = `
          SELECT TO_CHAR(id)
            FROM ${rawName}
           WHERE TO_CHAR(id) LIKE :p
             AND ROWNUM <= :limit`;
                binds = { p: `%${q}%`, limit };
            }
            const rs = await conn.execute(sql, binds);
            const rows = (rs.rows ?? []);
            const ids = rows.map(([id]) => String(id)).filter(Boolean);
            await conn.close();
            res.json({ ok: true, ids });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    // Router'ı mount ET, sonra catch-all
    app.use("/api/get", getRouter);
    app.get("/shutdown", async (_req, res) => {
        await (0, oracle_1.closePool)();
        res.json({ ok: true });
    });
    app.get(/(.*)/, async (_req, res) => {
        res.json({ ok: false, error: "Wrong API url!" });
    });
    // Startup’ta hangi route’lar var diye logla
    console.log("Mounted routes:", getRouter.stack?.map((l) => l.route?.path).filter(Boolean));
    return app;
}
