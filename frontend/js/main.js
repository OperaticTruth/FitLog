// ============================================================
//  CONFIG â€” set your Render backend URL here after deploying
// ============================================================
var API = window.FITLOG_API_URL || 'https://fitlog-api-mb8r.onrender.com';

// ============================================================
//  STATE
// ============================================================
var token = localStorage.getItem('fitlog_token') || '';
var currentUser = null;
var schedule = {};
var trainingProfile = {};
var weightData = [];
var measureData = [];
var goalsData = [];
var workoutHistory = {};
var prsData = {};
var activeWorkouts = {};
var swapTarget = {date:null, idx:null};
var currentDayIndex = 0;
var windowDays = [];
var swapFilter = 'All';

var TODAY = new Date(); TODAY.setHours(0,0,0,0);
var TODAY_STR = TODAY.toISOString().split('T')[0];

var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
var MUSCLE_GROUPS = ['Rest','Chest & Triceps','Back & Biceps','Shoulders','Posterior Chain','Anterior Chain','Upper Body','Lower Body','Full Body','Legs','Arms','Cardio','Cardio / Pole','Pole Dancing'];
var STYLE_OPTS = ['','Strength','HIIT / Supersets','Hypertrophy','Endurance / Cardio','Mixed'];
var EXP_OPTS = ['Beginner','Beginner-Intermediate','Intermediate','Intermediate-Advanced','Advanced'];
var GOAL_OPTS = ['Body recomp - lose fat, build muscle','Fat loss - lose weight and slim down','Muscle building - gain size and strength','Strength - powerlifting focus','Endurance - cardio and stamina','General fitness - stay active and healthy'];

var BASE_LIBRARY = [
  {id:'bench',name:'Barbell Bench Press',muscle:'Chest',equip:'Barbell'},
  {id:'bench-inc',name:'Incline Dumbbell Press',muscle:'Chest',equip:'Dumbbell'},
  {id:'fly',name:'Cable Chest Fly',muscle:'Chest',equip:'Cable'},
  {id:'pushup',name:'Push-Up',muscle:'Chest',equip:'Bodyweight'},
  {id:'deadlift',name:'Deadlift',muscle:'Back',equip:'Barbell'},
  {id:'row-bar',name:'Barbell Row',muscle:'Back',equip:'Barbell'},
  {id:'row-db',name:'Dumbbell Row',muscle:'Back',equip:'Dumbbell'},
  {id:'pullup',name:'Pull-Up',muscle:'Back',equip:'Bodyweight'},
  {id:'lat-pull',name:'Lat Pulldown',muscle:'Back',equip:'Cable'},
  {id:'cable-row',name:'Seated Cable Row',muscle:'Back',equip:'Cable'},
  {id:'rdl',name:'Romanian Deadlift',muscle:'Back',equip:'Barbell'},
  {id:'ohp',name:'Overhead Press',muscle:'Shoulders',equip:'Barbell'},
  {id:'ohp-db',name:'Dumbbell Shoulder Press',muscle:'Shoulders',equip:'Dumbbell'},
  {id:'lat-raise',name:'Lateral Raise',muscle:'Shoulders',equip:'Dumbbell'},
  {id:'face-pull',name:'Face Pull',muscle:'Shoulders',equip:'Cable'},
  {id:'curl-bar',name:'Barbell Curl',muscle:'Biceps',equip:'Barbell'},
  {id:'curl-db',name:'Dumbbell Curl',muscle:'Biceps',equip:'Dumbbell'},
  {id:'hammer',name:'Hammer Curl',muscle:'Biceps',equip:'Dumbbell'},
  {id:'skull',name:'Skull Crusher',muscle:'Triceps',equip:'Barbell'},
  {id:'pushdown',name:'Tricep Pushdown',muscle:'Triceps',equip:'Cable'},
  {id:'squat',name:'Barbell Back Squat',muscle:'Quads',equip:'Barbell'},
  {id:'leg-press',name:'Leg Press',muscle:'Quads',equip:'Machine'},
  {id:'leg-ext',name:'Leg Extension',muscle:'Quads',equip:'Machine'},
  {id:'lunge',name:'Walking Lunge',muscle:'Quads',equip:'Dumbbell'},
  {id:'bss',name:'Bulgarian Split Squat',muscle:'Quads',equip:'Dumbbell'},
  {id:'leg-curl',name:'Lying Leg Curl',muscle:'Hamstrings',equip:'Machine'},
  {id:'hip-thrust',name:'Barbell Hip Thrust',muscle:'Glutes',equip:'Barbell'},
  {id:'abduct',name:'Hip Abduction Machine',muscle:'Glutes',equip:'Machine'},
  {id:'calf',name:'Standing Calf Raise',muscle:'Calves',equip:'Machine'},
  {id:'plank',name:'Plank',muscle:'Core',equip:'Bodyweight'},
  {id:'burpee',name:'Burpee',muscle:'Full Body',equip:'Bodyweight'},
  {id:'kb-swing',name:'Kettlebell Swing',muscle:'Full Body',equip:'Kettlebell'},
  {id:'battle-rope',name:'Battle Ropes',muscle:'Cardio',equip:'Bodyweight'},
  {id:'jump-rope',name:'Jump Rope',muscle:'Cardio',equip:'Bodyweight'},
  {id:'row-machine',name:'Rowing Machine',muscle:'Cardio',equip:'Machine'}
];

var MUSCLE_PREVIEWS = {
  'Chest & Triceps':['Barbell Bench Press','Incline Dumbbell Press','Cable Chest Fly','Skull Crusher','Tricep Pushdown'],
  'Back & Biceps':['Deadlift','Barbell Row','Lat Pulldown','Barbell Curl','Hammer Curl'],
  'Shoulders':['Overhead Press','Dumbbell Shoulder Press','Lateral Raise','Face Pull'],
  'Posterior Chain':['Romanian Deadlift','Lying Leg Curl','Barbell Hip Thrust','Standing Calf Raise'],
  'Anterior Chain':['Barbell Back Squat','Leg Press','Walking Lunge','Leg Extension'],
  'Upper Body':['Dumbbell Shoulder Press','Lat Pulldown','Dumbbell Row','Lateral Raise','Battle Ropes'],
  'Lower Body':['Barbell Back Squat','Hip Abduction Machine','Walking Lunge','Lying Leg Curl','Barbell Hip Thrust'],
  'Full Body':['Barbell Back Squat','Barbell Row','Dumbbell Shoulder Press','Burpee'],
  'Cardio':['Rowing Machine','Jump Rope','Battle Ropes'],
  'Cardio / Pole':['Jump Rope','Battle Ropes'],
  'Pole Dancing':[],'Rest':[]
};

