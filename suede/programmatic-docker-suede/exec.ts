/// <reference types="node" />
import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** Promisified version of `child_process.execFile`. */
export const execFileAsync = promisify(execFile);

/**
 * Run an executable with arguments, returning stdout and stderr.
 * @param command - The executable to run. Example: "docker"
 * @param args - Arguments to pass to the executable. Example: ["run", "--rm", "node:20"]
 * @param cwd - Working directory for the process. Default: process.cwd()
 */
export const runCmd = async (
  command: string,
  args: string[],
  cwd?: string,
  maxBuffer = 16 * 1024 * 1024,
) =>
  execFileAsync(command, args, {
    cwd,
    maxBuffer,
  });

export type CmdResult = Awaited<ReturnType<typeof runCmd>>;

export type ExitedCmdResult = CmdResult & { exitCode: number };

export type ExitedCmdBufferResult = Pick<
  ExitedCmdResult,
  "stderr" | "exitCode"
> & { stdout: Buffer };

/**
 * Run a command and always resolve with text output + exit code.
 * Does not throw on non-zero exit codes.
 * @param stdin - Optional string to write to the process stdin.
 */
export const runCmdWithResult = (
  command: string,
  args: string[],
  {
    cwd,
    maxBuffer = 16 * 1024 * 1024,
    stdin,
  }: { cwd?: string; maxBuffer?: number; stdin?: string } = {},
): Promise<ExitedCmdResult> =>
  new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      { cwd, maxBuffer, encoding: "buffer" },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ? Buffer.from(stdout).toString("utf-8") : "",
          stderr: stderr ? Buffer.from(stderr).toString("utf-8") : "",
          exitCode: error ? ((error as any).code ?? 1) : 0,
        });
      },
    );
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });

/**
 * Run a command and always resolve with raw Buffer stdout + exit code.
 * Does not throw on non-zero exit codes.
 */
export const runCmdWithBufferResult = (
  command: string,
  args: string[],
  cwd?: string,
  maxBuffer = 64 * 1024 * 1024,
): Promise<ExitedCmdBufferResult> =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd, maxBuffer, encoding: "buffer" },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ? Buffer.from(stdout) : Buffer.alloc(0),
          stderr: stderr ? Buffer.from(stderr).toString("utf-8") : "",
          exitCode: error ? ((error as any).code ?? 1) : 0,
        });
      },
    );
  });
