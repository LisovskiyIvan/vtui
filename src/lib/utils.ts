import { $ } from "bun"

export async function run(cmd: string, args: string[] = []): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  return { ok: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim() }
}

export async function runShell(cmd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const result = await $`${cmd}`.quiet()
    return { ok: result.exitCode === 0, stdout: result.stdout.toString().trim(), stderr: result.stderr.toString().trim() }
  } catch (e: any) {
    return { ok: false, stdout: e?.stdout?.toString()?.trim() ?? "", stderr: e?.stderr?.toString()?.trim() ?? e?.message ?? "" }
  }
}

export function randomPort(): number {
  return Math.floor(Math.random() * (65535 - 445 + 1)) + 445
}

export function randomUUID(): string {
  return crypto.randomUUID()
}

export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}
