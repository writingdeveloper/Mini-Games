#!/bin/bash
# Mini-Games Server - Oracle Cloud Auto-Deploy Script
# Usage: curl -sSL <raw-url> | bash
# Or: bash deploy.sh

set -e

INSTALL_DIR="/opt/minigames"
REPO_URL="${REPO_URL:-}"  # Set this or pass as env variable
DOMAIN="minigames-api.devmanage.duckdns.org"
PORT=3001

echo "======================================"
echo "  Mini-Games Server - Auto Deploy"
echo "======================================"

# 1. Check prerequisites
echo ""
echo "[1/5] Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "  Docker: $(docker --version)"
echo "  Docker Compose: available"

# 2. Setup directory
echo ""
echo "[2/5] Setting up project directory..."

if [ -d "$INSTALL_DIR/server" ]; then
    echo "  Existing installation found. Updating..."
    cd "$INSTALL_DIR"
    if [ -d ".git" ]; then
        git pull
    fi
else
    echo "  Creating new installation..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown $(whoami):$(whoami) "$INSTALL_DIR"

    if [ -n "$REPO_URL" ]; then
        git clone "$REPO_URL" "$INSTALL_DIR"
    else
        echo ""
        echo "  No REPO_URL set. Please copy the project files manually:"
        echo "    scp -r ./server/ user@server:$INSTALL_DIR/server/"
        echo ""
        echo "  Or set REPO_URL and re-run:"
        echo "    REPO_URL=https://github.com/your/repo.git bash deploy.sh"
        exit 1
    fi
fi

cd "$INSTALL_DIR/server"

# 3. Build and start
echo ""
echo "[3/5] Building and starting server..."
docker compose down 2>/dev/null || true
docker compose up -d --build

# 4. Wait for health check
echo ""
echo "[4/5] Waiting for server to be healthy..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:$PORT/health > /dev/null 2>&1; then
        echo "  Server is healthy!"
        curl -s http://localhost:$PORT/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:$PORT/health
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  WARNING: Server health check timed out. Check logs:"
        echo "    docker compose logs game-server"
        exit 1
    fi
    sleep 2
done

# 5. Firewall check
echo ""
echo "[5/5] Checking firewall..."

# Oracle Cloud uses iptables
if command -v iptables &> /dev/null; then
    # Check if port is accessible
    if ! sudo iptables -L -n 2>/dev/null | grep -q "$PORT"; then
        echo "  Adding iptables rule for port $PORT..."
        sudo iptables -I INPUT -p tcp --dport $PORT -j ACCEPT
        echo "  NOTE: Make sure to also open port $PORT in Oracle Cloud"
        echo "  Security List (VCN > Subnet > Security List > Ingress Rules)"
    else
        echo "  Port $PORT appears to be open in iptables."
    fi
fi

echo ""
echo "======================================"
echo "  Deployment Complete!"
echo "======================================"
echo ""
echo "  Server URL:     http://localhost:$PORT"
echo "  Health Check:   http://localhost:$PORT/health"
echo "  Domain:         https://$DOMAIN"
echo ""
echo "  Next steps:"
echo "  1. Configure Nginx Proxy Manager:"
echo "     - Domain: $DOMAIN"
echo "     - Forward to: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "     - Enable WebSocket Support"
echo "     - Request SSL certificate"
echo ""
echo "  2. Open Oracle Cloud Security List:"
echo "     - OCI Console > Networking > VCN > Subnet > Security List"
echo "     - Add Ingress Rule: TCP, port $PORT, source 0.0.0.0/0"
echo ""
echo "  3. Test: curl https://$DOMAIN/health"
echo ""
echo "  Logs: docker compose -f $INSTALL_DIR/server/docker-compose.yml logs -f"
echo ""