// ============================================================
//  UTILS
// ============================================================
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,err){var t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(err?' err':'')+' show';setTimeout(function(){t.classList.remove('show');},2600);}
function fmtDate(s){return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function dayName(ds){return DAYS[new Date(ds+'T12:00:00').getDay()];}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function scrollToTop(){document.getElementById('scroll-area').scrollTo({top:0,behavior:'smooth'});}

function offsetDate(base,days){var d=new Date(base);d.setDate(d.getDate()+days);return d.toISOString().split('T')[0];}

async function api(method, path, body){
  var opts = {method:method, headers:{'Content-Type':'application/json'}};
  if(token) opts.headers['Authorization'] = 'Bearer '+token;
  if(body) opts.body = JSON.stringify(body);
  var res = await fetch(API+path, opts);
  if(res.status===401){showAuthScreen();return null;}
  if(!res.ok){var e=await res.json().catch(function(){return{detail:'Error'};});throw new Error(e.detail||'Error');}
  return res.json();
}

// ============================================================
//  AUTH
// ============================================================
function showAuthScreen(){
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').style.display='none';
}
function showApp(){
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').style.display='flex';
}
function showLogin(){document.getElementById('auth-login').style.display='';document.getElementById('auth-reg').style.display='none';document.getElementById('auth-err').style.display='none';}
function showReg(){document.getElementById('auth-login').style.display='none';document.getElementById('auth-reg').style.display='';document.getElementById('auth-err').style.display='none';}
function authErr(msg){var e=document.getElementById('auth-err');e.textContent=msg;e.style.display='block';}

async function doLogin(){
  var u=document.getElementById('li-user').value.trim();
  var p=document.getElementById('li-pw').value;
  if(!u||!p){authErr('Please fill in both fields');return;}
  try{
    var r=await api('POST','/auth/login',{username:u,password:p});
    if(!r)return;
    token=r.token; localStorage.setItem('fitlog_token',token);
    currentUser=r; await loadAllData(); showApp();
  }catch(e){authErr(e.message);}
}

async function doRegister(){
  var name=document.getElementById('reg-name').value.trim();
  var u=document.getElementById('reg-user').value.trim();
  var p=document.getElementById('reg-pw').value;
  var h=parseFloat(document.getElementById('reg-height').value)||null;
  if(!name||!u||!p){authErr('Please fill in name, username and password');return;}
  if(p.length<6){authErr('Password must be at least 6 characters');return;}
  try{
    var r=await api('POST','/auth/register',{username:u,display_name:name,password:p,height_in:h});
    if(!r)return;
    token=r.token; localStorage.setItem('fitlog_token',token);
    currentUser=r; await loadAllData(); showApp();
  }catch(e){authErr(e.message);}
}

async function doLogout(){
  await api('POST','/auth/logout').catch(function(){});
  token=''; localStorage.removeItem('fitlog_token'); currentUser=null;
  showAuthScreen();
}

// ============================================================
//  LOAD ALL DATA
// ============================================================
async function loadAllData(){
  document.getElementById('user-chip').textContent=currentUser.display_name;
  document.getElementById('acct-name').textContent=currentUser.username;

  var results = await Promise.all([
    api('GET','/weight?days=90'),
    api('GET','/measurements?days=90'),
    api('GET','/goals'),
    api('GET','/schedule'),
    api('GET','/profile'),
    api('GET','/workouts?days=60'),
    api('GET','/prs')
  ]);

  weightData    = results[0]||[];
  measureData   = results[1]||[];
  goalsData     = results[2]||[];
  var schedList = results[3]||[];
  trainingProfile = results[4]||{};
  var wkts      = results[5]||[];
  var prsList   = results[6]||[];

  // Build schedule map
  schedule = {};
  schedList.forEach(function(s){schedule[s.day_of_week]={gym:s.is_gym,muscle:s.muscle_group,style:s.style||''};});
  DAYS.forEach(function(d){if(!schedule[d])schedule[d]={gym:false,muscle:'Rest',style:''};});

  // Build workout history map keyed by date
  workoutHistory = {};
  wkts.forEach(function(w){
    var ds = typeof w.workout_date === 'string' ? w.workout_date.split('T')[0] : w.workout_date;
    workoutHistory[ds] = w;
  });

  // Build PRs map
  prsData = {};
  prsList.forEach(function(p){prsData[p.exercise_name]=p;});

  // Set default dates
  var todayVal = TODAY_STR;
  document.getElementById('wt-date-input').value=todayVal;
  document.getElementById('meas-date').value=todayVal;

  await loadPhotos();
  renderWeightPage();
  buildCarouselWindow();
  rebuildCarousel();
}

// ============================================================
//  TAB NAV
// ============================================================
function showTab(name){
  ['weight','workouts','history','photos','settings'].forEach(function(t){
    document.getElementById('page-'+t).classList.toggle('active', t===name);
    document.getElementById('tab-'+t).classList.toggle('active', t===name);
  });
  if(name==='history'){renderHistory();renderPRs();}
  if(name==='photos'){renderPhotos();}
  if(name==='settings'){renderSettings();}
  document.getElementById('scroll-area').scrollTo({top:0});
}

// ============================================================
//  WEIGHT PAGE
// ============================================================
function renderWeightPage(){
  if(weightData.length){
    var last = weightData[weightData.length-1];
    document.getElementById('wt-display').textContent=last.weight_lbs;
    document.getElementById('wt-date').textContent=fmtDate(last.entry_date);
    // 7-day avg
    var recent = weightData.slice(-7);
    var avg = (recent.reduce(function(a,e){return a+e.weight_lbs;},0)/recent.length).toFixed(1);
    document.getElementById('wt-avg').innerHTML='7-day avg: <strong>'+avg+' lbs</strong>';
  }
  renderWeightChart();
  renderMeasurements();
  renderGoals();
}

function renderWeightChart(){
  var svg = document.getElementById('wt-svg');
  if(!weightData.length){svg.innerHTML='';return;}
  var data = weightData.slice(-30);
  var W=svg.clientWidth||300, H=70;
  var vals = data.map(function(d){return d.weight_lbs;});
  var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
  var pad=2;
  if(mx===mn)mx=mn+1;
  function x(i){return pad+(i/(data.length-1||1))*(W-2*pad);}
  function y(v){return H-pad-(v-mn)/(mx-mn)*(H-2*pad);}
  var pts=data.map(function(d,i){return x(i)+','+y(d.weight_lbs);}).join(' ');
  svg.innerHTML='<polyline points="'+pts+'" fill="none" stroke="var(--accent-a)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    +'<circle cx="'+x(data.length-1)+'" cy="'+y(vals[vals.length-1])+'" r="3" fill="var(--accent-a)"/>';
}

async function logWeight(){
  var w=parseFloat(document.getElementById('wt-input').value);
  var d=document.getElementById('wt-date-input').value;
  if(!w||!d){toast('Enter weight and date',true);return;}
  try{
    var r=await api('POST','/weight',{entry_date:d,weight_lbs:w});
    var idx=weightData.findIndex(function(e){return e.entry_date===d;});
    if(idx>=0)weightData[idx]=r; else {weightData.push(r); weightData.sort(function(a,b){return a.entry_date.localeCompare(b.entry_date);});}
    document.getElementById('wt-input').value='';
    toast('Weight logged!');
    renderWeightPage();
    buildWeekStrip();
  }catch(e){toast(e.message,true);}
}

// ============================================================
//  MEASUREMENTS
// ============================================================
var MEAS_FIELDS = [
  {key:'stomach',label:'Stomach',wantDown:true},{key:'waist',label:'Waist',wantDown:true},
  {key:'chest',label:'Chest',wantUp:true},{key:'bust',label:'Bust',wantDown:true},
  {key:'hips',label:'Hips',wantDown:true},{key:'glutes',label:'Glutes',wantUp:true},
  {key:'upper_arm_l',label:'Arm L',wantUp:true},{key:'upper_arm_r',label:'Arm R',wantUp:true},
  {key:'flexed_l',label:'Flexed L',wantUp:true},{key:'flexed_r',label:'Flexed R',wantUp:true},
  {key:'thigh_l',label:'Thigh L',wantUp:true},{key:'thigh_r',label:'Thigh R',wantUp:true}
];

function renderMeasurements(){
  var el=document.getElementById('meas-display');
  var latest=measureData[measureData.length-1];
  var prev=measureData[measureData.length-2];
  if(!latest){el.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="ei">&#128207;</div><p>No measurements yet</p></div>';return;}
  el.innerHTML=MEAS_FIELDS.map(function(f){
    var v=latest[f.key]; if(v==null)return '';
    var chg=''; if(prev&&prev[f.key]!=null){var d=(v-prev[f.key]).toFixed(2);var cls='neutral';if(d>0){cls=f.wantUp?'good':'bad';}else if(d<0){cls=f.wantDown?'good':'bad';}chg='<div class="meas-change '+cls+'">'+(d<0?d:d>0?'+'+d:'0')+' in</div>';}
    return '<div class="meas-box"><div class="meas-label">'+f.label+'</div><div class="meas-val">'+v+'<span class="meas-unit">in</span></div>'+chg+'</div>';
  }).join('');
}

function openMeasModal(){
  var el=document.getElementById('meas-fields');
  el.innerHTML=MEAS_FIELDS.map(function(f){
    return '<div class="auth-field"><label>'+f.label+'</label><input class="auth-input inp-sm" id="mf-'+f.key+'" type="number" step="0.01" placeholder="inches"></div>';
  }).join('');
  openModal('meas-modal');
}

async function saveMeasurements(){
  var d=document.getElementById('meas-date').value;
  if(!d){toast('Select a date',true);return;}
  var body={entry_date:d};
  MEAS_FIELDS.forEach(function(f){var v=parseFloat(document.getElementById('mf-'+f.key).value);if(!isNaN(v))body[f.key]=v;});
  try{
    var r=await api('POST','/measurements',body);
    var idx=measureData.findIndex(function(e){return e.entry_date===d;});
    if(idx>=0)measureData[idx]=r; else{measureData.push(r);measureData.sort(function(a,b){return a.entry_date.localeCompare(b.entry_date);});}
    closeModal('meas-modal'); toast('Measurements saved!'); renderMeasurements();
  }catch(e){toast(e.message,true);}
}

// ============================================================
//  GOALS
// ============================================================
function renderGoals(){
  var el=document.getElementById('goals-list');
  if(!goalsData.length){el.innerHTML='<div class="empty"><div class="ei">&#127945;</div><p>Set a goal to track progress</p></div>';return;}
  el.innerHTML=goalsData.map(function(g){
    return '<div class="row"><div><label style="'+(g.achieved?'text-decoration:line-through;color:var(--text-dim)':'')+'">'
      +esc(g.title)+'</label>'+(g.target?'<small>Target: '+g.target+(g.unit?' '+g.unit:'')+(g.deadline?' by '+fmtDate(g.deadline):'')+'</small>':'')+'</div>'
      +(g.achieved?'<span style="color:var(--green);font-size:12px;font-weight:700">Done!</span>':'<button class="btn ghost" style="font-size:10px;padding:4px 8px" onclick="markGoalDone('+g.id+')">Done</button>')
      +'</div>';
  }).join('');
}

function openGoalModal(){document.getElementById('goal-title').value='';document.getElementById('goal-target').value='';document.getElementById('goal-unit').value='';document.getElementById('goal-deadline').value='';openModal('goal-modal');}
async function saveGoal(){
  var title=document.getElementById('goal-title').value.trim();
  if(!title){toast('Enter a goal title',true);return;}
  try{
    var r=await api('POST','/goals',{title:title,target:parseFloat(document.getElementById('goal-target').value)||null,unit:document.getElementById('goal-unit').value||null,deadline:document.getElementById('goal-deadline').value||null});
    goalsData.push(r); closeModal('goal-modal'); toast('Goal added!'); renderGoals();
  }catch(e){toast(e.message,true);}
}
async function markGoalDone(id){
  try{await api('PATCH','/goals/'+id+'/achieve');var g=goalsData.find(function(g){return g.id===id;});if(g)g.achieved=true;renderGoals();toast('Goal achieved!');}
  catch(e){toast(e.message,true);}
}

// ============================================================
//  CAROUSEL
// ============================================================
function buildCarouselWindow(){
  windowDays=[];
  for(var i=-7;i<=13;i++){var d=new Date(TODAY);d.setDate(d.getDate()+i);windowDays.push(d.toISOString().split('T')[0]);}
  currentDayIndex=7;
}

function getDayInfo(ds){return schedule[dayName(ds)]||{gym:false,muscle:'Rest',style:''};}
function getWkt(ds){return workoutHistory[ds]||null;}
function relDay(ds){var diff=Math.round((new Date(ds+'T12:00:00')-TODAY)/86400000);return diff===0?'today':diff>0?'future':'past';}

function buildWeekStrip(){
  var strip=document.getElementById('week-strip'); strip.innerHTML='';
  windowDays.forEach(function(ds,i){
    var d=new Date(ds+'T12:00:00'); var di=getDayInfo(ds);
    var isSel=i===currentDayIndex; var isToday=ds===TODAY_STR; var hasLog=!!getWkt(ds);
    var cls='week-chip'+(di.gym?' is-gym':'')+(hasLog?' logged':'')+(isToday?' is-today':'')+(isSel?' selected':'');
    var chip=document.createElement('div'); chip.className=cls;
    chip.innerHTML='<div class="wc-day">'+DAYS[d.getDay()].slice(0,3)+'</div><div class="wc-num">'+d.getDate()+'</div>'+(di.gym?'<div class="wc-dot"></div>':'');
    chip.onclick=(function(idx){return function(){goToDay(idx);};})(i);
    strip.appendChild(chip);
    if(isSel)setTimeout(function(){chip.scrollIntoView({inline:'center',behavior:'smooth'});},50);
  });
}

function rebuildCarousel(){
  buildWeekStrip();
  var track=document.getElementById('card-track'); track.innerHTML='';
  windowDays.forEach(function(ds,i){
    var card=document.createElement('div'); card.className='day-card'; card.id='day-card-'+i;
    card.innerHTML=buildDayCardHTML(ds,i); track.appendChild(card);
  });
  goToDay(currentDayIndex,false); setupCarouselSwipe();
}

function goToDay(idx,animate){
  if(animate===undefined)animate=true;
  currentDayIndex=Math.max(0,Math.min(windowDays.length-1,idx));
  var track=document.getElementById('card-track');
  if(!animate)track.style.transition='none';
  track.style.transform='translateX(-'+(currentDayIndex*100)+'%)';
  if(!animate)requestAnimationFrame(function(){track.style.transition='';});
  buildWeekStrip();
}

function buildDayCardHTML(ds,idx){
  var di=getDayInfo(ds); var rel=relDay(ds);
  var dn=dayName(ds); var abbr=dn.slice(0,3).toUpperCase();
  var d=new Date(ds+'T12:00:00');
  var dateLabel=d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
  var nc=rel==='today'?'':rel==='future'?' future':' past';
  var hasLog=!!getWkt(ds);
  var statusHTML=rel==='today'?'<div class="dc-status today">'+(hasLog?'LOGGED':'TODAY')+'</div>':rel==='past'?'<div class="dc-status logged">'+(hasLog?'LOGGED':'MISSED')+'</div>':'<div class="dc-status future">+'+Math.round((new Date(ds+'T12:00:00')-TODAY)/86400000)+'d</div>';
  var prevBtn=idx>0?'<button class="dc-arrow" onclick="goToDay('+(idx-1)+')">&#8592;</button>':'<button class="dc-arrow" disabled>&#8592;</button>';
  var nextBtn=idx<windowDays.length-1?'<button class="dc-arrow" onclick="goToDay('+(idx+1)+')">&#8594;</button>':'<button class="dc-arrow" disabled>&#8594;</button>';
  var header='<div class="dc-header"><div class="dc-top"><div class="dc-day-block"><div class="dc-day-name'+nc+'">'+abbr+'</div><div><div style="font-size:11px;color:var(--text-dim)">'+dateLabel+'</div><div class="dc-muscle'+nc+'">'+esc(di.muscle)+'</div>'+(di.style?'<div class="dc-style">'+esc(di.style)+'</div>':'')+'</div></div>'+statusHTML+'</div><div class="dc-arrows">'+prevBtn+'<button class="dc-arrow" onclick="goToDay(7)" style="font-size:9px;font-weight:700;letter-spacing:.5px">TODAY</button>'+nextBtn+'</div></div>';
  var body='';
  if(!di.gym){
    var icon=di.muscle.indexOf('Pole')>=0?'&#127914;':di.muscle.indexOf('Cardio')>=0?'&#127939;':'&#128564;';
    var sub=di.muscle.indexOf('Pole')>=0?'pole class day':di.muscle.indexOf('Cardio')>=0?'active recovery':'full rest - recovery is training';
    body='<div class="rest-block"><div class="rest-icon">'+icon+'</div><div class="rest-label">'+esc(di.muscle).toUpperCase()+'</div><div class="rest-sub">'+sub+'</div></div>';
  } else if((rel==='past')||(rel==='today'&&hasLog&&!activeWorkouts[ds])){
    var entry=getWkt(ds);
    if(entry){
      var logAgain=rel==='today'?'<div class="gen-bar"><button class="btn ai" data-ds="'+ds+'" data-ci="'+idx+'" onclick="handleGenBtn(this)">Regenerate</button></div>':'';
      var exHTML=(entry.exercises||[]).map(function(ex){
        var chips=(ex.sets||[]).map(function(s){var pr=prsData[ex.name];var ispr=pr&&s.weight_lbs&&s.weight_lbs>=pr.weight_lbs;return'<div class="set-chip'+(ispr?' pr':'')+'">'+s.reps+'x'+(s.weight_lbs||'BW')+(ispr?' PR':'')+' </div>';}).join('');
        return'<div class="logged-ex"><div class="logged-ex-name">'+esc(ex.name)+'</div><div class="set-chips">'+chips+'</div></div>';
      }).join('');
      body=logAgain+exHTML;
    } else {body='<div class="empty"><div class="ei">&#128203;</div><p>No workout logged</p></div>';}
  } else if(rel==='today'){
    var active=activeWorkouts[ds];
    body=active?buildActiveHTML(ds,active):'<div class="gen-bar"><button class="btn ai" id="gen-'+idx+'" data-ds="'+ds+'" data-ci="'+idx+'" onclick="handleGenBtn(this)">&#10022; Generate Workout</button></div><div id="wkt-area-'+idx+'"></div>';
  } else {
    var previews=MUSCLE_PREVIEWS[di.muscle]||[];
    if(previews.length){
      body='<div class="future-overlay"><h3>AI GENERATES ON '+abbr+'</h3><p>Come back on '+dn+' for your personalized '+esc(di.muscle)+' workout</p></div>';
      previews.forEach(function(name){
        body+='<div class="ex-block future-ex"><div class="ex-header"><div><div class="ex-name">'+esc(name)+'</div><div class="ex-sub">Likely exercise</div><div class="ex-badges"><span class="badge prev">PREVIEW</span></div></div></div>';
        body+='<div class="sets-hdr"><span>#</span><span>REPS</span><span>WEIGHT</span></div><div>';
        for(var n=1;n<=3;n++)body+='<div style="display:grid;grid-template-columns:24px 1fr 1fr;gap:3px;padding:2px;margin-bottom:2px"><span class="set-num">'+n+'</span><span style="text-align:center;color:var(--text-faint);font-size:12px">-</span><span style="text-align:center;color:var(--text-faint);font-size:12px">-</span></div>';
        body+='</div></div>';
      });
    } else {body='<div class="empty"><div class="ei">&#128564;</div><p>Rest - see you next gym day</p></div>';}
  }
  return header+body;
}

function buildActiveHTML(ds,workout){
  var rendered={}; var html='';
  html+='<div class="gen-bar"><button class="btn ai" onclick="startGenerate(\\x27'+ds+'\\x27,'+currentDayIndex+')">Regenerate</button><button class="btn save" onclick="saveWorkout(\\x27'+ds+'\\x27)">Save Workout</button></div>';
  html+='<div class="ex-block" style="background:linear-gradient(135deg,var(--surface),#0f1a20);border-color:rgba(66,200,245,.18);margin-bottom:10px"><div style="font-family:\x27Bebas Neue\x27,sans-serif;font-size:17px;letter-spacing:2px;color:var(--accent-c);margin-bottom:3px">'+esc(workout.title)+'</div><div style="font-size:12px;color:var(--text-dim)">'+esc(workout.notes||'')+'</div></div>';
  workout.exercises.forEach(function(ex,idx){
    if(rendered[idx])return; rendered[idx]=true;
    var isSS=!!ex.ss; var pIdx=-1;
    if(isSS)workout.exercises.forEach(function(e,i){if(i!==idx&&e.name===ex.ss)pIdx=i;});
    if(pIdx>=0)rendered[pIdx]=true;
    var partner=pIdx>=0?workout.exercises[pIdx]:null;
    if(isSS&&partner){html+='<div class="ex-block superset"><div class="ss-label">SUPERSET</div>'+buildExInnerHTML(ds,workout,ex,idx)+buildExInnerHTML(ds,workout,partner,pIdx)+'</div>';}
    else{html+='<div class="ex-block">'+buildExInnerHTML(ds,workout,ex,idx)+'</div>';}
  });
  return html;
}

function buildExInnerHTML(ds,workout,ex,exIdx){
  var isSS=!!ex.ss; var isHIIT=(workout.style||'').indexOf('HIIT')>=0;
  var lp=findLastPerf(ex.name);
  var dk=ds.replace(/-/g,'');
  var html='<div class="ex-header"><div><div class="ex-name">'+esc(ex.name)+'</div><div class="ex-sub">'+esc(ex.muscle||'')+'</div><div class="ex-badges">'+(isSS?'<span class="badge ss">SS</span>':'')+(isHIIT?'<span class="badge hiit">HIIT</span>':'<span class="badge str">STRENGTH</span>')+'</div></div><button class="btn danger" onclick="openSwap(\\x27'+ds+'\\x27,'+exIdx+')">Swap</button></div>';
  if(lp)html+='<div class="last-perf">Last: <strong>'+lp.sets.map(function(s){return s.reps+'x'+s.weight_lbs+'lbs';}).join(', ')+'</strong> on '+fmtDate(lp.date)+'</div>';
  if(ex.tip)html+='<div style="font-size:11px;color:var(--text-dim);margin-bottom:5px;font-style:italic">'+esc(ex.tip)+'</div>';
  if(ex.notes)html+='<div style="font-size:11px;color:var(--text-dim);margin-bottom:5px">'+esc(ex.notes)+'</div>';
  html+='<div class="sets-hdr"><span>#</span><span>REPS</span><span>WEIGHT</span><span>done</span></div>';
  html+='<div id="sets-'+dk+'-'+exIdx+'">';
  ex.loggedSets.forEach(function(s,si){html+=buildSetRowHTML(ds,exIdx,si,s,ex.reps);});
  html+='</div><button class="add-set-btn" onclick="addSet(\\x27'+ds+'\\x27,'+exIdx+')">+ Add Set</button>';
  return html;
}

function buildSetRowHTML(ds,exIdx,si,s,repsPlaceholder){
  var dk=ds.replace(/-/g,''); var chkCls='chk-btn'+(s.done?' done':'');
  return '<div class="set-row-wrap" id="wrap-'+dk+'-'+exIdx+'-'+si+'">'
    +'<div class="set-del" onclick="deleteSet(\\x27'+ds+'\\x27,'+exIdx+','+si+')">Del</div>'
    +'<div class="set-inner" id="sri-'+dk+'-'+exIdx+'-'+si+'">'
    +'<span class="set-num">'+(si+1)+'</span>'
    +'<input class="set-input" type="number" placeholder="'+esc(String(repsPlaceholder||''))+'" value="'+esc(String(s.reps||''))+'" oninput="updSet(\\x27'+ds+'\\x27,'+exIdx+','+si+',\x27reps\x27,this.value);chkPR(\\x27'+ds+'\\x27,'+exIdx+','+si+')" id="r-'+dk+'-'+exIdx+'-'+si+'">'
    +'<input class="set-input" type="number" placeholder="lbs" value="'+esc(String(s.weight||''))+'" oninput="updSet(\\x27'+ds+'\\x27,'+exIdx+','+si+',\x27weight\x27,this.value);chkPR(\\x27'+ds+'\\x27,'+exIdx+','+si+')" id="w-'+dk+'-'+exIdx+'-'+si+'">'
    +'<button class="'+chkCls+'" id="c-'+dk+'-'+exIdx+'-'+si+'" onclick="togSet(\\x27'+ds+'\\x27,'+exIdx+','+si+')">'+(s.done?'ok':'')+'</button>'
    +'</div></div>';
}

function attachSwipe(ds,exIdx,si){
  var dk=ds.replace(/-/g,''); var inner=document.getElementById('sri-'+dk+'-'+exIdx+'-'+si);
  if(!inner||inner._sw)return; inner._sw=true;
  var sx=0,sy=0,isH=null,swiped=false;
  inner.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;isH=null;e.stopPropagation();},{passive:true});
  inner.addEventListener('touchmove',function(e){var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;if(isH===null)isH=Math.abs(dx)>Math.abs(dy);if(isH){e.preventDefault();e.stopPropagation();}},{passive:false});
  inner.addEventListener('touchend',function(e){e.stopPropagation();if(!isH)return;var dx=e.changedTouches[0].clientX-sx;if(dx<-40){inner.classList.add('open');swiped=true;}else if(dx>20&&swiped){inner.classList.remove('open');swiped=false;}});
  var ms=0,md=false;
  inner.addEventListener('mousedown',function(e){ms=e.clientX;md=true;e.preventDefault();});
  document.addEventListener('mouseup',function(e){if(!md)return;md=false;var dx=e.clientX-ms;if(dx<-40){inner.classList.add('open');swiped=true;}else if(dx>20&&swiped){inner.classList.remove('open');swiped=false;}});
}

