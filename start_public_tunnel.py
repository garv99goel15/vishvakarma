from pyngrok import ngrok
import time

port = 3101

# Open HTTP tunnel
public_tunnel = ngrok.connect(port, bind_tls=True)
print(public_tunnel.public_url, flush=True)

# Keep process alive so tunnel stays active
while True:
    time.sleep(60)
