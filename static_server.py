import http.server
import socketserver
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Extract path before query params
        path = self.path.split('?')[0]
        # Resolve real file path on disk
        local_path = os.path.join(DIRECTORY, path.lstrip('/'))
        
        # If it is a real file or asset, serve it
        if os.path.isfile(local_path):
            return super().do_GET()
        
        # Also handle vendor, src, etc.
        if path.startswith(('/vendor/', '/src/', '/data/')):
            return super().do_GET()
        
        # Otherwise, fall back to index.html for SPA client-side routes (/login, /dashboard, /q/..., /d/...)
        self.path = '/index.html'
        return super().do_GET()

    def end_headers(self):
        # Add CORS and no-cache headers for easy development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

if __name__ == '__main__':
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), SPAHandler) as httpd:
        print(f"Serverless SPA Static Server running on port {PORT} bound to 0.0.0.0")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
