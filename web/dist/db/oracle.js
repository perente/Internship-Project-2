"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConn = getConn;
exports.closePool = closePool;
const oracledb_1 = __importDefault(require("oracledb"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const rootEnv = path_1.default.resolve(process.cwd(), "..", ".env");
if (fs_1.default.existsSync(rootEnv)) {
    dotenv_1.default.config({ path: rootEnv });
}
else {
    dotenv_1.default.config();
}
let pool = null;
async function getPool() {
    if (!pool) {
        pool = await oracledb_1.default.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            connectString: process.env.DB_CONNECT,
            poolMin: 1,
            poolMax: 5,
            poolIncrement: 1
        });
    }
    return pool;
}
async function getConn() {
    const p = await getPool();
    return p.getConnection();
}
async function closePool() {
    if (pool) {
        await pool.close(0);
        pool = null;
    }
}
