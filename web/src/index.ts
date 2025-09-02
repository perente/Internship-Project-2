import { createApiServer } from "./router/api";
import { createDashboardServer } from "./router/dashboard";

const apiPort = 3001;
const dashboardPort = 3000;

const apiServer = createApiServer().listen(apiPort, () => {
  console.log(`API server up on :${apiPort}`);
});

const dashboardServer = createDashboardServer().listen(dashboardPort, () => {
  console.log(`Dashboard server up on :${dashboardPort}`);
});

for (const sig of ["SIGINT", "SIGTERM", "SIGQUIT"] as const) {
  process.on(sig, () => {
    apiServer.close();
    dashboardServer.close();
    process.exit(0);
  });
}
