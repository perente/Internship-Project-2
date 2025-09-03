import oracledb from "oracledb";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

let pool: oracledb.Pool | null = null;

async function getPool(): Promise<oracledb.Pool> {
  if (!pool) {
    pool = await oracledb.createPool({
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

export async function getConn() {
  const p = await getPool();
  return p.getConnection();
}

export async function closePool() {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}
