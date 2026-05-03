import { useState, useCallback, useEffect } from "react"
import { createCliRenderer, TextAttributes } from "@opentui/core"
import { createRoot, useKeyboard } from "@opentui/react"
import type { SelectOption } from "@opentui/core"
import {
  PROTOCOLS, type Protocol,
  SS_METHODS, SERVER_NAMES, DNS_SERVERS,
} from "./lib"
import type { InboundConfig } from "./lib/singbox"
import {
  getCoreVersion, getServerIP,
  listConfigFiles,
  deleteConfig, readMainConfig, writeMainConfig, parseInboundConfig,
  getConfigURL, addConfig,
  getServiceStatus, startService, stopService, restartService,
  testRun, tailLog,
  isInstalled, randomItem,
} from "./lib"

type Screen = "main" | "add" | "add-form" | "info" | "info-detail" | "delete" | "manage" | "dns" | "log" | "about" | "status" | "url"

const MAIN_MENU_ITEMS: SelectOption[] = [
  { name: "Add Config", description: "Add a new inbound configuration" },
  { name: "View Configs", description: "View all configurations" },
  { name: "Delete Config", description: "Remove a configuration" },
  { name: "Service", description: "Start / Stop / Restart sing-box" },
  { name: "DNS", description: "Configure DNS" },
  { name: "Logs", description: "View logs" },
  { name: "Status", description: "Service & core status" },
  { name: "About", description: "About vpntui" },
  { name: "Exit", description: "Quit the application" },
]

function Header({ version, status, ip }: { version: string; status: string; ip: string }) {
  return (
    <box flexDirection="column" alignItems="center" marginBottom={1}>
      <text fg="cyan" attributes={TextAttributes.BOLD}>sing-box TUI Manager</text>
      <box flexDirection="row" gap={2}>
        <text fg="#888">v{version}</text>
        <text fg={status === "running" ? "green" : "red"}>● {status}</text>
        <text fg="#666">IP: {ip}</text>
      </box>
    </box>
  )
}

function Footer({ text }: { text: string }) {
  return (
    <box marginTop={1} alignItems="center">
      <text fg="#555">{text}</text>
    </box>
  )
}

