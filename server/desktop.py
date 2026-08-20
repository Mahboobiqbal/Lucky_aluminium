import sys
import os
import time
import shutil
import threading
import subprocess
import webbrowser


def _ensure_env():
    if not getattr(sys, "frozen", False):
        return
    exe_dir = os.path.dirname(sys.executable)
    env_dst = os.path.join(exe_dir, ".env")
    if not os.path.isfile(env_dst):
        bundled = os.path.join(sys._MEIPASS, ".env")
        if os.path.isfile(bundled):
            shutil.copy2(bundled, env_dst)
    os.chdir(exe_dir)


def _start_server():
    os.environ["UDYANA_HOST"] = "127.0.0.1"
    os.environ["UDYANA_PORT"] = "8000"
    if getattr(sys, "frozen", False):
        os.environ["UDYANA_DESKTOP"] = "1"

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
            resp = urllib.request.urlopen(url, timeout=2)
            if resp.status == 200:
                return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.5)
    return False


def _open_browser():
    url = "http://127.0.0.1:8000"
    chrome = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    ]
    for path in chrome:
        if os.path.isfile(path):
            subprocess.Popen([path, f"--app={url}", "--new-window"])
            return
    edge = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in edge:
        if os.path.isfile(path):
            subprocess.Popen([path, f"--app={url}", "--new-window"])
            return
    webbrowser.open(url)


def main():
    _ensure_env()

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    if not _wait_for_server():
        print("[Lucky Aluminium] Server failed to start")
        input("Press Enter to exit...")
        sys.exit(1)

    _open_browser()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
