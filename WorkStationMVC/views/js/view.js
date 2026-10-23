'use strict';
/* ================= View 层：渲染与交互 UI =================
 * 只负责展示与收集输入；所有数据读写一律通过 Model（/api）。
 */
/* ---------- 工具函数 ---------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtNum(n){ return Number(n||0).toLocaleString('zh-CN'); }
function fmtTime(d){ return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'); }
function djb2(str){ var h=5381,i; for(i=0;i<str.length;i++){ h=((h<<5)+h+str.charCodeAt(i))>>>0; } return 'h'+h.toString(16); }
function ymd(dateStr){ if(!dateStr) return '—'; var p=String(dateStr).split('-'); if(p.length<3) return dateStr; return p[0]+'-'+p[1]+'-'+p[2]; }

/* ---------- 字典与常量 ---------- */
var CONCERN_TYPES=['心理','学业','思政','经济'];
var CONCERN_LEVELS=['红','橙','黄'];             // 学业 / 思政 / 经济 三级
var PSYCH_LEVELS=['红','橙','黄','严重','一般']; // 心理类五级（v2.2）
function levelsOf(t){ return t==='心理' ? PSYCH_LEVELS : CONCERN_LEVELS; }
function levelValid(t,l){ return t==='心理' ? PSYCH_LEVELS.indexOf(l)>-1 : CONCERN_LEVELS.indexOf(l)>-1; }
function levelDefault(t){ return t==='心理' ? '一般' : '黄'; }
function levelInfo(lv){ if(lv==='r') return ['重点关注','r','badge-r']; if(lv==='a') return ['需关注','a','badge-a']; return ['一般','g','badge-g']; }
function normConcerns(list){
  if(!Array.isArray(list)) return [];
  return list.map(function(c){
    if(c && typeof c==='object' && c.t) return { t:String(c.t), l:(levelValid(c.t,c.l)?c.l:levelDefault(c.t)) };
    return { t:String(c==null?'':c), l:levelDefault(String(c==null?'':c)) };
  }).filter(function(c){ return c.t; });
}
function concernLabel(c){ return (c.t||'')+(c.l?'·'+c.l:''); }
function concernTagClass(c){ var l=c&&c.l; if(l==='红'||l==='严重') return 'tag-红'; if(l==='橙') return 'tag-橙'; return 'tag-黄'; }
function concernHas(s,t){ return (s.concerns||[]).some(function(c){ return c.t===t; }); }
function concernsToStr(list){ return normConcerns(list).map(function(c){ return c.t+':'+c.l; }).join(';'); }
function concernsFromStr(str){
  var out=[];
  if(!str) return out;
  String(str).split(/[;；,，、\n]/).forEach(function(seg){
    seg=String(seg).trim(); if(!seg) return;
    var m=seg.match(/^(心理|学业|思政|经济|家庭|其他)\s*[:：\-—]?\s*(严重|一般|红|橙|黄)?/);
    if(m){
      var t=m[1], l=m[2]||levelDefault(t);
      if(levelValid(t,l)) out.push({ t:t, l:l });
    }
  });
  return out;
}
function topicDict(){ return (Model.settings().topicDict) || []; }
function catDict(){ return (Model.settings().catDict) || []; }
function getStudent(id){ return Model.student(id); }
function studentName(id){ var s=getStudent(id); return s? s.name : '（已删除学生）'; }
function talkCountOf(sid){ return Model.talks().filter(function(t){ return t.sid===sid; }).length; }
function portraitTagsOf(sid){ var p=Model.portraits().find(function(x){ return x.sid===sid; }); return p? p.tags : []; }

/* ---------- 通用交互 ---------- */
function toast(msg, kind){ var t=document.createElement('div'); t.className='toast '+(kind||'ok'); t.textContent=msg; document.getElementById('toastRoot').appendChild(t); setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },350); },2600); }
function confirmDlg(msg){ return window.confirm(msg); }
function openModal(html){ var r=document.getElementById('modalRoot'); r.innerHTML='<div class="overlay"><div class="modal">'+html+'</div></div>'; var ov=r.firstChild; ov.addEventListener('click',function(e){ if(e.target===ov) closeModal(); }); }
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
function openFilePicker(cb, accept){ var inp=document.createElement('input'); inp.type='file'; if(accept) inp.accept=accept; inp.style.display='none'; document.body.appendChild(inp); inp.addEventListener('change',function(){ if(inp.files&&inp.files[0]) cb(inp.files[0]); document.body.removeChild(inp); }); inp.click(); }
function download(name, content, type){ var blob=new Blob([content],{type:type||'text/plain;charset=utf-8'}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(url); document.body.removeChild(a); },500); }

