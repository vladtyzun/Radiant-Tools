import bcrypt from "bcryptjs";
import * as readline from "readline";

const SALT_ROUNDS = 12;

async function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const fromArgv = process.argv[2];
  const password = fromArgv || (await promptHidden("Password to hash: "));

  if (!password) {
    console.error("No password provided.");
    process.exit(1);
  }

  if (fromArgv) {
    console.warn(
      "Warning: passing password on the command line may store it in shell history. Prefer running without arguments for a prompt."
    );
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const escaped = hash.replace(/\$/g, "\\$");
  console.log("\nAdd to .env.local (never commit this file):\n");
  console.log(`AUTH_PASSWORD_HASH=${escaped}\n`);
  console.log(
    "Backslash each $ in the hash — Next/dotenv expand strips unescaped $ from values."
  );
  console.log(
    "Also set AUTH_SECRET to a random string of 32+ characters (openssl rand -base64 32)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
