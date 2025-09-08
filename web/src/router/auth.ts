import express from "express";
import { getConn } from "../db/oracle";

export const requireAuth = (req: any, res: any, next: any) => {
  if (req.session?.user) return next();
  return res.status(401).json({ ok: false, error: "Login required" });
};

export function buildAuthRouter() {
  const router = express.Router();

  router.post("/register", async (req: any, res) => {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.json({
        ok: false,
        error: "Username, Email and Password required",
      });
    }
    const conn = await getConn();
    try {
      await conn.execute(
        `INSERT INTO USERS (USERNAME, EMAIL, PASSWORD) VALUES (:u, :e, :p)`,
        { u: username, e: email, p: password },
        { autoCommit: true }
      );

      const r = await conn.execute(
        `SELECT ID, USERNAME, EMAIL FROM USERS WHERE USERNAME=:u`,
        { u: username }
      );
      const row = (r.rows || [])[0] as any;
      const [ID, USERNAME, EMAIL] = Array.isArray(row)
        ? row
        : [row.ID, row.USERNAME, row.EMAIL];

      req.session.user = { id: ID, username: USERNAME, email: EMAIL };
      return res.json({ ok: true, user: req.session.user });
    } catch (err: any) {
      return res.json({ ok: false, error: err.message });
    } finally {
      await conn.close();
    }
  });

  router.post("/login", async (req: any, res) => {
    const { userOrEmail, password } = req.body || {};
    if (!userOrEmail || !password) {
      return res.json({
        ok: false,
        error: "Username/Email and Password required",
      });
    }
    const conn = await getConn();
    try {
      const r = await conn.execute(
        `SELECT ID, USERNAME, EMAIL, PASSWORD
           FROM USERS
          WHERE USERNAME = :x OR EMAIL = :x`,
        { x: userOrEmail }
      );

      const row = (r.rows || [])[0] as any;
      if (!row) return res.json({ ok: false, error: "User not found" });

      const [ID, USERNAME, EMAIL, PASS] = Array.isArray(row)
        ? row
        : [row.ID, row.USERNAME, row.EMAIL, row.PASSWORD];

      if (PASS !== password)
        return res.json({ ok: false, error: "Password is incorrect" });

      req.session.user = { id: ID, username: USERNAME, email: EMAIL };
      return res.json({ ok: true, user: req.session.user });
    } catch (err: any) {
      return res.json({ ok: false, error: err.message });
    } finally {
      await conn.close();
    }
  });

  router.post("/logout", (req: any, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get("/me", (req: any, res) => {
    res.json({ ok: true, user: req.session?.user || null });
  });

  return router;
}
