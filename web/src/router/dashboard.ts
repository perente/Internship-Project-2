import express from "express";
import path from "path";

export function createDashboardServer() {
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "../public")));
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "ejs");

  app.get("/login", (req, res) => {
    const mode = req.query.mode === "register" ? "register" : "login";
    res.render("login", { title: "Login", activePage: "login", error: null, mode });
  });

  app.post("/login", async (req, res) => {
    try {
      const r = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOrEmail: req.body.userOrEmail,
          password: req.body.password,
        }),
      });

      const anyHeaders: any = r.headers as any;
      const setCookies =
        typeof anyHeaders.getSetCookie === "function"
          ? anyHeaders.getSetCookie()
          : r.headers.get("set-cookie");

      if (setCookies) {
        res.setHeader("set-cookie", setCookies as any);
      }

      const data = await r.json();
      if (!data.ok) {
        return res.render("login", {
          title: "Login",
          activePage: "login",
          error: data.error || "Login failed",
          mode: "login",
        });
      }
      return res.redirect("/");
    } catch (e) {
      return res.render("login", {
        title: "Login",
        activePage: "login",
        error: "Server Error",
        mode: "login",
      });
    }
  });

  app.post("/register", async (req, res) => {
    try {
      const r = await fetch("http://localhost:3001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: req.body.username,
          email: req.body.email,
          password: req.body.password,
        }),
      });

      const anyHeaders: any = r.headers as any;
      const setCookies =
        typeof anyHeaders.getSetCookie === "function"
          ? anyHeaders.getSetCookie()
          : r.headers.get("set-cookie");

      if (setCookies) {
        res.setHeader("set-cookie", setCookies as any);
      }

      const data = await r.json();
      if (!data.ok) {
        return res.render("login", {
          title: "Login",
          activePage: "login",
          error: data.error || "Sign Up failed",
          mode: "register",
        });
      }
      return res.redirect("/");
    } catch (e) {
      return res.render("login", {
        title: "Login",
        activePage: "login",
        error: "Server Error",
        mode: "register",
      });
    }
  });

  app.get("/tables", async (_req, res) => {
    try {
      const response = await fetch("http://localhost:3001/api/get/tables");
      const data = await response.json();
      const tables = data.ok ? data.tables : {};

      res.render("tables", {
        title: "Tables",
        activePage: "tables",
        tables,
      });
    } catch (err) {
      console.error(err);
      res.render("error", {
        title: "Error",
        message: "Error fetching tables",
        tables: [],
      });
    }
  });

  app.get("/crud", async (_req, res) => {
    try {
      const response = await fetch("http://localhost:3001/api/get/tables");
      const data = await response.json();
      const tables = data.ok ? data.tables : {};

      res.render("crud", {
        title: "CRUD",
        activePage: "crud",
        tables,
      });
    } catch (err) {
      console.error(err);
      res.render("error", {
        title: "Error",
        message: "Error fetching tables",
        tables: [],
      });
    }
  });

  app.get("/", async (_req, res) => {
    try {
      const response = await fetch("http://localhost:3001/api/get/tables");
      const data = await response.json();
      const tables = data.ok ? data.tables : {};

      res.render("dashboard", {
        title: "Dashboard",
        activePage: "dashboard",
        tables,
      });
    } catch (err) {
      console.error(err);
      res.render("dashboard", {
        title: "Dashboard",
        activePage: "dashboard",
        tables: {},
      });
    }
  });

  app.get(/(.*)/, (_req, res) => {
    res.redirect("/");
  });

  return app;
}
