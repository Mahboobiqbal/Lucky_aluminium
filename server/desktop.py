import sys
import os
import time
import shutil
import threading
import webview


def _ensure_env():
    if not getattr(sys, "frozen", False):
        return
    exe_dir = os.path.dirname(sys.executable)
    env_dst = os.path.join(exe_dir, ".env")
    if not os.path.isfile(env_dst):
        bundled = os.path.join(sys._MEIPASS, ".env")
        if os.path.isfile(bundled):
            shutil.copy2(bundled, env_dst)


def _start_server():
    os.environ["UDYANA_HOST"] = "127.0.0.1"
    os.environ["UDYANA_PORT"] = "8000"

    import uvicorn
    from main import app
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    server.run()


def _wait_for_server(url="http://127.0.0.1:8000/api/health", timeout=30):
    import urllib.request
    import urllib.error
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.3)
    return False


def main():
    _ensure_env()

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    if not _wait_for_server():
        print("Server failed to start within timeout")
        sys.exit(1)

    window = webview.create_window(
        title="Lucky Aluminium uPVC Works",
        url="http://127.0.0.1:8000",
        width=1400,
        height=900,
        min_size=(1024, 600),
        text_select=True,
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()
