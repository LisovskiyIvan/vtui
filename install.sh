#!/bin/bash
set -e

REPO="LisovskiyIvan/vtui"
BIN_NAME="vui"
INSTALL_DIR="/usr/local/bin"
CORE_DIR="/etc/sing-box"
CORE_BIN="${CORE_DIR}/bin/sing-box"
CORE_REPO="SagerNet/sing-box"

RED='\e[31m'
GREEN='\e[92m'
YELLOW='\e[33m'
CYAN='\e[96m'
NONE='\e[0m'

info()  { echo -e "${CYAN}[INFO]${NONE} $*"; }
ok()    { echo -e "${GREEN}[OK]${NONE} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NONE} $*"; }
err()   { echo -e "${RED}[ERROR]${NONE} $*" && exit 1; }

[[ $EUID -ne 0 ]] && err "Run as root"

ARCH=$(uname -m)
case $ARCH in
    x86_64|amd64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)             err "Unsupported architecture: $ARCH" ;;
esac

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

_wget() {
    if command -v wget &>/dev/null; then
        wget --no-check-certificate -q -O "$1" "$2"
    elif command -v curl &>/dev/null; then
        curl -fsSL -o "$1" "$2"
    else
        err "wget or curl required"
    fi
}

# --- install sing-box ---
if [[ ! -x $CORE_BIN ]]; then
    info "Installing sing-box..."

    _wget "${TMPDIR}/_ver" "https://api.github.com/repos/${CORE_REPO}/releases/latest"
    CORE_VER=$(grep -oE '"tag_name":"v[0-9.]+"' "${TMPDIR}/_ver" | grep -oE 'v[0-9.]+' || true)

    if [[ -z $CORE_VER ]]; then
        CORE_VER=$(curl -fsSL -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${CORE_REPO}/releases/latest" 2>/dev/null | grep -oE '"tag_name":"v[0-9.]+"' | grep -oE 'v[0-9.]+' || true)
    fi

    if [[ -z $CORE_VER ]]; then
        CORE_VER=$(wget --no-check-certificate -qO- -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${CORE_REPO}/releases/latest" 2>/dev/null | grep -oE '"tag_name":"v[0-9.]+"' | grep -oE 'v[0-9.]+' || true)
    fi
    [[ -z $CORE_VER ]] && err "Failed to get sing-box latest version"

    info "sing-box version: ${CORE_VER}"
    CORE_URL="https://github.com/${CORE_REPO}/releases/download/${CORE_VER}/sing-box-${CORE_VER#v}-linux-${ARCH}.tar.gz"

    _wget "${TMPDIR}/sing-box.tar.gz" "$CORE_URL"
    mkdir -p "${CORE_DIR}/bin"
    tar xzf "${TMPDIR}/sing-box.tar.gz" --strip-components 1 -C "${CORE_DIR}/bin"
    chmod +x "$CORE_BIN"
    ok "sing-box ${CORE_VER} installed"
else
    ok "sing-box already installed: $($CORE_BIN version 2>/dev/null | head -1)"
fi

# --- create directories ---
mkdir -p "${CORE_DIR}/conf" "/var/log/sing-box"

# --- generate config.json if missing ---
CONFIG_JSON="${CORE_DIR}/config.json"
if [[ ! -f $CONFIG_JSON ]]; then
    cat > "$CONFIG_JSON" <<'CONF'
{
  "log": {"output": "/var/log/sing-box/access.log", "level": "info", "timestamp": true},
  "dns": {},
  "outbounds": [{"tag": "direct", "type": "direct"}]
}
CONF
    ok "Created default config.json"
fi

# --- install systemd service ---
if [[ $(type -P systemctl) ]]; then
    if [[ ! -f /lib/systemd/system/sing-box.service ]]; then
        cat > /lib/systemd/system/sing-box.service <<EOF
[Unit]
Description=sing-box Service
After=network.target nss-lookup.target

[Service]
User=root
ExecStart=${CORE_BIN} run -c ${CONFIG_JSON} -C ${CORE_DIR}/conf
Restart=on-failure
RestartPreventExitStatus=23
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
        systemctl enable sing-box
        systemctl daemon-reload
        ok "systemd service installed"
    fi
elif [[ $(type -P rc-service) ]]; then
    if [[ ! -f /etc/init.d/sing-box ]]; then
        cat > /etc/init.d/sing-box <<EOF
#!/sbin/openrc-run
name="sing-box"
command="${CORE_BIN}"
command_args="run -c ${CONFIG_JSON} -C ${CORE_DIR}/conf"
command_background=true
pidfile="/run/\${RC_SVCNAME}.pid"
supervisor=supervise-daemon
depend() { need net; after firewall; }
EOF
        chmod +x /etc/init.d/sing-box
        rc-update add sing-box default
        ok "OpenRC service installed"
    fi
fi

# --- install vui ---
info "Installing vui..."
VUI_URL="https://github.com/${REPO}/releases/latest/download/vui-linux-${ARCH}"
_wget "${TMPDIR}/${BIN_NAME}" "$VUI_URL"
chmod +x "${TMPDIR}/${BIN_NAME}"
mv "${TMPDIR}/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"
ok "vui installed to ${INSTALL_DIR}/${BIN_NAME}"

echo
ok "Done! Run: vui"
