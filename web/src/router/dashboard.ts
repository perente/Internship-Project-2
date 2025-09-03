import express from "express";
import path from "path";

export function createDashboardServer() {
    const app = express();

    app.use(express.static('public'));
    app.set("views", path.join(__dirname, "../views"));
    app.set("view engine", "ejs");

    app.get("/", async (_req, res) => {
        try {
            const response = await fetch("http://localhost:3001/tables");
            const data = await response.json();

            const tables = data.ok ? data.tables : [];

            res.render("dashboard", {
                title: "Dashboard",
                activePage: "dashboard",
                tables
            });
        } catch (err) {
            console.error(err);
            res.render("dashboard", {
                title: "Dashboard",
                message: "Error fetching tables",
                tables: []
            });
        }
    });

    app.get(/(.*)/, async (_req, res) => {
        res.redirect("/")
    });

    return app;
}
