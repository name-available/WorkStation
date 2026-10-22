'use strict';
/* ================= 入口 ================= */
function updateSideFoot(){
  var el=document.getElementById('sideFoot');
  if(!el) return;
  var n=Model.students().length, t=Model.talks().length, f=Model.files().length;
  el.innerHTML='<div>数据存储：SQLite 本地数据库</div>'
    +'<div>学生 '+n+' 人 · 谈话 '+t+' 条 · 文件 '+f+' 个</div>'
    +'<div style="opacity:.8">每次操作自动保存，无需手动导出</div>';
}

function init(){
  renderNav();
  var navItems=document.querySelectorAll('.nav-item');
  for(var i=0;i<navItems.length;i++){
    navItems[i].addEventListener('click',function(){ go(this.getAttribute('data-view')); });
  }
  if(Model.settings().passHash){
    document.getElementById('lockScreen').hidden=false;
    document.getElementById('lockForm').addEventListener('submit',function(e){
      e.preventDefault();
      var v=document.getElementById('lockPass').value;
      if(djb2('ws_salt:'+v)===Model.settings().passHash){ document.getElementById('lockScreen').hidden=true; document.getElementById('app').hidden=false; go('home'); }
      else{ document.getElementById('lockErr').textContent='密码不正确，请重试'; }
    });
  } else {
    document.getElementById('lockScreen').hidden=true;
    document.getElementById('app').hidden=false;
    go('home');
  }
  updateSideFoot();
}

document.addEventListener('DOMContentLoaded', function(){
  (async function(){
    try{
      await Model.load();
      init();
    }catch(e){
      document.getElementById('lockScreen').hidden=true;
      var app=document.getElementById('app'); app.hidden=false;
      var c=document.getElementById('content');
      c.innerHTML='<div class="card" style="max-width:520px;margin:60px auto">'
        +'<h3>无法连接本地服务</h3>'
        +'<p style="font-size:14px;color:var(--muted)">请确认已通过「启动工作站.command」启动服务（双击该文件，浏览器会自动打开本页面）。如果服务已启动仍看到此提示，请刷新页面重试。</p>'
        +'<button class="btn btn-p" onclick="location.reload()">重新连接</button></div>';
      document.getElementById('viewTitle').textContent='无法连接';
      document.getElementById('viewSub').textContent='请检查服务是否已启动';
      document.getElementById('nav').innerHTML='';
    }
  })();
});
