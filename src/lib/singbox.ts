import { CORE_BIN, CONF_DIR, CONFIG_JSON } from "./constants"
import { run, runShell, randomPort, randomUUID, randomItem } from "./utils"
import { SERVER_NAMES, PROTOCOLS, type Protocol } from "./constants"

export interface InboundConfig {
  file: string
  tag: string
  protocol: string
  port: number
  uuid?: string
  password?: string
  method?: string
  network?: string
  host?: string
  path?: string
  tls?: string
  serverName?: string
  publicKey?: string
  privateKey?: string
  flow?: string
  alpn?: string
  remoteAddr?: string
  remotePort?: number
  username?: string
  anytlsDomain?: string
}

export async function getCoreVersion(): Promise<string> {
  const { stdout } = await run(CORE_BIN, ["version"])
  return stdout.split("\n")[0]?.split(" ")[2] ?? "unknown"
}

export async function getServerIP(): Promise<string> {
  try {
    const { stdout } = await runShell(`wget --no-check-certificate -4 -qO- https://one.one.one.one/cdn-cgi/trace 2>/dev/null | grep ip=`)
    const match = stdout.match(/ip=(.+)/)
    if (match?.[1]) return match[1]
  } catch {}
  try {
    const { stdout } = await runShell(`wget --no-check-certificate -6 -qO- https://one.one.one.one/cdn-cgi/trace 2>/dev/null | grep ip=`)
    const match = stdout.match(/ip=(.+)/)
    if (match?.[1]) return match[1]
  } catch {}
  return "127.0.0.1"
}

export async function isPortUsed(port: number): Promise<boolean> {
  const { stdout } = await runShell(`ss -tunlp 2>/dev/null | grep ':${port} ' || netstat -tunlp 2>/dev/null | grep ':${port} '`)
  return stdout.length > 0
}

export async function getAvailablePort(): Promise<number> {
  for (let i = 0; i < 233; i++) {
    const port = randomPort()
    if (!(await isPortUsed(port))) return port
  }
  throw new Error("Failed to find available port after 233 attempts")
}

export async function getAvailablePortExcluding(exclude: number): Promise<number> {
  for (let i = 0; i < 233; i++) {
    const port = randomPort()
    if (port !== exclude && !(await isPortUsed(port))) return port
  }
  throw new Error("Failed to find available port after 233 attempts")
}

export async function generateRealityKeypair(): Promise<{ privateKey: string; publicKey: string }> {
  const { stdout } = await run(CORE_BIN, ["generate", "reality-keypair"])
  const lines = stdout.split("\n")
  return {
    privateKey: lines[0]?.replace("PrivateKey: ", "").trim() ?? "",
    publicKey: lines[1]?.replace("PublicKey: ", "").trim() ?? "",
  }
}

export async function generateSS2022Password(method: string): Promise<string> {
  const bytes = method.includes("128") ? 16 : 32
  const { stdout } = await run(CORE_BIN, ["generate", "rand", String(bytes), "--base64"])
  return stdout.trim()
}

export function listConfigFiles(): string[] {
  try {
    const proc = Bun.spawnSync(["ls", CONF_DIR])
    const stdout = proc.stdout ? Buffer.from(proc.stdout).toString() : ""
    const entries = stdout.split("\n").filter(Boolean)
    return entries.filter((f: string) => f.endsWith(".json"))
  } catch {
    return []
  }
}

export function readConfig(fileName: string): any {
  const content = Bun.file(`${CONF_DIR}/${fileName}`).text()
  return content.then(JSON.parse)
}

export function writeConfig(fileName: string, data: any): void {
  Bun.write(`${CONF_DIR}/${fileName}`, JSON.stringify(data, null, 2))
}

export function deleteConfig(fileName: string): void {
  try {
    Bun.spawnSync(["rm", "-f", `${CONF_DIR}/${fileName}`])
  } catch {}
}

export async function readMainConfig(): Promise<any> {
  const content = await Bun.file(CONFIG_JSON).text()
  return JSON.parse(content)
}

export function writeMainConfig(data: any): void {
  Bun.write(CONFIG_JSON, JSON.stringify(data, null, 2))
}