function attachAllSwipes(ds){
  if(!activeWorkouts[ds])return;
  activeWorkouts[ds].exercises.forEach(function(ex,ei){ex.loggedSets.forEach(function(_,si){attachSwipe(ds,ei,si);});});
}

function refreshSets(ds,exIdx){
  var dk=ds.replace(/-/g,''); var container=document.getElementById('sets-'+dk+'-'+exIdx);
  if(!container)return;
  var ex=activeWorkouts[ds].exercises[exIdx]; container.innerHTML='';
  ex.loggedSets.forEach(function(s,si){container.innerHTML+=buildSetRowHTML(ds,exIdx,si,s,ex.reps);});
  ex.loggedSets.forEach(function(_,si){attachSwipe(ds,exIdx,si);});
}

function findLastPerf(name){
  var entries=Object.values(workoutHistory).sort(function(a,b){return b.workout_date.localeCompare(a.workout_date);});
  for(var i=0;i<entries.length;i++){
    var f=(entries[i].exercises||[]).filter(function(e){return e.name===name;})[0];
    if(f&&f.sets&&f.sets.some(function(s){return s.weight_lbs;}))return Object.assign({},f,{date:entries[i].workout_date});
  }
  return null;
}

// ============================================================
//  GENERATE WORKOUT
// ============================================================
function handleGenBtn(btn){
  var ds=btn.getAttribute('data-ds');
  var ci=parseInt(btn.getAttribute('data-ci')||'0');
  startGenerate(ds,ci);
}

