import express from "express";
import path from "path";
import session from "express-session";
import cookieParser from "cookie-parser";
import { buildAuthRouter, requireAuth } from "./auth";

async function fetchMe(req: any) {
  const resp = await fetch("http://localhost:3001/api/auth/me", {
    headers: { cookie: req.headers.cookie || "" },
  });
  const data = await resp.json();
  return data.ok ? data.user : null;
}

export function createDashboardServer() {
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: "super-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
      },
    })
  );
  app.use(express.static(path.join(__dirname, "../public")));
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "ejs");

  app.use("/", buildAuthRouter());

  app.get("/tables", requireAuth, async (req, res) => {
    try {
      const response = await fetch("http://localhost:3001/api/get/tables");
      const data = await response.json();
      const tables = data.ok ? data.tables : {};

      res.render("tables", {
        title: "Tables",
        activePage: "tables",
        tables,
        user: req.user,
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

  app.get("/crud", requireAuth, async (req, res) => {
    try {
      const response = await fetch("http://localhost:3001/api/get/tables");
      const data = await response.json();
      const tables = data.ok ? data.tables : {};

      res.render("crud", {
        title: "CRUD",
        activePage: "crud",
        tables,
        user: req.user,
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

  app.get("/settings", requireAuth, async (req: any, res) => {
    try {
      const ok = typeof req.query.ok === "string" ? req.query.ok : null;
      const error =
        typeof req.query.error === "string" ? req.query.error : null;

      const freshUser = await fetchMe(req); 

      res.render("settings", {
        title: "Settings",
        activePage: "settings",
        user: freshUser || req.user, 
        ok,
        error,
        success: null,
      });
    } catch (err) {
      console.error(err);
      res.render("error", {
        title: "Error",
        message: "Error fetching profile settings",
        tables: [],
      });
    }
  });

  app.get("/about", requireAuth, async (req: any, res) => {
    try {
      const freshUser = await fetchMe(req);

      res.render("about", {
        title: "About Us",
        activePage: "about",
        user: freshUser || req.user
      });
    } catch (err) {
      console.error(err);
      res.render("error", {
        title: "Error",
        message: "Error fetching profile settings",
        tables: [],
      });
    }
  });

  app.get("/", requireAuth, async (req: any, res) => {
    try {
      const freshUser = await fetchMe(req);
      const response = await fetch("http://localhost:3001/api/get/tables");
      const data = await response.json();
      const tables = data.ok ? data.tables : {};

      res.render("dashboard", {
        title: "Dashboard",
        activePage: "dashboard",
        tables,
        user: freshUser || req.user,
      });
    } catch (err) {
      console.error(err);
      res.render("dashboard", {
        title: "Dashboard",
        activePage: "dashboard",
        tables: {},
        user: req.user,
      });
    }
  });

  app.get(/(.*)/, (req, res) => {
    res.redirect("/");
  });

  return app;
}