export async function parseInboundConfig(fileName: string): Promise<InboundConfig | null> {
  try {
    const json = await readConfig(fileName)
    const inbound = json?.inbounds?.[0]
    if (!inbound) return null

    const config: InboundConfig = {
      file: fileName,
      tag: inbound.tag ?? fileName,
      protocol: inbound.type,
      port: inbound.listen_port,
      uuid: inbound.users?.[0]?.uuid,
      password: inbound.users?.[0]?.password ?? inbound.password,
      method: inbound.method,
      network: inbound.transport?.type,
      host: inbound.transport?.headers?.host ?? inbound.tls?.server_name,
      path: inbound.transport?.path,
      tls: inbound.tls?.enabled ? "tls" : undefined,
      serverName: inbound.tls?.server_name,
      privateKey: inbound.tls?.reality?.private_key,
      publicKey: undefined,
      flow: inbound.users?.[0]?.flow,
      alpn: inbound.tls?.alpn?.join(","),
      remoteAddr: inbound.override_address,
      remotePort: inbound.override_port,
      username: inbound.users?.[0]?.username,
    }

    if (inbound.tls?.reality) {
      config.tls = "reality"
      const outboundTag = json?.outbounds?.find((o: any) => o.tag?.startsWith("public_key_"))
      config.publicKey = outboundTag?.tag?.replace("public_key_", "") ?? ""
    }

    if (inbound.tls?.certificate_provider?.domain?.[0]) {
      config.anytlsDomain = inbound.tls.certificate_provider.domain[0]
    } else if (inbound.tls?.acme?.domain?.[0]) {
      config.anytlsDomain = inbound.tls.acme.domain[0]
    }

    return config
  } catch {
    return null
  }
}

export async function getConfigURL(config: InboundConfig, ip: string): Promise<string | null> {
  const addr = config.host ?? (ip.includes(":") ? `[${ip}]` : ip)
  const port = config.port

  switch (config.protocol) {
    case "vmess": {
      const v2 = {
        v: 2,
        ps: `233boy-${config.network}-${config.host ?? ip}`,
        add: addr,
        port,
        id: config.uuid,
        aid: "0",
        net: config.network,
        type: "none",
        host: config.host ?? "",
        path: config.path ?? "",
        tls: config.tls === "tls" ? "tls" : "",
      }
      return `vmess://${btoa(JSON.stringify(v2))}`
    }
    case "vless": {
      const params = new URLSearchParams()
      params.set("encryption", "none")
      params.set("security", config.tls ?? "none")
      if (config.flow) params.set("flow", config.flow)
      params.set("type", config.network ?? "tcp")
      if (config.serverName) params.set("sni", config.serverName)
      if (config.publicKey) params.set("pbk", config.publicKey)
      params.set("fp", "chrome")
      return `vless://${config.uuid}@${addr}:${port}?${params.toString()}#233boy-${config.tls ?? config.network}-${config.host ?? ip}`
    }
    case "trojan": {
      const pass = config.password ?? config.uuid
      const params = new URLSearchParams()
      params.set("type", config.network ?? "tcp")
      params.set("security", config.tls ?? "tls")
      if (config.host) params.set("host", config.host)
      if (config.path) params.set("path", config.path)
      return `trojan://${pass}@${addr}:${port}?${params.toString()}#233boy-${config.network}-${config.host ?? ip}`
    }
    case "hysteria2": {
      const params = new URLSearchParams()
      params.set("insecure", "1")
      params.set("alpn", "h3")
      return `hysteria2://${config.password}@${addr}:${port}?${params.toString()}#233boy-hy2-${ip}`
    }
    case "tuic": {
      const params = new URLSearchParams()
      params.set("alpn", "h3")
      params.set("allow_insecure", "1")
      params.set("congestion_control", "bbr")
      return `tuic://${config.uuid}:${config.password}@${addr}:${port}?${params.toString()}#233boy-tuic-${ip}`
    }
    case "shadowsocks": {
      const userInfo = btoa(`${config.method}:${config.password}`)
      return `ss://${userInfo}@${addr}:${port}#233boy-ss-${ip}`
    }
    case "anytls": {
      const domain = config.anytlsDomain ?? addr
      const params: string[] = []
      if (!config.anytlsDomain) params.push("allowInsecure=1")
      const paramStr = params.length ? `?${params.join("&")}` : ""
      return `anytls://${config.password}@${domain}:${port}${paramStr}#233boy-anytls-${domain}`
    }
    case "socks": {
      const userInfo = btoa(`${config.username}:${config.password}`)
      return `socks://${userInfo}@${addr}:${port}#233boy-socks-${ip}`
    }
    default:
      return null
  }
}

