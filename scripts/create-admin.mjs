import { execFile } from "node:child_process";
import { randomBytes, pbkdf2 as pbkdf2Callback, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";

const pbkdf2 = promisify(pbkdf2Callback);
const execFileAsync = promisify(execFile);
const PASSWORD_ITERATIONS = 100_000;

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function escapeSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function promptText(question) {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await reader.question(question)).trim();
  } finally {
    reader.close();
  }
}

async function promptPassword(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Pembuatan admin harus dijalankan melalui terminal interaktif.");
  }

  process.stdout.write(question);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    const finish = () => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };

    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === "c") {
        finish();
        reject(new Error("Dibatalkan."));
        return;
      }
      if (key?.name === "return") {
        finish();
        resolve(value);
        return;
      }
      if (key?.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      if (character && !key?.ctrl && !key?.meta) {
        value += character;
        process.stdout.write("*");
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

async function main() {
  const remote = process.argv.includes("--remote");
  const name = await promptText("Nama admin: ");
  const username = (await promptText("Username: ")).toLowerCase();
  const password = await promptPassword("Password (minimal 12 karakter): ");

  if (name.length < 2 || username.length < 3 || password.length < 12) {
    throw new Error("Nama, username, atau password belum memenuhi panjang minimum.");
  }

  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS, 32, "sha256");
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "bdi-admin-"));
  const sqlPath = join(temporaryDirectory, "create-admin.sql");
  const sql = `INSERT INTO admins (
  id, name, username, password_hash, password_salt, password_iterations, role
) VALUES (
  ${escapeSql(randomUUID())},
  ${escapeSql(name)},
  ${escapeSql(username)},
  ${escapeSql(encodeBase64Url(hash))},
  ${escapeSql(encodeBase64Url(salt))},
  ${PASSWORD_ITERATIONS},
  CASE WHEN NOT EXISTS (SELECT 1 FROM admins) THEN 'SUPERADMIN' ELSE 'ADMIN' END
);\n`;

  try {
    await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
    const wrangler = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
    const args = [wrangler, "d1", "execute", "DB"];
    if (remote) {
      args.push("--remote", "--env", "production");
    } else {
      args.push("--local");
    }
    args.push("--file", sqlPath);

    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      windowsHide: true,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.stdout.write(`Admin ${username} berhasil dibuat.\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Pembuatan admin gagal."}\n`);
  process.exitCode = 1;
});
