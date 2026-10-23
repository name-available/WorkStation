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
function exportAidRecords(){
  var pid=F.aid.rPid, p=aidProject(pid);
  if(!p){ toast('请先选择奖助项目','err'); return; }
  var records=aidRecords().filter(function(r){ return r.pid===pid; });
  var q=F.aid.rQ.toLowerCase();
  if(q) records=records.filter(function(r){ var s=getStudent(r.sid); return s && ((s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1); });
  if(F.aid.rCls) records=records.filter(function(r){ var s=getStudent(r.sid); return s && s.cls===F.aid.rCls; });
  if(F.aid.rLevel) records=records.filter(function(r){ return (hardshipOf(r.sid)||{}).level===F.aid.rLevel; });
  if(F.aid.rEco) records=records.filter(function(r){ return ecoLevelOf(r.sid)===F.aid.rEco; });
  function q(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
  var lines=[['姓名','学号','班级','项目','学年学期','困难等级','经济关注','申请日期','材料说明','评审结果','金额','发放状态'].map(q).join(',')];
  records.forEach(function(r){
    var s=getStudent(r.sid)||{}, hd=hardshipOf(r.sid), eco=ecoLevelOf(r.sid);
    lines.push([q(s.name||''),q(s.xh||''),q(s.cls||''),q(p.name),q(p.term||''),q(hd?hd.level:''),q(eco?'经济·'+eco:''),q(r.applyDate),q(r.material),q(r.review),q(r.amount),q(r.status)].join(','));
  });
  download('奖助申报明细_'+todayISO()+'_{0}.csv'.replace('{0}',p.name.replace(/[\/\\:*?"<>|]/g,'_')),'\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('已导出奖助申报明细（'+records.length+' 条）');
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
  toast('数据库文件位于项目文件夹 db/workstation.db，可在访达中打开');
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

/* ---------- 奖助管理：项目 ---------- */
function openAidProjectForm(id){
  var p = id ? aidProject(id) : null;
  var v = p || { name:'', type:'助学金', term:currentTerm(), amount:'', quota:'', deadline:'', status:'进行中', note:'' };
  openModal('<h2>'+(id?'编辑奖助项目':'新增奖助项目')+'</h2><div class="m-sub">项目用于组织奖助申报与发放，如“国家助学金（2026-2027）”“困难认定”。删除项目会同步删除其申报记录与关联材料索引。</div>'
    +'<div class="form-grid">'
    +'<div class="form-item form-full"><label><span class="req">*</span>项目名称</label><input id="apName" value="'+esc(v.name)+'" placeholder="如 国家助学金（2026-2027学年）"></div>'
    +'<div class="form-item"><label>类型</label><select id="apType">'+AID_TYPES.map(function(t){ return '<option'+(v.type===t?' selected':'')+'>'+esc(t)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item"><label>学年学期</label><input id="apTerm" value="'+esc(v.term||'')+'" placeholder="如 2026-2027"></div>'
    +'<div class="form-item"><label>金额标准</label><input id="apAmount" value="'+esc(v.amount||'')+'" placeholder="如 每生每年 4000 元"></div>'
    +'<div class="form-item"><label>名额</label><input id="apQuota" type="number" min="0" value="'+esc(v.quota||'')+'" placeholder="名额数量，可空"></div>'
    +'<div class="form-item"><label>申报截止日期</label><input type="date" id="apDeadline" value="'+esc(v.deadline||'')+'"></div>'
    +'<div class="form-item"><label>状态</label><select id="apStatus">'+['进行中','已截止','已完成'].map(function(s){ return '<option'+(v.status===s?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item form-full"><label>备注</label><input id="apNote" value="'+esc(v.note||'')+'" placeholder="如 评选条件、材料要求"></div>'
    +'</div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveAidProject(\''+(id||'')+'\')">保存</button></div>');
}
function saveAidProject(id){
  var name=document.getElementById('apName').value.trim();
  if(!name){ toast('请填写项目名称','err'); return; }
  var obj = id ? aidProject(id) : { id:uid(), createdAt:Date.now(), updatedAt:Date.now() };
  obj.name=name; obj.type=document.getElementById('apType').value;
  obj.term=document.getElementById('apTerm').value.trim();
  obj.amount=document.getElementById('apAmount').value.trim();
  obj.quota=Number(document.getElementById('apQuota').value||0);
  obj.deadline=document.getElementById('apDeadline').value;
  obj.status=document.getElementById('apStatus').value;
  obj.note=document.getElementById('apNote').value.trim();
  obj.updatedAt=Date.now();
  (async function(){
    try{
      if(id){ await Model.save('PUT','/api/aid/projects/'+id,{project:obj}); }
      else { await Model.save('POST','/api/aid/projects',{project:obj}); }
      closeModal(); aidRenderProjects(); toast(id?'已保存项目修改':'已新增奖助项目');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function delAidProject(id){
  var p=aidProject(id); if(!p) return;
  if(!confirmDlg('确定删除项目「'+p.name+'」吗？\n该项目下的申报记录与已上传材料索引将一并删除（本地实体文件保留）。')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/aid/projects/'+id);
      if(F.aid.rPid===id) F.aid.rPid='';
      aidRenderProjects(); toast('已删除项目','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
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

/* ---------- 奖助管理：申报记录 ---------- */
function aidAddSelected(){
  var pid=F.aid.rPid; if(!pid){ toast('请先选择奖助项目','err'); return; }
  var chks=document.querySelectorAll('.arChk:checked');
  if(!chks.length){ toast('请先勾选要添加申报的学生','err'); return; }
  var today=todayISO();
  var sids=[].map.call(chks,function(c){ return c.value; });
  var ok=0, err=0, i=0;
  function next(){
    if(i>=sids.length){
      if(err){ toast('已添加 '+ok+' 条'+(err?'，'+err+' 条失败（可能已存在）':''), err?'err':'ok'); }
      else toast('已为 '+ok+' 名学生添加申报');
      aidRenderRecords();
      return;
    }
    var sid=sids[i++];
    Model.save('POST','/api/aid/records',{record:{pid:pid, sid:sid, applyDate:today, material:'', review:'待评审', amount:'', status:'待发放', note:''}})
      .then(function(){ ok++; next(); })
      .catch(function(){ err++; next(); });
  }
  next();
}
function openAidRecordForm(id){
  var r = id ? aidRecords().find(function(x){ return x.id===id; }) : null;
  if(!r){ toast('记录不存在','err'); return; }
  var s=getStudent(r.sid)||{};
  var p=aidProject(r.pid)||{};
  openModal('<h2>编辑申报记录</h2><div class="m-sub">'+esc(p.name||'')+' · '+esc(s.name||'')+'（'+esc(s.xh||'')+'）</div>'
    +'<div class="form-grid">'
    +'<div class="form-item"><label>申请日期</label><input type="date" id="arDate" value="'+esc(r.applyDate||todayISO())+'"></div>'
    +'<div class="form-item"><label>金额</label><input id="arAmount" value="'+esc(r.amount||'')+'" placeholder="如 4000 元"></div>'
    +'<div class="form-item"><label>评审结果</label><select id="arReview">'+AID_REVIEWS.map(function(x){ return '<option'+(r.review===x?' selected':'')+'>'+esc(x)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item"><label>发放状态</label><select id="arStatus">'+AID_PAY.map(function(x){ return '<option'+(r.status===x?' selected':'')+'>'+esc(x)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item form-full"><label>材料说明</label><input id="arMaterial" value="'+esc(r.material||'')+'" placeholder="如 已提交家庭经济困难认定表、佐证材料"></div>'
    +'<div class="form-item form-full"><label>备注</label><input id="arNote" value="'+esc(r.note||'')+'"></div>'
    +'</div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveAidRecord(\''+r.id+'\')">保存</button></div>');
}
function saveAidRecord(id){
  var r=aidRecords().find(function(x){ return x.id===id; }); if(!r) return;
  r.applyDate=document.getElementById('arDate').value||todayISO();
  r.amount=document.getElementById('arAmount').value.trim();
  r.review=document.getElementById('arReview').value;
  r.status=document.getElementById('arStatus').value;
  r.material=document.getElementById('arMaterial').value.trim();
  r.note=document.getElementById('arNote').value.trim();
  r.updatedAt=Date.now();
  (async function(){
    try{
      await Model.save('PUT','/api/aid/records/'+id,{record:r});
      closeModal(); aidRenderRecords(); toast('已保存申报记录');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function delAidRecord(id){
  var r=aidRecords().find(function(x){ return x.id===id; }); if(!r) return;
  var s=getStudent(r.sid);
  if(!confirmDlg('确定删除 '+(s?s.name:'')+' 的这条申报记录吗？')) return;
  (async function(){
    try{
      await Model.save('DELETE','/api/aid/records/'+id);
      aidRenderRecords(); toast('已删除申报记录','ok');
    }catch(e){ toast(e.message,'err'); }
  })();
}
function openAidUpload(sid, pid){
  var s=getStudent(sid); if(!s) return;
  var p=aidProject(pid);
  openModal('<h2>上传奖助材料</h2>'
    +'<div class="m-sub">'+(p?'项目：'+esc(p.name)+'<br>':'')+'学生：'+esc(s.name)+'（'+esc(s.xh)+'）。文件将存入项目本地「奖助文件」文件夹，并自动改名为 <b>YYYYMMDD-姓名-文件类型</b>。</div>'
    +'<div class="form-item"><label>文件类型</label><select id="auType">'+AID_FILE_TYPES.map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item"><label>材料日期</label><input type="date" id="auDate" value="'+todayISO()+'"></div>'
    +'<div id="auTip" style="font-size:13px;color:var(--muted);margin:10px 0">尚未选择文件。</div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pickAidFile(\''+sid+'\',\''+pid+'\')">选择文件并上传</button></div>');
}
function pickAidFile(sid, pid){
  openFilePicker(function(file){
    uploadAidFile(sid, pid, file);
  }, '*');
}
function uploadAidFile(sid, pid, file){
  var ftype=document.getElementById('auType').value;
  var date=document.getElementById('auDate').value||todayISO();
  var fd=new FormData();
  fd.append('sid', sid); fd.append('pid', pid);
  fd.append('type', ftype); fd.append('date', date);
  fd.append('file', file, file.name);
  document.getElementById('auTip').textContent='正在上传「'+file.name+'」…';
  (async function(){
    try{
      var res=await fetch('/api/aid/upload', {method:'POST', body:fd});
      var json={};
      try{ json=await res.json(); }catch(e){}
      if(!res.ok){ throw new Error((json&&json.error)||('上传失败（'+res.status+'）')); }
      if(json.state) Model.data=json.state;
      var f=json.payload&&json.payload.file;
      closeModal(); aidRenderRecords();
      toast('已上传并自动命名为 '+(f&&f.name||'')+'（存于「奖助文件」文件夹）');
    }catch(e){ toast(e.message,'err'); }
  })();
}

/* ---------- 谈话：批量导入 ---------- */
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
