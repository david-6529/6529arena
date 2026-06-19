import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Wallet } from "ethers";
import {
  default6529SmokeUsername,
  default6529SmokeWalletEnvPath,
  get6529SmokeWalletPublicSummary,
  render6529SmokeWalletEnv,
} from "../src/lib/6529/smoke-wallet";

type CliOptions = {
  force: boolean;
  outputPath: string;
  username: string;
};

function readOptionValue(args: string[], name: string) {
  const exact = args.indexOf(name);
  if (exact >= 0) {
    return args[exact + 1];
  }

  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));

  return inline ? inline.slice(prefix.length) : undefined;
}

function parseArgs(args: string[]): CliOptions {
  return {
    force: args.includes("--force"),
    outputPath: readOptionValue(args, "--output") ?? default6529SmokeWalletEnvPath,
    username: readOptionValue(args, "--username") ?? default6529SmokeUsername,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = resolve(process.cwd(), options.outputPath);

  if (existsSync(outputPath) && !options.force) {
    throw new Error(`${options.outputPath} already exists. Re-run with --force to replace it.`);
  }

  const wallet = Wallet.createRandom();
  const env = render6529SmokeWalletEnv({
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
    username: options.username,
  });

  writeFileSync(outputPath, env, { encoding: "utf8", flag: options.force ? "w" : "wx", mode: 0o600 });
  chmodSync(outputPath, 0o600);

  const summary = get6529SmokeWalletPublicSummary({
    walletAddress: wallet.address,
    username: options.username,
  });

  console.log(
    [
      "Created local 6529 smoke wallet env file.",
      `File: ${options.outputPath}`,
      `Wallet address: ${summary.walletAddress}`,
      `Requested 6529 username: ${summary.username}`,
      "Private key was written only to the local ignored env file.",
      "Do not paste the private key into chat, docs, issues, or commits.",
    ].join("\n"),
  );
}

main();
