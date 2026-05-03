import type { Protocol } from "../lib/constants"
import type { InboundConfig } from "../lib/singbox"
import { listConfigFiles, parseInboundConfig } from "../lib/singbox"
import { getServiceStatus, getCoreVersion, getServerIP } from "../lib"

export type Screen =
  | "main"
  | "add"
  | "add-form"
  | "change"
  | "change-form"
  | "info"
  | "info-detail"
  | "delete"
  | "manage"
  | "update"
  | "dns"
  | "log"
  | "bbr"
  | "about"
  | "status"
  | "url"

export interface AppState {
  screen: Screen
  prevScreen: Screen
  status: string
  error: string | null
  configs: InboundConfig[]
  selectedConfig: string | null
  selectedProtocol: Protocol | null
  serverIP: string
  coreVersion: string
  coreStatus: string
}

export type Action =
  | { type: "NAVIGATE"; screen: Screen }
  | { type: "SET_STATUS"; status: string }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_CONFIGS"; configs: InboundConfig[] }
  | { type: "SELECT_CONFIG"; file: string | null }
  | { type: "SELECT_PROTOCOL"; protocol: Protocol | null }
  | { type: "SET_SERVER_INFO"; ip: string; version: string; status: string }

export function createInitialState(): AppState {
  return {
    screen: "main",
    prevScreen: "main",
    status: "",
    error: null,
    configs: [],
    selectedConfig: null,
    selectedProtocol: null,
    serverIP: "",
    coreVersion: "",
    coreStatus: "",
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NAVIGATE":
      return { ...state, prevScreen: state.screen, screen: action.screen, error: null }
    case "SET_STATUS":
      return { ...state, status: action.status }
    case "SET_ERROR":
      return { ...state, error: action.error }
    case "SET_CONFIGS":
      return { ...state, configs: action.configs }
    case "SELECT_CONFIG":
      return { ...state, selectedConfig: action.file }
    case "SELECT_PROTOCOL":
      return { ...state, selectedProtocol: action.protocol }
    case "SET_SERVER_INFO":
      return { ...state, serverIP: action.ip, coreVersion: action.version, coreStatus: action.status }
    default:
      return state
  }
}

export async function loadConfigs(): Promise<InboundConfig[]> {
  const files = listConfigFiles()
  const configs: InboundConfig[] = []
  for (const file of files) {
    const config = await parseInboundConfig(file)
    if (config) configs.push(config)
  }
  return configs
}

export async function loadServerInfo(): Promise<{ ip: string; version: string; status: string }> {
  const [ip, version, statusRaw] = await Promise.all([getServerIP(), getCoreVersion(), getServiceStatus()])
  return { ip, version, status: statusRaw === "running" ? "running" : "stopped" }
}