function useAsync<T>(fn: () => Promise<T>, deps: any[] = []): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [counter, setCounter] = useState(0)

  const refresh = useCallback(() => setCounter((c) => c + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fn()
      .then((result) => { if (!cancelled) setData(result) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [...deps, counter])

  return { data, loading, error, refresh }
}

function App() {
  const [screen, setScreen] = useState<Screen>("main")
  const [prevScreen, setPrevScreen] = useState<Screen>("main")
  const [statusMsg, setStatusMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const serverInfo = useAsync(async () => {
    const [ip, version, status] = await Promise.all([
      getServerIP(), getCoreVersion(), getServiceStatus(),
    ])
    return { ip, version, status }
  }, [screen])

  const configs = useAsync(async () => {
    const files = listConfigFiles()
    const result: InboundConfig[] = []
    for (const file of files) {
      const config = await parseInboundConfig(file)
      if (config) result.push(config)
    }
    return result
  }, [screen])

  const navigate = useCallback((s: Screen) => {
    setPrevScreen(screen)
    setScreen(s)
    setErrorMsg(null)
    setStatusMsg("")
  }, [screen])

  const goBack = useCallback(() => {
    setScreen(prevScreen === screen ? "main" : prevScreen)
    setErrorMsg(null)
  }, [prevScreen, screen])

  useKeyboard((key) => {
    if (key.name === "escape" && screen !== "main") {
      goBack()
    }
  })

  const renderScreen = () => {
    switch (screen) {
      case "main":
        return (
          <MainMenuScreen
            version={serverInfo.data?.version ?? "..."}
            status={serverInfo.data?.status ?? "unknown"}
            ip={serverInfo.data?.ip ?? "..."}
            onSelect={(index) => {
              switch (index) {
                case 0: navigate("add"); break
                case 1: navigate("info"); break
                case 2: navigate("delete"); break
                case 3: navigate("manage"); break
                case 4: navigate("dns"); break
                case 5: navigate("log"); break
                case 6: navigate("status"); break
                case 7: navigate("about"); break
                case 8: process.exit(0)
              }
            }}
          />
        )
      case "add":
        return (
          <AddConfigScreen
            onAdd={async (protocol, opts) => {
              try {
                const fileName = await addConfig(protocol, opts)
                await restartService()
                setStatusMsg(`Added: ${fileName}`)
                navigate("info")
              } catch (e: any) {
                setErrorMsg(e.message)
              }
            }}
            onBack={() => navigate("main")}
          />
        )
      case "info":
        return (
          <InfoScreen
            configs={configs.data ?? []}
            ip={serverInfo.data?.ip ?? ""}
            onSelect={(config) => {
              setStatusMsg(config.file)
              navigate("info-detail")
            }}
            onBack={() => navigate("main")}
          />
        )
      case "info-detail":
        return (
          <InfoDetailScreen
            configs={configs.data ?? []}
            selectedFile={statusMsg}
            ip={serverInfo.data?.ip ?? ""}
            onBack={() => navigate("info")}
          />
        )
      case "delete":
        return (
          <DeleteScreen
            configs={configs.data ?? []}
            onDelete={async (file) => {
              try {
                deleteConfig(file)
                await restartService()
                setStatusMsg(`Deleted: ${file}`)
                configs.refresh()
              } catch (e: any) {
                setErrorMsg(e.message)
              }
            }}
            onBack={() => navigate("main")}
          />
        )
      case "manage":
        return (
          <ManageScreen
            status={serverInfo.data?.status ?? "unknown"}
            version={serverInfo.data?.version ?? "..."}
            onAction={async (action) => {
              try {
                switch (action) {
                  case "start": await startService(); setStatusMsg("Started"); break
                  case "stop": await stopService(); setStatusMsg("Stopped"); break
                  case "restart": await restartService(); setStatusMsg("Restarted"); break
                  case "test": {
                    const result = await testRun()
                    setStatusMsg(result.ok ? "Test passed" : `Test failed: ${result.output}`)
                    break
                  }
                }
                serverInfo.refresh()
              } catch (e: any) {
                setErrorMsg(e.message)
              }
            }}
            onBack={() => navigate("main")}
          />
        )
      case "dns":
        return (
          <DNSScreen
            onSet={async (dns) => {
              try {
                const mainConfig = await readMainConfig()
                if (dns === "none") {
                  mainConfig.dns = { disabled: true }
                } else {
                  mainConfig.dns = {
                    servers: [
                      { tag: "dns", address: dns, address_resolver: "local" },
                      { tag: "local", address: "local" },
                    ],
                  }
                }
                writeMainConfig(mainConfig)
                await restartService()
                setStatusMsg(`DNS set to: ${dns}`)
                serverInfo.refresh()
              } catch (e: any) {
                setErrorMsg(e.message)
              }
            }}
            onBack={() => navigate("main")}
          />
        )
      case "log":
        return (
          <LogScreen onBack={() => navigate("main")} />
        )
      case "status":
        return (
          <StatusScreen
            version={serverInfo.data?.version ?? "..."}
            status={serverInfo.data?.status ?? "unknown"}
            ip={serverInfo.data?.ip ?? "..."}
            configs={configs.data ?? []}
            onBack={() => navigate("main")}
          />
        )
      case "about":
        return (
          <AboutScreen onBack={() => navigate("main")} />
        )
      default:
        return <text>Unknown screen</text>
    }
  }

  return (
    <box flexGrow={1} flexDirection="column" padding={1}>
      {renderScreen()}
      {errorMsg && <text fg="red">Error: {errorMsg}</text>}
      {statusMsg && screen !== "info-detail" && <text fg="green">{statusMsg}</text>}
      <Footer text="ESC: Back | ↑↓: Navigate | Enter: Select | q: Quit" />
    </box>
  )
}

function MainMenuScreen({ version, status, ip, onSelect }: {
  version: string; status: string; ip: string
  onSelect: (index: number) => void
}) {
  useKeyboard((key) => {
    if (key.name === "q") process.exit(0)
  })

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <Header version={version} status={status} ip={ip} />
      <box border borderStyle="rounded" padding={1} width={55} height={16}>
        <select
          options={MAIN_MENU_ITEMS}
          focused={true}
          onChange={(index: number) => {}}
          style={{ height: 14 }}
        />
      </box>
    </box>
  )
}

function AddConfigScreen({ onAdd, onBack }: {
  onAdd: (protocol: Protocol, opts: any) => Promise<void>
  onBack: () => void
}) {
  const [step, setStep] = useState<"protocol" | "form">("protocol")
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null)
  const [port, setPort] = useState("")
  const [uuid, setUuid] = useState("")
  const [password, setPassword] = useState("")
  const [host, setHost] = useState("")
  const [path, setPath] = useState("")
  const [method, setMethod] = useState("")
  const [serverName, setServerName] = useState("")
  const [adding, setAdding] = useState(false)

  const protocolOptions: SelectOption[] = PROTOCOLS.map((p) => ({
    name: p,
    description: getProtocolDescription(p),
  }))

  const handleAdd = useCallback(async () => {
    if (!selectedProtocol) return
    setAdding(true)
    try {
      await onAdd(selectedProtocol, {
        port: port ? parseInt(port) : undefined,
        uuid: uuid || undefined,
        password: password || undefined,
        host: host || undefined,
        path: path || undefined,
        method: method || undefined,
        serverName: serverName || undefined,
      })
    } finally {
      setAdding(false)
    }
  }, [selectedProtocol, port, uuid, password, host, path, method, serverName, onAdd])

  if (step === "protocol") {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <text fg="yellow" attributes={TextAttributes.BOLD}>Select Protocol</text>
        <box border borderStyle="rounded" padding={1} width={55} height={18}>
          <select
            options={protocolOptions}
            focused={true}
            onChange={() => {}}
            style={{ height: 16 }}
          />
        </box>
      </box>
    )
  }

  const proto = selectedProtocol!.toLowerCase()
  const needsHost = proto.includes("tls") && !proto.includes("reality")
  const needsServerName = proto.includes("reality")
  const needsPassword = ["trojan", "hysteria2", "tuic", "anytls"].some((p) => proto.includes(p))
  const needsMethod = proto.includes("shadowsocks")

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="yellow" attributes={TextAttributes.BOLD}>Add: {selectedProtocol}</text>
      <box border borderStyle="rounded" padding={1} width={50} flexDirection="column" gap={1}>
        <box flexDirection="row" gap={1}>
          <text fg="#888">Port:</text>
          <input placeholder="auto" onInput={setPort} focused={false} width={20} />
        </box>
        <box flexDirection="row" gap={1}>
          <text fg="#888">UUID:</text>
          <input placeholder="auto" onInput={setUuid} focused={false} width={20} />
        </box>
        {needsPassword && (
          <box flexDirection="row" gap={1}>
            <text fg="#888">Password:</text>
            <input placeholder="auto" onInput={setPassword} focused={false} width={20} />
          </box>
        )}
        {needsHost && (
          <box flexDirection="row" gap={1}>
            <text fg="#888">Domain:</text>
            <input placeholder="example.com" onInput={setHost} focused={false} width={20} />
          </box>
        )}
        {needsMethod && (
          <box flexDirection="row" gap={1}>
            <text fg="#888">Method:</text>
            <input placeholder={SS_METHODS[0]} onInput={setMethod} focused={false} width={20} />
          </box>
        )}
        {needsServerName && (
          <box flexDirection="row" gap={1}>
            <text fg="#888">SNI:</text>
            <input placeholder={randomItem(SERVER_NAMES)} onInput={setServerName} focused={false} width={20} />
          </box>
        )}
      </box>
      <text fg="green">Enter = Add | ESC = Back</text>
      {adding && <text fg="yellow">Adding...</text>}
    </box>
  )
}

