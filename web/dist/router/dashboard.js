"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashboardServer = createDashboardServer;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
function createDashboardServer() {
    const app = (0, express_1.default)();
    const publicDir = path_1.default.join(__dirname, "..", "public"); // projeKök/public
    app.use(express_1.default.static(publicDir));
    app.set("views", path_1.default.join(__dirname, "../views"));
    app.set("view engine", "ejs");
    app.get("/", async (_req, res) => {
        res.render("dashboard", {
            title: "Dashboard",
            activePage: "dashboard"
        });
    });
    app.get("/tables", async (_req, res) => {
        try {
            const response = await fetch("http://localhost:3001/api/get/tables");
            const data = await response.json();
            const tables = data.ok ? data.tables : [];
            res.render("tables", {
                title: "Tables",
                activePage: "tables",
                tables
            });
        }
        catch (err) {
            console.error(err);
            res.render("error", {
                title: "Error",
                message: "Error fetching tables",
                tables: []
            });
        }
    });
    app.get(/(.*)/, async (_req, res) => {
        res.redirect("/");
    });
    return app;
}