/* ---------- 分隔符文本解析（CSV / TSV 通用） ---------- */
function parseDelimited(text, delim){
  var rows=[], row=[], cell='', inQ=false, i, c;
  for(i=0;i<text.length;i++){
    c=text[i];
    if(inQ){ if(c==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else inQ=false; } else cell+=c; }
    else if(c==='"'){ inQ=true; }
    else if(c===delim){ row.push(cell); cell=''; }
    else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
    else if(c==='\r'){ /* skip */ }
    else cell+=c;
  }
  if(cell!=='' || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(function(r){ return r.some(function(x){ return String(x||'').trim()!==''; }); });
}
function guessDelim(text){ var first=text.split(/\r?\n/)[0]||''; if(first.indexOf('\t')>-1 && first.indexOf(',')===-1) return '\t'; return ','; }
function decodeText(buf){
  var bytes=new Uint8Array(buf);
  try{ var u=new TextDecoder('utf-8',{fatal:true}).decode(bytes); return u; }catch(e){}
  try{ return new TextDecoder('gbk').decode(bytes); }catch(e){}
  return new TextDecoder('utf-8').decode(bytes);
}
var STUDENT_FIELDS = { xh:'学号', name:'姓名', gender:'性别', origin:'籍贯', cls:'班级', dorm:'宿舍', nation:'民族', zzmm:'政治面貌', address:'通讯地址', qq:'QQ', phone:'电话', fName:'父亲姓名', fPhone:'父亲联系方式', fWork:'父亲工作单位', fPost:'父亲职务', fZzmm:'父亲政治面貌', mName:'母亲姓名', mPhone:'母亲联系方式', mWork:'母亲工作单位', mPost:'母亲职务', mZzmm:'母亲政治面貌' };
function headerAlias(h){
  var s=String(h||'').replace(/^\uFEFF/,'').trim().toLowerCase();
  s=s.replace(/[\s（()]/g,'');
  var map={
    xh:'xh', xuehao:'xh', studentno:'xh', no:'xh', id:'xh', 学号:'xh', 学生学号:'xh', 学号学生:'xh',
    name:'name', xingming:'name', studentname:'name', 姓名:'name', 学生姓名:'name',
    gender:'gender', xingbie:'gender', sex:'gender', 性别:'gender',
    cls:'cls', banji:'cls', class:'cls', 班级:'cls',
    major:'major', zhuanye:'major', xueyuan:'major', college:'major', 专业:'major',
    nation:'nation', minzu:'nation', 民族:'nation',
    zzmm:'zzmm', zhengzhimianmao:'zzmm', political:'zzmm', 政治面貌:'zzmm',
    origin:'origin', jiguan:'origin', 籍贯:'origin', shengyuandi:'origin', shengfen:'origin', province:'origin', 生源地:'origin',
    dorm:'dorm', sushe:'dorm', dormitory:'dorm', 宿舍:'dorm',
    address:'address', dizhi:'address', tongxundizhi:'address', addr:'address', 通讯地址:'address',
    qq:'qq',
    phone:'phone', shouji:'phone', dianhua:'phone', lianxifangshi:'phone', tel:'phone', 电话:'phone', 手机:'phone', 手机号:'phone',
    family:'family', jiatingqingkuang:'family', jiating:'family', 家庭情况:'family',
    fname:'fName', fathername:'fName', 父亲姓名:'fName', 父姓名:'fName',
    fphone:'fPhone', fatherphone:'fPhone', 父亲联系方式:'fPhone', 父亲电话:'fPhone',
    fwork:'fWork', fatherwork:'fWork', 父亲工作单位:'fWork', 父亲单位:'fWork',
    fpost:'fPost', fatherpost:'fPost', 父亲职务:'fPost',
    fzzmm:'fZzmm', fatherzzmm:'fZzmm', 父亲政治面貌:'fZzmm',
    mname:'mName', mothername:'mName', 母亲姓名:'mName', 母姓名:'mName',
    mphone:'mPhone', motherphone:'mPhone', 母亲联系方式:'mPhone', 母亲电话:'mPhone',
    mwork:'mWork', motherwork:'mWork', 母亲工作单位:'mWork', 母亲单位:'mWork',
    mpost:'mPost', motherpost:'mPost', 母亲职务:'mPost',
    mzzmm:'mZzmm', motherzzmm:'mZzmm', 母亲政治面貌:'mZzmm',
    concerns:'concerns', 特殊关注:'concerns',
    note:'note', beizhu:'note', remark:'note', comments:'note', 备注:'note' };
  return map[s]||'';
}

/* ---------- 视图常量与导航 ---------- */
var VIEWS = {
  home:'工作台', students:'学生台账', focus:'重点关注', aid:'奖助管理', talks:'谈心谈话', portrait:'学生画像', files:'文件中心', settings:'设置'
};
var VIEW_SUBS = {
  home:'今日概览与待办', students:'学生信息导入与管理', focus:'关注调整与材料归档',
  aid:'奖助项目 · 困难认定 · 申报发放',
  talks:'谈话记录、计划与跟进', portrait:'一人一档全景视图', files:'本地文件索引（仅文件名检索）', settings:'密码、字典、备份与数据'
};
var curView='home';
var F = { students:{q:'',cls:'',gender:'',zzmm:'',concern:''}, focus:{q:'',type:'',level:'',cls:''},
  aid:{tab:'projects', pQ:'',pType:'',pTerm:'', hYear:'',hLevel:'',hQ:'', rPid:'',rCls:'',rLevel:'',rEco:'',rQ:''},
  talks:{q:'',topic:'',level:'',month:''}, files:{q:'',cat:'',tag:''}, portrait:{sid:''} };
var NAV_ICONS = {
  home:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/></svg>',
  students:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  focus:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  aid:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  talks:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>',
  portrait:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M18 3l1.2 2.6 2.8.4-2 2 .5 2.8L18 9.8l-2.5 1 .5-2.8-2-2 2.8-.4z"/></svg>',
  files:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  settings:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};
/* 导出列定义（台账 / 谈话，用于导出配置弹窗） */
var STUDENT_EXPORT_FIELDS = [
  {k:'xh',l:'学号'},{k:'name',l:'姓名'},{k:'gender',l:'性别'},{k:'origin',l:'籍贯'},
  {k:'cls',l:'班级'},{k:'dorm',l:'宿舍'},{k:'nation',l:'民族'},{k:'zzmm',l:'政治面貌'},
  {k:'address',l:'通讯地址'},{k:'qq',l:'QQ'},{k:'phone',l:'电话'},
  {k:'fName',l:'父亲姓名'},{k:'fPhone',l:'父亲联系方式'},{k:'fWork',l:'父亲工作单位'},{k:'fPost',l:'父亲职务'},{k:'fZzmm',l:'父亲政治面貌'},
  {k:'mName',l:'母亲姓名'},{k:'mPhone',l:'母亲联系方式'},{k:'mWork',l:'母亲工作单位'},{k:'mPost',l:'母亲职务'},{k:'mZzmm',l:'母亲政治面貌'},
  {k:'major',l:'专业'},{k:'family',l:'家庭情况'},
  {k:'concerns',l:'重点关注'},{k:'note',l:'备注'},{k:'talkCount',l:'谈话数'}
];
var TALK_EXPORT_FIELDS = [
  {k:'time',l:'谈话时间'},{k:'name',l:'姓名'},{k:'xh',l:'学号'},{k:'cls',l:'班级'},
  {k:'talker',l:'谈话人'},{k:'place',l:'地点'},{k:'topic',l:'话题'},{k:'level',l:'关注等级'},
  {k:'traits',l:'学生特点'},{k:'content',l:'谈话内容'},{k:'followUp',l:'跟进事项'},{k:'followDate',l:'跟进日期'},{k:'done',l:'完成状态'}
];
function renderNav(){
  var html='', k;
  for(k in VIEWS){
    html+='<div class="nav-item'+(curView===k?' active':'')+'" data-view="'+k+'">'+NAV_ICONS[k]+'<span>'+VIEWS[k]+'</span></div>';
  }
  document.getElementById('nav').innerHTML=html;
}

/* ---------- 通用渲染 ---------- */
var RENDERERS = {};
function stat(k,v,warn){ return '<div class="stat-card"><div class="k">'+k+'</div><div class="v'+(warn?' warn':'')+'">'+v+'</div></div>'; }
function emptyBox(msg){ return '<div class="empty"><div class="big">—</div>'+msg+'</div>'; }
var PALETTE = { blue:'#2a6fb0', green:'#2f9e63', amber:'#d98a2b', red:'#c4503e', teal:'#2b8a83', gray:'#7a8698', navy:'#1b3a5b' };
var HAS_ECHARTS = (typeof window.echarts !== 'undefined');
function chartBoxHtml(id,title){ return '<div class="chart-box"><h4>'+title+'</h4><div id="'+id+'" class="chart"></div></div>'; }
function fbBars(rows){
  var max=1, i;
  for(i=0;i<rows.length;i++){ if(rows[i][1]>max) max=rows[i][1]; }
  var h='<div class="chart-fallback">';
  rows.forEach(function(r){
    var w=Math.max(3, Math.round(r[1]/max*100));
    h+='<div class="fb-row"><span class="fb-name">'+esc(r[0])+'</span><div class="fb-bar" style="width:'+w+'%"></div><span class="fb-num">'+r[1]+'</span></div>';
  });
  h+='</div>';
  return h;
}
function drawCharts(){
  var st=Model.students(), tk=Model.talks(), i;
  function counts(arr,key){ var o={}; arr.forEach(function(x){ var k=x[key]||'未填写'; if(k===''||k===' '||k==='—') k='未填写'; o[k]=(o[k]||0)+1; }); return Object.keys(o).map(function(k){ return [k,o[k]]; }).sort(function(a,b){ return b[1]-a[1]; }); }
  var zz=counts(st,'zzmm');
  var tp=counts(tk,'topic').slice(0,6);
  if(!HAS_ECHARTS){
    var z=document.getElementById('chartZzmm'); if(z) z.innerHTML=fbBars(zz.length?zz:[['暂无数据',0]]);
    var t=document.getElementById('chartTopic'); if(t) t.innerHTML=fbBars(tp.length?tp:[['暂无数据',0]]);
    return;
  }
  try{
    function pie(data, colors){
      return { tooltip:{trigger:'item', confine:true},
        legend:{bottom:0, itemWidth:10, itemHeight:10, textStyle:{fontSize:12,color:'#64748b'}},
        series:[{type:'pie', radius:['42%','68%'], center:['50%','44%'], data:data.map(function(r){ return {name:r[0], value:r[1]}; }),
          label:{show:true, formatter:'{b} {c}', fontSize:11, color:'#23303e'},
          itemStyle:{borderColor:'#fff', borderWidth:2},
          color: colors }] };
    }
    function bar(rows){
      return { tooltip:{trigger:'axis', axisPointer:{type:'shadow'}, confine:true},
        grid:{left:6,right:40,top:6,bottom:6,containLabel:true},
        xAxis:{type:'value', axisLine:{show:false}, axisTick:{show:false}, splitLine:{lineStyle:{color:'#eef1f5'}}, axisLabel:{color:'#64748b',fontSize:11}},
        yAxis:{type:'category', inverse:true, data:rows.map(function(r){return r[0];}), axisLine:{show:false}, axisTick:{show:false}, axisLabel:{color:'#23303e',fontSize:12}},
        series:[{type:'bar', data:rows.map(function(r){return r[1];}), barWidth:'55%', itemStyle:{color:'#2a6fb0',borderRadius:[0,3,3,0]}, label:{show:true,position:'right',color:'#64748b',fontSize:11}}] };
    }
    var el,ch;
    el=document.getElementById('chartZzmm'); if(el){ ch=window.echarts.init(el); ch.setOption(pie(zz,['#2a6fb0','#2f9e63','#d98a2b','#7a8698','#2b8a83','#c4503e'])); }
    el=document.getElementById('chartTopic'); if(el){ ch=window.echarts.init(el); ch.setOption(bar(tp)); }
  }catch(e){}
}

/* ---------- 工作台 ---------- */
RENDERERS.home = function(){
  var st=Model.students(), tk=Model.talks(), fl=Model.files(), tm=todayISO(), ym=todayISO().slice(0,7), i;
  var male=0,female=0;
  for(i=0;i<st.length;i++){ if(st[i].gender==='男')male++; else if(st[i].gender==='女')female++; }
  var monthCount=0, sidSet={}, coverage=0, pending=[];
  for(i=0;i<tk.length;i++){ var t=tk[i]; if(t.time && t.time.slice(0,7)===ym) monthCount++; if(t.sid) sidSet[t.sid]=1; if(t.followDate && t.followDate<=tm && !t.done) pending.push(t); }
  if(st.length) coverage=Math.round(Object.keys(sidSet).length/st.length*100);
  var keyCount=0; for(i=0;i<st.length;i++){ if((st[i].concerns||[]).length>0) keyCount++; }
  var empty = st.length===0 && tk.length===0 && fl.length===0;

  var html='';
  if(empty){
    html+='<div class="banner"><b>欢迎使用辅导员工作站。</b>数据保存在本机 SQLite 数据库（db/workstation.db），不会上传。建议按这个顺序开始：<b>① 导入学生信息</b>（学生台账 → 导入）→ <b>② 记录谈心谈话</b>（谈心谈话 → 新增记录）→ <b>③ 注册文件索引</b>（文件中心）。也可以先 <button class="btn btn-p btn-sm" onclick="seedDemo()">载入示例数据</button> 体验完整功能。</div>';
  }
  html+='<div class="stat-grid">'
    +stat('学生总数', fmtNum(st.length), false)
    +stat('男生 / 女生', male+' / '+female, false)
    +stat('本月谈话', fmtNum(monthCount), false)
    +stat('待回访', fmtNum(pending.length), pending.length>0)
    +stat('重点关注', fmtNum(keyCount), keyCount>0)
    +'</div>';

  html+='<div class="section-title">数据概览</div><div class="chart-grid">';
  html+=chartBoxHtml('chartZzmm','政治面貌分布')+chartBoxHtml('chartTopic','谈话话题 Top 6');
  html+='</div>';

  html+='<div class="section-title">工作待办与最近记录</div><div class="panel-2">';
  var left='<div class="card"><h3>待回访提醒</h3>';
  if(pending.length){
    pending.sort(function(a,b){ return a.followDate<b.followDate?-1:1; });
    left+='<div class="tl">';
    pending.forEach(function(t){
      left+='<div class="tl-date">'+ymd(t.followDate)+'</div><div class="tl-axis"><span class="dot a"></span></div>'
        +'<div class="tl-body"><div class="t-topic">'+esc(studentName(t.sid))+' · '+esc(t.topic||'未分类')+'</div>'
        +'<div class="t-meta">'+esc(t.followUp||'回访跟进')+'</div>'
        +'<button class="btn btn-g btn-xs" onclick="markFollowDone(\''+t.id+'\')">标记已完成</button></div>';
    });
    left+='</div>';
  } else left+=emptyBox('当前没有到期的回访跟进。');
  left+='</div>';

  var right='<div class="card"><h3>重点关注学生 <button class="btn btn-g btn-xs" onclick="go(\'focus\')">进入板块管理</button></h3>';
  var keys=st.filter(function(s){ return (s.concerns||[]).length>0; });
  if(keys.length){
    keys.sort(function(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); });
    right+='<div style="display:flex;flex-direction:column;gap:9px">';
    keys.slice(0,8).forEach(function(s){
      var tags=(s.concerns||[]).map(function(c){ return '<span class="tag '+concernTagClass(c)+'">'+esc(concernLabel(c))+'</span>'; }).join('');
      right+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-weight:600">'+esc(s.name)+'</span><span style="font-size:12px;color:var(--muted)">'+esc(s.xh)+' · '+esc(s.cls||'—')+'</span><span>'+tags+'</span>'
        +'<button class="btn btn-g btn-xs" onclick="goPortrait(\''+s.id+'\')">查看画像</button></div>';
    });
    right+='</div>';
  } else right+=emptyBox('暂无重点关注学生。可在「重点关注」板块为学生标记关注后显示在这里。');
  right+='</div>';

  var rec='<div class="card"><h3>最近谈话</h3>';
  var tks=tk.slice().sort(function(a,b){ return b.time<a.time?-1:1; });
  if(tks.length){
    rec+='<div class="tl">';
    tks.slice(0,6).forEach(function(t){
      var li=levelInfo(t.level||'g');
      rec+='<div class="tl-date">'+ymd(t.time)+'</div><div class="tl-axis"><span class="dot '+li[1]+'"></span></div>'
        +'<div class="tl-body"><div class="t-topic">'+esc(studentName(t.sid))+' · '+esc(t.topic||'未分类')+' <span class="badge '+li[2]+'">'+li[0]+'</span></div>'
        +'<div class="t-meta">'+esc(t.place||'')+(t.place?' · ':'')+esc(t.talker||'')+'</div></div>';
    });
    rec+='</div>';
  } else rec+=emptyBox('还没有谈话记录，去谈心谈话里新增一条吧。');
  rec+='</div>';

  html+=left+right+rec+'</div>';
  document.getElementById('view-home').innerHTML=html;
  document.getElementById('viewActions').innerHTML='<button class="btn btn-p" onclick="go(\'talks\')">新增谈话</button><button class="btn btn-g" onclick="go(\'students\')">管理台账</button>';
  drawCharts();
};

