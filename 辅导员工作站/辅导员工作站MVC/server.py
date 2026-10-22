#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""辅导员工作站 · 本地版（MVC + SQLite）—— 入口。

双击「启动工作站.command」即可运行本服务：
  - 数据存储：本地 SQLite 数据库 db/workstation.db（所有业务数据）
  - 访问方式：浏览器打开 http://127.0.0.1:8790/
  - 停止方式：关闭终端窗口，或按 Ctrl+C

仅监听本机 127.0.0.1，不对外网开放，数据不会上传。
"""
import os
import sys
import threading
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from models.db import Database
from controllers.api import handle_api

HOST = '127.0.0.1'
PORT = 8790
VIEWS_DIR = os.path.join(BASE_DIR, 'views')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=VIEWS_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/'):
            handle_api(self, DB, 'GET')
            return
        if self.path in ('/', ''):
            self.path = '/index.html'
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            handle_api(self, DB, 'POST')
            return
        super().do_POST()

    def do_PUT(self):
        if self.path.startswith('/api/'):
            handle_api(self, DB, 'PUT')
            return
        super().do_PUT()

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            handle_api(self, DB, 'DELETE')
            return
        super().do_DELETE()

    def log_message(self, *args):
        pass  # 安静运行，不打印每一条访问日志


def _port_in_use(port):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, port))
            return False
        except OSError:
            return True


def main():
    global DB
    port = PORT
    if _port_in_use(port):
        print('端口 %d 已被占用，尝试其他端口…' % port)
        for p in range(PORT + 1, PORT + 10):
            if not _port_in_use(p):
                port = p
                break
        else:
            print('未找到可用端口，请关闭占用程序后重试。')
            sys.exit(1)

    DB = Database()

    httpd = HTTPServer((HOST, port), Handler)
    url = 'http://127.0.0.1:%d/' % port
    print('=' * 52)
    print('  辅导员工作站 · 本地版已启动')
    print('  请在浏览器打开：%s' % url)
    print('  数据保存在：db/workstation.db（SQLite 数据库）')
    print('  停止：关闭本窗口或按 Ctrl+C')
    print('=' * 52)

    threading.Timer(0.9, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止服务。')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
