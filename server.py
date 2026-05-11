import http.server
import socketserver
import mimetypes

PORT = 8888 # Use 8888 to avoid conflicts

# Ensure JS is recognized correctly
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def send_response(self, code, message=None):
        super().send_response(code, message)
        # Log content type for debugging
        if self.path.endswith('.js'):
            print(f"DEBUG: Serving {self.path} with Content-Type: {self.guess_type(self.path)}")

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
