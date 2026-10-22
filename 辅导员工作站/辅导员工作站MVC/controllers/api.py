# -*- coding: utf-8 -*-
"""Controller 层：REST API 路由处理。

负责解析请求、调用 Model(数据库)、返回 JSON 响应。
所有写操作成功后返回 {state: <最新全量数据>}，前端直接用最新状态重渲染。
"""
import json
import re
import urllib.parse

from models.db import Database


def _json_resp(handler, code, obj):
    body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    handler.send_response(code)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Cache-Control', 'no-store')
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler):
    length = int(handler.headers.get('Content-Length') or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode('utf-8'))
    except Exception:
        return {}


def _path_parts(path):
    """/api/students/xxx -> ['students', 'xxx']"""
    p = urllib.parse.urlparse(path).path
    return [seg for seg in p.split('/') if seg]


def _ok(handler, db, payload=None):
    state = db.state()
    obj = {'state': state}
    if payload:
        obj.update(payload)
    _json_resp(handler, 200, obj)


def _err(handler, code, msg):
    _json_resp(handler, code, {'error': msg})


def _check_origin(handler):
    """本地单机防护：仅允许本站页面发起写请求。"""
    origin = handler.headers.get('Origin')
    if origin and origin not in ('http://127.0.0.1:8790', 'http://localhost:8790'):
        return False
    return True


def handle_api(handler, db, method):
    parts = _path_parts(handler.path)  # ['api', ...]
    if len(parts) < 2 or parts[0] != 'api':
        _err(handler, 404, 'not found')
        return
    res = parts[1]

    if method == 'GET' and res == 'state':
        _ok(handler, db)
        return

    if method != 'GET' and not _check_origin(handler):
        _err(handler, 403, '跨站请求已拒绝')
        return

    body = _read_body(handler)

    # ---- 学生 ----
    if method == 'POST' and res == 'students':
        s = body.get('student') or {}
        if not s.get('name') and not s.get('xh'):
            _err(handler, 400, '请至少填写姓名或学号')
            return
        st, err = db.add_student(s)
        if err:
            _err(handler, 400, err)
            return
        _ok(handler, db)
        return
    if method == 'PUT' and res == 'students' and len(parts) >= 3:
        sid = parts[2]
        st, err = db.update_student(sid, body.get('student') or {})
        if err:
            _err(handler, 400, err)
            return
        _ok(handler, db)
        return
    if method == 'DELETE' and res == 'students' and len(parts) >= 3:
        db.delete_student(parts[2])
        _ok(handler, db)
        return

    # ---- 谈话 ----
    if method == 'POST' and len(parts) >= 4 and parts[1] == 'talks' and parts[3] == 'done':
        db.mark_follow_done(parts[2])
        _ok(handler, db)
        return
    if method == 'POST' and res == 'talks':
        db.add_talk(body.get('talk') or {})
        _ok(handler, db)
        return
    if method == 'PUT' and res == 'talks' and len(parts) >= 3:
        db.update_talk(parts[2], body.get('talk') or {})
        _ok(handler, db)
        return
    if method == 'DELETE' and res == 'talks' and len(parts) >= 3:
        db.delete_talk(parts[2])
        _ok(handler, db)
        return

    # ---- 文件索引 ----
    if method == 'POST' and res == 'files':
        db.add_file(body.get('file') or {})
        _ok(handler, db)
        return
    if method == 'PUT' and res == 'files' and len(parts) >= 3:
        db.update_file(parts[2], body.get('file') or {})
        _ok(handler, db)
        return
    if method == 'DELETE' and res == 'files' and len(parts) >= 3:
        db.delete_file(parts[2])
        _ok(handler, db)
        return

    # ---- 画像标签 ----
    if method == 'POST' and res == 'portraits' and len(parts) >= 3 and parts[2] == 'tags':
        sid = body.get('sid') or ''
        tag = (body.get('tag') or '').strip()
        if not sid or not tag:
            _err(handler, 400, '参数缺失')
            return
        ok, err = db.add_portrait_tag(sid, tag)
        if not ok:
            _err(handler, 400, err)
            return
        _ok(handler, db)
        return

    # ---- 设置 ----
    if method == 'PUT' and res == 'settings':
        db.save_settings(body.get('settings') or {})
        _ok(handler, db)
        return

    # ---- 批量导入学生（服务端去重） ----
    if method == 'POST' and res == 'import' and len(parts) >= 3 and parts[2] == 'students':
        records = body.get('records') or []
        result = db.import_students(records)
        _ok(handler, db, {'imported': result['imported'], 'skips': result['skips']})
        return

    # ---- 导入旧备份 ----
    if method == 'POST' and res == 'backup' and len(parts) >= 3 and parts[2] == 'import':
        backup = body.get('backup') or {}
        if not isinstance(backup.get('students'), list) or not isinstance(backup.get('talks'), list):
            _err(handler, 400, '备份文件结构不符')
            return
        db.import_backup(backup)
        _ok(handler, db)
        return

    # ---- 示例数据 / 清空 ----
    if method == 'POST' and res == 'seed':
        db.seed()
        _ok(handler, db)
        return
    if method == 'POST' and res == 'reset':
        db.reset()
        _ok(handler, db)
        return

    _err(handler, 404, '接口不存在: %s %s' % (method, handler.path))