async function startGenerate(ds,cardIdx){
  var genBtn=document.getElementById('gen-'+cardIdx);
  if(genBtn){genBtn.disabled=true;genBtn.textContent='Generating...';}
  var area=document.getElementById('wkt-area-'+cardIdx);
  var di=getDayInfo(ds);
  if(area)area.innerHTML='<div class="ai-loading"><div class="ai-spin"></div><p><strong>Building your '+esc(di.muscle)+' workout...</strong><br>Personalizing for your goals</p></div>';
  try{
    var result=await api('POST','/workouts/generate',{workout_date:ds});
    if(!result)return;
    var workout={title:result.title,notes:result.notes,muscleGroup:result.muscle_group,style:result.style,source:result.source};
    workout.exercises=(result.exercises||[]).map(function(ex,i){
      return {id:i,name:ex.name,muscle:ex.muscle||'',sets:ex.sets||3,reps:ex.reps||'8-10',tip:ex.weight_suggestion||'',notes:ex.notes||'',ss:ex.superset_with||null,
        loggedSets:Array(ex.sets||3).fill(null).map(function(){return{reps:'',weight:'',done:false};})};
    });
    activeWorkouts[ds]=workout;
    var card=document.getElementById('day-card-'+cardIdx);
    if(card)card.innerHTML=buildDayCardHTML(ds,cardIdx);
    setTimeout(function(){attachAllSwipes(ds);},50);
  }catch(e){
    toast(e.message,true);
    if(genBtn){genBtn.disabled=false;genBtn.textContent='&#10022; Generate Workout';}
    if(area)area.innerHTML='';
  }
}

