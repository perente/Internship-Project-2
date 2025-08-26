import express from "express";
import cors from "cors";
import { getConn, closePool } from "./db/oracle";

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

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, () =>
  console.log(`API up on :${port}`)
);

// Kapatılırken pool'u serbest bırak
for (const sig of ["SIGINT","SIGTERM","SIGQUIT"] as const) {
  process.on(sig, async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  });
}
