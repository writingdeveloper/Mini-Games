# Mini-Games Server - Oracle Cloud Deployment Guide

## Architecture

```
[Vercel - Frontend]                    [Oracle Cloud - Game Server]
 Next.js + Static Games    <-WSS->     Node.js + Socket.io (Docker)
 mini-games.vercel.app                  minigames-api.devmanage.duckdns.org
                                           |
                                     [Nginx Proxy Manager]
                                       SSL + WebSocket proxy
                                           |
                                     [Docker Container]
                                       Port 3001
```

## Prerequisites

- Oracle Cloud VM with Docker and Docker Compose installed
- Nginx Proxy Manager running
- Wildcard domain `*.devmanage.duckdns.org` pointing to the VM
- SSH access to the server

---

## Step 1: Oracle Cloud Security List

Before anything else, ensure port 3001 is open in Oracle Cloud's networking layer.

1. Go to **OCI Console** > **Networking** > **Virtual Cloud Networks**
2. Click your VCN > **Subnet** > **Security List**
3. Add **Ingress Rule**:
   - Source: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `3001`
4. Also open port in the VM's iptables (if not already):
   ```bash
   sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
   sudo iptables-save | sudo tee /etc/iptables/rules.v4
   ```

## Step 2: Clone & Build on Server

```bash
# SSH into your Oracle server
ssh your-user@your-oracle-ip

# Clone the repo
git clone <your-repo-url> /opt/minigames
cd /opt/minigames/server

# Build and start with Docker Compose
docker compose up -d --build
```

Or use the auto-deploy script:
```bash
cd /opt/minigames/server
bash deploy.sh
```

## Step 3: Verify Server is Running

```bash
# Health check (from the server)
curl http://localhost:3001/health
# Expected: {"status":"ok","uptime":123.456}

# Check container status
docker compose ps
docker compose logs -f game-server
```

## Step 4: Nginx Proxy Manager Configuration

Open your Nginx Proxy Manager dashboard (typically at `http://your-server-ip:81`).

### Add Proxy Host

1. Click **"Add Proxy Host"**
2. **Details tab**:
   - Domain Names: `minigames-api.devmanage.duckdns.org`
   - Scheme: `http`
   - Forward Hostname / IP: `172.17.0.1` (Docker host bridge) or `localhost`
   - Forward Port: `3001`
   - **Check: "WebSockets Support"** (CRITICAL!)
   - Check: "Block Common Exploits"

3. **SSL tab**:
   - SSL Certificate: Request a new SSL certificate
   - Check: "Force SSL"
   - Check: "HTTP/2 Support"
   - Check: "HSTS Enabled"

4. **Advanced tab** (add this custom Nginx config):
   ```nginx
   # WebSocket support
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_read_timeout 86400s;
   proxy_send_timeout 86400s;

   # Socket.io specific
   proxy_http_version 1.1;
   proxy_buffering off;
   proxy_cache off;
   ```

5. Click **Save**

### Important: Forward Hostname

If `localhost` doesn't work (common when Nginx Proxy Manager runs in Docker), try:
- `172.17.0.1` (default Docker bridge gateway)
- `host.docker.internal` (Docker Desktop)
- Your server's internal IP: `hostname -I | awk '{print $1}'`

## Step 5: Update CORS Origin

Once you know your Vercel frontend URL, update `docker-compose.yml`:

```yaml
environment:
  - CORS_ORIGIN=https://mini-games-xxxx.vercel.app,https://your-custom-domain.com
```

Then restart:
```bash
docker compose restart
```

## Step 6: Configure Frontend

Add to your Vercel project environment variables:
```
NEXT_PUBLIC_GAME_SERVER_URL=https://minigames-api.devmanage.duckdns.org
```

Or update `.env.local` for local development:
```
NEXT_PUBLIC_GAME_SERVER_URL=https://minigames-api.devmanage.duckdns.org
```

## Step 7: End-to-End Verification

```bash
# From your local machine, test the server
curl https://minigames-api.devmanage.duckdns.org/health

# Test WebSocket connectivity (requires wscat: npm i -g wscat)
wscat -c wss://minigames-api.devmanage.duckdns.org/socket.io/?EIO=4\&transport=websocket
```

Then open the game in your browser, click "멀티플레이어", and verify the lobby UI appears.

---

## Monitoring

```bash
# View live logs
docker compose logs -f game-server

# Check resource usage
docker stats minigames-server

# Check container health
docker inspect --format='{{.State.Health.Status}}' minigames-server
```

## Updating

```bash
cd /opt/minigames
git pull
cd server
docker compose up -d --build
```

## Troubleshooting

### WebSocket connection fails
- Ensure "WebSockets Support" is checked in Nginx Proxy Manager
- Add the Advanced tab config shown above
- Check that port 3001 is open in both iptables and OCI Security List

### CORS errors in browser console
- Update `CORS_ORIGIN` in `docker-compose.yml` to match your frontend domain
- Use `*` temporarily for debugging, then restrict for production

### Container won't start
```bash
docker compose logs game-server
docker compose down && docker compose up -d --build
```

### Health check fails
```bash
# Check if the container is running
docker compose ps
# Check container logs
docker compose logs --tail=50 game-server
# Try connecting directly
curl -v http://localhost:3001/health
```