export function resolveProtocolAlias(input: string): Protocol | null {
  const lower = input.toLowerCase()
  const aliases: Record<string, Protocol> = {
    r: "VLESS-REALITY",
    reality: "VLESS-REALITY",
    rh2: "VLESS-HTTP2-REALITY",
    ws: "VMess-WS",
    tcp: "VMess-TCP",
    http: "VMess-HTTP",
    quic: "VMess-QUIC",
    wss: "VMess-WS-TLS",
    h2: "VMess-H2-TLS",
    hu: "VMess-HTTPUpgrade-TLS",
    vws: "VLESS-WS-TLS",
    vh2: "VLESS-H2-TLS",
    vhu: "VLESS-HTTPUpgrade-TLS",
    tws: "Trojan-WS-TLS",
    th2: "Trojan-H2-TLS",
    thu: "Trojan-HTTPUpgrade-TLS",
    ss: "Shadowsocks",
    tuic: "TUIC",
    hy: "Hysteria2",
    hy2: "Hysteria2",
    trojan: "Trojan",
    anytls: "AnyTLS",
    socks: "Socks",
  }
  if (aliases[lower]) return aliases[lower]
  const found = PROTOCOLS.find((p) => p.toLowerCase() === lower)
  return found ?? null
}

export async function buildInboundJSON(
  protocol: Protocol,
  opts: {
    port: number
    uuid: string
    password?: string
    host?: string
    path?: string
    method?: string
    serverName?: string
    privateKey?: string
    publicKey?: string
    anytlsDomain?: string
    remoteAddr?: string
    remotePort?: number
    socksUser?: string
    socksPass?: string
  },
): Promise<{ inbound: any; extraOutbound?: any }> {
  const proto = protocol.toLowerCase()
  const tag = `${proto}-${opts.host ?? opts.port}.json`
  let listen = '"::"'
  let extraOutbound: any = undefined

  if (opts.host) listen = '"127.0.0.1"'

  let inbound: any = { tag, listen_port: opts.port }
  let _jsonStr = ""

  const coreVer = await getCoreVersion()
  const verParts = coreVer.replace("v", "").split(".").map(Number)
  const _coreMajor = verParts[0] ?? 0
  const coreMinor = verParts[1] ?? 0

  if (proto.startsWith("vmess")) {
    inbound.type = "vmess"
    const netType = proto.includes("ws") ? "ws" : proto.includes("tcp") ? "tcp" : (proto.includes("http") && !proto.includes("upgrade")) ? "http" : proto.includes("quic") ? "quic" : proto.includes("h2") ? "h2" : "tcp"

    if (proto.includes("tls") && opts.host) {
      inbound.listen = JSON.parse(listen)
      const transportPath = opts.path ?? `/${opts.uuid}`
      const transportType = netType === "ws" ? "ws" : netType === "h2" ? "http" : netType
      inbound.transport = { type: transportType, path: transportPath, headers: { host: opts.host } }
      if (netType === "ws") inbound.transport.early_data_header_name = "Sec-WebSocket-Protocol"
      inbound.tls = { enabled: true }
      inbound.users = [{ uuid: opts.uuid }]
    } else if (netType === "quic") {
      inbound.users = [{ uuid: opts.uuid }]
      inbound.tls = { enabled: true, alpn: ["h3"] }
      inbound.transport = { type: "quic" }
    } else if (netType === "ws") {
      inbound.users = [{ uuid: opts.uuid }]
      inbound.transport = { type: "ws", early_data_header_name: "Sec-WebSocket-Protocol" }
    } else if (netType === "http") {
      inbound.users = [{ uuid: opts.uuid }]
      inbound.transport = { type: "http" }
    } else {
      inbound.users = [{ uuid: opts.uuid }]
    }
  } else if (proto.startsWith("vless")) {
    inbound.type = "vless"
    if (proto.includes("reality")) {
      const sni = opts.serverName ?? randomItem(SERVER_NAMES)
      const pbk = opts.publicKey && opts.privateKey ? { privateKey: opts.privateKey, publicKey: opts.publicKey } : await generateRealityKeypair()
      inbound.tls = {
        enabled: true,
        server_name: sni,
        reality: {
          enabled: true,
          handshake: { server: sni, server_port: 443 },
          private_key: pbk.privateKey,
          short_id: [""],
        },
      }
      if (proto.includes("http2") || proto.includes("http")) {
        inbound.transport = { type: "http" }
        inbound.users = [{ uuid: opts.uuid }]
      } else {
        inbound.users = [{ flow: "xtls-rprx-vision", uuid: opts.uuid }]
      }
      extraOutbound = { tag: `public_key_${pbk.publicKey}`, type: "direct" }
    } else if (proto.includes("tls") && opts.host) {
      inbound.listen = JSON.parse(listen)
      const transportType = proto.includes("ws") ? "ws" : proto.includes("h2") ? "http" : "httpupgrade"
      const transportPath = opts.path ?? `/${opts.uuid}`
      inbound.transport = { type: transportType, path: transportPath, headers: { host: opts.host } }
      if (transportType === "ws") inbound.transport.early_data_header_name = "Sec-WebSocket-Protocol"
      inbound.tls = { enabled: true }
      inbound.users = [{ uuid: opts.uuid }]
    }
  } else if (proto === "tuic") {
    inbound.type = "tuic"
    inbound.users = [{ uuid: opts.uuid, password: opts.password ?? opts.uuid }]
    inbound.congestion_control = "bbr"
    inbound.tls = { enabled: true, alpn: ["h3"] }
  } else if (proto === "trojan") {
    inbound.type = "trojan"
    if (opts.host && proto.includes("tls")) {
      inbound.listen = JSON.parse(listen)
      inbound.transport = { type: proto.includes("ws") ? "ws" : proto.includes("h2") ? "http" : "httpupgrade", path: opts.path ?? `/${opts.uuid}`, headers: { host: opts.host } }
      inbound.tls = { enabled: true }
    } else {
      inbound.tls = { enabled: true }
    }
    inbound.users = [{ password: opts.password ?? opts.uuid }]
  } else if (proto === "hysteria2") {
    inbound.type = "hysteria2"
    inbound.users = [{ password: opts.password ?? opts.uuid }]
    inbound.tls = { enabled: true, alpn: ["h3"] }
  } else if (proto === "shadowsocks") {
    inbound.type = "shadowsocks"
    inbound.method = opts.method ?? "2022-blake3-aes-256-gcm"
    inbound.password = opts.password ?? await generateSS2022Password(inbound.method)
  } else if (proto === "anytls") {
    inbound.type = "anytls"
    inbound.users = [{ password: opts.password ?? opts.uuid }]
    if (opts.anytlsDomain) {
      if (coreMinor >= 14) {
        inbound.tls = { enabled: true, certificate_provider: { type: "acme", domain: [opts.anytlsDomain] } }
      } else {
        inbound.tls = { enabled: true, acme: { domain: [opts.anytlsDomain] } }
      }
    } else {
      inbound.tls = { enabled: true }
    }
  } else if (proto === "socks") {
    inbound.type = "socks"
    inbound.users = [{ username: opts.socksUser ?? "user", password: opts.socksPass ?? opts.uuid }]
  }

  return { inbound, extraOutbound }
}

export async function addConfig(
  protocol: Protocol,
  opts: {
    port?: number
    uuid?: string
    password?: string
    host?: string
    path?: string
    method?: string
    serverName?: string
    privateKey?: string
    publicKey?: string
    anytlsDomain?: string
    remoteAddr?: string
    remotePort?: number
    socksUser?: string
    socksPass?: string
  } = {},
): Promise<string> {
  const port = opts.port ?? (await getAvailablePort())
  const uuid = opts.uuid ?? randomUUID()
  const proto = protocol.toLowerCase()

  const { inbound, extraOutbound } = await buildInboundJSON(protocol, { port, uuid, ...opts })

  const configName = opts.host ? `${proto}-${opts.host}.json` : inbound.type === "anytls" && opts.anytlsDomain ? `${proto}-${opts.anytlsDomain}.json` : `${proto}-${port}.json`

  const config: any = {
    inbounds: [inbound],
    outbounds: [{ tag: "direct", type: "direct" }],
  }
  if (extraOutbound) config.outbounds.push(extraOutbound)

  writeConfig(configName, config)
  return configName
}
