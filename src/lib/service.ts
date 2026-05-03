import { run, runShell } from "./utils"
import { CORE, CORE_BIN, CONFIG_JSON, CONF_DIR, LOG_DIR, CORE_DIR } from "./constants"

export type ServiceStatus = "running" | "stopped" | "unknown"

export async function getServiceStatus(): Promise<ServiceStatus> {
  const { stdout } = await runShell(`pgrep -f ${CORE_BIN} 2>/dev/null || grep -l "${CORE_BIN}" /proc/*/cmdline 2>/dev/null`)
  return stdout.length > 0 ? "running" : "stopped"
}

export async function startService(): Promise<boolean> {
  const isSystemd = !!Bun.which("systemctl")
  const isOpenRC = !!Bun.which("rc-service")

  if (isSystemd) {
    const { ok } = await run("systemctl", ["start", CORE])
    return ok
  } else if (isOpenRC) {
    const { ok } = await run("rc-service", [CORE, "start"])
    return ok
  }
  return false
}

export async function stopService(): Promise<boolean> {
  const isSystemd = !!Bun.which("systemctl")
  const isOpenRC = !!Bun.which("rc-service")

  if (isSystemd) {
    const { ok } = await run("systemctl", ["stop", CORE])
    return ok
  } else if (isOpenRC) {
    const { ok } = await run("rc-service", [CORE, "stop"])
    return ok
  }
  return false
}

export async function restartService(): Promise<boolean> {
  const isSystemd = !!Bun.which("systemctl")
  const isOpenRC = !!Bun.which("rc-service")

  if (isSystemd) {
    const { ok } = await run("systemctl", ["restart", CORE])
    return ok
  } else if (isOpenRC) {
    const { ok } = await run("rc-service", [CORE, "restart"])
    return ok
  }
  return false
}

export async function enableService(): Promise<boolean> {
  const isSystemd = !!Bun.which("systemctl")
  const isOpenRC = !!Bun.which("rc-service")

  if (isSystemd) {
    const { ok } = await run("systemctl", ["enable", CORE])
    return ok
  } else if (isOpenRC) {
    const { ok } = await run("rc-update", ["add", CORE, "default"])
    return ok
  }
  return false
}

export async function disableService(): Promise<boolean> {
  const isSystemd = !!Bun.which("systemctl")
  const isOpenRC = !!Bun.which("rc-service")

  if (isSystemd) {
    const { ok } = await run("systemctl", ["disable", CORE])
    return ok
  } else if (isOpenRC) {
    const { ok } = await run("rc-update", ["del", CORE, "default"])
    return ok
  }
  return false
}

export async function testRun(): Promise<{ ok: boolean; output: string }> {
  const { ok, stdout, stderr } = await run(CORE_BIN, ["run", "-c", CONFIG_JSON, "-C", CONF_DIR])
  return { ok, output: stderr || stdout }
}

export async function tailLog(lines = 50): Promise<string> {
  const logFile = `${LOG_DIR}/access.log`
  try {
    const content = await Bun.file(logFile).text()
    const allLines = content.trim().split("\n")
    return allLines.slice(-lines).join("\n")
  } catch {
    return "No log file found"
  }
}

export async function checkConfig(): Promise<{ ok: boolean; output: string }> {
  const { ok, stderr, stdout } = await run(CORE_BIN, ["check", "-c", CONFIG_JSON])
  return { ok, output: stderr || stdout }
}

export function ensureDirectories(): void {
  for (const dir of [CORE_DIR, `${CORE_DIR}/bin`, CONF_DIR, LOG_DIR]) {
    try {
      Bun.spawnSync(["mkdir", "-p", dir])
    } catch {}
  }
}

export function isInstalled(): boolean {
  try {
    const proc = Bun.spawnSync(["test", "-f", CORE_BIN])
    return proc.exitCode === 0
  } catch {
    return false
  }
}
