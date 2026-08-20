import sys
import os
import time
import shutil
import threading


def _ensure_env():
    if not getattr(sys, "frozen", False):
        return
    exe_dir = os.path.dirname(sys.executable)
    env_dst = os.path.join(exe_dir, ".env")
    if not os.path.isfile(env_dst):
        bundled = os.path.join(sys._MEIPASS, ".env")
        if os.path.isfile(bundled):
            shutil.copy2(bundled, env_dst)
            print(f"[Lucky Aluminium] Created .env at {env_dst}")
    os.chdir(exe_dir)


def _start_server():
    os.environ["UDYANA_HOST"] = "127.0.0.1"
    os.environ["UDYANA_PORT"] = "8000"
    if getattr(sys, "frozen", False):
        os.environ["UDYANA_DESKTOP"] = "1"

    import uvicorn
    from main import app
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="info")
    server = uvicorn.Server(config)
    server.run()


def _wait_for_server(url="http://127.0.0.1:8000/api/health", timeout=30):
    import urllib.request
    import urllib.error
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(url, timeout=2)
            if resp.status == 200:
                return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.5)
    return False


def main():
    _ensure_env()

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    print("[Lucky Aluminium] Starting server...")
    if not _wait_for_server():
        print("[Lucky Aluminium] ERROR: Server failed to start")
        input("Press Enter to exit...")
        sys.exit(1)

    print("[Lucky Aluminium] Server ready. Opening window...")

    import webview
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
