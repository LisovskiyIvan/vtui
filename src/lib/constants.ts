export const CORE = "sing-box"
export const CORE_DIR = `/etc/${CORE}`
export const CORE_BIN = `${CORE_DIR}/bin/${CORE}`
export const CONF_DIR = `${CORE_DIR}/conf`
export const LOG_DIR = `/var/log/${CORE}`
export const CONFIG_JSON = `${CORE_DIR}/config.json`
export const CADDY_BIN = "/usr/local/bin/caddy"
export const CADDY_DIR = "/etc/caddy"
export const CADDYFILE = `${CADDY_DIR}/Caddyfile`

export const PROTOCOLS = [
  "VLESS-REALITY",
  "VLESS-HTTP2-REALITY",
  "TUIC",
  "Trojan",
  "Hysteria2",
  "AnyTLS",
  "VMess-WS",
  "VMess-TCP",
  "VMess-HTTP",
  "VMess-QUIC",
  "VMess-H2-TLS",
  "VMess-WS-TLS",
  "VLESS-H2-TLS",
  "VLESS-WS-TLS",
  "Trojan-H2-TLS",
  "Trojan-WS-TLS",
  "VMess-HTTPUpgrade-TLS",
  "VLESS-HTTPUpgrade-TLS",
  "Trojan-HTTPUpgrade-TLS",
  "Shadowsocks",
  "Socks",
] as const

export type Protocol = (typeof PROTOCOLS)[number]

export const SS_METHODS = [
  "2022-blake3-aes-128-gcm",
  "2022-blake3-aes-256-gcm",
  "2022-blake3-chacha20-poly1305",
  "aes-128-gcm",
  "aes-256-gcm",
  "chacha20-ietf-poly1305",
  "xchacha20-ietf-poly1305",
] as const

export const SERVER_NAMES = [
  "www.amazon.com",
  "www.ebay.com",
  "www.paypal.com",
  "www.cloudflare.com",
  "dash.cloudflare.com",
  "aws.amazon.com",
]

export const DNS_SERVERS = [
  { name: "1.1.1.1", description: "Cloudflare DNS" },
  { name: "8.8.8.8", description: "Google DNS" },
  { name: "h3://dns.google/dns-query", description: "Google DNS (H3)" },
  { name: "h3://cloudflare-dns.com/dns-query", description: "Cloudflare (H3)" },
  { name: "h3://family.cloudflare-dns.com/dns-query", description: "Cloudflare Family (H3)" },
]

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "panic", "none"] as const
