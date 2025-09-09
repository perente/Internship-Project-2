import express from "express";
import path from "path";
import session from "express-session";
import cookieParser from "cookie-parser";
import { buildAuthRouter, requireAuth } from "./auth";

export function createDashboardServer() {
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  }));
  app.use(express.static(path.join(__dirname, "../public")));
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "ejs");

  app.use("/", buildAuthRouter());

  app.get("/tables", requireAuth, async (_req, res) => {
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

  app.get("/crud", requireAuth, async (_req, res) => {
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

  app.get("/", requireAuth, async (_req, res) => {
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
