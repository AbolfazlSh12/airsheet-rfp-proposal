"""Serve a folder over HTTP with UTF-8 charset headers, for checking a customer page locally.

Python's own `http.server` sends no charset, so Persian pages render as mojibake.

    python3 serve.py <folder> [port]        # default port 8765, bound to 127.0.0.1
"""
import functools
import http.server
import sys

folder = sys.argv[1] if len(sys.argv) > 1 else "."
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
handler = http.server.SimpleHTTPRequestHandler
handler.extensions_map.update(
    {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8"}
)
http.server.test(HandlerClass=functools.partial(handler, directory=folder), port=port, bind="127.0.0.1")