/* ---------- 学生台账 ---------- */
function clsOptions(){ var o={},h=''; Model.students().forEach(function(s){ if(s.cls) o[s.cls]=1; }); Object.keys(o).sort().forEach(function(c){ h+='<option value="'+esc(c)+'">'+esc(c)+'</option>'; }); return h; }
function concernOptions(){
  var h='';
  CONCERN_TYPES.forEach(function(t){
    h+='<option value="'+t+'">'+t+'（全部）</option>';
    levelsOf(t).forEach(function(l){ h+='<option value="'+t+':'+l+'">'+t+'·'+l+'</option>'; });
  });
  return h;
}
RENDERERS.students = function(){
  var acts='<button class="btn btn-p" onclick="importStudentsModal()">导入学生</button><button class="btn btn-g" onclick="openExportDlg(\'students\')">导出</button><button class="btn btn-g" onclick="openStudentForm()">新增学生</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var html='<div class="toolbar">'
    +'<input type="search" placeholder="按姓名 / 学号查询" value="'+esc(F.students.q)+'" oninput="studentsApply()" id="stuQ">'
    +'<select id="stuCls" onchange="studentsApply()"><option value="">全部班级</option>'+clsOptions()+'</select>'
    +'<select id="stuGender" onchange="studentsApply()"><option value="">全部性别</option><option>男</option><option>女</option></select>'
    +'<select id="stuZzmm" onchange="studentsApply()"><option value="">全部政治面貌</option>'+Model.students().filter(function(s){return s.zzmm;}).map(function(s){return s.zzmm;}).filter(function(v,i,a){return a.indexOf(v)===i;}).map(function(v){return '<option>'+esc(v)+'</option>';}).join('')+'</select>'
    +'<select id="stuConcern" onchange="studentsApply()"><option value="">全部学生</option>'+concernOptions()+'</select>'
    +'</div><div id="studentsBox"></div>';
  document.getElementById('view-students').innerHTML=html;
  document.getElementById('stuQ').value=F.students.q;
  document.getElementById('stuCls').value=F.students.cls;
  document.getElementById('stuGender').value=F.students.gender;
  document.getElementById('stuZzmm').value=F.students.zzmm;
  document.getElementById('stuConcern').value=F.students.concern;
  renderStudentsTable();
};
function studentsApply(){
  F.students.q=(document.getElementById('stuQ').value||'').trim();
  F.students.cls=document.getElementById('stuCls').value;
  F.students.gender=document.getElementById('stuGender').value;
  F.students.zzmm=document.getElementById('stuZzmm').value;
  F.students.concern=document.getElementById('stuConcern').value;
  renderStudentsTable();
}
function renderStudentsTable(){
  var list=Model.students().slice(), q=F.students.q.toLowerCase(), i;
  if(q){ list=list.filter(function(s){ return (s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1; }); }
  if(F.students.cls) list=list.filter(function(s){ return s.cls===F.students.cls; });
  if(F.students.gender) list=list.filter(function(s){ return s.gender===F.students.gender; });
  if(F.students.zzmm) list=list.filter(function(s){ return s.zzmm===F.students.zzmm; });
  if(F.students.concern){
    var ci=F.students.concern.indexOf(':');
    list=list.filter(function(s){ return (s.concerns||[]).some(function(c){
      return ci>-1 ? (c.t===F.students.concern.slice(0,ci) && c.l===F.students.concern.slice(ci+1)) : c.t===F.students.concern;
    }); });
  }
  list.sort(function(a,b){ return (a.cls||'').localeCompare(b.cls||'') || (a.xh||'').localeCompare(b.xh||''); });
  var html='<div class="table-wrap"><table><colgroup><col style="width:11%"><col style="width:8%"><col style="width:6%"><col style="width:11%"><col style="width:10%"><col style="width:11%"><col style="width:17%"><col style="width:8%"><col style="width:18%"></colgroup>'
    +'<thead><tr><th>学号</th><th>姓名</th><th>性别</th><th>班级</th><th>政治面貌</th><th>籍贯</th><th>重点关注</th><th>谈话数</th><th>操作</th></tr></thead><tbody>';
  if(!list.length){ html+='<tr><td colspan="9">'+emptyBox('没有匹配的学生。可点击右上角“导入学生”批量导入，或“新增学生”手动添加。')+'</td></tr>'; }
  list.forEach(function(s){
    var tags=(s.concerns||[]).length ? (s.concerns||[]).map(function(c){ return '<span class="tag '+concernTagClass(c)+'">'+esc(concernLabel(c))+'</span>'; }).join('') : '<span style="color:var(--muted)">—</span>';
    html+='<tr><td>'+esc(s.xh||'—')+'</td><td style="font-weight:600">'+esc(s.name)+'</td><td>'+esc(s.gender||'—')+'</td><td>'+esc(s.cls||'—')+'</td><td>'+esc(s.zzmm||'—')+'</td><td>'+esc(s.origin||'—')+'</td><td>'+tags+'</td><td>'+talkCountOf(s.id)+'</td>'
      +'<td><div class="ops"><button onclick="goPortrait(\''+s.id+'\')">画像</button><button onclick="openStudentForm(\''+s.id+'\')">编辑</button><button onclick="delStudent(\''+s.id+'\')">删除</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+list.length+' 名学生（共 '+Model.students().length+' 名）</div>';
  document.getElementById('studentsBox').innerHTML=html;
}
function openStudentForm(id){
  var s = id ? getStudent(id) : null;
  var v = s || {xh:'',name:'',gender:'',cls:'',dorm:'',nation:'',zzmm:'',origin:'',address:'',qq:'',phone:'',fName:'',fPhone:'',fWork:'',fPost:'',fZzmm:'',mName:'',mPhone:'',mWork:'',mPost:'',mZzmm:'',concerns:[],note:''};
  var focusTags = (s&&s.concerns&&s.concerns.length) ? s.concerns.map(function(c){ return '<span class="tag '+concernTagClass(c)+'">'+esc(concernLabel(c))+'</span>'; }).join('') : '<span style="color:var(--muted)">未标记</span>';
  function seg(title){ return '<div class="form-item form-full"><div style="font-weight:600;color:var(--navy);border-bottom:1px solid var(--border-s);padding-bottom:6px">'+title+'</div></div>'; }
  openModal('<h2>'+(id?'编辑学生':'新增学生')+'</h2><div class="m-sub">所有信息都允许缺失；建议至少填写姓名或学号，便于后续检索与关联谈话。学号在全台账中唯一，重复时将无法保存。</div>'
    +'<div class="form-grid">'
    +seg('基本信息')
    +'<div class="form-item"><label>学号</label><input id="sXh" value="'+esc(v.xh)+'"></div>'
    +'<div class="form-item"><label>姓名</label><input id="sName" value="'+esc(v.name)+'"></div>'
    +'<div class="form-item"><label>性别</label><select id="sGender"><option value="">—</option><option>男</option><option>女</option></select></div>'
    +'<div class="form-item"><label>籍贯</label><input id="sOrigin" value="'+esc(v.origin)+'" placeholder="如 山东青岛"></div>'
    +'<div class="form-item"><label>班级</label><input id="sCls" value="'+esc(v.cls)+'" placeholder="如 生科2601"></div>'
    +'<div class="form-item"><label>宿舍</label><input id="sDorm" value="'+esc(v.dorm)+'"></div>'
    +'<div class="form-item"><label>民族</label><input id="sNation" value="'+esc(v.nation)+'"></div>'
    +'<div class="form-item"><label>政治面貌</label><input id="sZzmm" value="'+esc(v.zzmm)+'" list="zzmmList"><datalist id="zzmmList"><option>中共党员</option><option>中共预备党员</option><option>共青团员</option><option>群众</option></datalist></div>'
    +'<div class="form-item"><label>通讯地址</label><input id="sAddr" value="'+esc(v.address)+'"></div>'
    +'<div class="form-item"><label>QQ</label><input id="sQq" value="'+esc(v.qq)+'"></div>'
    +'<div class="form-item"><label>电话</label><input id="sPhone" value="'+esc(v.phone)+'"></div>'
    +seg('父亲信息')
    +'<div class="form-item"><label>父亲姓名</label><input id="sFName" value="'+esc(v.fName)+'"></div>'
    +'<div class="form-item"><label>父亲联系方式</label><input id="sFPhone" value="'+esc(v.fPhone)+'"></div>'
    +'<div class="form-item"><label>父亲工作单位</label><input id="sFWork" value="'+esc(v.fWork)+'"></div>'
    +'<div class="form-item"><label>父亲职务</label><input id="sFPost" value="'+esc(v.fPost)+'"></div>'
    +'<div class="form-item"><label>父亲政治面貌</label><input id="sFZzmm" value="'+esc(v.fZzmm)+'"></div>'
    +seg('母亲信息')
    +'<div class="form-item"><label>母亲姓名</label><input id="sMName" value="'+esc(v.mName)+'"></div>'
    +'<div class="form-item"><label>母亲联系方式</label><input id="sMPhone" value="'+esc(v.mPhone)+'"></div>'
    +'<div class="form-item"><label>母亲工作单位</label><input id="sMWork" value="'+esc(v.mWork)+'"></div>'
    +'<div class="form-item"><label>母亲职务</label><input id="sMPost" value="'+esc(v.mPost)+'"></div>'
    +'<div class="form-item"><label>母亲政治面貌</label><input id="sMZzmm" value="'+esc(v.mZzmm)+'"></div>'
    +'<div class="form-item form-full"><div style="font-size:12.5px;color:var(--muted);background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:8px 12px">重点关注（心理：红 / 橙 / 黄 / 严重 / 一般；学业 / 思政 / 经济：红 / 橙 / 黄）已迁移至「重点关注」板块统一调整。当前标记：'+focusTags+'</div></div>'
    +'<div class="form-item form-full"><label>备注</label><textarea id="sNote" rows="2">'+esc(v.note)+'</textarea></div>'
    +'</div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveStudent(\''+(id||'')+'\')">保存</button></div>');
  document.getElementById('sGender').value=v.gender||'';
}
/* ---------- 重点关注 ---------- */
var FOCUS_TYPES = ['证明材料', '谈话记录', '家访记录', '一生一策', '其他'];
function focusStudents(){ return Model.students().filter(function(s){ return (s.concerns||[]).length>0; }); }
function focusFilesOf(sid){ return Model.files().filter(function(f){ return f.category==='重点关注' && f.sid===sid; }); }
function lvlRank(l){ return (l==='红'||l==='严重')?0:(l==='橙'?1:2); }
function focusMaxLevel(s){ var r=2,i; for(i=0;i<(s.concerns||[]).length;i++){ var k=lvlRank(s.concerns[i].l); if(k<r) r=k; } return r; }
RENDERERS.focus = function(){
  var acts='<button class="btn btn-p" onclick="importConcernsModal()">批量导入重点关注</button><button class="btn btn-g" onclick="openFocusFolder()">打开重点关注文件文件夹</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var list=focusStudents();
  var cnt={};
  CONCERN_TYPES.forEach(function(t){ cnt[t]={}; levelsOf(t).forEach(function(l){ cnt[t][l]=0; }); });
  list.forEach(function(s){ (s.concerns||[]).forEach(function(c){ if(cnt[c.t]&&cnt[c.t][c.l]!==undefined) cnt[c.t][c.l]++; }); });
  var html='<div class="focus-stats">';
  CONCERN_TYPES.forEach(function(t){
    html+='<div class="focus-stat"><div class="k">'+t+'</div><div class="v">'
      +levelsOf(t).map(function(l){ return '<span class="fc '+l+'">'+l+' '+cnt[t][l]+'</span>'; }).join('')
      +'</div></div>';
  });
  html+='</div>';
  html+='<div class="toolbar">'
    +'<input type="search" placeholder="按姓名 / 学号查询" value="'+esc(F.focus.q)+'" oninput="focusApply()" id="fcQ">'
    +'<select id="fcType" onchange="focusApply()"><option value="">全部类型</option>'+CONCERN_TYPES.map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('')+'</select>'
    +'<select id="fcLevel" onchange="focusApply()"><option value="">全部级别</option><option value="严重">严重</option><option value="一般">一般</option><option value="红">红</option><option value="橙">橙</option><option value="黄">黄</option></select>'
    +'<select id="fcCls" onchange="focusApply()"><option value="">全部班级</option>'+clsOptions()+'</select>'
    +'</div><div id="focusBox"></div>';
  document.getElementById('view-focus').innerHTML=html;
  document.getElementById('fcQ').value=F.focus.q;
  document.getElementById('fcType').value=F.focus.type;
  document.getElementById('fcLevel').value=F.focus.level;
  document.getElementById('fcCls').value=F.focus.cls;
  renderFocusTable();
};
function focusApply(){
  F.focus.q=(document.getElementById('fcQ').value||'').trim();
  F.focus.type=document.getElementById('fcType').value;
  F.focus.level=document.getElementById('fcLevel').value;
  F.focus.cls=document.getElementById('fcCls').value;
  renderFocusTable();
}
function renderFocusTable(){
  var list=focusStudents().slice(), q=F.focus.q.toLowerCase();
  if(q) list=list.filter(function(s){ return (s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1; });
  if(F.focus.type) list=list.filter(function(s){ return (s.concerns||[]).some(function(c){ return c.t===F.focus.type; }); });
  if(F.focus.level) list=list.filter(function(s){ return (s.concerns||[]).some(function(c){ return c.l===F.focus.level; }); });
  if(F.focus.cls) list=list.filter(function(s){ return s.cls===F.focus.cls; });
  list.sort(function(a,b){ var ra=focusMaxLevel(a), rb=focusMaxLevel(b); if(ra!==rb) return ra-rb; return (a.cls||'').localeCompare(b.cls||'') || (a.xh||'').localeCompare(b.xh||''); });
  var html='<div class="table-wrap"><table><colgroup><col style="width:9%"><col style="width:11%"><col style="width:12%"><col style="width:26%"><col style="width:10%"><col style="width:32%"></colgroup>'
    +'<thead><tr><th>姓名</th><th>学号</th><th>班级</th><th>重点关注</th><th>材料数</th><th>操作</th></tr></thead><tbody>';
  if(!list.length) html+='<tr><td colspan="6">'+emptyBox('当前没有标记重点关注的学生。可在本板块为学生设置 心理（红 / 橙 / 黄 / 严重 / 一般）、学业 / 思政 / 经济（红 / 橙 / 黄）四类关注，或使用「批量导入重点关注」按学号导入。')+'</td></tr>';
  list.forEach(function(s){
    var tags=(s.concerns||[]).map(function(c){ return '<span class="tag '+concernTagClass(c)+'">'+esc(concernLabel(c))+'</span>'; }).join('');
    html+='<tr class="'+(F.focus.sid===s.id?' row-sel':'')+'"><td style="font-weight:600">'+esc(s.name)+'</td><td>'+esc(s.xh||'—')+'</td><td>'+esc(s.cls||'—')+'</td><td>'+tags+'</td><td>'+focusFilesOf(s.id).length+'</td>'
      +'<td><div class="ops"><button onclick="selectFocusStudent(\''+s.id+'\')">调整</button><button onclick="focusUpload(\''+s.id+'\')">上传</button><button onclick="goPortrait(\''+s.id+'\')">画像</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+list.length+' 名重点关注学生</div>';
  html+='<div id="focusDetail"></div>';
  document.getElementById('focusBox').innerHTML=html;
  var sel = F.focus.sid && getStudent(F.focus.sid) ? getStudent(F.focus.sid) : (list.length? list[0] : null);
  if(sel){ F.focus.sid=sel.id; renderFocusDetail(sel); }
}
function selectFocusStudent(sid){
  F.focus.sid=sid;
  renderFocusTable();
  var s=getStudent(sid); if(s){ renderFocusDetail(s); var el=document.getElementById('focusAdjustBox'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(function(){ if(el) el.scrollIntoView({behavior:'auto',block:'start'}); }, 350); }
}
function focusUpload(sid){
  F.focus.sid=sid;
  renderFocusTable();
  var s=getStudent(sid); if(s){ renderFocusDetail(s); var el=document.getElementById('focusUploadBox'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(function(){ if(el) el.scrollIntoView({behavior:'auto',block:'start'}); }, 350); }
}
function renderFocusDetail(s){
  var checked={}; normConcerns(s.concerns).forEach(function(c){ checked[c.t]=c.l; });
  var lvCss={'红':'var(--red)','橙':'var(--amber)','黄':'#a37f1f','严重':'var(--red)','一般':'#a37f1f'};
  var concernHtml=CONCERN_TYPES.map(function(t){
    return '<div style="display:flex;align-items:center;gap:6px;margin:5px 0;flex-wrap:wrap"><span style="width:40px;font-size:14px;color:#3d4c5e">'+t+'</span>'
      +levelsOf(t).map(function(l){
        var on=checked[t]===l, col=lvCss[l];
        return '<label style="cursor:pointer;font-size:13px;padding:3px 12px;border-radius:999px;border:1px solid '+(on?col:'var(--border)')+';background:'+(on?col:'#fff')+';color:'+(on?'#fff':'var(--muted)')+'"><input type="radio" name="fcc_'+t+'" value="'+l+'"'+(on?' checked':'')+' style="display:none">'+l+'</label>';
      }).join('')
      +'<label style="cursor:pointer;font-size:13px;color:var(--muted);padding:3px 10px"><input type="radio" name="fcc_'+t+'" value=""'+(checked[t]?'':' checked')+' style="display:none">无</label>'
      +'</div>';
  }).join('');
  var fls=focusFilesOf(s.id);
  var html='<div class="card focus-detail" id="focusAdjustBox">'
    +'<h3>'+esc(s.name)+' · 重点关注调整</h3>'
    +'<div class="m-sub">设置或解除该生在 心理（红 / 橙 / 黄 / 严重 / 一般）、学业 / 思政 / 经济（红 / 橙 / 黄）四类上的关注级别。保存后同步到学生台账与画像。</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0">'
    +concernHtml
    +'<button class="btn btn-p" onclick="saveFocusConcerns(\''+s.id+'\')">保存关注调整</button></div>'
    +'</div>';
  html+='<div class="card" id="focusUploadBox"><h3>上传关注材料（'+esc(s.name)+'）</h3>'
    +'<div class="m-sub">支持 证明材料 / 谈话记录 / 家访记录 / 一生一策 等文件。上传后存入项目内「重点关注文件」文件夹，并自动改名为 <b>YYYYMMDD-姓名-文件类型.扩展名</b>；文件本体只保存在本机。</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:12px">'
    +'<div class="form-item" style="margin:0"><label>文件类型</label><select id="fcTypeSel">'+FOCUS_TYPES.map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item" id="fcCustomWrap" style="margin:0;display:none"><label>自定义类型</label><input id="fcCustom" placeholder="如 家访照片"></div>'
    +'<div class="form-item" style="margin:0"><label>日期</label><input type="date" id="fcDate" value="'+todayISO()+'"></div>'
    +'<button class="btn btn-p" onclick="pickFocusFile(\''+s.id+'\')">选择文件并上传</button>'
    +'</div>'
    +'<div id="fcFileTip" style="font-size:12.5px;color:var(--muted);margin-top:8px"></div>'
    +'</div>';
  html+='<div class="card"><h3>已归档材料（'+fls.length+' 份）</h3>';
  if(fls.length){
    html+='<div style="display:flex;flex-direction:column;gap:7px">';
    fls.slice().sort(function(a,b){ return (b.date||'')<(a.date||'')?-1:1; }).forEach(function(f){
      html+='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
        +'<span style="font-weight:600;word-break:break-all">'+esc(f.name)+'</span>'
        +'<span class="badge badge-gray">'+esc((f.tags&&f.tags[0])||'其他')+'</span>'
        +'<span style="font-size:12px;color:var(--muted)">'+ymd(f.date)+'</span>'
        +'<span style="font-size:12px;color:var(--muted)">'+esc(f.size||'')+'</span>'
        +'<button class="btn btn-d btn-xs" onclick="delFocusFile(\''+f.id+'\')">删除索引</button></div>';
    });
    html+='</div><div style="font-size:12.5px;color:var(--muted);margin-top:8px">删除索引不会删除文件夹中的实体文件；实体文件位于项目「重点关注文件」文件夹，可在上方打开查看。</div>';
  } else html+=emptyBox('还没有上传材料。选择上方文件类型与日期后上传即可。');
  html+='</div>';
  document.getElementById('focusDetail').innerHTML=html;
  document.getElementById('fcTypeSel').addEventListener('change', function(){
    document.getElementById('fcCustomWrap').style.display = this.value==='其他' ? 'block':'none';
  });
}

/* ---------- 奖助管理 ---------- */
var AID_TYPES = ['困难认定', '助学金', '奖学金', '勤工助学', '其他'];
var HARD_LEVELS = ['特别困难', '困难', '一般困难'];
var AID_FILE_TYPES = ['认定表', '佐证材料', '申请表', '证明材料', '其他'];
var AID_REVIEWS = ['待评审', '通过', '未通过'];
var AID_PAY = ['待发放', '已发放', '未通过'];
function aidProjects(){ return (Model.data.aidProjects)||[]; }
function hardshipRecords(){ return (Model.data.hardshipRecords)||[]; }
function aidRecords(){ return (Model.data.aidRecords)||[]; }
function aidProject(id){ return aidProjects().filter(function(p){ return p.id===id; })[0]||null; }
function hardshipOf(sid, year){ return hardshipRecords().filter(function(h){ return h.sid===sid && h.year===(year||h.year); })[0]||null; }
function aidFilesOf(sid, pid){ return Model.files().filter(function(f){ return f.category==='奖助材料' && f.sid===sid && (!pid || f.pid===pid); }); }
function ecoLevelOf(sid){ var s=getStudent(sid); if(!s) return ''; var c=(s.concerns||[]).filter(function(x){ return x.t==='经济'; })[0]; return c?c.l:''; }
function hardshipSuggest(h){
  var want = h.level==='特别困难' ? '红' : (h.level==='困难' ? '橙' : '');
  var cur = ecoLevelOf(h.sid);
  var rank = {红:0, 橙:1, 黄:2, '':3};
  return { want:want, cur:cur, need: !!want && rank[cur] > rank[want] };
}
RENDERERS.aid = function(){
  var tabs=[['projects','奖助项目'],['hardship','困难认定'],['records','申报记录']];
  var html='<div class="tabbar">'+tabs.map(function(t){ return '<button class="tab'+(F.aid.tab===t[0]?' on':'')+'" data-tab="'+t[0]+'" onclick="aidTab(\''+t[0]+'\')">'+t[1]+'</button>'; }).join('')+'</div><div id="aidBox"></div>';
  document.getElementById('view-aid').innerHTML=html;
  aidRenderTab();
};
function aidTab(t){ F.aid.tab=t; aidRenderTab(); }
function aidRenderTab(){
  if(F.aid.tab==='projects') aidRenderProjects();
  else if(F.aid.tab==='hardship') aidRenderHardship();
  else aidRenderRecords();
  var btns=document.querySelectorAll('.tabbar .tab');
  for(var i=0;i<btns.length;i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-tab')===F.aid.tab);
}
/* ---- 页签 A：奖助项目 ---- */
function aidProjectsApply(){
  F.aid.pQ=(document.getElementById('apQ').value||'').trim();
  F.aid.pType=document.getElementById('apType').value;
  F.aid.pTerm=document.getElementById('apTerm').value;
  aidRenderProjects();
}
function aidRenderProjects(){
  var acts='<button class="btn btn-p" onclick="openAidProjectForm()">新增项目</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var list=aidProjects().slice(), q=F.aid.pQ.toLowerCase();
  if(q) list=list.filter(function(p){ return (p.name||'').toLowerCase().indexOf(q)>-1; });
  if(F.aid.pType) list=list.filter(function(p){ return p.type===F.aid.pType; });
  if(F.aid.pTerm) list=list.filter(function(p){ return (p.term||'').indexOf(F.aid.pTerm)>-1; });
  list.sort(function(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); });
  var terms={}; aidProjects().forEach(function(p){ if(p.term) terms[p.term]=1; });
  var termOpts=Object.keys(terms).sort().reverse().map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('');
  var counts={}; aidRecords().forEach(function(r){ counts[r.pid]=(counts[r.pid]||0)+1; });
  var html='<div class="toolbar">'
    +'<input type="search" placeholder="按项目名称查询" value="'+esc(F.aid.pQ)+'" oninput="aidProjectsApply()" id="apQ">'
    +'<select id="apType" onchange="aidProjectsApply()"><option value="">全部类型</option>'+AID_TYPES.map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('')+'</select>'
    +'<select id="apTerm" onchange="aidProjectsApply()"><option value="">全部学年学期</option>'+termOpts+'</select>'
    +'</div><div class="table-wrap"><table><colgroup><col style="width:18%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:8%"><col style="width:10%"><col style="width:10%"><col style="width:8%"><col style="width:12%"></colgroup>'
    +'<thead><tr><th>项目名称</th><th>类型</th><th>学年学期</th><th>金额</th><th>名额</th><th>截止日期</th><th>状态</th><th>申报人数</th><th>操作</th></tr></thead><tbody>';
  if(!list.length) html+='<tr><td colspan="9">'+emptyBox('暂无奖助项目。点击右上角“新增项目”建立本学年奖助项目（助学金、奖学金、困难认定等）。')+'</td></tr>';
  list.forEach(function(p){
    html+='<tr><td style="font-weight:600">'+esc(p.name)+'</td><td><span class="badge badge-gray">'+esc(p.type||'—')+'</span></td><td>'+esc(p.term||'—')+'</td><td>'+esc(p.amount||'—')+'</td><td>'+(p.quota?p.quota:'—')+'</td><td>'+ymd(p.deadline)+'</td>'
      +'<td><span class="badge '+(p.status==='进行中'?'badge-b':(p.status==='已截止'?'badge-gray':'badge-g'))+'">'+esc(p.status||'—')+'</span></td><td style="font-weight:600">'+(counts[p.id]||0)+'</td>'
      +'<td><div class="ops"><button onclick="openAidProjectForm(\''+p.id+'\')">编辑</button><button onclick="delAidProject(\''+p.id+'\')">删除</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+list.length+' 个奖助项目</div>';
  document.getElementById('aidBox').innerHTML=html;
  document.getElementById('apQ').value=F.aid.pQ;
  document.getElementById('apType').value=F.aid.pType;
  document.getElementById('apTerm').value=F.aid.pTerm;
}
/* ---- 页签 B：困难认定 ---- */
function aidHardshipApply(){
  F.aid.hYear=document.getElementById('ahYear').value;
  F.aid.hLevel=document.getElementById('ahLevel').value;
  F.aid.hQ=(document.getElementById('ahQ').value||'').trim();
  aidRenderHardship();
}
function aidRenderHardship(){
  var acts='<button class="btn btn-p" onclick="openHardshipForm()">新增认定</button><button class="btn btn-g" onclick="openHardshipImport()">批量导入名单</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var list=hardshipRecords().slice(), q=F.aid.hQ.toLowerCase();
  if(q) list=list.filter(function(h){ var s=getStudent(h.sid); return s && ((s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1); });
  if(F.aid.hYear) list=list.filter(function(h){ return h.year===F.aid.hYear; });
  if(F.aid.hLevel) list=list.filter(function(h){ return h.level===F.aid.hLevel; });
  list.sort(function(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); });
  var years={}; hardshipRecords().forEach(function(h){ if(h.year) years[h.year]=1; });
  var html='<div class="toolbar">'
    +'<input type="search" placeholder="按姓名 / 学号查询" value="'+esc(F.aid.hQ)+'" oninput="aidHardshipApply()" id="ahQ">'
    +'<select id="ahYear" onchange="aidHardshipApply()"><option value="">全部学年</option>'+Object.keys(years).sort().reverse().map(function(y){ return '<option>'+esc(y)+'</option>'; }).join('')+'</select>'
    +'<select id="ahLevel" onchange="aidHardshipApply()"><option value="">全部等级</option>'+HARD_LEVELS.map(function(l){ return '<option>'+esc(l)+'</option>'; }).join('')+'</select>'
    +'</div><div class="table-wrap"><table><colgroup><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:18%"><col style="width:10%"><col style="width:16%"></colgroup>'
    +'<thead><tr><th>姓名</th><th>学号</th><th>班级</th><th>学年</th><th>等级</th><th>评议结果</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  if(!list.length) html+='<tr><td colspan="8">'+emptyBox('暂无困难认定档案。可在右上角“新增认定”逐条登记，或“批量导入名单”按学号导入。')+'</td></tr>';
  list.forEach(function(h){
    var s=getStudent(h.sid)||{};
    var eco=ecoLevelOf(h.sid);
    html+='<tr><td style="font-weight:600">'+esc(s.name||'—')+'</td><td>'+esc(s.xh||'—')+'</td><td>'+esc(s.cls||'—')+'</td><td>'+esc(h.year||'—')+'</td>'
      +'<td><span class="tag '+(h.level==='特别困难'?'tag-红':(h.level==='困难'?'tag-橙':'tag-黄'))+'">'+esc(h.level||'—')+'</span></td>'
      +'<td>'+esc(h.review||'—')+'</td>'
      +'<td><span class="badge '+(h.status==='已认定'?'badge-b':(h.status==='已归档'?'badge-gray':'badge-a'))+'">'+esc(h.status||'—')+'</span></td>'
      +'<td><div class="ops"><button onclick="openHardshipForm(\''+h.id+'\')">编辑</button><button onclick="delHardship(\''+h.id+'\')">删除</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+list.length+' 条认定档案。登记认定结果后，该生的成长时间轴与画像会自动联动；建议依据等级同步调整经济关注。</div>';
  document.getElementById('aidBox').innerHTML=html;
  document.getElementById('ahQ').value=F.aid.hQ;
  document.getElementById('ahYear').value=F.aid.hYear;
  document.getElementById('ahLevel').value=F.aid.hLevel;
}
/* ---- 页签 C：申报记录 ---- */
function aidRecordsApply(){
  F.aid.rPid=document.getElementById('arPid').value;
  F.aid.rCls=document.getElementById('arCls').value;
  F.aid.rLevel=document.getElementById('arLevel').value;
  F.aid.rEco=document.getElementById('arEco').value;
  F.aid.rQ=(document.getElementById('arQ').value||'').trim();
  aidRenderRecords();
}
function aidRenderRecords(){
  var acts='<button class="btn btn-p" onclick="exportAidRecords()">导出申报明细</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var projects=aidProjects();
  if(!projects.length){
    document.getElementById('aidBox').innerHTML=emptyBox('还没有奖助项目。请先在「奖助项目」页签建立项目（如国家助学金、困难认定等），再登记申报记录。');
    return;
  }
  if(!F.aid.rPid || !aidProject(F.aid.rPid)) F.aid.rPid=projects[0].id;
  var pid=F.aid.rPid, p=aidProject(pid);
  var records=aidRecords().filter(function(r){ return r.pid===pid; });
  var bySid={}; records.forEach(function(r){ bySid[r.sid]=r; });
  // 候选学生：未在该项目申报
  var pool=Model.students().filter(function(s){ return !bySid[s.id]; });
  var q=F.aid.rQ.toLowerCase();
  if(q) pool=pool.filter(function(s){ return (s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1; });
  if(F.aid.rCls) pool=pool.filter(function(s){ return s.cls===F.aid.rCls; });
  if(F.aid.rLevel) pool=pool.filter(function(s){ return (hardshipOf(s.id)||{}).level===F.aid.rLevel; });
  if(F.aid.rEco) pool=pool.filter(function(s){ return ecoLevelOf(s.id)===F.aid.rEco; });
  pool.sort(function(a,b){ return (a.cls||'').localeCompare(b.cls||'') || (a.xh||'').localeCompare(b.xh||''); });
  var selList=records.slice();
  if(F.aid.rCls) selList=selList.filter(function(r){ var s=getStudent(r.sid); return s && s.cls===F.aid.rCls; });
  if(F.aid.rLevel) selList=selList.filter(function(r){ return (hardshipOf(r.sid)||{}).level===F.aid.rLevel; });
  if(F.aid.rEco) selList=selList.filter(function(r){ return ecoLevelOf(r.sid)===F.aid.rEco; });
  if(q) selList=selList.filter(function(r){ var s=getStudent(r.sid); return s && ((s.name||'').toLowerCase().indexOf(q)>-1 || (s.xh||'').indexOf(q)>-1); });
  selList.sort(function(a,b){ var sa=getStudent(a.sid)||{}, sb=getStudent(b.sid)||{}; return (sa.cls||'').localeCompare(sb.cls||'') || (sa.xh||'').localeCompare(sb.xh||''); });
  var html='<div class="aid-proj-head"><span style="font-weight:700">'+esc(p.name)+'</span> <span class="badge badge-b">'+esc(p.type||'')+'</span> <span style="color:var(--muted);font-size:13px">'+esc(p.term||'')+(p.amount?' · '+esc(p.amount):'')+' · 已申报 '+records.length+' 人</span></div>';
  html+='<div class="toolbar">'
    +'<select id="arPid" onchange="aidRecordsApply()">'+projects.map(function(x){ return '<option value="'+x.id+'">'+esc(x.name)+'</option>'; }).join('')+'</select>'
    +'<input type="search" placeholder="按姓名 / 学号查询" value="'+esc(F.aid.rQ)+'" oninput="aidRecordsApply()" id="arQ">'
    +'<select id="arCls" onchange="aidRecordsApply()"><option value="">全部班级</option>'+clsOptions()+'</select>'
    +'<select id="arLevel" onchange="aidRecordsApply()"><option value="">全部困难等级</option>'+HARD_LEVELS.map(function(l){ return '<option>'+esc(l)+'</option>'; }).join('')+'</select>'
    +'<select id="arEco" onchange="aidRecordsApply()"><option value="">全部经济关注</option><option value="红">经济·红</option><option value="橙">经济·橙</option><option value="黄">经济·黄</option></select>'
    +'</div>';
  html+='<div class="card aid-pool"><div class="m-sub" style="margin-bottom:8px"><b>批量添加申报</b>：勾选下列尚未在本项目申报的学生，点击「添加申报」（默认申请日期为今天，可在申报列表中修改）。</div>'
    +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
    +'<label style="font-size:13px"><input type="checkbox" id="arAll" onchange="aidPoolAll()"> 全选当前 '+(pool.length)+' 人</label>'
    +'<button class="btn btn-p btn-xs" onclick="aidAddSelected()">添加申报</button></div>';
  if(pool.length){
    html+='<div style="max-height:220px;overflow-y:auto;border:1px solid var(--border-s);border-radius:8px;padding:8px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px">';
    pool.forEach(function(s){
      var eco=ecoLevelOf(s.id), hd=hardshipOf(s.id);
      html+='<label style="font-size:13px;display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" class="arChk" value="'+s.id+'"> <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(s.name)+' '+esc(s.xh||'')+'</span>'
        +(hd?'<span class="tag '+(hd.level==='特别困难'?'tag-红':(hd.level==='困难'?'tag-橙':'tag-黄'))+'" style="margin:0">'+esc(hd.level)+'</span>':'')
        +(eco?'<span class="tag tag-其他" style="margin:0">经'+eco+'</span>':'')
        +'</label>';
    });
    html+='</div>';
  } else html+='<div style="font-size:13px;color:var(--muted)">当前筛选下没有可添加的学生（都已申报或不在筛选中）。</div>';
  html+='</div>';
  html+='<div class="table-wrap"><table><colgroup><col style="width:9%"><col style="width:11%"><col style="width:10%"><col style="width:11%"><col style="width:11%"><col style="width:9%"><col style="width:9%"><col style="width:14%"><col style="width:16%"></colgroup>'
    +'<thead><tr><th>姓名</th><th>学号</th><th>班级</th><th>申请日期</th><th>材料说明</th><th>评审</th><th>金额</th><th>发放状态</th><th>操作</th></tr></thead><tbody>';
  if(!selList.length) html+='<tr><td colspan="9">'+emptyBox('该项目暂无申报记录。请在上方筛选学生后勾选添加。')+'</td></tr>';
  selList.forEach(function(r){
    var s=getStudent(r.sid)||{};
    html+='<tr><td style="font-weight:600">'+esc(s.name||'—')+'</td><td>'+esc(s.xh||'—')+'</td><td>'+esc(s.cls||'—')+'</td><td>'+ymd(r.applyDate)+'</td>'
      +'<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.material||'—')+'</td>'
      +'<td><span class="badge '+(r.review==='通过'?'badge-g':(r.review==='未通过'?'badge-r':'badge-gray'))+'">'+esc(r.review||'待评审')+'</span></td>'
      +'<td>'+esc(r.amount||'—')+'</td>'
      +'<td><span class="badge '+(r.status==='已发放'?'badge-g':(r.status==='未通过'?'badge-r':'badge-a'))+'">'+esc(r.status||'—')+'</span></td>'
      +'<td><div class="ops"><button onclick="openAidRecordForm(\''+r.id+'\')">编辑</button><button onclick="openAidUpload(\''+r.sid+'\',\''+r.pid+'\')">上传材料</button><button onclick="delAidRecord(\''+r.id+'\')">删除</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+selList.length+' 条申报记录（该项目共 '+records.length+' 条）。上传的奖助材料自动存入项目内「奖助文件」文件夹并按 YYYYMMDD-姓名-文件类型 命名。</div>';
  document.getElementById('aidBox').innerHTML=html;
  document.getElementById('arPid').value=pid;
  document.getElementById('arQ').value=F.aid.rQ;
  document.getElementById('arCls').value=F.aid.rCls;
  document.getElementById('arLevel').value=F.aid.rLevel;
  document.getElementById('arEco').value=F.aid.rEco;
}
function aidPoolAll(){
  var all=document.getElementById('arAll');
  var chks=document.querySelectorAll('.arChk');
  for(var i=0;i<chks.length;i++) chks[i].checked=all.checked;
}

/* ---------- 谈心谈话 ---------- */
RENDERERS.talks = function(){
  var acts='<button class="btn btn-p" onclick="openTalkForm()">新增谈话记录</button><button class="btn btn-g" onclick="openTalkImport()">批量导入</button><button class="btn btn-g" onclick="openExportDlg(\'talks\')">导出</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var months={}; Model.talks().forEach(function(t){ if(t.time) months[t.time.slice(0,7)]=1; });
  var monthHtml=Object.keys(months).sort().reverse().map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('');
  var html='<div class="toolbar">'
    +'<input type="search" placeholder="按学生姓名 / 学号查询" value="'+esc(F.talks.q)+'" oninput="talksApply()" id="tkQ">'
    +'<select id="tkTopic" onchange="talksApply()"><option value="">全部话题</option>'+topicDict().map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('')+'</select>'
    +'<select id="tkLevel" onchange="talksApply()"><option value="">全部等级</option><option value="g">一般</option><option value="a">需关注</option><option value="r">重点关注</option></select>'
    +'<select id="tkMonth" onchange="talksApply()"><option value="">全部月份</option>'+monthHtml+'</select>'
    +'</div><div id="talksBox"></div>';
  document.getElementById('view-talks').innerHTML=html;
  document.getElementById('tkQ').value=F.talks.q;
  document.getElementById('tkTopic').value=F.talks.topic;
  document.getElementById('tkLevel').value=F.talks.level;
  document.getElementById('tkMonth').value=F.talks.month;
  renderTalksTable();
};
function talksApply(){
  F.talks.q=(document.getElementById('tkQ').value||'').trim();
  F.talks.topic=document.getElementById('tkTopic').value;
  F.talks.level=document.getElementById('tkLevel').value;
  F.talks.month=document.getElementById('tkMonth').value;
  renderTalksTable();
}
function renderTalksTable(){
  var list=Model.talks().slice(), q=F.talks.q.toLowerCase(), i;
  if(q){ list=list.filter(function(t){ var s=getStudent(t.sid); var nm=(s?s.name:'')+' '+(s?s.xh:''); return nm.toLowerCase().indexOf(q)>-1; }); }
  if(F.talks.topic) list=list.filter(function(t){ return t.topic===F.talks.topic; });
  if(F.talks.level) list=list.filter(function(t){ return (t.level||'g')===F.talks.level; });
  if(F.talks.month) list=list.filter(function(t){ return (t.time||'').slice(0,7)===F.talks.month; });
  list.sort(function(a,b){ return (b.time||'')<(a.time||'')?-1:1; });
  var html='<div class="table-wrap"><table><colgroup><col style="width:9%"><col style="width:12%"><col style="width:8%"><col style="width:10%"><col style="width:11%"><col style="width:8%"><col style="width:20%"><col style="width:14%"><col style="width:8%"></colgroup>'
    +'<thead><tr><th>谈话时间</th><th>学生</th><th>谈话人</th><th>地点</th><th>话题</th><th>等级</th><th>谈话内容摘要</th><th>跟进</th><th>操作</th></tr></thead><tbody>';
  if(!list.length){ html+='<tr><td colspan="9">'+emptyBox('没有匹配的谈话记录。点击右上角“新增谈话记录”开始记录。')+'</td></tr>'; }
  list.forEach(function(t){
    var s=getStudent(t.sid);
    var li=levelInfo(t.level||'g');
    var stu=s? (esc(s.name)+' <span style="color:var(--muted);font-size:12px">'+esc(s.xh)+'</span>') : '（已删除学生）';
    var follow = t.followDate ? (t.done ? '<span class="badge badge-g">已完成</span>' : (t.followDate<=todayISO()? '<span class="badge badge-r">待回访 '+ymd(t.followDate)+'</span>' : '<span class="badge badge-gray">'+ymd(t.followDate)+'</span>')) : '—';
    html+='<tr><td>'+ymd(t.time)+'</td><td>'+stu+'</td><td>'+esc(t.talker||'—')+'</td><td>'+esc(t.place||'—')+'</td><td>'+esc(t.topic||'未分类')+'</td><td><span class="badge '+li[2]+'">'+li[0]+'</span></td>'
      +'<td style="color:var(--muted)">'+esc(String(t.content||'').replace(/\n/g,' ').slice(0,42))+(t.content&&t.content.length>42?'…':'')+'</td>'
      +'<td>'+follow+'</td>'
      +'<td><div class="ops"><button onclick="viewTalk(\''+t.id+'\')">查看</button><button onclick="openTalkForm(\''+t.id+'\')">编辑</button><button onclick="delTalk(\''+t.id+'\')">删除</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+list.length+' 条记录（共 '+Model.talks().length+' 条）</div>';
  document.getElementById('talksBox').innerHTML=html;
}
function openTalkForm(id){
  var t = id ? Model.talks().find(function(x){ return x.id===id; }) : null;
  var v = t || { sid:'', time:todayISO(), place:'', topic:'', level:'g', content:'', traits:'', followUp:'', followDate:'', done:false };
  var s = v.sid ? getStudent(v.sid) : null;
  var tip = s ? ('<span style="color:var(--green);font-size:13px">已关联：'+esc(s.name)+' · '+esc(s.xh)+' · '+esc(s.cls||'未填班级')+'</span>') : '';
  var levelSeg='<div class="seg" id="lvSeg">'
    +['g|一般','a|需关注','r|重点关注'].map(function(x){ var p=x.split('|'); return '<button type="button" data-lv="'+p[0]+'" class="'+(v.level===p[0]?'on':'')+'">'+p[1]+'</button>'; }).join('')
    +'</div>';
  openModal('<h2>'+(id?'编辑谈话记录':'新增谈话记录')+'</h2><div class="m-sub">选择学生后会带出班级等信息；谈话内容请如实摘要记录，建议包含关键信息。</div>'
    +'<div class="form-grid">'
    +'<div class="form-item form-full"><label><span class="req">*</span>谈话学生（输入姓名或学号选择）</label>'
    +'<input id="tStu" list="studentList" value="'+esc(s? s.name:'')+'" placeholder="输入姓名或学号"><datalist id="studentList">'
    +Model.students().map(function(x){ return '<option value="'+esc(x.name)+'">'+esc(x.xh)+' · '+esc(x.cls||'')+'</option>'; }).join('')
    +'</datalist><div id="tStuTip" style="margin-top:5px">'+tip+'</div></div>'
    +'<div class="form-item"><label><span class="req">*</span>谈话时间</label><input type="date" id="tTime" value="'+v.time+'"></div>'
    +'<div class="form-item"><label>谈话人</label><input id="tTalker" value="'+esc(v.talker||Model.settings().talker||'')+'"></div>'
    +'<div class="form-item"><label>谈话地点</label><input id="tPlace" value="'+esc(v.place||'')+'" placeholder="如 办公室 / 操场 / 线上"></div>'
    +'<div class="form-item"><label>话题</label><input id="tTopic" list="topicList" value="'+esc(v.topic||'')+'"><datalist id="topicList">'+topicDict().map(function(x){ return '<option>'+esc(x)+'</option>'; }).join('')+'</datalist></div>'
    +'<div class="form-item"><label>关注等级</label>'+levelSeg+'</div>'
    +'<div class="form-item"><label>学生特点</label><input id="tTraits" value="'+esc(v.traits||'')+'" placeholder="如 性格内向、学业压力大"></div>'
    +'<div class="form-item form-full"><label>谈话内容</label><textarea id="tContent" rows="5" placeholder="记录谈话要点、学生反馈、你的引导与建议">'+esc(v.content||'')+'</textarea></div>'
    +'<div class="form-item"><label>后续跟进事项</label><input id="tFollow" value="'+esc(v.followUp||'')+'" placeholder="如 一周后回访"></div>'
    +'<div class="form-item"><label>跟进日期</label><input type="date" id="tFollowDate" value="'+esc(v.followDate||'')+'"></div>'
    +'</div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveTalk(\''+(id||'')+'\')">保存记录</button></div>');
  document.getElementById('tStu').addEventListener('change', function(){ resolveTalkStudent(); });
  if(v.sid) document.getElementById('tStu').setAttribute('data-sid', v.sid);
}
function resolveTalkStudent(){
  var val=document.getElementById('tStu').value.trim(); var tip=document.getElementById('tStuTip'); if(!tip) return;
  if(!val){ tip.innerHTML=''; return; }
  var s=null, i, list=Model.students();
  for(i=0;i<list.length;i++){ var x=list[i]; if(x.name===val || x.xh===val){ s=x; break; } }
  if(s){ tip.innerHTML='<span style="color:var(--green);font-size:13px">已关联：'+esc(s.name)+' · '+esc(s.xh)+' · '+esc(s.cls||'未填班级')+'</span>'; document.getElementById('tStu').setAttribute('data-sid',s.id); }
  else { tip.innerHTML='<span style="color:var(--red);font-size:13px">未找到匹配学生，请先到学生台账导入或新增</span>'; document.getElementById('tStu').removeAttribute('data-sid'); }
}

/* ---------- 学生画像 ---------- */
RENDERERS.portrait = function(){
  document.getElementById('viewActions').innerHTML='';
  var sel = F.portrait.sid && getStudent(F.portrait.sid) ? getStudent(F.portrait.sid).name : '';
  var html='<div class="toolbar">'
    +'<input type="search" placeholder="搜索学生（姓名 / 学号）" id="ptQ" list="ptList" value="'+esc(sel)+'" onchange="ptSelect()" style="width:280px">'
    +'<datalist id="ptList">'+Model.students().map(function(x){ return '<option value="'+esc(x.name)+'">'+esc(x.xh)+' · '+esc(x.cls||'')+'</option>'; }).join('')+'</datalist>'
    +'<span style="font-size:13px;color:var(--muted)">画像数据来自台账、谈话记录与文件索引，实时聚合</span>'
    +'</div><div id="portraitBox"></div>';
  document.getElementById('view-portrait').innerHTML=html;
  if(F.portrait.sid && getStudent(F.portrait.sid)) renderPortrait(F.portrait.sid);
  else document.getElementById('portraitBox').innerHTML=emptyBox('在上方搜索并选择一名学生，查看其画像、时间轴与关联材料。');
};
function ptSelect(){
  var val=document.getElementById('ptQ').value.trim(); if(!val) return;
  var s=null,i, list=Model.students();
  for(i=0;i<list.length;i++){ var x=list[i]; if(x.name===val || x.xh===val){ s=x; break; } }
  if(s){ F.portrait.sid=s.id; renderPortrait(s.id); }
  else { F.portrait.sid=''; document.getElementById('portraitBox').innerHTML='<div class="empty"><div class="big">—</div>未找到匹配学生，请检查姓名或学号。</div>'; }
}
function goPortrait(id){
  F.portrait.sid=id;
  go('portrait');
}
function goFocusAdd(id){
  F.focus.sid=id;
  go('focus');
}
function renderPortrait(sid){
  var s=getStudent(sid); if(!s) return;
  var talks=Model.talks().filter(function(t){ return t.sid===sid; }).sort(function(a,b){ return (b.time||'')<(a.time||'')?-1:1; });
  var files=Model.files().filter(function(f){ return (f.name||'').indexOf(s.name)>-1 || (f.name||'').indexOf(s.xh)>-1; });
  var tm=todayISO();

  var html='';
  html+='<div class="card portrait-head">'
    +'<div class="avatar">'+esc((s.name||'?').charAt(0))+'</div>'
    +'<div style="min-width:0">'
    +'<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:20px;font-weight:700;color:var(--navy)">'+esc(s.name)+'</span><span style="color:var(--muted);font-size:14px">'+esc(s.xh||'')+'</span><span class="badge badge-b">'+esc(s.cls||'未填班级')+'</span></div>'
    +'<div class="p-basic">'
    +pItem('性别',s.gender)+pItem('籍贯',s.origin)+pItem('班级',s.cls)+pItem('宿舍',s.dorm)
    +pItem('民族',s.nation)+pItem('政治面貌',s.zzmm)+pItem('通讯地址',s.address)+pItem('QQ',s.qq)
    +pItem('电话',s.phone)+(s.major?pItem('专业',s.major):'')+(s.family?pItem('家庭情况',s.family):'')
    +pItem('备注',s.note)
    +'</div>'
    +'<div style="margin-top:14px">'
    +'<details class="fam"><summary><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>父亲信息</summary>'
    +'<div class="p-basic fam-body">'+pItem('姓名',s.fName)+pItem('联系方式',s.fPhone)+pItem('工作单位',s.fWork)+pItem('职务',s.fPost)+pItem('政治面貌',s.fZzmm)+'</div></details>'
    +'<details class="fam"><summary><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>母亲信息</summary>'
    +'<div class="p-basic fam-body">'+pItem('姓名',s.mName)+pItem('联系方式',s.mPhone)+pItem('工作单位',s.mWork)+pItem('职务',s.mPost)+pItem('政治面貌',s.mZzmm)+'</div></details>'
    +'</div>'
    +'<div style="margin-top:12px"><span style="font-size:13px;color:var(--muted);margin-right:6px">重点关注</span>'
    +((s.concerns||[]).length?(s.concerns||[]).map(function(c){ return '<span class="tag '+concernTagClass(c)+'">'+esc(concernLabel(c))+'</span>'; }).join(''):'<span style="color:var(--muted);font-size:13px">未标记</span>')
    +' <button class="btn btn-p btn-xs" onclick="goFocusAdd(\''+s.id+'\')">新增 / 调整重点关注</button>'
    +'</div>'
    +'<div style="margin-top:8px"><span style="font-size:13px;color:var(--muted);margin-right:6px">画像标签</span>'
    +((portraitTagsOf(s.id)).length?portraitTagsOf(s.id).map(function(c){ return '<span class="tag tag-其他">'+esc(c)+'</span>'; }).join(''):'<span style="color:var(--muted);font-size:13px">暂无，可手动补充</span>')
    +' <button class="btn btn-g btn-xs" onclick="addPortraitTag(\''+s.id+'\')">添加标签</button></div>'
    +'</div></div>';

  html+='<div class="stat-grid p4">'
    +stat('谈话次数', fmtNum(talks.length), false)
    +stat('最近谈话', talks.length?ymd(talks[0].time):'—', false)
    +stat('待回访', fmtNum(talks.filter(function(t){ return t.followDate && t.followDate<=tm && !t.done; }).length), true)
    +stat('关联文件', fmtNum(files.length), false)
    +'</div>';

  var focusF=focusFilesOf(sid);
  var legacy=files.filter(function(f){ return f.category==='重点关注' && !focusF.some(function(x){ return x.id===f.id; }); });
  var events=[];
  talks.forEach(function(t){ events.push({d:t.time, k:'talk', t:t}); });
  focusF.concat(legacy).forEach(function(f){ events.push({d:f.date, k:'file', f:f}); });
  hardshipRecords().forEach(function(h){ if(h.sid===sid) events.push({d:(h.year||'')+'-00-00', k:'hardship', h:h}); });
  aidRecords().forEach(function(r){
    if(r.sid===sid){
      var p=aidProject(r.pid);
      events.push({d:r.applyDate||'', k:'aid', r:r, p:p});
    }
  });
  events.sort(function(a,b){ return (b.d||'')<(a.d||'')?-1:1; });

  html+='<div class="section-title">成长时间轴（谈话、奖助与重点关注材料，按日期倒序）</div><div class="card">';
  if(events.length){
    html+='<div class="tl">';
    events.forEach(function(ev){
      if(ev.k==='talk'){
        var t=ev.t, li=levelInfo(t.level||'g');
        html+='<div class="tl-date">'+ymd(t.time)+'</div><div class="tl-axis"><span class="dot '+li[1]+'"></span></div>'
          +'<div class="tl-body"><div class="t-topic">'+esc(t.topic||'未分类')+' <span class="badge '+li[2]+'">'+li[0]+'</span></div>'
          +'<div class="t-meta">'+esc(t.place||'地点未记')+(t.talker?' · 谈话人 '+esc(t.talker):'')+(t.traits?' · 特点：'+esc(t.traits):'')+'</div>'
          +(t.content?'<div class="t-content">'+esc(t.content)+'</div>':'')
          +(t.followDate?'<div style="font-size:12.5px;color:var(--muted);margin-top:6px">跟进：'+esc(t.followUp||'回访')+'（'+ymd(t.followDate)+'）'+(t.done?' · 已完成':'')+'</div>':'')
          +'</div>';
      } else if(ev.k==='hardship'){
        var h=ev.h;
        html+='<div class="tl-date">'+esc(h.year||'—')+'</div><div class="tl-axis"><span class="dot dot-gold"></span></div>'
          +'<div class="tl-body"><div class="t-topic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a37f1f" stroke-width="1.8" style="vertical-align:-2px;margin-right:4px"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>困难认定 · '+esc(h.level||'')+' <span class="badge '+(h.status==='已认定'?'badge-b':(h.status==='已归档'?'badge-gray':'badge-a'))+'">'+esc(h.status||'')+'</span></div>'
          +'<div class="t-meta">'+(h.review?'评议：'+esc(h.review)+' · ':'')+esc(h.year||'')+'学年家庭经济困难认定</div>'
          +'</div>';
      } else if(ev.k==='aid'){
        var r=ev.r, p=ev.p;
        html+='<div class="tl-date">'+ymd(r.applyDate)+'</div><div class="tl-axis"><span class="dot dot-gold"></span></div>'
          +'<div class="tl-body"><div class="t-topic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a37f1f" stroke-width="1.8" style="vertical-align:-2px;margin-right:4px"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'+esc(p?p.name:'奖助申报')+' <span class="badge '+(r.review==='通过'?'badge-g':(r.review==='未通过'?'badge-r':'badge-gray'))+'">'+esc(r.review||'待评审')+'</span> <span class="badge '+(r.status==='已发放'?'badge-g':(r.status==='未通过'?'badge-r':'badge-a'))+'">'+esc(r.status||'')+'</span></div>'
          +'<div class="t-meta">奖助申报'+(r.amount?' · 金额 '+esc(r.amount):'')+(r.material?' · '+esc(r.material):'')+'</div>'
          +'</div>';
      } else {
        var f=ev.f;
        html+='<div class="tl-date">'+ymd(f.date)+'</div><div class="tl-axis"><span class="dot dot-b"></span></div>'
          +'<div class="tl-body"><div class="t-topic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.8" style="vertical-align:-2px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'+esc(f.name)+' <span class="badge badge-gray">'+(f.tags&&f.tags[0]?esc(f.tags[0]):(f.category||'材料'))+'</span></div>'
          +'<div class="t-meta">'+(f.category||'材料')+(f.size?' · '+esc(f.size):'')+(f.note?' · '+esc(f.note):'')+'</div>'
          +'</div>';
      }
    });
    html+='</div>';
  } else html+=emptyBox('暂无谈话、奖助记录与重点关注材料。可在谈心谈话中新增记录，或在「奖助管理」「重点关注」板块登记。');
  html+='</div>';

  html+='<div class="section-title">关联材料（文件索引）</div><div class="card">';
  if(files.length){
    html+='<div style="display:flex;flex-direction:column;gap:6px">';
    files.forEach(function(f){
      html+='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span style="font-weight:600">'+esc(f.name)+'</span><span class="badge badge-gray">'+esc(f.category||'未分类')+'</span><span style="font-size:12px;color:var(--muted)">'+ymd(f.date)+'</span><span style="font-size:12px;color:var(--muted)">'+esc(f.tags&&f.tags.length?f.tags.join('、'):'')+'</span></div>';
    });
    html+='</div>';
  } else html+=emptyBox('文件索引中暂无与该生姓名或学号匹配的文件。可在文件中心注册。');
  html+='</div>';

  document.getElementById('portraitBox').innerHTML=html;
  document.getElementById('ptQ').value=s.name;
}
function pItem(k,v){ return '<div><span class="it">'+k+'</span><div class="iv">'+esc(v||'—')+'</div></div>'; }
function addPortraitTag(sid){
  var s=getStudent(sid); if(!s) return;
  openModal('<h2>添加画像标签</h2><div class="m-sub">给 '+esc(s.name)+' 补充一个画像标签，如“文体特长”“宿舍骨干”。</div>'
    +'<input id="ptTag" placeholder="输入标签内容" style="width:100%">'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="savePortraitTag(\''+sid+'\')">添加</button></div>');
  document.getElementById('ptTag').focus();
}

/* ---------- 文件中心 ---------- */
RENDERERS.files = function(){
  var acts='<button class="btn btn-p" onclick="openFileForm()">注册文件</button>';
  if(window.showDirectoryPicker) acts+='<button class="btn btn-g" onclick="pickFolder()">选择文件夹索引</button>';
  acts+='<button class="btn btn-g" onclick="exportFiles()">导出索引 CSV</button>';
  document.getElementById('viewActions').innerHTML=acts;
  var tags={}; Model.files().forEach(function(f){ (f.tags||[]).forEach(function(t){ if(t) tags[t]=1; }); });
  var tagHtml=Object.keys(tags).sort().map(function(t){ return '<option>'+esc(t)+'</option>'; }).join('');
  var html='<div class="dropzone" id="dropZone"><div style="font-size:15px;color:var(--navy);font-weight:600">拖拽文件到此处注册索引</div><div style="margin-top:4px">仅记录文件名、分类、标签与日期等元数据；文件本体留在你的本地文件夹，不会被移动或上传。</div></div>'
    +'<div class="toolbar">'
    +'<input type="search" placeholder="按文件名查询（不检索内容）" value="'+esc(F.files.q)+'" oninput="filesApply()" id="flQ">'
    +'<select id="flCat" onchange="filesApply()"><option value="">全部分类</option>'+catDict().map(function(c){ return '<option>'+esc(c)+'</option>'; }).join('')+'</select>'
    +'<select id="flTag" onchange="filesApply()"><option value="">全部标签</option>'+tagHtml+'</select>'
    +'</div><div id="filesBox"></div>';
  document.getElementById('view-files').innerHTML=html;
  document.getElementById('flQ').value=F.files.q;
  document.getElementById('flCat').value=F.files.cat;
  document.getElementById('flTag').value=F.files.tag;
  var dz=document.getElementById('dropZone');
  dz.addEventListener('dragover',function(e){ e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave',function(){ dz.classList.remove('drag'); });
  dz.addEventListener('drop',function(e){
    e.preventDefault(); dz.classList.remove('drag');
    var fs=e.dataTransfer.files; if(!fs||!fs.length) return;
    var list=[], i;
    for(i=0;i<fs.length;i++){
      var f=fs[i]; if(!f.name) continue;
      list.push({ name:f.name, category:'', tags:[], date:todayISO(), size:f.size?f.size+' B':'', note:'', source:'拖拽注册', relPath:'' });
    }
    registerDroppedFiles(list);
  });
  renderFilesTable();
};
function filesApply(){
  F.files.q=(document.getElementById('flQ').value||'').trim();
  F.files.cat=document.getElementById('flCat').value;
  F.files.tag=document.getElementById('flTag').value;
  renderFilesTable();
}
function renderFilesTable(){
  var list=Model.files().slice(), q=F.files.q.toLowerCase();
  if(q) list=list.filter(function(f){ return (f.name||'').toLowerCase().indexOf(q)>-1; });
  if(F.files.cat) list=list.filter(function(f){ return f.category===F.files.cat; });
  if(F.files.tag) list=list.filter(function(f){ return (f.tags||[]).indexOf(F.files.tag)>-1; });
  list.sort(function(a,b){ return (b.date||'')<(a.date||'')?-1:1; });
  var html='<div class="table-wrap"><table><colgroup><col style="width:30%"><col style="width:11%"><col style="width:13%"><col style="width:9%"><col style="width:10%"><col style="width:10%"><col style="width:17%"></colgroup>'
    +'<thead><tr><th>文件名</th><th>分类</th><th>标签</th><th>日期</th><th>大小</th><th>来源</th><th>操作</th></tr></thead><tbody>';
  if(!list.length){ html+='<tr><td colspan="7">'+emptyBox('还没有文件索引。拖拽文件到上方区域，或点击右上角“注册文件”。')+'</td></tr>'; }
  list.forEach(function(f){
    html+='<tr><td style="font-weight:600;word-break:break-all">'+esc(f.name)+'</td><td>'+(f.category?'<span class="badge badge-gray">'+esc(f.category)+'</span>':'<span style="color:var(--muted)">—</span>')+'</td>'
      +'<td>'+(f.tags&&f.tags.length?f.tags.map(function(t){ return '<span class="tag tag-其他">'+esc(t)+'</span>'; }).join(''):'—')+'</td>'
      +'<td>'+ymd(f.date)+'</td><td style="font-size:12.5px;color:var(--muted)">'+esc(f.size||'—')+'</td><td style="font-size:12.5px;color:var(--muted)">'+esc(f.source||'注册')+'</td>'
      +'<td><div class="ops"><button onclick="openFileForm(\''+f.id+'\')">编辑</button><button onclick="delFile(\''+f.id+'\')">删除索引</button></div></td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:12px;color:var(--muted);margin-top:8px">共 '+list.length+' 个索引（共 '+Model.files().length+' 个）。查询仅匹配文件名，不检索文件内容。</div>';
  document.getElementById('filesBox').innerHTML=html;
}
function openFileForm(id){
  var f = id ? Model.files().find(function(x){ return x.id===id; }) : null;
  var v = f || { name:'', category:'', tags:[], date:todayISO(), size:'', note:'' };
  openModal('<h2>'+(id?'编辑文件索引':'注册文件索引')+'</h2><div class="m-sub">文件本体保存在你的本地文件夹中，这里只登记便于检索的元数据。</div>'
    +'<div class="form-grid">'
    +'<div class="form-item form-full"><label><span class="req">*</span>文件名</label><input id="fName" value="'+esc(v.name)+'"></div>'
    +'<div class="form-item"><label>分类</label><select id="fCat"><option value="">未分类</option>'+catDict().map(function(c){ return '<option>'+esc(c)+'</option>'; }).join('')+'</select></div>'
    +'<div class="form-item"><label>标签（逗号分隔）</label><input id="fTags" value="'+esc((v.tags||[]).join('、'))+'" placeholder="如 重点学生, 心理"></div>'
    +'<div class="form-item"><label>日期</label><input type="date" id="fDate" value="'+v.date+'"></div>'
    +'<div class="form-item"><label>大小</label><input id="fSize" value="'+esc(v.size||'')+'" placeholder="如 1.2 MB"></div>'
    +'<div class="form-item form-full"><label>备注 / 本地路径</label><input id="fNote" value="'+esc(v.note||'')+'" placeholder="如 /Users/me/桌面/谈话记录/2026-10-22.docx"></div>'
    +'</div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveFile(\''+(id||'')+'\')">保存</button></div>');
  document.getElementById('fCat').value=v.category||'';
}

/* ---------- 设置 ---------- */
RENDERERS.settings = function(){
  document.getElementById('viewActions').innerHTML='';
  var set=Model.settings(), meta=Model.meta();
  var hasPass=!!set.passHash;
  var html='<div class="card"><h3>访问密码</h3>'
    +(hasPass?'<p style="margin:0 0 10px;font-size:14px;color:var(--muted)">当前已启用访问密码（打开页面时需输入）。提示：该密码仅用于防止他人借用电脑时误入，属于基础保护，不是加密级安全措施。</p>'
      +'<button class="btn btn-g" onclick="setPasswordModal()">修改密码</button> <button class="btn btn-d" onclick="clearPassword()">关闭密码</button>'
      :'<p style="margin:0 0 10px;font-size:14px;color:var(--muted)">尚未设置。建议设置一个访问密码，防止他人打开页面时直接看到学生信息。</p>'
      +'<button class="btn btn-p" onclick="setPasswordModal()">设置密码</button>')
    +'</div>';
  html+='<div class="card"><h3>默认设置</h3><div class="form-grid">'
    +'<div class="form-item"><label>默认谈话人（新增记录时自动填入）</label><input id="setTalker" value="'+esc(set.talker||'')+'"></div>'
    +'</div><div style="margin-top:14px"><button class="btn btn-p" onclick="saveDefaults()">保存默认设置</button></div></div>';
  html+='<div class="card"><h3>字典管理</h3><p style="margin:0 0 10px;font-size:13px;color:var(--muted)">每行一个词条，用于谈话话题与文件分类的下拉建议。</p>'
    +'<div class="form-grid">'
    +'<div class="form-item"><label>谈话话题字典</label><textarea id="setTopics" rows="6">'+(topicDict().map(esc).join('\n'))+'</textarea></div>'
    +'<div class="form-item"><label>文件分类字典</label><textarea id="setCats" rows="6">'+(catDict().map(esc).join('\n'))+'</textarea></div>'
    +'</div><div style="margin-top:14px"><button class="btn btn-p" onclick="saveDicts()">保存字典</button></div></div>';
  html+='<div class="card"><h3>数据存储（SQLite 数据库）</h3>'
    +'<p style="margin:0 0 12px;font-size:13px;color:var(--muted)">全部业务数据（学生台账、谈心谈话、文件索引、画像标签、设置）均保存在本机 SQLite 数据库文件中。每次新增、修改、删除数据后自动写入数据库，无需手动保存或导出。</p>'
    +'<div id="dbConnInfo" style="margin-bottom:10px;font-size:13px;color:var(--muted)">未连接数据库，点击下方按钮连接本机 workstation.db。</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn btn-p" onclick="connectDb()">连接数据库</button>'
    +'<button class="btn btn-g" onclick="openDbDir()">打开数据库所在文件夹</button>'
    +'</div></div>';
  html+='<div class="card"><h3>数据保险与清理（可选）</h3>'
    +'<p style="margin:0 0 10px;font-size:13px;color:var(--muted)">数据库已自动持久化，无需手动备份。以下操作用于版本升级前保险、换机迁移、恢复或清理。</p>'
    +(meta.lastBackup?'<p style="margin:0 0 10px;font-size:13px;color:var(--green)">上次手动导出：'+ymd(meta.lastBackup)+'</p>':'')
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn btn-g" onclick="exportDbBackup()">导出 db 格式备份</button>'
    +'<button class="btn btn-g" onclick="exportBackup()">导出 JSON 备份</button>'
    +'<button class="btn btn-g" onclick="importBackup()">导入备份</button>'
    +'<button class="btn btn-g" onclick="seedDemo()">载入示例数据</button>'
    +'<button class="btn btn-d" onclick="clearAllData()">清空全部数据</button>'
    +'</div></div>';
  html+='<div class="card"><h3>使用说明</h3><div style="font-size:14px;line-height:1.8;color:#3d4c5e">'
    +'<div><b>1. 数据在哪：</b>所有数据保存在本机 SQLite 数据库 db/workstation.db。双击“启动工作站.command”启动服务，用浏览器打开 http://127.0.0.1:8790/ 使用；关闭终端窗口即停止服务（数据始终保留在数据库中）。</div>'
    +'<div><b>2. 换机迁移：</b>先“导出备份”得到 JSON 文件，拷贝到新电脑后“导入备份”；也可直接拷贝整个数据库文件 db/workstation.db。</div>'
    +'<div><b>3. 文件怎么管理：</b>文件本体保留在你的本地文件夹，系统只登记文件名、分类、标签等元数据，因此查询只匹配文件名，不检索内容。</div>'
    +'<div><b>4. 安全提示：</b>学生谈话与家庭信息属敏感个人信息，本服务仅监听本机回环地址（127.0.0.1），不会对外网开放；建议对存放项目的磁盘启用文件保险箱加密。</div>'
    +'</div></div>';
  document.getElementById('view-settings').innerHTML=html;
  document.getElementById('setTalker').value=set.talker||'';
};
function setPasswordModal(){
  openModal('<h2>设置访问密码</h2><div class="m-sub">下次打开页面时需要输入。请记住密码，忘记后需在设置中清除数据才可恢复访问。</div>'
    +'<div class="form-item"><label>新密码</label><input type="password" id="pw1" autocomplete="new-password"></div>'
    +'<div class="form-item" style="margin-top:10px"><label>再次输入</label><input type="password" id="pw2" autocomplete="new-password"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="savePassword()">保存密码</button></div>');
}

/* ---------- 学生导入预览 ---------- */
function importStudentsModal(){
  openModal('<h2>导入学生信息</h2><div class="m-sub">支持 CSV 文件（含 Excel 另存的 CSV，自动识别 UTF-8 / GBK 编码），或从 Excel 直接复制粘贴。表头请使用下载的模板：学号、姓名、性别、籍贯、班级、宿舍、民族、政治面貌、通讯地址、QQ、电话，及父亲/母亲姓名、联系方式、工作单位、职务、政治面貌，另含“特殊关注”“备注”两列。特殊关注填写格式“类型:级别”，多项用分号分隔，如 心理:严重;学业:橙（类型限 心理/学业/思政/经济；心理级别限 红/橙/黄/严重/一般，学业/思政/经济级别限 红/橙/黄）。所有信息都允许缺失；学号必须唯一，空行与学号重复的行会跳过并在下方列出明细。</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
    +'<button class="btn btn-p" onclick="pickStudentCsv()">选择 CSV 文件</button>'
    +'<button class="btn btn-g" onclick="pasteStudentsModal()">从 Excel 粘贴</button>'
    +'<button class="btn btn-g" onclick="downloadStudentTemplate()">下载导入模板</button>'
    +'</div><div id="importPreview" style="max-height:300px;overflow:auto"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button></div>');
}
function pickStudentCsv(){
  openFilePicker(function(file){
    var fr=new FileReader();
    fr.onload=function(){ showStudentImportPreview(decodeText(fr.result)); };
    fr.readAsArrayBuffer(file);
  }, '.csv,.txt');
}
function pasteStudentsModal(){
  openModal('<h2>从 Excel 粘贴导入</h2><div class="m-sub">在 Excel 中选中学生表格区域并复制（Ctrl/Cmd + C），粘贴到下方后点击“解析”。首行必须是表头。</div>'
    +'<textarea id="pasteArea" rows="10" placeholder="在此粘贴 Excel 表格内容…" style="width:100%"></textarea>'
    +'<div id="importPreview" style="max-height:280px;overflow:auto;margin-top:10px"></div>'
    +'<div class="m-actions"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="doPaste()">解析并预览</button></div>');
}
function doPaste(){
  var text=document.getElementById('pasteArea').value;
  if(!text.trim()){ toast('粘贴内容为空','err'); return; }
  showStudentImportPreview(text);
}
function showStudentImportPreview(text){
  var box=document.getElementById('importPreview'); if(!box) return;
  var delim=guessDelim(text);
  var rows=parseDelimited(text, delim);
  if(rows.length<2){ box.innerHTML='<div class="empty"><div class="big">—</div>未能解析出有效数据行，请确认首行为表头。</div>'; return; }
  var colMap={}, i;
  rows[0].forEach(function(hd,ix){ var a=headerAlias(hd); if(a) colMap[a]=ix; });
  if(colMap.xh===undefined && colMap.name===undefined){
    box.innerHTML='<div class="empty"><div class="big">—</div>未识别到“学号 / 姓名”表头。请确认首行包含这些字段名（支持 学号/姓名/性别/班级/政治面貌/生源地/宿舍 等）。</div>';
    return;
  }
  var records=[], skips=[], seen={}, exist={};
  Model.students().forEach(function(s){ if(s.xh) exist[s.xh]=s.name; });
  for(i=1;i<rows.length;i++){
    var r=rows[i], rec={};
    Object.keys(colMap).forEach(function(field){ var ix=colMap[field]; rec[field]=String(r[ix]==null?'':r[ix]).trim(); });
    var xh=rec.xh||'', name=rec.name||'';
    if(!xh && !name){ skips.push({ row:i+1, xh:'', name:'', reason:'姓名与学号均为空' }); continue; }
    if(xh && exist[xh]){ skips.push({ row:i+1, xh:xh, name:name, reason:'学号已存在（'+exist[xh]+'）' }); continue; }
    if(xh && seen[xh]){ skips.push({ row:i+1, xh:xh, name:name, reason:'文件内学号重复' }); continue; }
    if(xh) seen[xh]=name;
    rec.row=i+1;
    records.push(rec);
  }
  window.__pendingImport = records;
  window.__pendingSkips = skips;
  var html='<div style="font-size:14px;margin-bottom:10px">解析完成：可导入 <b style="color:var(--green)">'+records.length+'</b> 条';
  if(skips.length) html+='，跳过 <b style="color:var(--red)">'+skips.length+'</b> 条';
  html+='</div>';
  if(records.length){
    html+='<table style="table-layout:fixed;width:100%;font-size:13px"><colgroup><col style="width:22%"><col style="width:16%"><col style="width:12%"><col style="width:18%"><col style="width:14%"><col style="width:18%"></colgroup><thead><tr style="background:#f7f9fc"><th style="padding:6px 8px;text-align:left">学号</th><th>姓名</th><th>性别</th><th>班级</th><th>政治面貌</th><th>籍贯</th></tr></thead><tbody>';
    records.slice(0,8).forEach(function(rec){
      html+='<tr><td style="padding:5px 8px;border-bottom:1px solid #eef1f5">'+esc(rec.xh)+'</td><td>'+esc(rec.name)+'</td><td>'+esc(rec.gender||'')+'</td><td>'+esc(rec.cls||'')+'</td><td>'+esc(rec.zzmm||'')+'</td><td>'+esc(rec.origin||'')+'</td></tr>';
    });
    if(records.length>8) html+='<tr><td colspan="6" style="padding:6px 8px;color:var(--muted)">… 其余 '+ (records.length-8) +' 条略</td></tr>';
    html+='</tbody></table>';
    html+='<div class="m-actions" style="margin-top:12px"><button class="btn btn-g" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="confirmStudentImport()">确认导入 '+records.length+' 条</button></div>';
  } else {
    html+='<div class="empty"><div class="big">—</div>没有可导入的新学生（可能全部学号重复或为空）。</div>';
  }
  if(skips.length){
    html+='<div style="font-size:13px;margin-top:14px;color:var(--muted)"><b style="color:var(--red)">跳过明细（导入失败项，请核对后修改重导）：</b></div>'
      +'<table style="table-layout:fixed;width:100%;font-size:12.5px"><colgroup><col style="width:15%"><col style="width:26%"><col style="width:23%"><col style="width:36%"></colgroup><thead><tr style="background:#fdf3f3;color:var(--red)"><th style="padding:5px 8px;text-align:left">文件行号</th><th>学号</th><th>姓名</th><th>跳过原因</th></tr></thead><tbody>';
    skips.slice(0,10).forEach(function(k){
      html+='<tr><td style="padding:4px 8px;border-bottom:1px solid #f3e8e8">第 '+k.row+' 行</td><td>'+esc(k.xh||'—')+'</td><td>'+esc(k.name||'—')+'</td><td>'+esc(k.reason)+'</td></tr>';
    });
    if(skips.length>10) html+='<tr><td colspan="4" style="padding:4px 8px;color:var(--muted)">… 其余 '+ (skips.length-10) +' 条略</td></tr>';
    html+='</tbody></table>';
  }
  box.innerHTML=html;
}
