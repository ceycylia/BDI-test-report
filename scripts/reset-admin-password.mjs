import { execFile } from "node:child_process";
import { randomBytes, pbkdf2 as pbkdf2Callback } from "node:crypto";
import { promisify } from "node:util";
import { emitKeypressEvents } from "node:readline";

const pbkdf2 = promisify(pbkdf2Callback);
const execFileAsync = promisify(execFile);

const PASSWORD_ITERATIONS = 100_000;

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function escapeSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function promptPassword(question) {
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
  const username = "admin.uji";
  const remote = process.argv.includes("--remote");
  const password = await promptPassword(
    "Password baru Superadmin (minimal 12 karakter): ",
  );

  if (password.length < 12) {
    throw new Error("Password minimal 12 karakter.");
  }

  const salt = randomBytes(16);

  const hash = await pbkdf2(
    password,
    salt,
    PASSWORD_ITERATIONS,
    32,
    "sha256",
  );

  const sql = `
    UPDATE admins
    SET
      password_hash = ${escapeSql(encodeBase64Url(hash))},
      password_salt = ${escapeSql(encodeBase64Url(salt))},
      password_iterations = ${PASSWORD_ITERATIONS},
      updated_at = CURRENT_TIMESTAMP
    WHERE username = ${escapeSql(username)}
      AND role = 'SUPERADMIN';
  `;

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "bdi-test-db",
      ...(remote ? ["--remote", "--env", "production"] : ["--local"]),
      "--command",
      sql,
    ],
    {
      cwd: process.cwd(),
      windowsHide: true,
    },
  );

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  console.log(`Password ${username} berhasil direset.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