// ============================================================
//  SET OPS
// ============================================================
function updSet(ds,exIdx,si,field,val){if(activeWorkouts[ds])activeWorkouts[ds].exercises[exIdx].loggedSets[si][field]=val;}
function togSet(ds,exIdx,si){
  if(!activeWorkouts[ds])return;
  var s=activeWorkouts[ds].exercises[exIdx].loggedSets[si]; s.done=!s.done;
  var dk=ds.replace(/-/g,''); var btn=document.getElementById('c-'+dk+'-'+exIdx+'-'+si);
  if(btn){btn.classList.toggle('done',s.done);btn.textContent=s.done?'ok':'';}
}
function addSet(ds,exIdx){if(!activeWorkouts[ds])return;activeWorkouts[ds].exercises[exIdx].loggedSets.push({reps:'',weight:'',done:false});refreshSets(ds,exIdx);}
function deleteSet(ds,exIdx,si){
  if(!activeWorkouts[ds])return;
  var sets=activeWorkouts[ds].exercises[exIdx].loggedSets;
  if(sets.length<=1){toast('Need at least 1 set',true);return;}
  sets.splice(si,1); refreshSets(ds,exIdx); toast('Set removed');
}
function chkPR(ds,exIdx,si){
  if(!activeWorkouts[ds])return;
  var ex=activeWorkouts[ds].exercises[exIdx]; var s=ex.loggedSets[si];
  var pr=prsData[ex.name]; var w=parseFloat(s.weight),r=parseFloat(s.reps);
  if(!w||!r)return;
  var dk=ds.replace(/-/g,''); var el=document.getElementById('w-'+dk+'-'+exIdx+'-'+si);
  if(!pr||w>pr.weight_lbs||(w===pr.weight_lbs&&r>(pr.reps||0))){if(el)el.classList.add('pr');toast('New PR incoming!');}
  else{if(el)el.classList.remove('pr');}
}