function InfoScreen({ configs, ip, onSelect, onBack }: {
  configs: InboundConfig[]; ip: string
  onSelect: (config: InboundConfig) => void
  onBack: () => void
}) {
  if (configs.length === 0) {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <text fg="yellow">No configurations found</text>
        <text fg="#666">Add a config first</text>
      </box>
    )
  }

  const options: SelectOption[] = configs.map((c) => ({
    name: c.file,
    description: `${c.protocol} :${c.port}${c.host ? ` ${c.host}` : ""}`,
  }))

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="yellow" attributes={TextAttributes.BOLD}>Configurations ({configs.length})</text>
      <box border borderStyle="rounded" padding={1} width={65} height={Math.min(configs.length + 4, 20)}>
        <select
          options={options}
          focused={true}
          onChange={() => {}}
          style={{ height: Math.min(configs.length + 2, 18) }}
        />
      </box>
    </box>
  )
}

function InfoDetailScreen({ configs, selectedFile, ip, onBack }: {
  configs: InboundConfig[]; selectedFile: string; ip: string; onBack: () => void
}) {
  const config = configs.find((c) => c.file === selectedFile)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      getConfigURL(config, ip).then(setUrl)
    }
  }, [config, ip])

  if (!config) {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <text fg="red">Config not found: {selectedFile}</text>
      </box>
    )
  }

  const infoLines: [string, string][] = [
    ["Protocol", config.protocol],
    ["Port", String(config.port)],
    ["UUID", config.uuid ?? "-"],
    ["Password", config.password ?? "-"],
    ["Network", config.network ?? "-"],
    ["Host", config.host ?? "-"],
    ["Path", config.path ?? "-"],
    ["TLS", config.tls ?? "-"],
    ["SNI", config.serverName ?? "-"],
    ["Public Key", config.publicKey ?? "-"],
    ["Method", config.method ?? "-"],
  ]

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="yellow" attributes={TextAttributes.BOLD}>{config.file}</text>
      <box border borderStyle="rounded" padding={1} width={60} flexDirection="column">
        {infoLines.map(([label, value], i) => (
          <box key={i} flexDirection="row" gap={1}>
            <text fg="#888">{label.padEnd(12)}</text>
            <text fg="cyan">{value}</text>
          </box>
        ))}
        {url && (
          <box flexDirection="column" marginTop={1}>
            <text fg="#888">{"URL".padEnd(12)}</text>
            <text fg="blue">{url}</text>
          </box>
        )}
      </box>
    </box>
  )
}

