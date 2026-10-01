import { execFile } from "node:child_process";
import {
  randomBytes,
  randomUUID,
  pbkdf2 as pbkdf2Callback,
} from "node:crypto";
import { promisify } from "node:util";
import { createInterface, emitKeypressEvents } from "node:readline";

const pbkdf2 = promisify(pbkdf2Callback);
const execFileAsync = promisify(execFile);

const PASSWORD_ITERATIONS = 100_000;

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function escapeSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function promptText(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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
  const name = await promptText("Nama Superadmin: ");
  const username = await promptText("Username Superadmin: ");

  if (!name) {
    throw new Error("Nama wajib diisi.");
  }

  if (!username) {
    throw new Error("Username wajib diisi.");
  }

  const password = await promptPassword(
    "Password Superadmin (minimal 12 karakter): ",
  );

  if (password.length < 12) {
    throw new Error("Password minimal 12 karakter.");
  }

  const confirmation = await promptPassword(
    "Ulangi password Superadmin: ",
  );

  if (password !== confirmation) {
    throw new Error("Konfirmasi password tidak sama.");
  }

  const id = randomUUID();
  const salt = randomBytes(16);

  const hash = await pbkdf2(
    password,
    salt,
    PASSWORD_ITERATIONS,
    32,
    "sha256",
  );

  const sql = `
    INSERT INTO admins (
      id,
      name,
      username,
      password_hash,
      password_salt,
      password_iterations,
      is_active,
      role
    )
    VALUES (
      ${escapeSql(id)},
      ${escapeSql(name)},
      ${escapeSql(username)},
      ${escapeSql(encodeBase64Url(hash))},
      ${escapeSql(encodeBase64Url(salt))},
      ${PASSWORD_ITERATIONS},
      1,
      'SUPERADMIN'
    );
  `;

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "bdi-test-db-production",
      "--remote",
      "--env",
      "production",
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

  console.log("");
  console.log("SUPERADMIN production berhasil dibuat.");
  console.log(`Nama     : ${name}`);
  console.log(`Username : ${username}`);
  console.log("Role     : SUPERADMIN");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