async function saveWorkout(ds){
  if(!activeWorkouts[ds])return;
  var w=activeWorkouts[ds];
  var exercises=w.exercises.map(function(ex,ei){
    return {name:ex.name,muscle:ex.muscle,superset_with:ex.ss||null,
      sets:ex.loggedSets.map(function(s,si){return{set_number:si+1,reps:s.reps||0,weight_lbs:parseFloat(s.weight)||0,done:s.done};}).filter(function(s){return s.reps||s.weight_lbs;})};
  }).filter(function(e){return e.sets.length;});
  if(!exercises.length){toast('Log at least one set first',true);return;}
  try{
    await api('POST','/workouts',{workout_date:ds,muscle_group:w.muscleGroup,title:w.title,style:w.style,notes:w.notes||'',exercises:exercises});
    // Reload workouts and PRs
    var wkts=await api('GET','/workouts?days=60');
    workoutHistory={};
    (wkts||[]).forEach(function(wk){var d=wk.workout_date.split('T')[0];workoutHistory[d]=wk;});
    var prsList=await api('GET','/prs');
    prsData={};(prsList||[]).forEach(function(p){prsData[p.exercise_name]=p;});
    delete activeWorkouts[ds];
    toast('Workout saved!');
    var card=document.getElementById('day-card-'+currentDayIndex);
    if(card)card.innerHTML=buildDayCardHTML(ds,currentDayIndex);
    buildWeekStrip();
  }catch(e){toast(e.message,true);}
}

// ============================================================
//  SWAP
// ============================================================
function openSwap(ds,exIdx){swapTarget={date:ds,idx:exIdx};swapFilter='All';renderSwapList('','All');openModal('swap-modal');}
function filterSwap(q){renderSwapList(q,swapFilter);}
function renderSwapList(q,muscle){
  if(!muscle)muscle='All';
  var muscles=['All'].concat([].concat.apply([],BASE_LIBRARY.map(function(e){return e.muscle;})).filter(function(v,i,a){return a.indexOf(v)===i;}));
  document.getElementById('swap-filters').innerHTML=muscles.map(function(m){return'<span class="lib-chip'+(m===muscle?' active':'')+'" onclick="swapFilter=\\x27'+m+'\\x27;renderSwapList(document.getElementById(\x27swap-search\x27).value,\\x27'+m+'\\x27)">'+m+'</span>';}).join('');
  var filtered=BASE_LIBRARY.filter(function(e){return(muscle==='All'||e.muscle===muscle)&&(!q||e.name.toLowerCase().indexOf(q.toLowerCase())>=0);});
  document.getElementById('swap-list').innerHTML=filtered.map(function(e){return'<div class="lib-item" onclick="doSwap(\\x27'+e.id+'\\x27)" style="cursor:pointer"><div class="lib-item-name">'+esc(e.name)+'</div><div class="lib-item-meta">'+e.muscle+' - '+e.equip+'</div></div>';}).join('');
}
function doSwap(id){
  if(!swapTarget.date||swapTarget.idx===null||!activeWorkouts[swapTarget.date])return;
  var ex=BASE_LIBRARY.filter(function(e){return e.id===id;})[0]; if(!ex)return;
  var old=activeWorkouts[swapTarget.date].exercises[swapTarget.idx];
  activeWorkouts[swapTarget.date].exercises[swapTarget.idx]=Object.assign({},old,{name:ex.name,muscle:ex.muscle,tip:'',notes:''});
  closeModal('swap-modal');
  var card=document.getElementById('day-card-'+currentDayIndex);
  if(card)card.innerHTML=buildDayCardHTML(swapTarget.date,currentDayIndex);
  setTimeout(function(){attachAllSwipes(swapTarget.date);},50);
  toast('Swapped to '+ex.name);
}

