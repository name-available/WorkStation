'use strict';
/* ================= Model 层：数据访问 =================
 * 所有业务数据的唯一来源是后端 SQLite（通过 /api 接口）。
 * 每次写操作成功后，后端返回最新全量 state，前端直接替换本地缓存并重渲染。
 */
var Model = {
  data: null, // {students, talks, files, portraits, settings, meta}

  async load() {
    var json = await Model._api('GET', '/api/state');
    this.data = (json && json.state) ? json.state : null;
    return this.data;
  },

  /* 写操作：method='POST'/'PUT'/'DELETE'，返回后端 JSON（含 state） */
  async save(method, path, body) {
    var json = await Model._api(method, path, body);
    if (json && json.state) this.data = json.state;
    return json;
  },

  async _api(method, path, body) {
    var opt = { method: method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    var res = await fetch(path, opt);
    var json;
    try { json = await res.json(); } catch (e) { json = {}; }
    if (!res.ok) {
      var msg = (json && json.error) || ('请求失败（' + res.status + '）');
      throw new Error(msg);
    }
    return json;
  },

  /* 便捷读方法 */
  students() { return (this.data && this.data.students) || []; },
  talks() { return (this.data && this.data.talks) || []; },
  files() { return (this.data && this.data.files) || []; },
  portraits() { return (this.data && this.data.portraits) || []; },
  settings() { return (this.data && this.data.settings) || {}; },
  meta() { return (this.data && this.data.meta) || {}; },
  student(id) {
    if (!id) return null;
    return (this.students().find(function (s) { return s.id === id; })) || null;
  }
};
