"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./router/api");
const dashboard_1 = require("./router/dashboard");
const apiPort = 3001;
const dashboardPort = 3000;
const apiServer = (0, api_1.createApiServer)().listen(apiPort, () => {
    console.log(`API server up on :${apiPort}`);
});
const dashboardServer = (0, dashboard_1.createDashboardServer)().listen(dashboardPort, () => {
    console.log(`Dashboard server up on :${dashboardPort}`);
});
for (const sig of ["SIGINT", "SIGTERM", "SIGQUIT"]) {
    process.on(sig, () => {
        apiServer.close();
        dashboardServer.close();
        process.exit(0);
    });
}
