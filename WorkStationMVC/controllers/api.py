# -*- coding: utf-8 -*-
"""Controller 层：REST API 路由处理。

负责解析请求、调用 Model(数据库)、返回 JSON 响应。
所有写操作成功后返回 {state: <最新全量数据>}，前端直接用最新状态重渲染。
"""
import email
import email.policy
import json
import re
import sqlite3
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


def _parse_multipart(handler):
    """解析 multipart/form-data 请求体 → {字段名: 字符串 | {'filename','content'}}。"""
    ctype = handler.headers.get('Content-Type') or ''
    m = re.search(r'boundary=(?:"([^"]+)"|([^;\s]+))', ctype, re.I)
    if not m:
        return {}
    boundary = m.group(1) or m.group(2)
    length = int(handler.headers.get('Content-Length') or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    header = ('Content-Type: multipart/form-data; boundary=%s\r\nMIME-Version: 1.0\r\n\r\n' % boundary).encode('utf-8')
    msg = email.message_from_bytes(header + raw, policy=email.policy.default)
    parts = {}
    if not msg.is_multipart():
        return parts
    for part in msg.iter_parts():
        name = part.get_param('name', header='content-disposition')
        if name is None:
            continue
        fname = part.get_filename()
        payload = part.get_payload(decode=True) or b''
        if fname:
            parts[name] = {'filename': fname, 'content': payload}
        else:
            try:
                parts[name] = payload.decode('utf-8')
            except Exception:
                parts[name] = ''
    return parts


def _fmt_size(n):
    if n < 1024:
        return '%d B' % n
    if n < 1024 * 1024:
        return '%.1f KB' % (n / 1024.0)
    return '%.1f MB' % (n / (1024.0 * 1024.0))


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
    """本地单机防护：仅允许本站页面（当前实际监听端口）发起写请求。"""
    origin = handler.headers.get('Origin')
    if not origin:
        return True
    port = getattr(handler.server, 'server_port', 8790)
    if origin in ('http://127.0.0.1:%d' % port, 'http://localhost:%d' % port):
        return True
    return False


def handle_api(handler, db, method):
    try:
        _dispatch(handler, db, method)
    except sqlite3.IntegrityError as e:
        _err(handler, 400, '数据唯一性冲突：' + str(e))
    except Exception as e:  # noqa
        _err(handler, 500, '服务器错误：' + str(e))


def _dispatch(handler, db, method):
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

    # ---- 重点关注：文件上传（multipart，须在读取 JSON body 之前处理） ----
    if method == 'POST' and res == 'focus' and len(parts) >= 3 and parts[2] == 'upload':
        fields = _parse_multipart(handler)
        sid = (fields.get('sid') or '').strip()
        ftype = (fields.get('type') or '其他').strip()
        date = (fields.get('date') or '').strip()
        up = fields.get('file')
        if not sid or not up or not up.get('content'):
            _err(handler, 400, '参数缺失：请选择学生与文件')
            return
        stu = None
        for x in db.state()['students']:
            if x['id'] == sid:
                stu = x
                break
        if not stu:
            _err(handler, 400, '学生不存在')
            return
        if len(up['content']) > 100 * 1024 * 1024:
            _err(handler, 400, '文件过大（超过 100 MB）')
            return
        f, err = db.save_focus_upload(
            sid, stu['name'], ftype, up['content'],
            up.get('filename') or '', _fmt_size(len(up['content'])), date or None)
        if err:
            _err(handler, 500, err)
            return
        _ok(handler, db, {'payload': {'file': {'id': f['id'], 'name': f['name']}}})
        return
    if method == 'POST' and res == 'focus' and len(parts) >= 3 and parts[2] == 'openfolder':
        db.open_focus_dir()
        _ok(handler, db)
        return

    # ---- 奖助：材料上传（multipart，须在读取 JSON body 之前处理） ----
    if method == 'POST' and res == 'aid' and len(parts) >= 3 and parts[2] == 'upload':
        fields = _parse_multipart(handler)
        sid = (fields.get('sid') or '').strip()
        pid = (fields.get('pid') or '').strip()
        ftype = (fields.get('type') or '其他').strip()
        date = (fields.get('date') or '').strip()
        up = fields.get('file')
        if not sid or not up or not up.get('content'):
            _err(handler, 400, '参数缺失：请选择学生与文件')
            return
        stu = None
        for x in db.state()['students']:
            if x['id'] == sid:
                stu = x
                break
        if not stu:
            _err(handler, 400, '学生不存在')
            return
        if pid:
            ok = False
            for p in db.state()['aidProjects']:
                if p['id'] == pid:
                    ok = True
                    break
            if not ok:
                _err(handler, 400, '奖助项目不存在')
                return
        if len(up['content']) > 100 * 1024 * 1024:
            _err(handler, 400, '文件过大（超过 100 MB）')
            return
        f, err = db.save_aid_upload(
            sid, pid, stu['name'], ftype, up['content'],
            up.get('filename') or '', _fmt_size(len(up['content'])), date or None)
        if err:
            _err(handler, 500, err)
            return
        _ok(handler, db, {'payload': {'file': {'id': f['id'], 'name': f['name']}}})
        return
    if method == 'POST' and res == 'aid' and len(parts) >= 3 and parts[2] == 'openfolder':
        db.open_aid_dir()
        _ok(handler, db)
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
        for k, v in (body.get('meta') or {}).items():
            db.set_meta(k, v)
        _ok(handler, db)
        return

    # ---- 批量导入学生（服务端去重） ----
    if method == 'POST' and res == 'import' and len(parts) >= 3 and parts[2] == 'students':
        records = body.get('records') or []
        result = db.import_students(records)
        _ok(handler, db, {'imported': result['imported'], 'skips': result['skips']})
        return

    # ---- 批量导入重点关注（学号绑定台账 + 类型/级别校验） ----
    if method == 'POST' and res == 'import' and len(parts) >= 3 and parts[2] == 'concerns':
        records = body.get('records') or []
        result = db.import_concerns(records)
        _ok(handler, db, {'imported': result['imported'], 'skips': result['skips']})
        return

    # ---- 批量导入困难认定名单 ----
    if method == 'POST' and res == 'import' and len(parts) >= 3 and parts[2] == 'hardship':
        records = body.get('records') or []
        if not isinstance(records, list):
            _err(handler, 400, '参数缺失')
            return
        result = db.import_hardship(records)
        _ok(handler, db, {'imported': result['imported'], 'skips': result['skips']})
        return

    # ---- 批量导入谈话 ----
    if method == 'POST' and res == 'import' and len(parts) >= 3 and parts[2] == 'talks':
        records = body.get('records') or []
        if not isinstance(records, list):
            _err(handler, 400, '参数缺失')
            return
        result = db.import_talks(records)
        _ok(handler, db, {'imported': result['imported'], 'skips': result['skips']})
        return

    # ---- 奖助管理 ----
    if method == 'POST' and res == 'aid' and len(parts) >= 3 and parts[2] == 'projects':
        p = body.get('project') or {}
        if not p.get('name'):
            _err(handler, 400, '项目名称不能为空')
            return
        _ok(handler, db, {'payload': {'project': db.add_aid_project(p)}})
        return
    if method == 'PUT' and res == 'aid' and len(parts) >= 4 and parts[2] == 'projects':
        _ok(handler, db, {'payload': {'project': db.update_aid_project(body.get('project') or {})}})
        return
    if method == 'DELETE' and res == 'aid' and len(parts) >= 4 and parts[2] == 'projects':
        db.delete_aid_project(parts[3])
        _ok(handler, db)
        return
    if method == 'POST' and res == 'aid' and len(parts) >= 3 and parts[2] == 'hardship':
        h = body.get('hardship') or {}
        if not h.get('sid') or not h.get('year'):
            _err(handler, 400, '学生与学年不能为空')
            return
        _ok(handler, db, {'payload': {'hardship': db.add_hardship(h)}})
        return
    if method == 'PUT' and res == 'aid' and len(parts) >= 4 and parts[2] == 'hardship':
        _ok(handler, db, {'payload': {'hardship': db.update_hardship(body.get('hardship') or {})}})
        return
    if method == 'DELETE' and res == 'aid' and len(parts) >= 4 and parts[2] == 'hardship':
        db.delete_hardship(parts[3])
        _ok(handler, db)
        return
    if method == 'POST' and res == 'aid' and len(parts) >= 3 and parts[2] == 'records':
        r = body.get('record') or {}
        if not r.get('pid') or not r.get('sid'):
            _err(handler, 400, '项目与学生不能为空')
            return
        _ok(handler, db, {'payload': {'record': db.add_aid_record(r)}})
        return
    if method == 'PUT' and res == 'aid' and len(parts) >= 4 and parts[2] == 'records':
        _ok(handler, db, {'payload': {'record': db.update_aid_record(body.get('record') or {})}})
        return
    if method == 'DELETE' and res == 'aid' and len(parts) >= 4 and parts[2] == 'records':
        db.delete_aid_record(parts[3])
        _ok(handler, db)
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
