# vui

TUI manager for [sing-box](https://sing-box.sagernet.org) — terminal interface for managing VPN configurations, services, and DNS.

## Install

One command installs sing-box + vui:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/LisovskiyIvan/vtui/main/install.sh)
```

## Usage

```bash
vui
```

## Build from source

```bash
bun install
bun run build
```

Binaries output to `./dist/`:
- `vui-linux-amd64`
- `vui-linux-arm64`

## Development

```bash
bun install
bun run dev
```

## Features

- Full TUI for sing-box management
- Add/change/delete configs (VLESS-REALITY, VMess, Trojan, Hysteria2, TUIC, Shadowsocks, AnyTLS, Socks)
- Service management (start/stop/restart via systemd/openrc)
- DNS configuration
- Log viewer
- Config URL generation
- Single binary (compiled with Bun)

## Requirements

- Linux amd64 or arm64
- Root access (install script handles everything)
