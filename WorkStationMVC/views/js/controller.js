'use strict';
/* ================= Controller 层：路由与业务操作 =================
 * 负责：视图切换、表单收集与校验、调用 Model 写接口、操作后重渲染。
 * 每个写操作：Model.save(...) 成功 → Model 已持有最新 state → 重渲染当前视图。
 */

/* ---------- 路由 ---------- */
function go(v){
  curView=v;
  var i,items=document.querySelectorAll('.nav-item');
  for(i=0;i<items.length;i++){ items[i].className='nav-item'+(items[i].getAttribute('data-view')===v?' active':''); }
  var views=document.querySelectorAll('.view');
  for(i=0;i<views.length;i++){ views[i].classList.toggle('active', views[i].id==='view-'+v); }
  document.getElementById('viewTitle').textContent=VIEWS[v];
  document.getElementById('viewSub').textContent=VIEW_SUBS[v];
  document.getElementById('viewActions').innerHTML='';
  RENDERERS[v]();
  window.scrollTo(0,0);
}

/* ---------- 学生 ---------- */
function saveStudent(id){
  var xh=document.getElementById('sXh').value.trim();
  var name=document.getElementById('sName').value.trim();
  if(!xh && !name){ toast('请至少填写姓名或学号','err'); return; }
  if(xh){
    var dup=Model.students().find(function(s){ return s.xh===xh && s.id!==id; });
    if(dup){ toast('学号 '+xh+' 已存在（'+dup.name+'），请核对','err'); return; }
  }
  var concerns = id ? ((Model.student(id).concerns)||[]) : [];
  var obj = id ? Model.student(id) : { id:uid(), createdAt:Date.now() };
  obj.xh=xh; obj.name=name;
  obj.gender=document.getElementById('sGender').value;
  obj.origin=document.getElementById('sOrigin').value.trim();
  obj.cls=document.getElementById('sCls').value.trim();
  obj.dorm=document.getElementById('sDorm').value.trim();
  obj.nation=document.getElementById('sNation').value.trim();
  obj.zzmm=document.getElementById('sZzmm').value.trim();
  obj.address=document.getElementById('sAddr').value.trim();
  obj.qq=document.getElementById('sQq').value.trim();
  obj.phone=document.getElementById('sPhone').value.trim();
  obj.fName=document.getElementById('sFName').value.trim();
  obj.fPhone=document.getElementById('sFPhone').value.trim();
  obj.fWork=document.getElementById('sFWork').value.trim();
  obj.fPost=document.getElementById('sFPost').value.trim();
  obj.fZzmm=document.getElementById('sFZzmm').value.trim();
  obj.mName=document.getElementById('sMName').value.trim();
  obj.mPhone=document.getElementById('sMPhone').value.trim();
  obj.mWork=document.getElementById('sMWork').value.trim();
  obj.mPost=document.getElementById('sMPost').value.trim();
  obj.mZzmm=document.getElementById('sMZzmm').value.trim();
  obj.concerns=concerns;
  obj.note=document.getElementById('sNote').value.trim();
  obj.updatedAt=Date.now();
  (async function(){
    try{
      if(id){ await Model.save('PUT','/api/students/'+id,{student:obj}); }
      else { await Model.save('POST','/api/students',{student:obj}); }
      closeModal(); renderStudentsTable(); toast(id?'已保存修改':'已新增学生 '+name);
    }catch(e){ toast(e.message,'err'); }
  })();
}
function delStudent(id){
  var s=getStudent(id); if(!s) return;
  if(!confirmDlg('确定删除学生 '+s.name+'（'+s.xh+'）吗？\n该生的谈话记录与画像关联不会删除，但将不再关联姓名。')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/students/'+id);
      renderStudentsTable(); toast('已删除学生','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}

/* ---------- 谈话 ---------- */
function saveTalk(id){
  var sid=document.getElementById('tStu').getAttribute('data-sid');
  var time=document.getElementById('tTime').value;
  if(!sid){ toast('请先选择台账中的学生（输入姓名或学号）','err'); return; }
  if(!time){ toast('请填写谈话时间','err'); return; }
  var level='g';
  document.querySelectorAll('#lvSeg button').forEach(function(b){ if(b.classList.contains('on')) level=b.getAttribute('data-lv'); });
  var obj = id ? Model.talks().find(function(x){ return x.id===id; }) : { id:uid(), createdAt:Date.now(), done:false };
  obj.sid=sid; obj.time=time;
  obj.talker=document.getElementById('tTalker').value.trim();
  obj.place=document.getElementById('tPlace').value.trim();
  obj.topic=document.getElementById('tTopic').value.trim()||'未分类';
  obj.level=level;
  obj.traits=document.getElementById('tTraits').value.trim();
  obj.content=document.getElementById('tContent').value.trim();
  obj.followUp=document.getElementById('tFollow').value.trim();
  obj.followDate=document.getElementById('tFollowDate').value;
  obj.updatedAt=Date.now();
  (async function(){
    try{
      if(id){ await Model.save('PUT','/api/talks/'+id,{talk:obj}); }
      else { await Model.save('POST','/api/talks',{talk:obj}); }
      closeModal(); renderTalksTable(); toast(id?'已保存修改':'已保存谈话记录');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function viewTalk(id){
  var t=Model.talks().find(function(x){ return x.id===id; }); if(!t) return;
  var s=t.sid ? Model.students().find(function(x){ return x.id===t.sid; }) : null;
  var li=levelInfo(t.level||'g');
  var follow = t.followDate ? (t.done ? '已完成' : ('待回访 '+ymd(t.followDate))) : '未设置';
  openModal('<h2>谈话记录详情</h2>'
    +'<div class="form-grid" style="margin-top:12px">'
    +'<div class="form-item"><label>谈话时间</label><div>'+ymd(t.time)+'</div></div>'
    +'<div class="form-item"><label>学生</label><div>'+(s?esc(s.name)+' · '+esc(s.xh)+' · '+esc(s.cls||'未填班级'):'（已删除学生）')+'</div></div>'
    +'<div class="form-item"><label>谈话人</label><div>'+esc(t.talker||'—')+'</div></div>'
    +'<div class="form-item"><label>谈话地点</label><div>'+esc(t.place||'—')+'</div></div>'
    +'<div class="form-item"><label>话题</label><div>'+esc(t.topic||'未分类')+'</div></div>'
    +'<div class="form-item"><label>等级</label><div><span class="badge '+li[2]+'">'+li[0]+'</span></div></div>'
    +'</div>'
    +'<div class="form-item" style="margin-top:12px"><label>学生特点</label><div style="font-size:14px;color:#3d4c5e">'+esc(t.traits||'—')+'</div></div>'
    +'<div class="form-item" style="margin-top:12px"><label>谈话内容</label><div style="font-size:14px;line-height:1.7;color:#3d4c5e;white-space:pre-wrap">'+esc(t.content||'—')+'</div></div>'
    +'<div class="form-item" style="margin-top:12px"><label>后续跟进</label><div style="font-size:14px;color:#3d4c5e">'+esc(t.followUp||'—')+'</div></div>'
    +'<div class="form-item" style="margin-top:12px"><label>回访状态</label><div style="font-size:14px;color:#3d4c5e">'+follow+'</div></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button><button class="btn btn-p" onclick="closeModal();openTalkForm(\''+id+'\')">编辑</button></div>');
}
function delTalk(id){
  var t=Model.talks().find(function(x){ return x.id===id; }); if(!t) return;
  if(!confirmDlg('确定删除这条谈话记录吗？')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/talks/'+id);
      renderTalksTable(); toast('已删除记录','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function markFollowDone(id){
  (async function(){
    try{
      await Model.save('POST','/api/talks/'+id+'/done');
      if(curView==='home') RENDERERS.home(); else renderTalksTable();
      toast('已标记跟进完成');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function filteredStudents(){
  var list=Model.students().slice(), q=F.students.q.toLowerCase();
  if(q){ list=list.filter(function(s){ return (s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1; }); }
  if(F.students.cls) list=list.filter(function(s){ return s.cls===F.students.cls; });
  if(F.students.gender) list=list.filter(function(s){ return s.gender===F.students.gender; });
  if(F.students.zzmm) list=list.filter(function(s){ return s.zzmm===F.students.zzmm; });
  if(F.students.concern){
    var ci=F.students.concern.indexOf(':');
    list=list.filter(function(s){ return (s.concerns||[]).some(function(c){ return ci>-1 ? (c.t===F.students.concern.slice(0,ci) && c.l===F.students.concern.slice(ci+1)) : c.t===F.students.concern; }); });
  }
  return list;
}
function filteredTalks(){
  var list=Model.talks().slice(), q=F.talks.q.toLowerCase();
  if(q){ list=list.filter(function(t){ var s=getStudent(t.sid); return (t.topic||'').toLowerCase().indexOf(q)>-1 || (s&&(s.name||'').toLowerCase().indexOf(q)>-1) || (t.content||'').toLowerCase().indexOf(q)>-1; }); }
  if(F.talks.topic) list=list.filter(function(t){ return t.topic===F.talks.topic; });
  if(F.talks.level) list=list.filter(function(t){ return t.level===F.talks.level; });
  if(F.talks.month) list=list.filter(function(t){ return (t.time||'').slice(0,7)===F.talks.month; });
  return list;
}
function openExportDlg(kind){
  var fields = kind==='students' ? STUDENT_EXPORT_FIELDS : TALK_EXPORT_FIELDS;
  var n = kind==='students' ? filteredStudents().length : filteredTalks().length;
  var opts=fields.map(function(f){ return '<label class="exp-chk"><input type="checkbox" data-k="'+f.k+'" checked> '+esc(f.l)+'</label>'; }).join('');
  openModal('<h2>导出'+(kind==='students'?'学生台账':'谈话记录')+' CSV</h2>'
    +'<div class="m-sub">选择导出列与范围。CSV 为 UTF-8（带 BOM），Excel 打开不乱码；文件名自动包含日期与范围。</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn btn-g btn-xs" onclick="expAll(\''+kind+'\')">全选</button><button class="btn btn-g btn-xs" onclick="expNone(\''+kind+'\')">清空</button></div>'
    +'<div class="exp-cols">'+opts+'</div>'
    +'<div style="margin-top:12px"><div style="font-size:13px;color:var(--muted);margin-bottom:6px">导出范围</div>'
    +'<div style="display:flex;gap:16px;flex-wrap:wrap"><label style="font-size:13px;cursor:pointer"><input type="radio" name="expRange" value="all" checked> 全部记录</label>'
    +'<label style="font-size:13px;cursor:pointer"><input type="radio" name="expRange" value="filtered"> 当前筛选结果（'+n+' 条）</label></div></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="doExport(\''+kind+'\')">导出</button></div>');
}
function expAll(kind){
  document.querySelectorAll('.exp-cols input[type=checkbox]').forEach(function(c){ c.checked=true; });
}
function expNone(kind){
  document.querySelectorAll('.exp-cols input[type=checkbox]').forEach(function(c){ c.checked=false; });
}
function doExport(kind){
  var chks=document.querySelectorAll('.exp-cols input[type=checkbox]:checked');
  var picked=[].map.call(chks,function(c){ return c.getAttribute('data-k'); });
  if(!picked.length){ toast('请至少勾选一列','err'); return; }
  var fields = kind==='students' ? STUDENT_EXPORT_FIELDS : TALK_EXPORT_FIELDS;
  var cols=fields.filter(function(f){ return picked.indexOf(f.k)>-1; });
  var useFiltered = document.querySelector('input[name=expRange]:checked').value==='filtered';
  function q(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
  var lines=[cols.map(function(c){ return q(c.l); }).join(',')];
  if(kind==='students'){
    var list=useFiltered? filteredStudents() : Model.students();
    list.forEach(function(s){
      lines.push(cols.map(function(c){
        var v;
        if(c.k==='concerns') v=concernsToStr(s.concerns);
        else if(c.k==='talkCount') v=talkCountOf(s.id);
        else v=s[c.k];
        return q(v);
      }).join(','));
    });
    var scope=useFiltered? '筛选结果':'全部';
    download('学生台账_'+todayISO()+'_'+scope+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
    toast('已导出学生台账 CSV（'+list.length+' 行，'+cols.length+' 列）');
  } else {
    var list=useFiltered? filteredTalks() : Model.talks();
    list.forEach(function(t){
      var s=getStudent(t.sid);
      lines.push(cols.map(function(c){
        var v;
        if(c.k==='name') v=s?s.name:'';
        else if(c.k==='xh') v=s?s.xh:'';
        else if(c.k==='cls') v=s?s.cls:'';
        else if(c.k==='level') v={g:'一般',a:'需关注',r:'重点关注'}[t.level]||'';
        else if(c.k==='done') v=t.done?'是':'';
        else v=t[c.k];
        return q(v);
      }).join(','));
    });
    var scope=useFiltered? '筛选结果':'全部';
    download('谈心谈话记录_'+todayISO()+'_'+scope+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
    toast('已导出谈话记录 CSV（'+list.length+' 行，'+cols.length+' 列）');
  }
  closeModal();
}
/* ---------- 画像 ---------- */
function savePortraitTag(sid){
  var v=document.getElementById('ptTag').value.trim(); if(!v){ toast('标签不能为空','err'); return; }
  if(portraitTagsOf(sid).indexOf(v)>-1){ toast('该标签已存在','err'); return; }
  (async function(){
    try{
      await Model.save('POST','/api/portraits/tags',{sid:sid, tag:v});
      closeModal(); renderPortrait(sid); toast('已添加标签');
    }catch(e){ toast(e.message,'err'); }
  })();
}

/* ---------- 文件索引 ---------- */
function saveFile(id){
  var name=document.getElementById('fName').value.trim();
  if(!name){ toast('文件名不能为空','err'); return; }
  var tags=document.getElementById('fTags').value.split(/[,，、]/).map(function(x){ return x.trim(); }).filter(Boolean);
  var obj = id ? Model.files().find(function(x){ return x.id===id; }) : { id:uid(), createdAt:Date.now(), source:'注册' };
  obj.name=name; obj.category=document.getElementById('fCat').value;
  obj.tags=tags; obj.date=document.getElementById('fDate').value; obj.size=document.getElementById('fSize').value.trim();
  obj.note=document.getElementById('fNote').value.trim(); obj.updatedAt=Date.now();
  (async function(){
    try{
      if(id){ await Model.save('PUT','/api/files/'+id,{file:obj}); }
      else { await Model.save('POST','/api/files',{file:obj}); }
      closeModal(); renderFilesTable(); toast(id?'已保存修改':'已注册文件索引');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function delFile(id){
  if(!confirmDlg('确定删除该文件索引吗？只删除索引记录，不删除本地文件。')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/files/'+id);
      renderFilesTable(); toast('已删除索引','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function exportFiles(){
  var lines=[['文件名','分类','标签','日期','大小','来源','备注/路径'].join(',')];
  Model.files().forEach(function(f){
    function q(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
    lines.push([q(f.name),q(f.category),q((f.tags||[]).join('、')),q(f.date),q(f.size),q(f.source),q(f.note)].join(','));
  });
  download('文件索引_'+todayISO()+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('已导出文件索引 CSV');
}
function registerDroppedFiles(list){
  if(!list || !list.length) return;
  (async function(){
    try{
      var n=0;
      for(var i=0;i<list.length;i++){
        await Model.save('POST','/api/files',{file:list[i]});
        n++;
      }
      renderFilesTable(); toast('已注册 '+n+' 个文件索引（文件本体未移动）');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function pickFolder(){
  if(!window.showDirectoryPicker) return;
  window.showDirectoryPicker({ mode:'read' }).then(function(dir){
    var added=0, updated=0, list=[], seen={};
    Model.files().forEach(function(f){ if(f.source==='文件夹索引' && f.relPath) seen[f.relPath]=f; });
    function walk(dirHandle, rel){
      var it=dirHandle.values(), p=it.next();
      function next(){
        if(p.done) return Promise.resolve();
        var e=p.value; p=it.next();
        if(e.kind==='file'){
          return e.getFile().then(function(fh){
            var rp=rel? rel+'/'+e.name : e.name;
            var ex=seen[rp];
            if(ex){ ex.size=fh.size+' B'; ex.date=fh.lastModified? new Date(fh.lastModified).toISOString().slice(0,10):ex.date; list.push({id:ex.id, file:ex}); updated++; }
            else { var nf={ name:e.name, category:'', tags:[], date:fh.lastModified? new Date(fh.lastModified).toISOString().slice(0,10):todayISO(), size:fh.size+' B', note:'', source:'文件夹索引', relPath:rp, id:uid(), createdAt:Date.now(), updatedAt:Date.now() }; list.push({id:null, file:nf}); added++; }
            return next();
          });
        }
        if(e.kind==='directory') return walk(e, rel? rel+'/'+e.name : e.name).then(next);
        return next();
      }
      return next();
    }
    walk(dir,'').then(function(){
      var ops=(function(){
        var arr=[];
        list.forEach(function(item){
          if(item.id){ arr.push(Model.save('PUT','/api/files/'+item.id,{file:item.file})); }
          else { arr.push(Model.save('POST','/api/files',{file:item.file})); }
        });
        return arr;
      })();
      Promise.all(ops).then(function(){
        renderFilesTable();
        toast('文件夹索引完成：新增 '+added+'、更新 '+updated+' 条');
        var box=document.getElementById('filesBox'); if(box) box.insertAdjacentHTML('beforeend','<div style="font-size:12px;color:var(--muted);margin-top:6px">说明：文件夹索引权限在浏览器会话内有效，下次打开时若需刷新，请重新选择文件夹。</div>');
      }).catch(function(e){ toast(e.message,'err'); });
    });
  }).catch(function(e){ if(e && e.name!=='AbortError') toast('无法读取文件夹：'+e.message,'err'); });
}

/* ---------- 重点关注 ---------- */
function saveFocusConcerns(sid){
  var s=getStudent(sid); if(!s) return;
  var concerns=[];
  CONCERN_TYPES.forEach(function(t){
    var sel=document.querySelector('input[name="fcc_'+t+'"]:checked');
    if(sel && sel.value) concerns.push({ t:t, l:sel.value });
  });
  var obj=Model.student(sid);
  obj.concerns=concerns; obj.updatedAt=Date.now();
  (async function(){
    try{
      await Model.save('PUT','/api/students/'+sid,{student:obj});
      renderFocusTable(); toast('已保存 '+s.name+' 的重点关注');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function pickFocusFile(sid){
  var type=document.getElementById('fcTypeSel').value;
  if(type==='其他'){
    var custom=(document.getElementById('fcCustom').value||'').trim();
    if(custom) type=custom; else { toast('请填写自定义文件类型','err'); return; }
  }
  var date=document.getElementById('fcDate').value;
  openFilePicker(function(file){ uploadFocusFile(sid, type, date, file); }, '*');
}
function uploadFocusFile(sid, type, date, file){
  var s=getStudent(sid); if(!s) return;
  var fd=new FormData();
  fd.append('sid', sid);
  fd.append('type', type||'其他');
  fd.append('date', date||todayISO());
  fd.append('file', file, file.name);
  document.getElementById('fcFileTip').textContent='正在上传「'+file.name+'」…';
  (async function(){
    try{
      var res=await fetch('/api/focus/upload', {method:'POST', body:fd});
      var json={};
      try{ json=await res.json(); }catch(e){}
      if(!res.ok){ throw new Error((json&&json.error)||('上传失败（'+res.status+'）')); }
      if(json.state) Model.data=json.state;
      var f=json.payload&&json.payload.file;
      document.getElementById('fcFileTip').textContent='';
      renderFocusTable();
      toast('已上传并自动命名为 '+(f&&f.name||'')+'（存于本地「重点关注文件」文件夹）');
    }catch(e){ document.getElementById('fcFileTip').textContent=''; toast(e.message,'err'); }
  })();
}
function delFocusFile(id){
  if(!confirmDlg('确定删除该文件的索引记录吗？只删除记录，不删除本地实体文件。')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/files/'+id);
      renderFocusTable(); toast('已删除索引','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function openFocusFolder(){
  (async function(){
    try{
      await fetch('/api/focus/openfolder', {method:'POST', headers:{'Content-Type':'application/json'}});
      toast('已在访达中打开「重点关注文件」文件夹');
    }catch(e){ toast('无法打开文件夹：'+e.message,'err'); }
  })();
}

/* ---------- 设置 ---------- */
function savePassword(){
  var a=document.getElementById('pw1').value, b=document.getElementById('pw2').value;
  if(!a){ toast('密码不能为空','err'); return; }
  if(a!==b){ toast('两次输入不一致','err'); return; }
  (async function(){
    try{
      var set=Model.settings();
      set.passHash=djb2('ws_salt:'+a);
      await Model.save('PUT','/api/settings',{settings:set});
      closeModal(); RENDERERS.settings(); toast('访问密码已设置');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function clearPassword(){
  if(!confirmDlg('确定关闭访问密码吗？')) return;
  (async function(){
    try{
      var set=Model.settings();
      set.passHash='';
      await Model.save('PUT','/api/settings',{settings:set});
      RENDERERS.settings(); toast('访问密码已关闭');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function saveDefaults(){
  (async function(){
    try{
      var set=Model.settings();
      set.talker=document.getElementById('setTalker').value.trim();
      await Model.save('PUT','/api/settings',{settings:set});
      RENDERERS.settings(); toast('默认设置已保存');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function saveDicts(){
  (async function(){
    try{
      var set=Model.settings();
      set.topicDict=document.getElementById('setTopics').value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
      set.catDict=document.getElementById('setCats').value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
      await Model.save('PUT','/api/settings',{settings:set});
      RENDERERS.settings(); toast('字典已保存');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function openDbDir(){
  (async function(){
    try{ await Model.save('POST','/api/db/openfolder'); }
    catch(e){ toast(e.message||'已打开数据库所在文件夹（访达）','err'); }
  })();
}
function connectDb(){
  (async function(){
    try{
      var r=await Model._api('GET','/api/dbinfo');
      var d=r.db||r;
      var info=document.getElementById('dbConnInfo');
      if(info) info.innerHTML='<span style="color:var(--green)">已连接数据库：</span>'+esc(d.path)+'（'+d.sizeMB+' MB）· 学生 '+d.students+' 人、谈话 '+d.talks+' 条、文件 '+d.files+' 个';
      toast('数据库连接成功，数据已加载至工作站');
    }catch(e){ toast('连接失败：'+e.message,'err'); }
  })();
}
function exportDbBackup(){
  (async function(){
    try{
      var res=await fetch('/api/backup/db');
      if(!res.ok){ var j; try{j=await res.json();}catch(e){} throw new Error((j&&j.error)||('导出失败（'+res.status+'）')); }
      var blob=await res.blob();
      download('辅导员工作站数据库备份_'+todayISO()+'.db', blob, 'application/octet-stream');
      var meta=Model.meta(); meta.lastBackup=todayISO();
      await Model.save('PUT','/api/settings',{settings:Model.settings(), meta:meta});
      RENDERERS.settings(); toast('已导出 db 格式备份');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function exportBackup(){
  (async function(){
    try{
      var meta=Model.meta();
      meta.lastBackup=todayISO();
      await Model.save('PUT','/api/settings',{settings:Model.settings(), meta:meta});
      var bak={ students:Model.students(), talks:Model.talks(), files:Model.files(), portraits:Model.portraits(), settings:Model.settings(), meta:meta };
      download('辅导员工作站备份_'+todayISO()+'.json', JSON.stringify(bak,null,2), 'application/json');
      RENDERERS.settings(); toast('已导出备份文件');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function importBackup(){
  openFilePicker(function(file){
    var fr=new FileReader();
    fr.onload=function(){
      var d;
      try{ d=JSON.parse(fr.result); }
      catch(e){ toast('备份文件无效：'+e.message,'err'); return; }
      if(!d || !d.students || !d.talks || !d.files){ toast('备份文件结构不符','err'); return; }
      (async function(){
        try{
          await Model.save('POST','/api/backup/import',{backup:d});
          go('home');
          toast('备份已导入：学生 '+Model.students().length+' 人、谈话 '+Model.talks().length+' 条、文件 '+Model.files().length+' 个');
        }catch(e){ toast(e.message,'err'); }
      })();
    };
    fr.readAsText(file);
  }, '.json');
}
function seedDemo(){
  if(Model.students().length || Model.talks().length || Model.files().length){
    if(!confirmDlg('当前已有数据，载入示例会追加一批示例学生与记录，确定继续吗？')) return;
  }
  (async function(){
    try{
      await Model.save('POST','/api/seed');
      go('home');
      toast('已载入示例数据：6 名学生、8 条谈话、6 个文件索引（全部为虚构示例）');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function clearAllData(){
  if(!confirmDlg('确定清空全部数据吗？此操作不可撤销，请先导出备份。')) return;
  if(!confirmDlg('再次确认：将删除所有学生、谈话与文件索引数据。')) return;
  (async function(){
    try{
      await Model.save('POST','/api/reset');
      go('home'); toast('已清空全部数据');
    }catch(e){ toast(e.message,'err'); }
  })();
}

/* ---------- 学生导入 / 导出 ---------- */
function confirmStudentImport(){
  var list=window.__pendingImport||[];
  var skips=window.__pendingSkips||[];
  if(!list.length){ window.__pendingImport=null; window.__pendingSkips=null; closeModal(); return; }
  (async function(){
    try{
      var json=await Model.save('POST','/api/import/students',{records:list});
      window.__pendingImport=null;
      window.__pendingSkips=null;
      closeModal(); renderStudentsTable();
      var msg='已导入 '+json.imported+' 名学生';
      if(json.skips && json.skips.length) msg+='，跳过 '+json.skips.length+' 条（学号重复或空行，已在预览明细中列出）';
      toast(msg);
    }catch(e){ toast(e.message,'err'); }
  })();
}
function downloadStudentTemplate(){
  var head=Object.keys(STUDENT_FIELDS).map(function(k){ return STUDENT_FIELDS[k]; }).concat(['特殊关注','备注']).join(',');
  var sample='202600001,张三,男,山东济南,生科2601,3号楼101,汉族,共青团员,山东省济南市历城区山大南路27号,12345678,13800000000,张建国,13900000001,济南市历城区XX街道,科员,中共党员,李秀兰,13900000002,济南市XX中学,教师,群众,心理:黄;学业:橙,';
  download('学生导入模板.csv','\uFEFF'+head+'\n'+sample+'\n','text/csv;charset=utf-8');
  toast('模板已下载（含一行示例，可删除）');
}

/* ---------- 重点关注：批量导入 ---------- */
function importConcernsModal(){
  openModal('<h2>批量导入重点关注</h2><div class="m-sub">支持 CSV 文件或从 Excel 直接复制粘贴。表头固定三列：<b>学号、类型、级别</b>，三项均必填。学号须与学生台账一致（自动绑定）；类型限 心理 / 学业 / 思政 / 经济；级别：心理类为 红 / 橙 / 黄 / 严重 / 一般 五级，学业 / 思政 / 经济为 红 / 橙 / 黄 三级。同一学生同一类型已有关注会被覆盖，其他类型保留。未匹配到台账学号、类型或级别无效的行会跳过并列出明细。</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
    +'<button class="btn btn-p" onclick="pickConcernsCsv()">选择 CSV 文件</button>'
    +'<button class="btn btn-g" onclick="pasteConcernsModal()">从 Excel 粘贴</button>'
    +'<button class="btn btn-g" onclick="downloadConcernsTemplate()">下载导入模板</button>'
    +'</div><div id="importPreview" style="max-height:300px;overflow:auto"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button></div>');
}
function pickConcernsCsv(){
  openFilePicker(function(file){
    var fr=new FileReader();
    fr.onload=function(){ showConcernsImportPreview(decodeText(fr.result)); };
    fr.readAsArrayBuffer(file);
  }, '.csv,.txt');
}
function pasteConcernsModal(){
  openModal('<h2>从 Excel 粘贴导入重点关注</h2><div class="m-sub">在 Excel 中选中三列表格区域（学号 / 类型 / 级别）并复制，粘贴到下方后点击“解析”。首行必须是表头。</div>'
    +'<textarea id="pasteArea" rows="8" placeholder="在此粘贴 Excel 表格内容…" style="width:100%"></textarea>'
    +'<div id="importPreview" style="max-height:280px;overflow:auto;margin-top:10px"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="doPasteConcerns()">解析并预览</button></div>');
}
function doPasteConcerns(){
  var text=document.getElementById('pasteArea').value;
  if(!text.trim()){ toast('粘贴内容为空','err'); return; }
  showConcernsImportPreview(text);
}
function showConcernsImportPreview(text){
  var box=document.getElementById('importPreview'); if(!box) return;
  var delim=guessDelim(text);
  var rows=parseDelimited(text, delim);
  if(rows.length<2){ box.innerHTML='<div class="empty"><div class="big">—</div>未能解析出有效数据行，请确认首行为表头。</div>'; return; }
  var colMap={};
  rows[0].forEach(function(hd,ix){
    var a=String(hd==null?'':hd).trim();
    if(a==='学号'||a==='xh'||a==='XH') colMap.xh=ix;
    if(a==='类型'||a==='type'||a==='关注类型') colMap.type=ix;
    if(a==='级别'||a==='level') colMap.level=ix;
  });
  if(colMap.xh===undefined || colMap.type===undefined || colMap.level===undefined){
    box.innerHTML='<div class="empty"><div class="big">—</div>未识别到“学号 / 类型 / 级别”表头（三列必须齐全）。</div>';
    return;
  }
  var okTypes=['心理','学业','思政','经济'];
  var okLv={'心理':['红','橙','黄','严重','一般'],'学业':['红','橙','黄'],'思政':['红','橙','黄'],'经济':['红','橙','黄']};
  var records=[], skips=[];
  for(var i=1;i<rows.length;i++){
    var r=rows[i];
    var xh=String(r[colMap.xh]==null?'':r[colMap.xh]).trim();
    var type=String(r[colMap.type]==null?'':r[colMap.type]).trim();
    var level=String(r[colMap.level]==null?'':r[colMap.level]).trim();
    if(!xh && !type && !level){ continue; }
    var reason='';
    if(!xh) reason='学号为空';
    else if(!type) reason='类型为空';
    else if(!level) reason='级别为空';
    else if(okTypes.indexOf(type)===-1) reason='类型无效（'+type+'），应为 心理/学业/思政/经济';
    else if(okLv[type].indexOf(level)===-1) reason='级别无效（'+level+'），'+type+'类应为 '+okLv[type].join('/');
    if(reason){ skips.push({ row:i+1, xh:xh, type:type, level:level, reason:reason }); continue; }
    records.push({ xh:xh, type:type, level:level, row:i+1 });
  }
  window.__pendingConcerns=records;
  window.__pendingConcernsSkips=skips;
  var byXh={}; Model.students().forEach(function(s){ if(s.xh) byXh[s.xh]=s.name; });
  var html='<div style="font-size:14px;margin-bottom:10px">解析完成：可导入 <b style="color:var(--green)">'+records.length+'</b> 条';
  if(skips.length) html+='，跳过 <b style="color:var(--red)">'+skips.length+'</b> 条';
  html+='</div>';
  if(records.length){
    html+='<table style="table-layout:fixed;width:100%;font-size:13px"><colgroup><col style="width:22%"><col style="width:22%"><col style="width:20%"><col style="width:36%"></colgroup><thead><tr style="background:#f7f9fc"><th style="padding:6px 8px;text-align:left">学号</th><th>类型</th><th>级别</th><th>台账学生</th></tr></thead><tbody>';
    records.slice(0,8).forEach(function(rec){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #eef1f5">'+esc(rec.xh)+'</td><td>'+esc(rec.type)+'</td><td>'+esc(rec.level)+'</td><td>'+esc(byXh[rec.xh]||'—')+'</td></tr>';
    });
    if(records.length>8) html+='<tr><td colspan="4" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (records.length-8) +' 条略</td></tr>';
    html+='</tbody></table>';
    html+='<div class="m-actions" style="margin-top:12px"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="confirmConcernsImport()">确认导入 '+records.length+' 条</button></div>';
  } else {
    html+='<div class="empty"><div class="big">—</div>没有可导入的关注记录（可能学号/类型/级别为空或格式不正确）。</div>';
  }
  if(skips.length){
    html+='<div style="font-size:13px;margin-top:14px;color:var(--muted)"><b style="color:var(--red)">跳过明细（导入失败项，请核对后修改重导）：</b></div>'
      +'<table style="table-layout:fixed;width:100%;font-size:12.5px"><colgroup><col style="width:15%"><col style="width:16%"><col style="width:14%"><col style="width:14%"><col style="width:41%"></colgroup><thead><tr style="background:#fdf3f3;color:var(--red)"><th style="padding:5px 8px;text-align:left">文件行号</th><th>学号</th><th>类型</th><th>级别</th><th>跳过原因</th></tr></thead><tbody>';
    skips.slice(0,10).forEach(function(k){
      html+='<tr><td style="padding:4px 8px;border-bottom:1px solid #f3e8e8">第 '+k.row+' 行</td><td>'+esc(k.xh||'—')+'</td><td>'+esc(k.type||'—')+'</td><td>'+esc(k.level||'—')+'</td><td>'+esc(k.reason)+'</td></tr>';
    });
    if(skips.length>10) html+='<tr><td colspan="5" style="padding:4px 8px;color:var(--muted)">… 其余 '+ (skips.length-10) +' 条略</td></tr>';
    html+='</tbody></table>';
  }
  box.innerHTML=html;
}
function confirmConcernsImport(){
  var list=window.__pendingConcerns||[];
  var skips=window.__pendingConcernsSkips||[];
  if(!list.length){ window.__pendingConcerns=null; window.__pendingConcernsSkips=null; closeModal(); return; }
  (async function(){
    try{
      var json=await Model.save('POST','/api/import/concerns',{records:list});
      window.__pendingConcerns=null;
      window.__pendingConcernsSkips=null;
      closeModal(); RENDERERS.focus();
      var msg='已导入 '+json.imported+' 条重点关注';
      if(json.skips && json.skips.length) msg+='，跳过 '+json.skips.length+' 条（未匹配学号或类型/级别无效，已在预览明细中列出）';
      toast(msg);
    }catch(e){ toast(e.message,'err'); }
  })();
}
function downloadConcernsTemplate(){
  var head='学号,类型,级别';
  var sample='202600103,心理,严重\n202600105,经济,红';
  download('重点关注导入模板.csv','\uFEFF'+head+'\n'+sample+'\n','text/csv;charset=utf-8');
  toast('模板已下载（含示例行，可删除）');
}

/* ---------- 奖助管理：困难认定 ---------- */
function openHardshipForm(id){
  var h = id ? hardshipRecords().find(function(x){ return x.id===id; }) : null;
  var v = h || { sid:'', year:currentYear(), level:'一般困难', review:'', status:'认定中', note:'' };
  var s = v.sid ? getStudent(v.sid) : null;
  var tip = s ? ('<span style="color:var(--green);font-size:13px">已关联：'+esc(s.name)+' · '+esc(s.xh)+' · '+esc(s.cls||'未填班级')+'</span>') : '';
  var sug='';
  if(h) sug=hardshipSuggest(h);
  openModal('<h2>'+(id?'编辑困难认定':'新增困难认定')+'</h2><div class="m-sub">每生每学年一条认定档案（同学生同学年重复保存将自动更新）。等级分 特别困难 / 困难 / 一般困难。</div>'
    +'<div class="form-grid">'
    +'<div class="form-item form-full"><label><span class="req">*</span>学生（输入姓名或学号选择）</label>'
    +'<input id="hStu" list="hStudentList" value="'+esc(s?s.name:'')+'" placeholder="输入姓名或学号"><datalist id="hStudentList">'
    +Model.students().map(function(x){ return '<option value="'+esc(x.name)+'">'+esc(x.xh)+' · '+esc(x.cls||'')+'</option>'; }).join('')
    +'</datalist><div id="hStuTip" style="margin-top:5px">'+tip+'</div></div>'
    +'<div class="form-item"><label><span class="req">*</span>学年</label><input id="hYear" value="'+esc(v.year||'')+'" placeholder="如 2026-2027"></div>'
    +'<div class="form-item"><label><span class="req">*</span>困难等级</label><select id="hLevel">'+HARD_LEVELS.map(function(l){ return '<option'+(v.level===l?' selected':'')+'>'+esc(l)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item"><label>评议结果</label><input id="hReview" value="'+esc(v.review||'')+'" placeholder="如 班级评议小组通过，公示无异议"></div>'
    +'<div class="form-item"><label>状态</label><select id="hStatus">'+['认定中','已认定','已归档'].map(function(s2){ return '<option'+(v.status===s2?' selected':'')+'>'+esc(s2)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item form-full"><label>备注</label><input id="hNote" value="'+esc(v.note||'')+'" placeholder="家庭情况等补充说明"></div>'
    +'</div>'
    +(sug&&sug.want? '<div class="aid-suggest"><b>经济关注建议</b>：该生当前经济关注为「'+(sug.cur||'未标记')+'」；按本认定等级建议调整为「'+sug.want+'」'+(sug.need?'（当前偏低，建议在重点关注板块同步上调）':'。')+'</div>' : '')
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveHardship(\''+(id||'')+'\')">保存</button></div>');
  document.getElementById('hStu').addEventListener('change', function(){ resolveHardshipStudent(); });
  if(v.sid) document.getElementById('hStu').setAttribute('data-sid', v.sid);
}
function resolveHardshipStudent(){
  var val=document.getElementById('hStu').value.trim(); var tip=document.getElementById('hStuTip'); if(!tip) return;
  if(!val){ tip.innerHTML=''; return; }
  var s=null, i, list=Model.students();
  for(i=0;i<list.length;i++){ var x=list[i]; if(x.name===val || x.xh===val){ s=x; break; } }
  if(s){ tip.innerHTML='<span style="color:var(--green);font-size:13px">已关联：'+esc(s.name)+' · '+esc(s.xh)+' · '+esc(s.cls||'未填班级')+'</span>'; document.getElementById('hStu').setAttribute('data-sid',s.id); }
  else { tip.innerHTML='<span style="color:var(--red);font-size:13px">未找到匹配学生，请先到学生台账导入或新增</span>'; document.getElementById('hStu').removeAttribute('data-sid'); }
}
function saveHardship(id){
  var sid=document.getElementById('hStu').getAttribute('data-sid');
  var year=document.getElementById('hYear').value.trim();
  var level=document.getElementById('hLevel').value;
  if(!sid){ toast('请先选择台账中的学生','err'); return; }
  if(!year){ toast('请填写学年','err'); return; }
  var obj = id ? hardshipRecords().find(function(x){ return x.id===id; }) : { id:uid(), updatedAt:Date.now() };
  obj.sid=sid; obj.year=year; obj.level=level;
  obj.review=document.getElementById('hReview').value.trim();
  obj.status=document.getElementById('hStatus').value;
  obj.note=document.getElementById('hNote').value.trim();
  obj.updatedAt=Date.now();
  (async function(){
    try{
      if(id){ await Model.save('PUT','/api/aid/hardship/'+id,{hardship:obj}); }
      else { await Model.save('POST','/api/aid/hardship',{hardship:obj}); }
      closeModal(); aidRenderHardship(); toast(id?'已保存认定修改':'已新增困难认定');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function delHardship(id){
  var h=hardshipRecords().find(function(x){ return x.id===id; }); if(!h) return;
  var s=getStudent(h.sid);
  if(!confirmDlg('确定删除 '+(s?s.name:'')+' '+h.year+' 学年的困难认定档案吗？')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/aid/hardship/'+id);
      aidRenderHardship(); toast('已删除认定档案','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function currentYear(){ var y=new Date().getFullYear(); return (y-1)+'-'+y; }
function currentTerm(){ var d=new Date(), m=d.getMonth()+1; return m>=9 ? d.getFullYear()+'-'+(d.getFullYear()+1) : (d.getFullYear()-1)+'-'+d.getFullYear(); }
/* ---------- 奖助管理：奖学金 / 助学金（汇总展示，不审批） ---------- */
function aidKindTitle(kind){ return kind==='grant' ? '助学金' : '奖学金'; }
function aidLevelClass(l){ return {'一等':'tag-红','二等':'tag-橙','三等':'tag-黄','不记等次':'tag-其他'}[l]||'tag-其他'; }

function downloadAidTemplate(kind){
  var t=aidKindTitle(kind);
  var head=['学号','名称','等次','获评学年','获评时间'].join(',');
  var sample='202600101,国家奖学金,一等,2026-2027,2026-10-20';
  download(t+'导入模板.csv','\uFEFF'+head+'\n'+sample+'\n','text/csv;charset=utf-8');
  toast('模板已下载（学号 / 名称 / 等次 / 学年 / 获评时间 均为必填）');
}
function importAidModal(kind){
  var t=aidKindTitle(kind);
  openModal('<h2>批量导入'+t+'</h2><div class="m-sub">模板列为：学号、名称、等次、获评学年、获评时间，五项均必填。学号须与学生台账一致（自动绑定）；等次限 一等 / 二等 / 三等 / 不记等次；同一学生同一名称同学年已存在会跳过。未匹配到台账学号、等次无效或缺失必填项的行会跳过并列出明细。本模块仅汇总展示，不涉及审批。</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
    +'<button class="btn btn-p" onclick="pickAidCsv(\''+kind+'\')">选择 CSV 文件</button>'
    +'<button class="btn btn-g" onclick="pasteAidModal(\''+kind+'\')">从 Excel 粘贴</button>'
    +'<button class="btn btn-g" onclick="downloadAidTemplate(\''+kind+'\')">下载导入模板</button>'
    +'</div><div id="aidPreview" style="max-height:300px;overflow:auto"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button></div>');
}
function pickAidCsv(kind){
  window.__aidKind=kind;
  openFilePicker(function(file){
    var fr=new FileReader();
    fr.onload=function(){ showAidImportPreview(decodeText(fr.result)); };
    fr.readAsArrayBuffer(file);
  }, '.csv,.txt');
}
function pasteAidModal(kind){
  window.__aidKind=kind;
  openModal('<h2>从 Excel 粘贴导入'+aidKindTitle(kind)+'</h2><div class="m-sub">在 Excel 中选中五列表格区域（学号 / 名称 / 等次 / 获评学年 / 获评时间）并复制，粘贴到下方后点击“解析”。首行必须是表头。</div>'
    +'<textarea id="aidPaste" rows="8" style="width:100%"></textarea>'
    +'<div id="aidPreview" style="max-height:300px;overflow:auto"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="doAidPaste()">解析并预览</button></div>');
}
function doAidPaste(){
  var ta=document.getElementById('aidPaste');
  showAidImportPreview(ta?ta.value:'');
}
function showAidImportPreview(text){
  var kind=window.__aidKind||'scholarship';
  var box=document.getElementById('aidPreview'); if(!box) return;
  var delim=guessDelim(text);
  var rows=parseDelimited(text, delim);
  if(rows.length<2){ box.innerHTML='<div class="empty"><div class="big">—</div>未能解析出有效数据行。</div>'; return; }
  var colMap={}, i;
  rows[0].forEach(function(hd,ix){
    var s=String(hd||'').replace(/^\uFEFF/,'').trim();
    if(s.indexOf('学号')>-1) colMap.xh=ix;
    else if(s.indexOf('名称')>-1) colMap.name=ix;
    else if(s.indexOf('等次')>-1) colMap.level=ix;
    else if(s.indexOf('学年')>-1) colMap.year=ix;
    else if(s.indexOf('获评时间')>-1 || s.indexOf('时间')>-1) colMap.time=ix;
  });
  if(colMap.xh===undefined || colMap.name===undefined){ box.innerHTML='<div class="empty"><div class="big">—</div>未识别到「学号」与「名称」表头。</div>'; return; }
  var records=[], skips=[], seen={};
  for(i=1;i<rows.length;i++){
    var r=rows[i];
    var xh=String(r[colMap.xh]==null?'':r[colMap.xh]).trim();
    var name=colMap.name!==undefined?String(r[colMap.name]==null?'':r[colMap.name]).trim():'';
    var level=colMap.level!==undefined?String(r[colMap.level]==null?'':r[colMap.level]).trim():'';
    var year=colMap.year!==undefined?String(r[colMap.year]==null?'':r[colMap.year]).trim():'';
    var tm=colMap.time!==undefined?String(r[colMap.time]==null?'':r[colMap.time]).trim():'';
    if(!xh && !name && !level && !year && !tm){ skips.push({row:i+1, xh:'', name:'', reason:'整行为空'}); continue; }
    if(!xh){ skips.push({row:i+1, xh:'', name:'', reason:'学号为空'}); continue; }
    if(!name){ skips.push({row:i+1, xh:xh, name:'', reason:'名称为空'}); continue; }
    if(AID_LEVELS.indexOf(level)===-1){ skips.push({row:i+1, xh:xh, name:name, reason:'等次无效（'+level+'），应为 一等/二等/三等/不记等次'}); continue; }
    if(!year){ skips.push({row:i+1, xh:xh, name:name, reason:'获评学年为空'}); continue; }
    if(!tm){ skips.push({row:i+1, xh:xh, name:name, reason:'获评时间为空'}); continue; }
    var key=xh+'|'+name+'|'+year;
    if(seen[key]){ skips.push({row:i+1, xh:xh, name:name, reason:'文件内同一学生同一名称同学年重复'}); continue; }
    seen[key]=1;
    records.push({row:i+1, xh:xh, name:name, level:level, year:year, time:tm});
  }
  window.__pendingAid=records;
  var html='<div style="font-size:14px;margin-bottom:10px">解析完成：可导入 <b style="color:var(--green)">'+records.length+'</b> 条';
  if(skips.length) html+='，跳过 <b style="color:var(--red)">'+skips.length+'</b> 条';
  html+='</div>';
  if(records.length){
    html+='<table style="table-layout:fixed;width:100%;font-size:13px"><colgroup><col style="width:14%"><col style="width:30%"><col style="width:14%"><col style="width:18%"><col style="width:24%"></colgroup><thead><tr style="background:#f7f9fc"><th style="padding:6px 8px;text-align:left">学号</th><th>名称</th><th>等次</th><th>获评学年</th><th>获评时间</th></tr></thead><tbody>';
    records.slice(0,8).forEach(function(rec){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #eef1f5">'+esc(rec.xh)+'</td><td>'+esc(rec.name)+'</td><td><span class="tag '+aidLevelClass(rec.level)+'">'+esc(rec.level)+'</span></td><td>'+esc(rec.year)+'</td><td>'+esc(rec.time)+'</td></tr>';
    });
    if(records.length>8) html+='<tr><td colspan="5" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (records.length-8) +' 条略</td></tr>';
    html+='</tbody></table>';
    html+='<div class="m-actions" style="margin-top:12px"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="confirmAidImport()">确认导入 '+records.length+' 条</button></div>';
  } else {
    html+='<div class="empty"><div class="big">—</div>没有可导入的数据。</div>';
  }
  if(skips.length){
    html+='<div style="font-size:13px;margin-top:14px;color:var(--muted)"><b style="color:var(--red)">跳过明细（请核对后修改重导）：</b></div>'
      +'<table style="table-layout:fixed;width:100%;font-size:12.5px"><colgroup><col style="width:14%"><col style="width:16%"><col style="width:20%"><col style="width:50%"></colgroup><thead><tr style="background:#fdf3f3;color:var(--red)"><th style="padding:5px 8px;text-align:left">文件行号</th><th>学号</th><th>名称</th><th>跳过原因</th></tr></thead><tbody>';
    skips.slice(0,20).forEach(function(sk){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #fbe3e3">'+sk.row+'</td><td>'+esc(sk.xh||'')+'</td><td>'+esc(sk.name||'')+'</td><td>'+esc(sk.reason)+'</td></tr>';
    });
    if(skips.length>20) html+='<tr><td colspan="4" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (skips.length-20) +' 条略</td></tr>';
    html+='</tbody></table>';
  }
  box.innerHTML=html;
}
function confirmAidImport(){
  var records=window.__pendingAid||[];
  if(!records.length){ toast('没有可导入的数据','err'); return; }
  var kind=window.__aidKind||'scholarship';
  (async function(){
    try{
      var json=await Model.save('POST','/api/import/'+(kind==='grant'?'grants':'scholarships'),{records:records});
      closeModal(); aidRenderAidList(kind);
      var s=json.skips||[];
      var msg='已导入'+aidKindTitle(kind)+' '+json.imported+' 条';
      if(s.length) msg+='，跳过 '+s.length+' 条（学号未匹配/等次无效/重复，可在重新导入时查看明细）';
      toast(msg);
    }catch(e){ toast(e.message,'err'); }
  })();
}
function delAid(kind, id){
  var t=aidKindTitle(kind);
  if(!confirmDlg('确定删除这条'+t+'记录吗？')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/'+(kind==='grant'?'grants':'scholarships')+'/'+id);
      aidRenderAidList(kind); toast('已删除记录','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function exportAidDlg(kind){
  var t=aidKindTitle(kind);
  var stuCols=[['xh','学号'],['name','姓名'],['gender','性别'],['origin','籍贯'],['cls','班级'],['dorm','宿舍'],['nation','民族'],['zzmm','政治面貌'],['address','通讯地址'],['qq','QQ'],['phone','电话'],['note','备注']];
  var aidCols=[['type','类型'],['name','名称'],['level','等次'],['year','获评学年'],['time','获评时间']];
  var def=['stu_xh','stu_name','stu_cls','aid_name','aid_level','aid_year','aid_time'];
  function chk(k,label){
    return '<label style="display:inline-flex;gap:5px;align-items:center;font-size:13px;margin:4px 10px 4px 0;cursor:pointer"><input type="checkbox" class="aidExp" value="'+k+'"'+(def.indexOf(k)>-1?' checked':'')+'> '+label+'</label>';
  }
  openModal('<h2>导出'+t+'明细（链接学生台账）</h2><div class="m-sub">选择需要导出的数据列：学生台账列与该生'+t+'获评信息列，导出为 CSV 文件。仅汇总导出，不含审批信息。</div>'
    +'<div style="margin-top:10px"><b style="font-size:14px">学生台账列</b><div style="margin-top:6px">'+stuCols.map(function(c){ return chk('stu_'+c[0], c[1]); }).join('')+'</div></div>'
    +'<div style="margin-top:10px"><b style="font-size:14px">'+t+'列</b><div style="margin-top:6px">'+aidCols.map(function(c){ return chk('aid_'+c[0], c[1]); }).join('')+'</div></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="doExportAid(\''+kind+'\')">导出 CSV</button></div>');
}
function doExportAid(kind){
  var t=aidKindTitle(kind);
  var checked=[].map.call(document.querySelectorAll('.aidExp:checked'), function(c){ return c.value; });
  if(!checked.length){ toast('请至少勾选一列','err'); return; }
  var stuMap={xh:'学号',name:'姓名',gender:'性别',origin:'籍贯',cls:'班级',dorm:'宿舍',nation:'民族',zzmm:'政治面貌',address:'通讯地址',qq:'QQ',phone:'电话',note:'备注'};
  var aidMap={type:'类型',name:'名称',level:'等次',year:'获评学年',time:'获评时间'};
  var cols=checked.map(function(k){
    return k.indexOf('stu_')===0 ? stuMap[k.slice(4)] : aidMap[k.slice(4)];
  });
  var list=aidList(kind).slice().sort(function(a,b){ return (b.year||'')<(a.year||'')?-1:1; });
  function q(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
  var lines=[cols.map(q).join(',')];
  list.forEach(function(r){
    var s=getStudentByXh(r.xh)||{};
    var row=[];
    checked.forEach(function(k){
      if(k.indexOf('stu_')===0){
        var f=k.slice(4);
        row.push(f==='xh' ? (r.xh!=null?r.xh:(s.xh||'')) : (s[f]!=null?s[f]:''));
      } else {
        var f=k.slice(4);
        row.push(f==='type' ? t : (r[f]!=null?r[f]:''));
      }
    });
    lines.push(row.map(q).join(','));
  });
  download(t+'明细_'+todayISO()+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  closeModal();
  toast('已导出 '+t+' 明细 CSV（'+list.length+' 行，'+cols.length+' 列，已链接学生台账）');
}

function downloadHardshipTemplate(){
  var head=['学号','等级','评议结果','学年'].join(',');
  var sample='202600001,特别困难,班级评议通过，公示无异议,2026-2027';
  download('困难认定导入模板.csv','\uFEFF'+head+'\n'+sample+'\n','text/csv;charset=utf-8');
  toast('模板已下载（等级限 特别困难/困难/一般困难）');
}
function openHardshipImport(){
  openModal('<h2>批量导入困难认定</h2><div class="m-sub">模板列为：学号、等级、评议结果、学年。等级限 特别困难 / 困难 / 一般困难；按学号匹配台账学生，未匹配、等级无效、同学年重复的行会跳过并列出明细。每生每学年以导入档案为准（同学生同学年已存在则更新）。</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
    +'<button class="btn btn-p" onclick="pickHardshipCsv()">选择 CSV 文件</button>'
    +'<button class="btn btn-g" onclick="downloadHardshipTemplate()">下载导入模板</button>'
    +'</div><div id="hardshipPreview" style="max-height:300px;overflow:auto"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button></div>');
}
function pickHardshipCsv(){
  openFilePicker(function(file){
    var fr=new FileReader();
    fr.onload=function(){ showHardshipImportPreview(decodeText(fr.result)); };
    fr.readAsArrayBuffer(file);
  }, '.csv,.txt');
}
function showHardshipImportPreview(text){
  var box=document.getElementById('hardshipPreview'); if(!box) return;
  var delim=guessDelim(text);
  var rows=parseDelimited(text, delim);
  if(rows.length<2){ box.innerHTML='<div class="empty"><div class="big">—</div>未能解析出有效数据行。</div>'; return; }
  var colMap={}, i;
  rows[0].forEach(function(hd,ix){
    var s=String(hd||'').replace(/^\uFEFF/,'').trim();
    if(s.indexOf('学号')>-1) colMap.xh=ix;
    else if(s.indexOf('等级')>-1) colMap.level=ix;
    else if(s.indexOf('评议')>-1) colMap.review=ix;
    else if(s.indexOf('学年')>-1) colMap.year=ix;
  });
  if(colMap.xh===undefined){ box.innerHTML='<div class="empty"><div class="big">—</div>未识别到「学号」表头。</div>'; return; }
  var records=[], skips=[], seen={};
  for(i=1;i<rows.length;i++){
    var r=rows[i];
    var xh=String(r[colMap.xh]==null?'':r[colMap.xh]).trim();
    var level=colMap.level!==undefined?String(r[colMap.level]==null?'':r[colMap.level]).trim():'';
    var review=colMap.review!==undefined?String(r[colMap.review]==null?'':r[colMap.review]).trim():'';
    var year=colMap.year!==undefined?String(r[colMap.year]==null?'':r[colMap.year]).trim():'';
    if(!xh && !level && !review && !year){ skips.push({row:i+1, xh:'', name:'', reason:'整行为空'}); continue; }
    if(!xh){ skips.push({row:i+1, xh:'', name:'', reason:'学号为空'}); continue; }
    if(!year){ skips.push({row:i+1, xh:xh, name:'', reason:'学年为空'}); continue; }
    if(HARD_LEVELS.indexOf(level)===-1){ skips.push({row:i+1, xh:xh, name:'', reason:'等级无效（'+level+'），应为 特别困难/困难/一般困难'}); continue; }
    var key=xh+'|'+year;
    if(seen[key]){ skips.push({row:i+1, xh:xh, name:'', reason:'文件内同一学生同学年重复'}); continue; }
    seen[key]=1;
    records.push({row:i+1, xh:xh, level:level, review:review, year:year});
  }
  window.__pendingHardship=records;
  var html='<div style="font-size:14px;margin-bottom:10px">解析完成：可导入 <b style="color:var(--green)">'+records.length+'</b> 条';
  if(skips.length) html+='，跳过 <b style="color:var(--red)">'+skips.length+'</b> 条';
  html+='</div>';
  if(records.length){
    html+='<table style="table-layout:fixed;width:100%;font-size:13px"><colgroup><col style="width:20%"><col style="width:16%"><col style="width:16%"><col style="width:30%"><col style="width:18%"></colgroup><thead><tr style="background:#f7f9fc"><th style="padding:6px 8px;text-align:left">学号</th><th>等级</th><th>学年</th><th>评议结果</th><th>操作</th></tr></thead><tbody>';
    records.slice(0,8).forEach(function(rec){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #eef1f5">'+esc(rec.xh)+'</td><td><span class="tag '+(rec.level==='特别困难'?'tag-红':(rec.level==='困难'?'tag-橙':'tag-黄'))+'">'+esc(rec.level)+'</span></td><td>'+esc(rec.year)+'</td><td>'+esc(rec.review||'')+'</td><td>—</td></tr>';
    });
    if(records.length>8) html+='<tr><td colspan="5" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (records.length-8) +' 条略</td></tr>';
    html+='</tbody></table>';
    html+='<div class="m-actions" style="margin-top:12px"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="confirmHardshipImport()">确认导入 '+records.length+' 条</button></div>';
  } else {
    html+='<div class="empty"><div class="big">—</div>没有可导入的认定数据。</div>';
  }
  if(skips.length){
    html+='<div style="font-size:13px;margin-top:14px;color:var(--muted)"><b style="color:var(--red)">跳过明细（请核对后修改重导）：</b></div>'
      +'<table style="table-layout:fixed;width:100%;font-size:12.5px"><colgroup><col style="width:14%"><col style="width:20%"><col style="width:20%"><col style="width:46%"></colgroup><thead><tr style="background:#fdf3f3;color:var(--red)"><th style="padding:5px 8px;text-align:left">文件行号</th><th>学号</th><th>姓名</th><th>跳过原因</th></tr></thead><tbody>';
    skips.slice(0,20).forEach(function(sk){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #fbe3e3">'+sk.row+'</td><td>'+esc(sk.xh||'')+'</td><td>'+esc(sk.name||'')+'</td><td>'+esc(sk.reason)+'</td></tr>';
    });
    if(skips.length>20) html+='<tr><td colspan="4" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (skips.length-20) +' 条略</td></tr>';
    html+='</tbody></table>';
  }
  box.innerHTML=html;
}
function confirmHardshipImport(){
  var records=window.__pendingHardship||[];
  if(!records.length){ toast('没有可导入的数据','err'); return; }
  (async function(){
    try{
      var json=await Model.save('POST','/api/import/hardship',{records:records});
      closeModal(); aidRenderHardship();
      var s=json.skips||[];
      var msg='已导入困难认定 '+json.imported+' 条';
      if(s.length) msg+='，跳过 '+s.length+' 条（学号未匹配/等级无效/重复，可在重新导入时查看明细）';
      toast(msg);
    }catch(e){ toast(e.message,'err'); }
  })();
}

function downloadTalkTemplate(){
  var head=['谈话时间','地点','姓名','学号','性别','年级','学历','话题','谈话要点记录','备注'].join(',');
  var sample='2026-09-15,办公室,张三,202600001,男,大一,本科,新生适应,已了解其高中情况与入学适应，建议参加班级活动。';
  download('谈话导入模板.csv','\uFEFF'+head+'\n'+sample+'\n','text/csv;charset=utf-8');
  toast('模板已下载（时间、学号、谈话要点记录为必填；性别/年级/学历可不填）');
}
function openTalkImport(){
  openModal('<h2>批量导入谈话记录</h2><div class="m-sub">模板列为：谈话时间、地点、姓名、学号、性别、年级、学历、话题、谈话要点记录、备注。<br>必填：谈话时间、学号、谈话要点记录；按学号匹配台账学生，未匹配或缺失必填项的行会跳过并列出明细。导入后谈话列表即时更新，学生画像谈话数同步。</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
    +'<button class="btn btn-p" onclick="pickTalkCsv()">选择 CSV 文件</button>'
    +'<button class="btn btn-g" onclick="downloadTalkTemplate()">下载导入模板</button>'
    +'</div><div id="talkPreview" style="max-height:300px;overflow:auto"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button></div>');
}
function pickTalkCsv(){
  openFilePicker(function(file){
    var fr=new FileReader();
    fr.onload=function(){ showTalkImportPreview(decodeText(fr.result)); };
    fr.readAsArrayBuffer(file);
  }, '.csv,.txt');
}
function showTalkImportPreview(text){
  var box=document.getElementById('talkPreview'); if(!box) return;
  var delim=guessDelim(text);
  var rows=parseDelimited(text, delim);
  if(rows.length<2){ box.innerHTML='<div class="empty"><div class="big">—</div>未能解析出有效数据行。</div>'; return; }
  var colMap={}, i;
  rows[0].forEach(function(hd,ix){
    var s=String(hd||'').replace(/^\uFEFF/,'').trim();
    if(s.indexOf('时间')>-1) colMap.time=ix;
    else if(s.indexOf('地点')>-1) colMap.place=ix;
    else if(s.indexOf('姓名')>-1) colMap.name=ix;
    else if(s.indexOf('学号')>-1) colMap.xh=ix;
    else if(s.indexOf('话题')>-1) colMap.topic=ix;
    else if(s.indexOf('要点')>-1||s.indexOf('内容')>-1) colMap.content=ix;
  });
  if(colMap.xh===undefined || colMap.time===undefined || colMap.content===undefined){
    box.innerHTML='<div class="empty"><div class="big">—</div>未识别到必填表头（谈话时间 / 学号 / 谈话要点记录）。</div>'; return;
  }
  var records=[], skips=[];
  for(i=1;i<rows.length;i++){
    var r=rows[i];
    var time=String(r[colMap.time]==null?'':r[colMap.time]).trim();
    var xh=String(r[colMap.xh]==null?'':r[colMap.xh]).trim();
    var content=String(r[colMap.content]==null?'':r[colMap.content]).trim();
    var place=colMap.place!==undefined?String(r[colMap.place]==null?'':r[colMap.place]).trim():'';
    var name=colMap.name!==undefined?String(r[colMap.name]==null?'':r[colMap.name]).trim():'';
    var topic=colMap.topic!==undefined?String(r[colMap.topic]==null?'':r[colMap.topic]).trim():'';
    if(!time && !xh && !content){ skips.push({row:i+1, xh:'', name:'', reason:'整行为空'}); continue; }
    if(!time){ skips.push({row:i+1, xh:xh, name:name, reason:'谈话时间为空'}); continue; }
    if(!xh){ skips.push({row:i+1, xh:'', name:name, reason:'学号为空'}); continue; }
    if(!content){ skips.push({row:i+1, xh:xh, name:name, reason:'谈话要点记录为空'}); continue; }
    records.push({row:i+1, time:time, place:place, name:name, xh:xh, topic:topic, content:content});
  }
  window.__pendingTalks=records;
  var html='<div style="font-size:14px;margin-bottom:10px">解析完成：可导入 <b style="color:var(--green)">'+records.length+'</b> 条';
  if(skips.length) html+='，跳过 <b style="color:var(--red)">'+skips.length+'</b> 条';
  html+='</div>';
  if(records.length){
    html+='<table style="table-layout:fixed;width:100%;font-size:13px"><colgroup><col style="width:16%"><col style="width:16%"><col style="width:18%"><col style="width:16%"><col style="width:34%"></colgroup><thead><tr style="background:#f7f9fc"><th style="padding:6px 8px;text-align:left">谈话时间</th><th>学号</th><th>姓名</th><th>话题</th><th>谈话要点记录</th></tr></thead><tbody>';
    records.slice(0,8).forEach(function(rec){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #eef1f5">'+esc(rec.time)+'</td><td>'+esc(rec.xh)+'</td><td>'+esc(rec.name||'')+'</td><td>'+esc(rec.topic||'未分类')+'</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(rec.content)+'</td></tr>';
    });
    if(records.length>8) html+='<tr><td colspan="5" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (records.length-8) +' 条略</td></tr>';
    html+='</tbody></table>';
    html+='<div class="m-actions" style="margin-top:12px"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="confirmTalkImport()">确认导入 '+records.length+' 条</button></div>';
  } else {
    html+='<div class="empty"><div class="big">—</div>没有可导入的谈话记录。</div>';
  }
  if(skips.length){
    html+='<div style="font-size:13px;margin-top:14px;color:var(--muted)"><b style="color:var(--red)">跳过明细（导入失败项，请核对后修改重导）：</b></div>'
      +'<table style="table-layout:fixed;width:100%;font-size:12.5px"><colgroup><col style="width:14%"><col style="width:20%"><col style="width:18%"><col style="width:48%"></colgroup><thead><tr style="background:#fdf3f3;color:var(--red)"><th style="padding:5px 8px;text-align:left">文件行号</th><th>学号</th><th>姓名</th><th>跳过原因</th></tr></thead><tbody>';
    skips.slice(0,20).forEach(function(sk){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #fbe3e3">'+sk.row+'</td><td>'+esc(sk.xh||'')+'</td><td>'+esc(sk.name||'')+'</td><td>'+esc(sk.reason)+'</td></tr>';
    });
    if(skips.length>20) html+='<tr><td colspan="4" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (skips.length-20) +' 条略</td></tr>';
    html+='</tbody></table>';
  }
  box.innerHTML=html;
}
function confirmTalkImport(){
  var records=window.__pendingTalks||[];
  if(!records.length){ toast('没有可导入的数据','err'); return; }
  (async function(){
    try{
      var json=await Model.save('POST','/api/import/talks',{records:records});
      closeModal(); renderTalksTable();
      var s=json.skips||[];
      var msg='已导入谈话记录 '+json.imported+' 条';
      if(s.length) msg+='，跳过 '+s.length+' 条（学号未匹配/必填缺失）';
      toast(msg);
    }catch(e){ toast(e.message,'err'); }
  })();
}
