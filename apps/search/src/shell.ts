import { spawn } from "node:child_process";

export function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `git ${args.join(" ")} failed with exit code ${code ?? "unknown"}: ${stderr.trim()}`
        )
      );
    });
  });
}
