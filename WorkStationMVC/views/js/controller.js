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
function exportTalks(){
  var lines=[['谈话时间','姓名','学号','班级','谈话人','地点','话题','关注等级','学生特点','谈话内容','跟进事项','跟进日期','已完成'].join(',')];
  Model.talks().forEach(function(t){
    var s=getStudent(t.sid);
    function q(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
    lines.push([q(t.time),q(s?s.name:''),q(s?s.xh:''),q(s?s.cls:''),q(t.talker),q(t.place),q(t.topic),q({g:'一般',a:'需关注',r:'重点关注'}[t.level]||''),q(t.traits),q(t.content),q(t.followUp),q(t.followDate),q(t.done?'是':'')].join(','));
  });
  download('谈心谈话记录_'+todayISO()+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('已导出谈话记录 CSV');
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
function exportStudents(){
  var head=Object.keys(STUDENT_FIELDS).map(function(k){ return STUDENT_FIELDS[k]; }).concat(['特殊关注','备注']).join(',');
  var lines=[head];
  Model.students().forEach(function(s){
    function q(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
    var vals=Object.keys(STUDENT_FIELDS).map(function(k){ return q(s[k]); });
    vals.push(q(concernsToStr(s.concerns)), q(s.note||''));
    lines.push(vals.join(','));
  });
  download('学生台账_'+todayISO()+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('已导出学生台账 CSV');
}
