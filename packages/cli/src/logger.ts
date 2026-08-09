// Простой логгер с уровнями и записью в файл.
import fs from "fs";
import path from "path";

const LOG_FILE = path.join(__dirname, '..', 'data', 'app.log');

function ensureDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function write(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', msg: string, meta?: unknown) {
  ensureDir();
  const ts = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false }).replace(',', '');
  const line = `[${ts}] [${level}] ${msg}` +
    (meta ? ' ' + JSON.stringify(meta) : '');
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const info = (m: string, meta?: unknown) => write('INFO', m, meta);
const warn = (m: string, meta?: unknown) => write('WARN', m, meta);
const error = (m: string, meta?: unknown) => write('ERROR', m, meta);
const debug = (m: string, meta?: unknown) => process.env.DEBUG && write('DEBUG', m, meta);

export default { info, warn, error, debug };