function DeleteScreen({ configs, onDelete, onBack }: {
  configs: InboundConfig[]
  onDelete: (file: string) => Promise<void>
  onBack: () => void
}) {
  if (configs.length === 0) {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <text fg="yellow">No configurations to delete</text>
      </box>
    )
  }

  const options: SelectOption[] = configs.map((c) => ({
    name: c.file,
    description: `${c.protocol} :${c.port}`,
  }))

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="red" attributes={TextAttributes.BOLD}>Delete Configuration</text>
      <text fg="#888">Select config to delete (Enter to confirm)</text>
      <box border borderStyle="rounded" padding={1} width={55} height={Math.min(configs.length + 4, 18)}>
        <select
          options={options}
          focused={true}
          onChange={() => {}}
          style={{ height: Math.min(configs.length + 2, 16) }}
        />
      </box>
    </box>
  )
}

function ManageScreen({ status, version, onAction, onBack }: {
  status: string; version: string
  onAction: (action: "start" | "stop" | "restart" | "test") => Promise<void>
  onBack: () => void
}) {
  const options: SelectOption[] = [
    { name: status === "running" ? "Restart" : "Start", description: "Start or restart sing-box service" },
    { name: "Stop", description: "Stop sing-box service" },
    { name: "Test Run", description: "Run sing-box in test mode" },
  ]

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="yellow" attributes={TextAttributes.BOLD}>Service Management</text>
      <text fg={status === "running" ? "green" : "red"}>
        sing-box v{version}: {status}
      </text>
      <box border borderStyle="rounded" padding={1} width={50} height={8} marginTop={1}>
        <select
          options={options}
          focused={true}
          onChange={() => {}}
          style={{ height: 6 }}
        />
      </box>
    </box>
  )
}

