# -*- coding: utf-8 -*-
"""Model 层：SQLite 数据库访问（DAO）。

所有业务数据的唯一持久化来源是本地 SQLite 文件 db/workstation.db。
字段命名：API/前端使用 camelCase，数据库列使用 snake_case，读写时在此层做映射。
"""
import json
import os
import re
import time
import uuid
import datetime
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(BASE_DIR, 'db')
DB_PATH = os.path.join(DB_DIR, 'workstation.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  xh TEXT,
  name TEXT NOT NULL DEFAULT '',
  gender TEXT DEFAULT '', origin TEXT DEFAULT '', cls TEXT DEFAULT '',
  dorm TEXT DEFAULT '', nation TEXT DEFAULT '', zzmm TEXT DEFAULT '',
  address TEXT DEFAULT '', qq TEXT DEFAULT '', phone TEXT DEFAULT '',
  f_name TEXT DEFAULT '', f_phone TEXT DEFAULT '', f_work TEXT DEFAULT '',
  f_post TEXT DEFAULT '', f_zzmm TEXT DEFAULT '',
  m_name TEXT DEFAULT '', m_phone TEXT DEFAULT '', m_work TEXT DEFAULT '',
  m_post TEXT DEFAULT '', m_zzmm TEXT DEFAULT '',
  major TEXT DEFAULT '', family TEXT DEFAULT '',
  concerns TEXT NOT NULL DEFAULT '[]',
  note TEXT DEFAULT '',
  created_at INTEGER, updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_xh ON students(xh) WHERE xh IS NOT NULL AND xh != '';

CREATE TABLE IF NOT EXISTS talks (
  id TEXT PRIMARY KEY,
  sid TEXT DEFAULT '', sname TEXT DEFAULT '',
  time TEXT DEFAULT '', topic TEXT DEFAULT '', level TEXT DEFAULT 'g',
  place TEXT DEFAULT '', talker TEXT DEFAULT '', traits TEXT DEFAULT '',
  content TEXT DEFAULT '',
  follow_up TEXT DEFAULT '', follow_date TEXT DEFAULT '', done INTEGER DEFAULT 0,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
  date TEXT DEFAULT '', size TEXT DEFAULT '',
  note TEXT DEFAULT '', source TEXT DEFAULT '', rel_path TEXT DEFAULT '',
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS portraits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT UNIQUE, tags TEXT NOT NULL DEFAULT '[]', updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, value TEXT
);
"""

DEFAULT_SETTINGS = {
    'passHash': '',
    'talker': '',
    'topicDict': ['入学适应', '学业指导', '心理健康', '情感人际', '家庭经济', '职业规划', '纪律安全', '党团发展', '资助帮扶', '其他'],
    'catDict': ['谈心谈话', '通知文件', '活动材料', '评奖评优', '资助材料', '党团材料', '安全材料', '心理材料', '其他'],
}

# 学生字段映射：API(camelCase) <-> 数据库列(snake_case)
STUDENT_API_KEYS = [
    'xh', 'name', 'gender', 'origin', 'cls', 'dorm', 'nation', 'zzmm', 'address', 'qq', 'phone',
    'fName', 'fPhone', 'fWork', 'fPost', 'fZzmm',
    'mName', 'mPhone', 'mWork', 'mPost', 'mZzmm',
    'major', 'family', 'concerns', 'note',
]
STUDENT_DB_COLS = [
    'xh', 'name', 'gender', 'origin', 'cls', 'dorm', 'nation', 'zzmm', 'address', 'qq', 'phone',
    'f_name', 'f_phone', 'f_work', 'f_post', 'f_zzmm',
    'm_name', 'm_phone', 'm_work', 'm_post', 'm_zzmm',
    'major', 'family', 'concerns', 'note',
]
STUDENT_MAP = dict(zip(STUDENT_API_KEYS, STUDENT_DB_COLS))


def _now():
    return int(time.time() * 1000)


def _today():
    return datetime.date.today().isoformat()


def _uid():
    return uuid.uuid4().hex[:13]


def _norm_concerns(raw):
    """把 concerns 规范化为 [{t,l}]（兼容旧数据：字符串 -> {t, 黄}）。"""
    out = []
    if not isinstance(raw, list):
        return out
    for c in raw:
        if isinstance(c, dict) and c.get('t'):
            lv = c.get('l')
            out.append({'t': str(c['t']), 'l': lv if lv in ('红', '橙', '黄') else '黄'})
        elif isinstance(c, str) and c.strip():
            out.append({'t': c.strip(), 'l': '黄'})
    return out


class Database:
    def __init__(self, path=None):
        self.path = path or DB_PATH
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    # ---------- 内部工具 ----------
    def _exec(self, sql, params=()):
        cur = self.conn.execute(sql, params)
        self.conn.commit()
        return cur

    def _q(self, table, sql_where='', params=()):
        cur = self.conn.execute('SELECT * FROM %s %s' % (table, sql_where), params)
        return [dict(r) for r in cur.fetchall()]

    # ---------- 序列化 ----------
    def _student_from_db(self, row):
        d = {}
        for api, col in STUDENT_MAP.items():
            d[api] = row.get(col)
        d['id'] = row.get('id')
        d['createdAt'] = row.get('created_at')
        d['updatedAt'] = row.get('updated_at')
        try:
            d['concerns'] = _norm_concerns(json.loads(d['concerns'] or '[]'))
        except Exception:
            d['concerns'] = []
        return d

    def _student_to_db(self, s):
        vals = {}
        for api, col in STUDENT_MAP.items():
            if api == 'concerns':
                vals[col] = json.dumps(_norm_concerns(s.get('concerns')), ensure_ascii=False)
            else:
                vals[col] = s.get(api) or ''
        vals['id'] = s.get('id')
        vals['created_at'] = s.get('createdAt')
        vals['updated_at'] = s.get('updatedAt')
        return vals

    def _talk_from_db(self, row):
        return {
            'id': row.get('id'), 'sid': row.get('sid'), 'sname': row.get('sname'),
            'time': row.get('time'), 'topic': row.get('topic'), 'level': row.get('level') or 'g',
            'place': row.get('place'), 'talker': row.get('talker'), 'traits': row.get('traits'),
            'content': row.get('content'), 'followUp': row.get('follow_up'),
            'followDate': row.get('follow_date'), 'done': bool(row.get('done')),
            'createdAt': row.get('created_at'), 'updatedAt': row.get('updated_at'),
        }

    def _talk_to_db(self, t):
        return {
            'id': t.get('id'), 'sid': t.get('sid'), 'sname': t.get('sname') or '',
            'time': t.get('time') or '', 'topic': t.get('topic') or '',
            'level': t.get('level') or 'g', 'place': t.get('place') or '',
            'talker': t.get('talker') or '', 'traits': t.get('traits') or '',
            'content': t.get('content') or '', 'follow_up': t.get('followUp') or '',
            'follow_date': t.get('followDate') or '', 'done': 1 if t.get('done') else 0,
            'created_at': t.get('createdAt'), 'updated_at': t.get('updatedAt'),
        }

    def _file_from_db(self, row):
        tags = []
        try:
            tags = json.loads(row.get('tags') or '[]')
        except Exception:
            pass
        return {
            'id': row.get('id'), 'name': row.get('name'), 'category': row.get('category') or '',
            'tags': tags, 'date': row.get('date') or '', 'size': row.get('size') or '',
            'note': row.get('note') or '', 'source': row.get('source') or '注册',
            'relPath': row.get('rel_path') or '', 'createdAt': row.get('created_at'),
            'updatedAt': row.get('updated_at'),
        }

    def _file_to_db(self, f):
        return {
            'id': f.get('id'), 'name': f.get('name') or '', 'category': f.get('category') or '',
            'tags': json.dumps(f.get('tags') or [], ensure_ascii=False), 'date': f.get('date') or '',
            'size': f.get('size') or '', 'note': f.get('note') or '',
            'source': f.get('source') or '注册', 'rel_path': f.get('relPath') or '',
            'created_at': f.get('createdAt'), 'updated_at': f.get('updatedAt'),
        }

    # ---------- 读取 ----------
    def state(self):
        students = [self._student_from_db(r) for r in self._q('students', 'ORDER BY cls, xh')]
        talks = [self._talk_from_db(r) for r in self._q('talks')]
        files = [self._file_from_db(r) for r in self._q('files')]
        portraits = []
        for r in self._q('portraits'):
            try:
                tags = json.loads(r.get('tags') or '[]')
            except Exception:
                tags = []
            portraits.append({'sid': r.get('sid'), 'tags': tags, 'updatedAt': r.get('updated_at')})
        settings = dict(DEFAULT_SETTINGS)
        for r in self._q('settings'):
            try:
                settings[r['key']] = json.loads(r['value'])
            except Exception:
                settings[r['key']] = r['value']
        meta = {'version': 1, 'seedAt': None, 'lastBackup': None}
        for r in self._q('meta'):
            try:
                meta[r['key']] = json.loads(r['value'])
            except Exception:
                meta[r['key']] = r['value']
        return {
            'students': students, 'talks': talks, 'files': files,
            'portraits': portraits, 'settings': settings, 'meta': meta,
        }

    # ---------- 学生 ----------
    def _xh_owner(self, exclude_id=None):
        rows = self._q('students', "WHERE xh IS NOT NULL AND xh != ''")
        m = {}
        for r in rows:
            if r['id'] != exclude_id and r['xh']:
                m[r['xh']] = r['name']
        return m

    def add_student(self, s):
        s = dict(s)
        s.setdefault('id', _uid())
        s.setdefault('createdAt', _now())
        s.setdefault('updatedAt', _now())
        xh = (s.get('xh') or '').strip()
        if xh:
            owner = self._xh_owner()
            if xh in owner:
                return None, '学号 %s 已存在（%s）' % (xh, owner[xh])
        vals = self._student_to_db(s)
        cols = ', '.join(vals.keys())
        ph = ', '.join(['?'] * len(vals))
        self._exec('INSERT INTO students (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        return self._student_from_db(self._q('students', 'WHERE id=?', (s['id'],))[0]), None

    def update_student(self, sid, s):
        xh = (s.get('xh') or '').strip()
        if xh:
            owner = self._xh_owner(exclude_id=sid)
            if xh in owner:
                return None, '学号 %s 已存在（%s）' % (xh, owner[xh])
        vals = self._student_to_db(s)
        vals.pop('id', None)
        vals.pop('created_at', None)
        sets = ', '.join('%s=?' % k for k in vals.keys())
        self._exec('UPDATE students SET %s, updated_at=? WHERE id=?' % sets,
                   list(vals.values()) + [s.get('updatedAt') or _now(), sid])
        rows = self._q('students', 'WHERE id=?', (sid,))
        if not rows:
            return None, '学生不存在'
        return self._student_from_db(rows[0]), None

    def delete_student(self, sid):
        self._exec('DELETE FROM students WHERE id=?', (sid,))

    def import_students(self, records):
        """批量导入：学号唯一，重复跳过并返回明细。records 含 row 行号。"""
        out = []
        skips = []
        seen = set()
        exist = self._xh_owner()
        now = _now()
        for rec in records:
            xh = (rec.get('xh') or '').strip()
            name = (rec.get('name') or '').strip()
            row_no = rec.get('row') or 0
            if not xh and not name:
                skips.append({'row': row_no, 'xh': '', 'name': '', 'reason': '姓名与学号均为空'})
                continue
            if xh and xh in exist:
                skips.append({'row': row_no, 'xh': xh, 'name': name, 'reason': '学号已存在（%s）' % exist[xh]})
                continue
            if xh and xh in seen:
                skips.append({'row': row_no, 'xh': xh, 'name': name, 'reason': '文件内学号重复'})
                continue
            if xh:
                seen.add(xh)
            s = {k: rec.get(k, '') for k in STUDENT_API_KEYS}
            s['id'] = _uid()
            s['createdAt'] = now
            s['updatedAt'] = now
            vals = self._student_to_db(s)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO students (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
            out.append(s)
        return {'imported': len(out), 'skips': skips}

    # ---------- 谈话 ----------
    def add_talk(self, t):
        t = dict(t)
        t.setdefault('id', _uid())
        t.setdefault('createdAt', _now())
        t.setdefault('updatedAt', _now())
        t.setdefault('done', False)
        sname = ''
        if t.get('sid'):
            rows = self._q('students', 'WHERE id=?', (t['sid'],))
            if rows:
                sname = rows[0]['name']
        t['sname'] = sname
        vals = self._talk_to_db(t)
        cols = ', '.join(vals.keys())
        ph = ', '.join(['?'] * len(vals))
        self._exec('INSERT INTO talks (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        return self._talk_from_db(self._q('talks', 'WHERE id=?', (t['id'],))[0])

    def update_talk(self, tid, t):
        sname = ''
        if t.get('sid'):
            rows = self._q('students', 'WHERE id=?', (t['sid'],))
            if rows:
                sname = rows[0]['name']
        t['sname'] = sname
        vals = self._talk_to_db(t)
        vals.pop('id', None)
        vals.pop('created_at', None)
        sets = ', '.join('%s=?' % k for k in vals.keys())
        self._exec('UPDATE talks SET %s, updated_at=? WHERE id=?' % sets,
                   list(vals.values()) + [t.get('updatedAt') or _now(), tid])

    def delete_talk(self, tid):
        self._exec('DELETE FROM talks WHERE id=?', (tid,))

    def mark_follow_done(self, tid):
        self._exec('UPDATE talks SET done=1, updated_at=? WHERE id=?', (_now(), tid))

    # ---------- 文件索引 ----------
    def add_file(self, f):
        f = dict(f)
        f.setdefault('id', _uid())
        f.setdefault('createdAt', _now())
        f.setdefault('updatedAt', _now())
        vals = self._file_to_db(f)
        cols = ', '.join(vals.keys())
        ph = ', '.join(['?'] * len(vals))
        self._exec('INSERT INTO files (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        return self._file_from_db(self._q('files', 'WHERE id=?', (f['id'],))[0])

    def update_file(self, fid, f):
        vals = self._file_to_db(f)
        vals.pop('id', None)
        vals.pop('created_at', None)
        sets = ', '.join('%s=?' % k for k in vals.keys())
        self._exec('UPDATE files SET %s, updated_at=? WHERE id=?' % sets,
                   list(vals.values()) + [f.get('updatedAt') or _now(), fid])

    def delete_file(self, fid):
        self._exec('DELETE FROM files WHERE id=?', (fid,))

    # ---------- 画像标签 ----------
    def add_portrait_tag(self, sid, tag):
        rows = self._q('portraits', 'WHERE sid=?', (sid,))
        tags = []
        if rows:
            try:
                tags = json.loads(rows[0]['tags'] or '[]')
            except Exception:
                tags = []
            if tag in tags:
                return False, '该标签已存在'
            tags.append(tag)
            self._exec('UPDATE portraits SET tags=?, updated_at=? WHERE sid=?',
                       (json.dumps(tags, ensure_ascii=False), _now(), sid))
        else:
            tags = [tag]
            self._exec('INSERT INTO portraits (sid, tags, updated_at) VALUES (?,?,?)',
                       (sid, json.dumps(tags, ensure_ascii=False), _now()))
        return True, None

    # ---------- 设置 / 元数据 ----------
    def save_settings(self, s):
        allowed = set(DEFAULT_SETTINGS.keys())
        for k, v in (s or {}).items():
            if k in allowed:
                self._exec('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)',
                           (k, json.dumps(v, ensure_ascii=False)))

    def set_meta(self, key, val):
        self._exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)',
                   (key, json.dumps(val, ensure_ascii=False)))

    # ---------- 导入旧备份 / 示例 / 清空 ----------
    def import_backup(self, d):
        """导入旧版备份 JSON（含 students/talks/files/portraits/settings/meta）。"""
        now = _now()
        # 清空后导入，保证与备份一致
        for table in ('students', 'talks', 'files', 'portraits', 'settings', 'meta'):
            self._exec('DELETE FROM %s' % table)
        for s in (d.get('students') or []):
            s = dict(s)
            s.setdefault('id', _uid())
            s.setdefault('createdAt', now)
            s.setdefault('updatedAt', now)
            vals = self._student_to_db(s)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO students (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        for t in (d.get('talks') or []):
            t = dict(t)
            t.setdefault('id', _uid())
            t.setdefault('createdAt', now)
            t.setdefault('updatedAt', now)
            t.setdefault('done', False)
            vals = self._talk_to_db(t)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO talks (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        for f in (d.get('files') or []):
            f = dict(f)
            f.setdefault('id', _uid())
            f.setdefault('createdAt', now)
            f.setdefault('updatedAt', now)
            vals = self._file_to_db(f)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO files (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        for p in (d.get('portraits') or []):
            self._exec('INSERT OR REPLACE INTO portraits (sid, tags, updated_at) VALUES (?,?,?)',
                       (p.get('sid'), json.dumps(p.get('tags') or [], ensure_ascii=False), p.get('updatedAt') or now))
        self.save_settings(d.get('settings'))
        meta = d.get('meta') or {}
        for k, v in meta.items():
            self.set_meta(k, v)

    def seed(self):
        now = _now()
        ss = [
            {'xh': '202600101', 'name': '张雨桐', 'gender': '女', 'cls': '生科2601', 'origin': '山东青岛', 'dorm': '3号楼521', 'nation': '汉族', 'zzmm': '共青团员', 'address': '山东省青岛市黄岛区XX路1号', 'qq': '100861001', 'phone': '138****1101', 'fName': '张海涛', 'fPhone': '139****0101', 'fWork': '青岛XX机械厂', 'fPost': '车间主任', 'fZzmm': '中共党员', 'mName': '刘春梅', 'mPhone': '139****0102', 'mWork': '青岛XX医院', 'mPost': '护士长', 'mZzmm': '群众', 'concerns': [], 'note': ''},
            {'xh': '202600102', 'name': '李明轩', 'gender': '男', 'cls': '生科2601', 'origin': '山东济南', 'dorm': '5号楼312', 'nation': '汉族', 'zzmm': '共青团员', 'address': '山东省济南市历下区XX街', 'qq': '', 'phone': '138****1102', 'fName': '', 'fPhone': '', 'fWork': '', 'fPost': '', 'fZzmm': '', 'mName': '王秀兰', 'mPhone': '139****0202', 'mWork': '济南XX超市', 'mPost': '营业员', 'mZzmm': '群众', 'concerns': [{'t': '经济', 'l': '黄'}], 'note': ''},
            {'xh': '202600103', 'name': '王梓萱', 'gender': '女', 'cls': '生科2601', 'origin': '河南郑州', 'dorm': '3号楼522', 'nation': '回族', 'zzmm': '群众', 'address': '河南省郑州市金水区XX路', 'qq': '100861003', 'phone': '138****1103', 'fName': '王建军', 'fPhone': '139****0301', 'fWork': '郑州XX集团', 'fPost': '工程师', 'fZzmm': '中共党员', 'mName': '李红', 'mPhone': '139****0302', 'mWork': '郑州XX小学', 'mPost': '教师', 'mZzmm': '群众', 'concerns': [{'t': '心理', 'l': '橙'}], 'note': '性格偏内向'},
            {'xh': '202600104', 'name': '刘一鸣', 'gender': '男', 'cls': '生科2602', 'origin': '江苏南京', 'dorm': '5号楼313', 'nation': '汉族', 'zzmm': '共青团员', 'address': '江苏省南京市鼓楼区XX路', 'qq': '', 'phone': '138****1104', 'fName': '刘强', 'fPhone': '139****0401', 'fWork': '南京XX物流', 'fPost': '主管', 'fZzmm': '群众', 'mName': '陈芳', 'mPhone': '', 'mWork': '', 'mPost': '', 'mZzmm': '', 'concerns': [], 'note': '班级体育委员'},
            {'xh': '202600105', 'name': '陈思远', 'gender': '男', 'cls': '生科2602', 'origin': '山东潍坊', 'dorm': '5号楼314', 'nation': '汉族', 'zzmm': '共青团员', 'address': '山东省潍坊市奎文区XX巷', 'qq': '100861005', 'phone': '138****1105', 'fName': '陈国栋', 'fPhone': '139****0501', 'fWork': '潍坊XX农业合作社', 'fPost': '理事长', 'fZzmm': '群众', 'mName': '孙秀英', 'mPhone': '139****0502', 'mWork': '潍坊XX服装厂', 'mPost': '工人', 'mZzmm': '群众', 'concerns': [{'t': '经济', 'l': '红'}, {'t': '学业', 'l': '橙'}], 'note': ''},
            {'xh': '202600106', 'name': '赵可欣', 'gender': '女', 'cls': '生科2602', 'origin': '湖南长沙', 'dorm': '3号楼523', 'nation': '汉族', 'zzmm': '中共预备党员', 'address': '湖南省长沙市岳麓区XX路', 'qq': '100861006', 'phone': '138****1106', 'fName': '赵志刚', 'fPhone': '139****0601', 'fWork': '长沙XX银行', 'fPost': '客户经理', 'fZzmm': '中共党员', 'mName': '周敏', 'mPhone': '139****0602', 'mWork': '长沙XX中学', 'mPost': '教师', 'mZzmm': '群众', 'concerns': [], 'note': '学生骨干'},
        ]
        tks = [
            {'sid': None, 'time': '2026-10-08', 'talker': '王怡硕', 'place': '办公室', 'topic': '入学适应', 'level': 'g', 'content': '了解入校适应情况，作息与课程节奏已基本适应，宿舍关系融洽，暂无困难。', 'traits': '开朗', 'followUp': '', 'followDate': ''},
            {'sid': None, 'time': '2026-10-10', 'talker': '王怡硕', 'place': '办公室', 'topic': '家庭经济', 'level': 'a', 'content': '家庭经济压力较大，已提示申请困难认定与助学金，正在准备材料。', 'traits': '较要强，不愿主动求助', 'followUp': '跟进困难认定材料', 'followDate': '2026-10-20'},
            {'sid': None, 'time': '2026-10-12', 'talker': '王怡硕', 'place': '操场', 'topic': '心理健康', 'level': 'a', 'content': '近期入睡困难、情绪低落，建议尝试规律作息与运动，鼓励其预约心理中心咨询。', 'traits': '内向敏感', 'followUp': '一周后回访状态', 'followDate': '2026-10-19'},
            {'sid': None, 'time': '2026-10-14', 'talker': '王怡硕', 'place': '线上', 'topic': '纪律安全', 'level': 'g', 'content': '就寝前晚归情况沟通，已了解宿舍公约要求，表示会注意。', 'traits': '', 'followUp': '', 'followDate': ''},
            {'sid': None, 'time': '2026-10-15', 'talker': '王怡硕', 'place': '办公室', 'topic': '学业指导', 'level': 'a', 'content': '高数期中模拟不理想，已约学习委员组队帮扶，制定每日复习计划。', 'traits': '基础薄弱但肯学', 'followUp': '查看复习计划执行', 'followDate': '2026-10-22'},
            {'sid': None, 'time': '2026-10-16', 'talker': '王怡硕', 'place': '办公室', 'topic': '党团发展', 'level': 'g', 'content': '了解入党意愿与思想汇报情况，鼓励继续学习党章，参与支部活动。', 'traits': '积极上进', 'followUp': '', 'followDate': ''},
            {'sid': None, 'time': '2026-10-18', 'talker': '王怡硕', 'place': '办公室', 'topic': '职业规划', 'level': 'g', 'content': '对保研与科研方向感兴趣，建议先联系学业导师参与组会。', 'traits': '目标明确', 'followUp': '', 'followDate': ''},
            {'sid': None, 'time': '2026-10-19', 'talker': '王怡硕', 'place': '办公室', 'topic': '心理健康', 'level': 'r', 'content': '回访：情绪较上次好转，已预约心理中心初次访谈，继续关注。', 'traits': '有进步', 'followUp': '两周后再次回访', 'followDate': '2026-11-02'},
        ]
        fls = [
            {'name': '2026-10-08_谈心_张雨桐.docx', 'category': '谈心谈话', 'tags': ['入学适应'], 'date': '2026-10-08', 'size': '24 KB', 'note': '', 'source': '示例数据', 'relPath': ''},
            {'name': '2026-10-10_谈心_李明轩.docx', 'category': '谈心谈话', 'tags': ['经济'], 'date': '2026-10-10', 'size': '22 KB', 'note': '', 'source': '示例数据', 'relPath': ''},
            {'name': '2026年10月新生班会记录.docx', 'category': '通知文件', 'tags': ['班会'], 'date': '2026-10-05', 'size': '36 KB', 'note': '', 'source': '示例数据', 'relPath': ''},
            {'name': '2026级困难认定汇总表.xlsx', 'category': '资助材料', 'tags': ['困难认定'], 'date': '2026-10-11', 'size': '58 KB', 'note': '', 'source': '示例数据', 'relPath': ''},
            {'name': '2026级军训风采活动照片.zip', 'category': '活动材料', 'tags': ['军训'], 'date': '2026-09-20', 'size': '12 MB', 'note': '', 'source': '示例数据', 'relPath': ''},
            {'name': '心理中心-重点关注学生名单.xlsx', 'category': '心理材料', 'tags': ['心理'], 'date': '2026-10-13', 'size': '15 KB', 'note': '注意保密', 'source': '示例数据', 'relPath': ''},
        ]
        for i, s in enumerate(ss):
            s['id'] = _uid()
            s['createdAt'] = now
            s['updatedAt'] = now
            tks[i]['sid'] = ss[i]['id']
        for t in tks:
            t['id'] = _uid()
            t['createdAt'] = now
            t['updatedAt'] = now
            t['done'] = False
            t['followDate'] = t['followDate'] or ''
            t['content'] = t['content'] or ''
            sname = ''
            for s in ss:
                if s['id'] == t['sid']:
                    sname = s['name']
            t['sname'] = sname
        for f in fls:
            f['id'] = _uid()
            f['createdAt'] = now
            f['updatedAt'] = now
        for s in ss:
            vals = self._student_to_db(s)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO students (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        for t in tks:
            vals = self._talk_to_db(t)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO talks (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        for f in fls:
            vals = self._file_to_db(f)
            cols = ', '.join(vals.keys())
            ph = ', '.join(['?'] * len(vals))
            self._exec('INSERT INTO files (%s) VALUES (%s)' % (cols, ph), list(vals.values()))
        self.set_meta('seedAt', now)

    def reset(self):
        for table in ('students', 'talks', 'files', 'portraits', 'settings', 'meta'):
            self._exec('DELETE FROM %s' % table)
