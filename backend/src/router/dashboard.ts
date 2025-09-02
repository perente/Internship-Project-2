import express from "express";
import path from "path";

export function createDashboardServer() {
    const app = express();

    // EJS ayarları
    app.set("views", path.join(__dirname, "../views"));
    app.set("view engine", "ejs");

    app.get("/", (_req, res) => {
        res.render("main", { title: "Dashboard", message: "Hello World!" });
    });

    return app;
}