function DNSScreen({ onSet, onBack }: {
  onSet: (dns: string) => Promise<void>
  onBack: () => void
}) {
  const dnsOptions: SelectOption[] = [
    ...DNS_SERVERS.map((d) => ({ name: d.name, description: d.description })),
    { name: "none", description: "Disable DNS" },
  ]

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="yellow" attributes={TextAttributes.BOLD}>DNS Settings</text>
      <box border borderStyle="rounded" padding={1} width={55} height={10}>
        <select
          options={dnsOptions}
          focused={true}
          onChange={() => {}}
          style={{ height: 8 }}
        />
      </box>
    </box>
  )
}

function LogScreen({ onBack }: { onBack: () => void }) {
  const logContent = useAsync(async () => tailLog(100), [])

  return (
    <box flexGrow={1} flexDirection="column" padding={1}>
      <text fg="yellow" attributes={TextAttributes.BOLD}>Logs (last 100 lines)</text>
      <box border borderStyle="rounded" padding={1} flexGrow={1} marginTop={1}>
        <scrollbox style={{ height: 20 }}>
          <text>{logContent.data ?? "No logs available"}</text>
        </scrollbox>
      </box>
    </box>
  )
}

function StatusScreen({ version, status, ip, configs, onBack }: {
  version: string; status: string; ip: string; configs: InboundConfig[]; onBack: () => void
}) {
  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg="yellow" attributes={TextAttributes.BOLD}>Status</text>
      <box border borderStyle="rounded" padding={1} width={45} flexDirection="column" gap={1}>
        <box flexDirection="row" gap={1}>
          <text fg="#888">sing-box:</text>
          <text fg="cyan">v{version}</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg="#888">Status:</text>
          <text fg={status === "running" ? "green" : "red"}>{status}</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg="#888">Server IP:</text>
          <text fg="cyan">{ip}</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg="#888">Configs:</text>
          <text fg="cyan">{configs.length}</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg="#888">Core:</text>
          <text fg="cyan">{isInstalled() ? "installed" : "not installed"}</text>
        </box>
      </box>
    </box>
  )
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <ascii-font font="tiny" text="vpntui" />
      <box border borderStyle="rounded" padding={1} width={45} flexDirection="column" gap={1} marginTop={1}>
        <text fg="cyan">sing-box TUI Manager</text>
        <text fg="#888">A terminal user interface for managing</text>
        <text fg="#888">sing-box VPN configurations</text>
        <text fg="#666"> </text>
        <text fg="#888">Core: https://sing-box.sagernet.org</text>
        <text fg="#888">Source: github.com/user/vpntui</text>
      </box>
    </box>
  )
}

function getProtocolDescription(protocol: Protocol): string {
  const descriptions: Record<string, string> = {
    "VLESS-REALITY": "VLESS with REALITY (recommended)",
    "VLESS-HTTP2-REALITY": "VLESS HTTP/2 with REALITY",
    "TUIC": "TUIC protocol (UDP)",
    "Trojan": "Trojan protocol",
    "Hysteria2": "Hysteria2 (UDP, speed)",
    "AnyTLS": "AnyTLS protocol",
    "VMess-WS": "VMess WebSocket",
    "VMess-TCP": "VMess TCP",
    "VMess-HTTP": "VMess HTTP",
    "VMess-QUIC": "VMess QUIC",
    "VMess-H2-TLS": "VMess HTTP/2 + TLS",
    "VMess-WS-TLS": "VMess WebSocket + TLS",
    "VLESS-H2-TLS": "VLESS HTTP/2 + TLS",
    "VLESS-WS-TLS": "VLESS WebSocket + TLS",
    "Trojan-H2-TLS": "Trojan HTTP/2 + TLS",
    "Trojan-WS-TLS": "Trojan WebSocket + TLS",
    "VMess-HTTPUpgrade-TLS": "VMess HTTPUpgrade + TLS",
    "VLESS-HTTPUpgrade-TLS": "VLESS HTTPUpgrade + TLS",
    "Trojan-HTTPUpgrade-TLS": "Trojan HTTPUpgrade + TLS",
    "Shadowsocks": "Shadowsocks 2022",
    "Socks": "SOCKS proxy",
  }
  return descriptions[protocol] ?? protocol
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