// ============================================================
//  CAROUSEL SWIPE
// ============================================================
function setupCarouselSwipe(){
  var track=document.getElementById('card-track');
  var sx=0,sy=0,moved=false,isH=null;
  track.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;moved=false;isH=null;},{passive:true});
  track.addEventListener('touchmove',function(e){var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;if(isH===null)isH=Math.abs(dx)>Math.abs(dy);if(isH){e.preventDefault();moved=true;}},{passive:false});
  track.addEventListener('touchend',function(e){if(!moved||!isH)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)goToDay(currentDayIndex+(dx<0?1:-1));});
}

// ============================================================
//  HISTORY & PRs
// ============================================================
function renderHistory(){
  var entries=Object.values(workoutHistory).sort(function(a,b){return b.workout_date.localeCompare(a.workout_date);});
  var el=document.getElementById('hist-list');
  if(!entries.length){el.innerHTML='<div class="empty"><div class="ei">&#128203;</div><p>No workouts logged yet</p></div>';return;}
  el.innerHTML=entries.map(function(w){
    var ds=w.workout_date.split('T')[0];
    var sets=(w.exercises||[]).reduce(function(a,e){return a+(e.sets||[]).length;},0);
    return'<div class="hist-item" onclick="this.querySelector(\x27.hist-detail\x27).classList.toggle(\x27open\x27)"><div class="hist-hdr"><div><div class="hist-date">'+fmtDate(ds)+' - '+esc(w.muscle_group)+'</div><div class="hist-mg">'+esc(w.title||'')+'</div></div><div class="hist-stat">'+((w.exercises||[]).length)+'ex / '+sets+' sets</div></div><div class="hist-detail">'+((w.exercises||[]).map(function(e){return'<div class="hist-ex"><strong>'+esc(e.name)+'</strong> '+((e.sets||[]).map(function(s){return s.reps+'x'+(s.weight_lbs||'BW')+'lbs';}).join(', '))+'</div>';})).join('')+'</div></div>';
  }).join('');
}

