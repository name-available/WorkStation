# -*- coding: utf-8 -*-
"""Controller 层：REST API 路由处理。

负责解析请求、调用 Model(数据库)、返回 JSON 响应。
所有写操作成功后返回 {state: <最新全量数据>}，前端直接用最新状态重渲染。
"""
import email
import email.policy
import json
import os
import re
import sqlite3
import urllib.parse

from models.db import Database, DB_PATH, TEST_DB_PATH


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
    # v2.5：活动数据库挂在 server 实例上（设置可切换 正式库/空测试库）
    db = getattr(getattr(handler, 'server', None), 'ws_db', None) or db
    try:
        _dispatch(handler, db, method)
    except sqlite3.IntegrityError as e:
        _err(handler, 400, '数据唯一性冲突：' + str(e))
    except Exception as e:  # noqa
        _err(handler, 500, '服务器错误：' + str(e))


def _db_kind(path):
    """返回当前库类型：正式库 / 测试库。"""
    try:
        if os.path.abspath(path) == os.path.abspath(TEST_DB_PATH):
            return 'empty'
        if os.path.abspath(path) == os.path.abspath(DB_PATH):
            return 'main'
    except Exception:
        pass
    return 'other'


def _dispatch(handler, db, method):
    parts = _path_parts(handler.path)  # ['api', ...]
    if len(parts) < 2 or parts[0] != 'api':
        _err(handler, 404, 'not found')
        return
    res = parts[1]

    if method == 'GET' and res == 'state':
        _ok(handler, db)
        return

    # ---- 数据库连接信息（设置-连接数据库） ----
    if method == 'GET' and res == 'dbinfo':
        _p = os.path.abspath(db.path)
        _sz = os.path.getsize(_p) if os.path.exists(_p) else 0
        _st = db.state()
        _ok(handler, db, {'db': {
            'path': _p,
            'name': os.path.basename(_p),
            'kind': _db_kind(_p),
            'size': _sz,
            'sizeMB': round(_sz / 1048576.0, 2),
            'students': len(_st.get('students') or []),
            'talks': len(_st.get('talks') or []),
            'files': len(_st.get('files') or []),
        }})
        return

    # ---- 导出 db 格式备份（下载数据库文件副本） ----
    if method == 'GET' and res == 'backup' and len(parts) >= 3 and parts[2] == 'db':
        import datetime
        _p = db.path
        if not os.path.exists(_p):
            _err(handler, 404, '数据库文件不存在')
            return
        try:
            with open(_p, 'rb') as _f:
                _data = _f.read()
        except Exception as e:  # noqa
            _err(handler, 500, '读取数据库文件失败：' + str(e))
            return
        _fname = '辅导员工作站数据库备份_%s.db' % datetime.date.today().isoformat()
        handler.send_response(200)
        handler.send_header('Content-Type', 'application/octet-stream')
        handler.send_header('Content-Disposition',
                            "attachment; filename*=UTF-8''%s" % urllib.parse.quote(_fname))
        handler.send_header('Content-Length', str(len(_data)))
        handler.end_headers()
        handler.wfile.write(_data)
        return

    # ---- 打开数据库所在文件夹 ----
    if method == 'POST' and res == 'db' and len(parts) >= 3 and parts[2] == 'openfolder':
        db.open_db_dir()
        _ok(handler, db, {'ok': True})
        return

    # ---- 文件中心：导入文件到本地文件夹（multipart，须在读取 JSON body 之前处理） ----
    if method == 'POST' and res == 'files' and len(parts) >= 3 and parts[2] == 'import':
        fields = _parse_multipart(handler)
        date = (fields.get('date') or '').strip()
        category = (fields.get('category') or '').strip()
        note = (fields.get('note') or '').strip()
        up = fields.get('file')
        if not up or not up.get('content'):
            _err(handler, 400, '请选择要导入的文件')
            return
        if len(up['content']) > 200 * 1024 * 1024:
            _err(handler, 400, '文件过大（超过 200 MB）')
            return
        tags = [t.strip() for t in re.split(r'[,，、]', fields.get('tags') or '') if t.strip()]
        f, err = db.save_file_import(
            up['content'], up.get('filename') or '', _fmt_size(len(up['content'])),
            date or None, category, tags, note)
        if err:
            _err(handler, 500, err)
            return
        _ok(handler, db, {'payload': {'file': {'id': f['id'], 'name': f['name'], 'relPath': f['relPath']}}})
        return

    # ---- 文件中心：预览（使用默认浏览器打开文件本体） ----
    if method == 'GET' and res == 'files' and len(parts) >= 4 and parts[3] == 'open':
        absp, err = db.file_abs_path(parts[2])
        if err:
            _err(handler, 404, err)
            return
        _ext = os.path.splitext(absp)[1].lower()
        _ctype = {
            '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
            '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
            '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
            '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
            '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
        }.get(_ext, 'application/octet-stream')
        try:
            with open(absp, 'rb') as _fh:
                _data = _fh.read()
        except Exception as e:  # noqa
            _err(handler, 500, '读取文件失败：' + str(e))
            return
        _disp = 'inline' if _ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp',
                                     '.pdf', '.txt', '.md', '.csv', '.html', '.htm', '.json') else 'attachment'
        handler.send_response(200)
        handler.send_header('Content-Type', _ctype)
        handler.send_header('Content-Disposition', _disp)
        handler.send_header('Content-Length', str(len(_data)))
        handler.end_headers()
        handler.wfile.write(_data)
        return

    # ---- 文件中心：打开文件所在地（在访达中定位文件） ----
    if method == 'POST' and res == 'files' and len(parts) >= 4 and parts[3] == 'openfolder':
        ok, msg = db.open_file_in_finder(parts[2])
        if not ok:
            _err(handler, 400, msg or '无法打开文件所在地')
            return
        _ok(handler, db, {'ok': True})
        return

    # ---- 导入 DATABASE 备份（multipart：校验 SQLite 魔数与必需表，覆盖当前活动库后重连） ----
    if method == 'POST' and res == 'backup' and len(parts) >= 3 and parts[2] == 'import-db':
        fields = _parse_multipart(handler)
        up = fields.get('file')
        if not up or not up.get('content'):
            _err(handler, 400, '请选择 DATABASE（.db）备份文件')
            return
        _data = up['content']
        if len(_data) < 16 or _data[:16] != b'SQLite format 3\x00':
            _err(handler, 400, '文件不是有效的 SQLite 数据库备份')
            return
        _tmp = db.path + '.importtmp'
        try:
            with open(_tmp, 'wb') as _fh:
                _fh.write(_data)
            _chk = sqlite3.connect(_tmp)
            _tabs = [r[0] for r in _chk.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            _chk.close()
            if 'students' not in _tabs or 'talks' not in _tabs:
                _err(handler, 400, '备份数据库缺少 students / talks 表，不是工作站数据库')
                return
            db.close()
            os.replace(_tmp, db.path)
            _ndb = Database(db.path)
        except Exception as e:  # noqa
            try:
                if os.path.exists(_tmp):
                    os.remove(_tmp)
            except Exception:
                pass
            _err(handler, 500, '导入 DATABASE 备份失败：' + str(e))
            return
        handler.server.ws_db = _ndb
        _ok(handler, _ndb)
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

    # ---- 谈话：附件上传（multipart：照片 / 谈话记录文档，命名 YYYYMMDD-姓名-类型-编号） ----
    if method == 'POST' and res == 'talks' and len(parts) >= 3 and parts[2] == 'upload':
        fields = _parse_multipart(handler)
        sid = (fields.get('sid') or '').strip()
        ftype = (fields.get('type') or '谈话记录').strip()
        date = (fields.get('date') or '').strip()
        up = fields.get('file')
        if not sid or not up or not up.get('content'):
            _err(handler, 400, '参数缺失：请选择学生与附件文件')
            return
        stu = None
        for x in db.state()['students']:
            if x['id'] == sid:
                stu = x
                break
        if not stu:
            _err(handler, 400, '学生不存在')
            return
        if ftype not in ('谈话记录', '照片'):
            ftype = '谈话记录'
        if len(up['content']) > 100 * 1024 * 1024:
            _err(handler, 400, '文件过大（超过 100 MB）')
            return
        f, err = db.save_talk_upload(
            sid, stu['name'], ftype, up['content'],
            up.get('filename') or '', _fmt_size(len(up['content'])), date or None)
        if err:
            _err(handler, 500, err)
            return
        _ok(handler, db, {'payload': {'file': {'id': f['id'], 'name': f['name']}}})
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
        # 兼容旧版奖助项目材料索引：pid 仅作为记录保留，不再校验项目存在
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

    # ---- 切换数据库：正式库 / 空测试库（设置-数据存储-链接空库） ----
    if method == 'POST' and res == 'db' and len(parts) >= 3 and parts[2] == 'switch':
        target = (body.get('target') or 'main').strip()
        if target == 'empty':
            _path = TEST_DB_PATH
        else:
            _path = DB_PATH
        try:
            db.close()
            _ndb = Database(_path)
        except Exception as e:  # noqa
            _err(handler, 500, '切换数据库失败：' + str(e))
            return
        handler.server.ws_db = _ndb
        _p = os.path.abspath(_ndb.path)
        _st = _ndb.state()
        _ok(handler, _ndb, {'db': {
            'path': _p,
            'name': os.path.basename(_p),
            'kind': _db_kind(_p),
            'size': os.path.getsize(_p) if os.path.exists(_p) else 0,
            'students': len(_st.get('students') or []),
            'talks': len(_st.get('talks') or []),
            'files': len(_st.get('files') or []),
        }})
        return

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

    # ---- 批量导入奖学金 / 助学金 ----
    if method == 'POST' and res == 'import' and len(parts) >= 3 and parts[2] in ('scholarships', 'grants'):
        records = body.get('records') or []
        if not isinstance(records, list):
            _err(handler, 400, '参数缺失')
            return
        kind = 'scholarship' if parts[2] == 'scholarships' else 'grant'
        result = db.import_aid(kind, records)
        _ok(handler, db, {'imported': result['imported'], 'skips': result['skips']})
        return

    # ---- 删除单条奖学金 / 助学金 ----
    if method == 'DELETE' and res in ('scholarships', 'grants') and len(parts) >= 3:
        kind = 'scholarship' if res == 'scholarships' else 'grant'
        db.delete_aid(kind, parts[2])
        _ok(handler, db)
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

    # ---- 导入 JSON 备份 ----
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
