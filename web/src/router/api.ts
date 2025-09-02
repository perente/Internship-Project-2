import express from "express";
import cors from "cors";
import { getConn, closePool } from "../db/oracle";

export function createApiServer() {
    const app = express();

    app.use(cors({ origin: "http://localhost:3000" }));
    app.use(express.json());

    app.get("/tables", async (_req, res) => {
        try {
            const conn = await getConn();

            const query = await conn.execute(
                `SELECT table_name FROM user_tables ORDER BY table_name`,
                [] // bind yok
            );

            await conn.close();

            const tables = (query.rows as string[][])?.map(row => row[0]) ?? [];

            res.json({
                ok: true,
                tables
            });
        } catch (e: any) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get("/table_info", async (req, res) => {
        try {
            const tableName = req.query.tableName as string;
            const id = req.query.id as string;

            const conn = await getConn();
            const query = await conn.execute(
                `SELECT * FROM ${tableName} WHERE id = :id`,
                { id }
            );
            await conn.close();

            const columns = query.metaData?.map(col => col.name) ?? [];

            res.json({ ok: true, columns: columns, rows: query.rows });
        } catch (e: any) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get("/shutdown", async (_req, res) => {
        await closePool();
        res.json({ ok: true });
    });

    return app;
}
