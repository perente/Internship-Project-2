import express from "express";
import cors from "cors";
import { getConn, closePool } from "../db/oracle";

export function createApiServer() {
    const app = express();

    app.use(cors({ origin: "http://localhost:3000" }));
    app.use(express.json());

    app.get("/health", async (_req, res) => {
        try {
            const c = await getConn();
            const r = await c.execute("SELECT * FROM dual");
            await c.close();
            res.json({ ok: true, rows: r.rows });
        } catch (e: any) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // pool’u serbest bırakma endpointi (opsiyonel)
    app.get("/shutdown", async (_req, res) => {
        await closePool();
        res.json({ ok: true });
    });

    return app;
}
