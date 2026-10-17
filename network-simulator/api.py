"""Loopback-only simulator REST API; not for untrusted/public deployment."""
import json
import os
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from .network import Network

def serve(db_path="synthetic-network.sqlite3",host="127.0.0.1",port=8099):
    if host not in {"127.0.0.1","::1"}: raise ValueError("Public bind forbidden")
    network=Network(db_path)
    class Handler(BaseHTTPRequestHandler):
        def send(self,code,obj):
            raw=json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type","application/json")
            self.send_header("Content-Length",str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        def read_json(self):
            n=int(self.headers.get("Content-Length","0"))
            if not 1<=n<=100000: raise ValueError("Invalid body length")
            return json.loads(self.rfile.read(n))
        def dispatch(self):
            parts=urlsplit(self.path).path.strip("/").split("/")
            try:
                if self.command=="POST" and parts==["v1","messages"]:
                    self.send(201,network.submit(self.read_json()))
                elif self.command=="POST" and len(parts)==4 and parts[:2]==["v1","messages"] and parts[3]=="respond":
                    d=self.read_json()
                    if set(d)!={"bank","state","reason"}: raise ValueError("Invalid response")
                    self.send(200,network.respond(parts[2],**d))
                elif self.command=="GET" and len(parts)==4 and parts[:2]==["v1","banks"] and parts[3]=="inbox":
                    self.send(200,network.inbox(parts[2]))
                elif self.command=="GET" and len(parts)==5 and parts[:2]==["v1","banks"] and parts[3]=="messages":
                    self.send(200,network.sender_status(parts[2],parts[4]))
                elif self.command=="GET" and parts==["health"]:
                    self.send(200,{"ok":True,"synthetic":True})
                else:self.send(404,{"error":"Not found"})
            except (ValueError,TypeError,KeyError,PermissionError,json.JSONDecodeError) as exc:
                status=403 if isinstance(exc,PermissionError) else 404 if isinstance(exc,KeyError) else 400
                self.send(status,{"error":str(exc)})
        def do_POST(self):self.dispatch()
        def do_GET(self):self.dispatch()
    ThreadingHTTPServer((host,int(port)),Handler).serve_forever()

if __name__=="__main__":
    serve(db_path=os.environ.get("NETWORK_SIM_DB","synthetic-network.sqlite3"),
          port=int(os.environ.get("NETWORK_SIM_PORT","8099")))