function renderPRs(){
  var entries=Object.entries(prsData); var el=document.getElementById('pr-grid');
  if(!entries.length){el.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="ei">&#127942;</div><p>No PRs yet - start logging!</p></div>';return;}
  el.innerHTML=entries.sort(function(a,b){return a[0].localeCompare(b[0]);}).map(function(e){return'<div class="pr-box"><div class="pr-name">'+esc(e[0])+'</div><div class="pr-val">'+e[1].weight_lbs+' lbs</div><div class="pr-meta">'+e[1].reps+' reps - '+fmtDate(e[1].achieved_date)+'</div></div>';}).join('');
}

// ============================================================
//  SETTINGS
// ============================================================
function renderSettings(){
  var muscleOpts=MUSCLE_GROUPS.map(function(m){return'<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('');
  var styleOpts=STYLE_OPTS.map(function(s){return'<option value="'+esc(s)+'">'+(s||'No style')+'</option>';}).join('');
  document.getElementById('sched-view').innerHTML=DAYS_ORDER.map(function(day){
    var d=schedule[day]||{gym:false,muscle:'Rest',style:''}; var dk=day.replace(/ /g,'');
    var mOpts=MUSCLE_GROUPS.map(function(m){return'<option value="'+esc(m)+'"'+(m===d.muscle?' selected':'')+'>'+esc(m)+'</option>';}).join('');
    var sOpts=STYLE_OPTS.map(function(s){return'<option value="'+esc(s)+'"'+(s===(d.style||'')?' selected':'')+'>'+(s||'No style')+'</option>';}).join('');
    return'<div class="sched-row"><div class="sched-day-col"><div class="sched-day-name">'+day.slice(0,3).toUpperCase()+'</div><button class="gym-toggle'+(d.gym?' on':'')+'" onclick="toggleGym(\\x27'+day+'\\x27)">'+( d.gym?'GYM':'OFF')+'</button></div><div class="sched-inputs'+(d.gym?'':' off')+'" id="sinputs-'+dk+'"><select class="sel" id="sm-'+dk+'" onchange="schedChanged(\\x27'+day+'\\x27)">'+mOpts+'</select><select class="sel" id="ss-'+dk+'" onchange="schedChanged(\\x27'+day+'\\x27)">'+sOpts+'</select></div></div>';
  }).join('');

  var gOpts=GOAL_OPTS.map(function(g){var sel=trainingProfile.goal&&trainingProfile.goal.indexOf(g.split(' - ')[0])>=0;return'<option value="'+esc(g)+'"'+(sel?' selected':'')+'>'+esc(g)+'</option>';}).join('');
  var stOpts=['Strength / Hypertrophy','HIIT / Supersets','Hypertrophy','Strength','Endurance / Cardio','Mixed'].map(function(s){return'<option value="'+esc(s)+'"'+(s===trainingProfile.style?' selected':'')+'>'+esc(s)+'</option>';}).join('');
  var exOpts=EXP_OPTS.map(function(e){return'<option value="'+esc(e)+'"'+(e===trainingProfile.experience?' selected':'')+'>'+esc(e)+'</option>';}).join('');
  document.getElementById('profile-view').innerHTML=
    '<div class="row"><label>Goal<small>What are you training for?</small></label><select class="sel" id="prof-goal" style="max-width:170px" onchange="profileChanged()">'+gOpts+'</select></div>'
    +'<div class="row"><label>Training Style<small>How you prefer to train</small></label><select class="sel" id="prof-style" style="max-width:170px" onchange="profileChanged()">'+stOpts+'</select></div>'
    +'<div class="row"><label>Experience<small>Your fitness level</small></label><select class="sel" id="prof-exp" style="max-width:170px" onchange="profileChanged()">'+exOpts+'</select></div>';
}

function toggleGym(day){
  var d=schedule[day]||(schedule[day]={gym:false,muscle:'Rest',style:''});
  d.gym=!d.gym; var dk=day.replace(/ /g,'');
  var btn=document.querySelector('#sinputs-'+dk+' ~ * .gym-toggle')||document.querySelector('.sched-row .gym-toggle');
  // find the right button by iterating
  document.querySelectorAll('.sched-row').forEach(function(row){
    var lbl=row.querySelector('.sched-day-name');
    if(lbl&&lbl.textContent===day.slice(0,3).toUpperCase()){
      var b=row.querySelector('.gym-toggle'); if(b){b.classList.toggle('on',d.gym);b.textContent=d.gym?'GYM':'OFF';}
      var inp=document.getElementById('sinputs-'+dk); if(inp)inp.classList.toggle('off',!d.gym);
    }
  });
  if(!d.gym){d.muscle='Rest';d.style='';}
}

function schedChanged(day){
  var dk=day.replace(/ /g,'');
  var m=document.getElementById('sm-'+dk); var s=document.getElementById('ss-'+dk);
  if(!schedule[day])schedule[day]={gym:false,muscle:'Rest',style:''};
  if(m)schedule[day].muscle=m.value;
  if(s)schedule[day].style=s.value;
}

function profileChanged(){
  var g=document.getElementById('prof-goal'); var s=document.getElementById('prof-style'); var e=document.getElementById('prof-exp');
  if(g)trainingProfile.goal=g.value; if(s)trainingProfile.style=s.value; if(e)trainingProfile.experience=e.value;
}

async function saveSettings(){
  DAYS_ORDER.forEach(function(day){schedChanged(day);}); profileChanged();
  var days=DAYS_ORDER.map(function(day){var d=schedule[day]||{gym:false,muscle:'Rest',style:''};return{day_of_week:day,is_gym:d.gym,muscle_group:d.muscle,style:d.style||null};});
  try{
    await Promise.all([
      api('PUT','/schedule',days),
      api('PUT','/profile',{goal:trainingProfile.goal,style:trainingProfile.style,experience:trainingProfile.experience})
    ]);
    rebuildCarousel(); toast('Settings saved!');
    showTab('settings');
  }catch(e){toast(e.message,true);}
}


// ============================================================
//  PHOTOS
// ============================================================
var photosData = [];
var pendingPhotoData = null;

async function loadPhotos(){
  try{
    var r = await api('GET','/photos');
    photosData = r || [];
  }catch(e){ photosData = []; }
}

function handlePhotoSelect(input){
  if(!input.files||!input.files[0])return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e){
    // Compress via canvas
    var img = new Image();
    img.onload = function(){
      var canvas = document.createElement('canvas');
      var MAX = 900;
      var ratio = Math.min(MAX/img.width, MAX/img.height, 1);
      canvas.width = Math.round(img.width*ratio);
      canvas.height = Math.round(img.height*ratio);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      pendingPhotoData = canvas.toDataURL('image/jpeg',0.78);
      // Show preview + note bar
      document.getElementById('photo-preview-img').src = pendingPhotoData;
      document.getElementById('photo-preview-wrap').style.display='block';
      document.getElementById('photo-note-bar').style.display='block';
      document.getElementById('photo-note-input').value='';
      document.getElementById('photo-note-input').focus();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value='';
}

function cancelUpload(){
  pendingPhotoData=null;
  document.getElementById('photo-preview-wrap').style.display='none';
  document.getElementById('photo-note-bar').style.display='none';
}

async function confirmUpload(){
  if(!pendingPhotoData){toast('No photo selected',true);return;}
  var note = document.getElementById('photo-note-input').value.trim();
  var ds = TODAY_STR;
  document.getElementById('photo-note-bar').style.display='none';
  document.getElementById('photo-preview-wrap').style.display='none';
  var loader = document.getElementById('upload-loading');
  loader.classList.add('show');
  try{
    var r = await api('POST','/photos',{photo_date:ds, note:note, image_data:pendingPhotoData});
    photosData.unshift(r);
    pendingPhotoData=null;
    loader.classList.remove('show');
    toast('Photo saved!');
    renderPhotos();
  }catch(e){
    loader.classList.remove('show');
    toast(e.message,true);
  }
}

function renderPhotos(){
  var el = document.getElementById('photo-grid-wrap');
  if(!photosData.length){
    el.innerHTML='<div class="empty"><div class="ei">&#128247;</div><p>No progress photos yet.<br>Take your first one today!</p></div>';
    return;
  }
  // Group by month
  var groups = {};
  photosData.forEach(function(p){
    var ds = typeof p.photo_date==='string' ? p.photo_date.split('T')[0] : p.photo_date;
    var d = new Date(ds+'T12:00:00');
    var key = d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    if(!groups[key])groups[key]=[];
    groups[key].push(Object.assign({},p,{ds:ds}));
  });
  var html='<div class="photo-grid">';
  Object.keys(groups).forEach(function(month){
    html+='<div class="photo-month-label">'+esc(month)+'</div>';
    groups[month].forEach(function(p){
      html+='<div class="photo-card" onclick="openPhotoViewer('+p.id+')">'
        +'<img src="'+esc(p.image_data)+'" loading="lazy">'
        +'<div class="photo-card-meta">'
        +'<div class="photo-card-date">'+fmtDate(p.ds)+'</div>'
        +(p.note?'<div class="photo-card-note">'+esc(p.note)+'</div>':'')
        +'</div>'
        +'<button class="photo-card-del" onclick="deletePhoto(event,'+p.id+')">&#x2715;</button>'
        +'</div>';
    });
  });
  html+='</div>';
  el.innerHTML=html;
}

function openPhotoViewer(id){
  var p = photosData.filter(function(x){return x.id===id;})[0];
  if(!p)return;
  var ds = typeof p.photo_date==='string' ? p.photo_date.split('T')[0] : p.photo_date;
  document.getElementById('pv-img').src = p.image_data;
  document.getElementById('pv-date').textContent = fmtDate(ds);
  document.getElementById('pv-note').textContent = p.note||'';
  document.getElementById('photo-viewer').classList.add('open');
}

function closePhotoViewer(){
  document.getElementById('photo-viewer').classList.remove('open');
}

async function deletePhoto(e,id){
  e.stopPropagation();
  if(!confirm('Delete this photo?'))return;
  try{
    await api('DELETE','/photos/'+id);
    photosData = photosData.filter(function(p){return p.id!==id;});
    toast('Photo deleted');
    renderPhotos();
  }catch(err){toast(err.message,true);}
}

// ============================================================
//  INIT
// ============================================================
window.addEventListener('DOMContentLoaded', async function(){
  // Set today's date in inputs
  document.getElementById('wt-date-input').value=TODAY_STR;
  document.getElementById('meas-date').value=TODAY_STR;
  buildCarouselWindow();

  if(token){
    try{
      var me=await api('GET','/auth/me');
      if(me){currentUser=me;await loadAllData();showApp();return;}
    }catch(e){}
  }
  showAuthScreen();
});
