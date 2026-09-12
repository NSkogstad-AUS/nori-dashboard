const direction={name:'Journey atlas',note:'The whole experience, connected.',desc:'Connected stages · Floating persona shelf'};
const people=[
 {id:'alex',name:'Alex',emoji:'🧑‍🦱',role:'First-time visitor',color:'peach',issues:2},
 {id:'jamie',name:'Jamie',emoji:'👩‍💻',role:'Busy professional',color:'blue',issues:1},
 {id:'sam',name:'Sam',emoji:'🧔',role:'Careful evaluator',color:'violet',issues:1},
 {id:'riley',name:'Riley',emoji:'👩‍🦽',role:'Keyboard-first visitor',color:'lime',issues:2}
];
const sites=[{name:'Acme',url:'acme.example',mark:'A',color:'peach'},{name:'Forma',url:'forma.example',mark:'F',color:'violet'},{name:'Orbit',url:'orbit.example',mark:'O',color:'blue'}];
const stages=['Discover','Explore','Sign up','Get started'];
const actions=[
 ['Lands on homepage','Compares plans','Looks for next step','Reaches workspace'],
 ['Opens pricing','Skims features','Creates an account','Finds first project'],
 ['Reads the promise','Checks what’s included','Reviews the form','Opens the guide'],
 ['Tabs through navigation','Opens plan details','Completes the form','Finds keyboard focus']
];
const findings=[
 {person:0,stage:1,title:'Plan differences are easy to miss',severity:'Moderate',evidence:'Alex moved between two plan cards three times before finding the limits.',recommendation:'Align the key limits in a short, scannable comparison.'},
 {person:0,stage:2,title:'The next step is unclear',severity:'High',evidence:'Alex paused at the form footer and returned to the pricing page.',recommendation:'Replace “Continue” with a specific action and keep it beside the final field.'},
 {person:1,stage:1,title:'Too much detail before the decision',severity:'Moderate',evidence:'Jamie skimmed the feature list and searched for a summary.',recommendation:'Lead with the three differences that help visitors choose.'},
 {person:2,stage:2,title:'Trial terms arrive too late',severity:'Moderate',evidence:'Sam left the form to look for billing information.',recommendation:'Show the trial length and billing expectations before sign-up.'},
 {person:3,stage:0,title:'Focus skips the main navigation',severity:'High',evidence:'The illustrative keyboard path jumps from the logo to the footer.',recommendation:'Use a predictable tab order and provide a skip-to-content link.'},
 {person:3,stage:3,title:'The active control is hard to see',severity:'High',evidence:'The sample focus indicator blends into the project card.',recommendation:'Use a visible, high-contrast focus ring on every control.'}
];
let runs=[{title:'First visit → first project',site:0,date:'Today, 10:42',count:6},{title:'Pricing → account',site:0,date:'Yesterday, 14:10',count:6},{title:'Discover the collection',site:1,date:'Yesterday, 09:20',count:6},{title:'Start a workspace',site:2,date:'Mon, 11:05',count:6}];
history.replaceState(null,'','#1');
const state={concept:0,view:'journey',site:0,person:null,collapsed:false,onlyIssues:false,run:0,mode:'overview',frames:[0,0,0,0],captures:[[0,1],[0,1],[0,1],[0,1]],playing:false,captureMessage:''};
const app=document.getElementById('app');
const dialog=document.getElementById('detail');
const escapeHTML=value=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const icon=(name)=>({home:'⌂',journey:'⌘',runs:'▦',sites:'◫'}[name]||'↗');
const button=(text,action,classes='pill',extra='')=>'<button class="'+classes+'" data-action="'+action+'" '+extra+'>'+text+'</button>';
function personaShelf(){
 return '<div class="persona-shelf"><div class="shelf-header"><div class="shelf-title"><span class="eyebrow">Attached perspectives</span><small>'+(state.mode==='live'?'Choose whose experience to watch':'Choose a person to trace their path')+'</small></div>'+button('+','personas','circle add-person','aria-label="Open persona library"')+'</div><div class="people">'+people.map((person,index)=>'<button class="person '+person.color+(state.person===index?' selected':'')+'" data-person="'+index+'" aria-pressed="'+(state.person===index)+'"><span class="emoji">'+person.emoji+'</span><span class="person-copy"><strong>'+person.name+'</strong><small>'+person.role+'</small></span><span class="issue-count" aria-label="'+person.issues+' potential issues">'+person.issues+'<span class="issue-word"> issues</span></span></button>').join('')+'</div></div>';
}
function issueAt(person,stage){return findings.findIndex(finding=>finding.person===person&&finding.stage===stage);}
function node(person,stage){
 const issue=issueAt(person,stage);
 if(state.onlyIssues&&issue<0)return '<div class="quiet-node">✓ No flagged issue</div>';
 return '<button class="journey-node '+(issue>=0?'has-issue':'')+'" '+(issue>=0?'data-finding="'+issue+'"':'data-step="'+person+','+stage+'"')+'><span class="node-top"><span>'+people[person].emoji+' '+people[person].name+'</span><span class="'+(issue>=0?'signal':'okay')+'">'+(issue>=0?'!':'✓')+'</span></span><strong>'+actions[person][stage]+'</strong><small>'+(issue>=0?findings[issue].severity+' friction':'Continued smoothly')+'</small></button>';
}
function visiblePeople(){return state.person===null?[0,1,2,3]:[state.person];}
function atlas(){
 return '<section class="map-panel"><div class="panel-head"><div><span class="eyebrow">Sample run / 024</span><h2>First visit → first project</h2></div>'+button('↗ Run details','run-detail','circle','aria-label="Run details"')+'</div><div class="scroll-area"><div class="stage-map">'+stages.map((stage,index)=>'<div class="stage-column"><div class="stage-heading"><span>0'+(index+1)+'</span><h3>'+stage+'</h3></div><div class="stage-nodes">'+visiblePeople().map(person=>node(person,index)).join('')+'</div></div>').join('')+'</div></div></section>';
}
function overview(){
 return '<div class="overview-grid"><section class="welcome-panel"><span class="eyebrow">Your workspace, at a glance</span><h2>A fresh look at<br>what matters.</h2><p>'+sites.length+' websites. A few new perspectives.</p>'+button('Explore customer journeys ↗','journey','dark pill')+'<div class="overview-people">'+people.map(person=>'<span class="emoji '+person.color+'">'+person.emoji+'</span>').join('')+'</div></section><section class="metric-panel"><span class="eyebrow">Across your workspace</span><div><strong>'+runs.length.toString().padStart(2,'0')+'</strong><span>sample runs</span></div><div><strong>'+String(sites.length).padStart(2,'0')+'</strong><span>websites tracked</span></div><div><strong>'+runs.reduce((sum,run)=>sum+run.count,0).toString().padStart(2,'0')+'</strong><span>flagged moments</span></div></section><section class="overview-journey"><div class="panel-head"><div><span class="eyebrow">Latest journey / '+sites[state.site].name+'</span><h2>Where people pause</h2></div>'+button('↗','journey','circle','aria-label="Explore journey"')+'</div><div class="mini-stages">'+stages.map((stage,index)=>'<button data-stage="'+index+'"><span class="mini-dot '+['blue','violet','peach','lime'][index]+'">0'+(index+1)+'</span><strong>'+stage+'</strong><small>'+findings.filter(item=>item.stage===index).length+' issues</small></button>').join('')+'</div><div class="mini-path"></div><p class="subtle">Most friction appears between choosing a plan and signing up.</p></section><section class="recent-panel"><div class="panel-head"><h2>Recent runs</h2>'+button('View all ↗','runs','text-button')+'</div>'+runs.slice(0,3).map(run=>'<button class="recent-row" data-run="'+runs.indexOf(run)+'"><span class="site-avatar '+sites[run.site].color+'">'+sites[run.site].mark+'</span><span><strong>'+run.title+'</strong><small>'+sites[run.site].url+' · '+run.date+'</small></span><span>↗</span></button>').join('')+'</section></div>';
}
function runCards(){
 const matching=runs.map((run,index)=>({...run,index})).filter(run=>run.site===state.site);
 return '<div class="view-intro"><p>Each run is a fresh set of eyes on your website.</p><span class="subtle">'+matching.length+' sample runs</span></div><div class="run-grid">'+matching.map(run=>'<button class="run-card" data-run="'+run.index+'"><div class="run-art '+sites[run.site].color+'"><div class="tiny-browser"><span>•••</span><div></div><div></div><i></i></div><div class="art-people">'+people.slice(0,3).map(person=>'<span>'+person.emoji+'</span>').join('')+'</div></div><div class="run-card-copy"><span class="eyebrow">'+sites[run.site].url+'</span><h2>'+run.title+'</h2><p>'+run.date+'</p><footer><span class="tag">'+(run.pending?'Setup only':run.count+' flagged moments')+'</span><span>Explore ↗</span></footer></div></button>').join('')+ '<button class="new-run-card" data-action="new"><span>＋</span><strong>Another fresh perspective</strong><small>Set up a sample run</small></button></div>';
}
function websites(){
 return '<div class="site-grid">'+sites.map((site,index)=>'<button class="website-card" data-site="'+index+'"><span class="site-avatar '+site.color+'">'+site.mark+'</span><h2>'+site.name+'</h2><p>'+escapeHTML(site.url)+'</p><footer><span>'+runs.filter(run=>run.site===index).length+' sample runs</span><span>Open website workspace ↗</span></footer></button>').join('')+'</div>';
}

function journeyContent(){
 return '<div class="perspective-panel"><div class="view-switch" role="group" aria-label="Journey view">'+button('⌘ Overview','mode-overview','pill','aria-pressed="'+(state.mode==='overview')+'"')+button('◉ Live view','mode-live','pill','aria-pressed="'+(state.mode==='live')+'"')+'</div>'+personaShelf()+'</div>'+(state.mode==='live'?liveView():'<div class="journey-tools"><span>'+escapeHTML(sites[state.site].url)+' · Illustrative journey</span><div>'+button('All perspectives','clear','pill small')+button(state.onlyIssues?'Show all steps':'Issues only','filter','pill small','aria-pressed="'+state.onlyIssues+'"')+'</div></div>'+atlas());
}
function browserFrame(person,frame,thumbnail=false){
 const content=[
 '<div class="mock-hero"><small>A little space for your best work</small><h3>Good ideas.<br>Room to grow.</h3><p>A calm place to bring your projects together.</p><span class="mock-cta">Find your workspace ↗</span><div class="mock-shapes"><i></i><i></i><i></i></div></div>',
 '<div class="mock-pricing"><h3>A plan for your next chapter.</h3><div class="mock-plans"><section><small>Personal</small><strong>$12 <em>/ month</em></strong><p>Your projects, in one place.</p><span class="mock-cta">Choose Personal</span></section><section><small>Team</small><strong>$24 <em>/ month</em></strong><p>A little more room to collaborate.</p><span class="mock-cta">Choose Team</span></section></div></div>',
 '<div class="mock-form"><small>Make yourself at home</small><h3>Your next chapter<br>starts here.</h3><div class="mock-field"><small>Your name</small><span>'+people[person].name+'</span></div><div class="mock-field"><small>Email address</small><span>'+people[person].name.toLowerCase()+'@example.com</span></div><span class="mock-cta">Continue →</span><p>By continuing, you agree to the terms.</p></div>',
 '<div class="mock-project"><small>Your workspace</small><h3>A fresh start, '+people[person].name+'.</h3><p>What would you like to work on?</p><div class="mock-plans"><section><strong>＋</strong>Create a project</section><section><strong>↗</strong>Explore the guide</section></div></div>'
 ];
 return '<div class="browser-scene '+people[person].color+' frame-'+frame+(thumbnail?' thumbnail':'')+'" '+(thumbnail?'aria-hidden="true"':'role="img" aria-label="Simulated '+stages[frame]+' browser screen for '+people[person].name+'"')+'><div class="mock-nav"><b>forma.</b><span>Product &nbsp; Pricing &nbsp; About</span><i>Get started ↗</i></div>'+content[frame]+'<div class="demo-cursor cursor-'+frame+'"><span>➤</span><small>'+people[person].name+'</small></div></div>';
}
function liveView(){
 const person=state.person===null?0:state.person,frame=state.frames[person],profile=people[person],issue=issueAt(person,frame);
 return '<section class="transmission"><header class="transmission-header"><div><span class="emoji '+profile.color+'">'+profile.emoji+'</span><span><h2>'+profile.name+'’s experience</h2><small>'+profile.role+'</small></span></div><span class="transmission-status"><i></i>'+(state.playing?'Playing demo':'Paused demo')+'</span></header><div class="transmission-layout"><div class="screen-column"><div class="browser-window"><div class="browser-chrome"><span>● ● ●</span><span class="browser-address">▣ forma.example / '+['home','pricing','signup','workspace'][frame]+'</span><span>↗</span></div>'+browserFrame(person,frame)+'</div><div class="playback"><div>'+button(state.playing?'Ⅱ Pause':'▶ Play demo','play','pill small')+button('←','previous-frame','circle','aria-label="Previous moment" '+(frame===0?'disabled':''))+button('→','next-frame','circle','aria-label="Next moment" '+(frame===3?'disabled':''))+'</div><span class="frame-time">00:'+String(frame*12).padStart(2,'0')+' / 00:36</span>'+button('⊙ Capture moment','capture','pill small')+'</div><p class="feed-disclaimer">Simulated browser frames · Forma is fictional, not a live connection to '+escapeHTML(sites[state.site].url)+'. Playback is condensed.</p></div><aside class="activity-panel"><span class="eyebrow">Through their eyes</span><h3>'+actions[person][frame]+'</h3><p>'+profile.name+' is at the “'+stages[frame]+'” stage of this illustrative journey.</p><div class="activity-steps">'+stages.map((stage,index)=>'<button data-frame="'+index+'" aria-current="'+(frame===index?'step':'false')+'"><span class="activity-dot">'+(index<frame?'✓':String(index+1).padStart(2,'0'))+'</span><span><strong>'+stage+'</strong><small>'+actions[person][index]+'</small></span></button>').join('')+'</div>'+(issue>=0?'<button class="live-finding" data-finding="'+issue+'"><span class="tag">'+findings[issue].severity+' friction</span><strong>'+findings[issue].title+'</strong><small>Open sample evidence ↗</small></button>':'<div class="clear-moment">✓ No flagged issue at this moment.</div>')+'</aside></div><div class="captures-heading"><div><h3>Captured moments</h3><p>Select a still to revisit that point in the journey.</p></div><span>'+state.captures[person].length+' stills · '+profile.name+'</span></div><div class="capture-grid">'+state.captures[person].map(moment=>'<button class="capture-card '+(moment===frame?'current':'')+'" data-frame="'+moment+'" aria-label="View '+profile.name+' at '+stages[moment]+'" aria-pressed="'+(moment===frame)+'">'+browserFrame(person,moment,true)+'<span><strong>'+stages[moment]+'</strong><small>00:'+String(moment*12).padStart(2,'0')+'</small></span></button>').join('')+'</div><p class="capture-feedback" role="status">'+escapeHTML(state.captureMessage)+'</p></section>';
}
function changeFrame(frame){
 const person=state.person===null?0:state.person;
 state.frames[person]=Math.max(0,Math.min(3,frame));state.playing=false;state.captureMessage='';render();
}

function render(){
 if(state.view!=='journey'||state.mode!=='live')state.playing=false;
 document.body.dataset.design=state.concept+1;
 app.innerHTML='<div class="shell '+(state.collapsed?'collapsed':'')+'"><aside class="rail"><a class="wordmark" href="#'+(state.concept+1)+'" aria-label="Nori"><span>n.</span><strong>Nori</strong></a><button class="rail-toggle circle" data-action="collapse" aria-label="Toggle sidebar" aria-expanded="'+!state.collapsed+'">☰</button><nav aria-label="Workspace">'+[['home','Home'],['journey','Journeys'],['runs','Runs'],['sites','Websites']].map(([view,label])=>'<button data-action="'+view+'" title="'+label+'" class="rail-link '+(state.view===view?'active':'')+'" '+(state.view===view?'aria-current="page"':'')+'><span>'+icon(view)+'</span><strong>'+label+'</strong></button>').join('')+'</nav><div class="rail-sites"><span class="rail-label">YOUR WEBSITES</span>'+sites.map((site,index)=>'<button data-site="'+index+'" title="'+site.name+'" class="website-link '+(state.site===index?'chosen':'')+'"><span class="site-avatar '+site.color+'">'+site.mark+'</span><strong>'+site.name+'</strong></button>').join('')+'</div><div class="rail-bottom"><span class="avatar">Y</span><strong>Your workspace<small>Personal · Demo</small></strong></div></aside><main><header class="workspace-header"><span>'+sites[state.site].name+' <span class="muted">/ '+({home:'Overview',journey:'Customer journeys',runs:'Runs',sites:'Websites'}[state.view])+'</span></span><div><span class="sample-badge">Sample workspace</span>'+button('＋ New run','new','dark pill')+'</div></header><div class="page-heading"><div><p class="eyebrow">'+direction.desc+'</p><h1>'+({home:'A clearer picture.',journey:'Customer journeys',runs:'Your runs',sites:'Your websites'}[state.view])+'</h1><p>'+direction.note+'</p></div></div>'+
 (state.view==='journey'?journeyContent():state.view==='home'?overview():state.view==='runs'?runCards():websites())+'<footer class="page-footer"><span>All journeys and findings are fictional. No live agents.</span><span>Nori / A fresh perspective</span></footer></main></div><div class="floating-dock" aria-label="Quick actions">'+button('⌘','journey','circle','aria-label="Open journeys"')+button('▦','runs','circle','aria-label="Open runs"')+button('＋','new','circle accent','aria-label="Create a sample run"')+'</div>';
}
function show(content){state.playing=false;document.getElementById('dialog-body').innerHTML=content;if(!dialog.open)dialog.showModal();}
function showFinding(index){
 const finding=findings[index],person=people[finding.person];
 show('<span class="eyebrow">Fictional evidence / '+stages[finding.stage]+'</span><h2 id="dialog-title">'+finding.title+'</h2><div class="finding-person"><span class="emoji '+person.color+'">'+person.emoji+'</span><span>'+person.name+' · '+person.role+'</span><span class="tag">'+finding.severity+'</span></div><h3>What happened</h3><p>'+finding.evidence+'</p><div class="evidence-strip"><span>'+stages[Math.max(0,finding.stage-1)]+'</span> → <span class="flagged">'+stages[finding.stage]+' !</span> → <span>Pause</span></div><h3>A possible improvement</h3><p>'+finding.recommendation+'</p><p class="disclaimer">Illustrative finding, not a test result from your website.</p>');
}
function newRun(){
 show('<span class="eyebrow">Set up a design preview</span><h2 id="dialog-title">Where should we look?</h2><form id="new-run-form"><label for="run-url">Website URL</label><input id="run-url" name="url" placeholder="https://your-website.com" required><label>Choose perspectives</label><div class="persona-options">'+people.map((person,index)=>'<label class="'+person.color+'"><input type="checkbox" name="persona" value="'+index+'" checked><span>'+person.emoji+'</span>'+person.name+'</label>').join('')+'</div><p id="form-error" role="alert"></p><p class="disclaimer">Creates a local sample run only. No website is visited or tested.</p><button type="submit" class="dark pill">Create sample run →</button></form>');
}
document.addEventListener('click',event=>{
 const target=event.target.closest('button');if(!target)return;
 if(target.hasAttribute('data-close')){dialog.close();return;}
 if(target.dataset.concept!==undefined){state.concept=Number(target.dataset.concept);state.view=state.concept===4?'home':'journey';state.person=null;state.onlyIssues=false;history.replaceState(null,'','#'+(state.concept+1));render();document.querySelector('[data-concept="'+state.concept+'"]').focus();return;}
 if(target.dataset.person!==undefined){const person=Number(target.dataset.person);state.person=state.mode==='live'?person:(state.person===person?null:person);state.playing=false;state.captureMessage='';render();document.querySelector('[data-person="'+person+'"]').focus();return;}
 if(target.dataset.frame!==undefined){changeFrame(Number(target.dataset.frame));document.querySelector('.activity-steps [data-frame="'+Number(target.dataset.frame)+'"]')?.focus();return;}
 if(target.dataset.finding!==undefined){showFinding(Number(target.dataset.finding));return;}
 if(target.dataset.step!==undefined){const [person,stage]=target.dataset.step.split(',').map(Number);show('<span class="eyebrow">Sample journey / '+stages[stage]+'</span><h2 id="dialog-title">'+actions[person][stage]+'</h2><p>'+people[person].emoji+' '+people[person].name+' continued to the next step without a flagged issue in this fictional path.</p>');return;}
 if(target.dataset.site!==undefined){state.site=Number(target.dataset.site);state.view='runs';state.person=null;render();return;}
 if(target.dataset.run!==undefined){state.run=Number(target.dataset.run);const run=runs[state.run];state.site=run.site;if(run.pending){show('<span class="eyebrow">Sample setup saved</span><h2 id="dialog-title">Your run brief</h2><p>'+escapeHTML(run.url)+'</p><div class="library">'+run.personas.map(index=>'<div class="'+people[index].color+'"><span class="emoji">'+people[index].emoji+'</span><strong>'+people[index].name+'</strong><p>'+people[index].role+'</p></div>').join('')+'</div><p class="disclaimer">This is a setup preview only. No agents have run and no findings have been generated.</p>');return;}state.view='journey';state.person=null;render();return;}
 if(target.dataset.stage!==undefined){state.view='journey';state.onlyIssues=true;render();return;}
 const action=target.dataset.action;
 if(action==='mode-overview'||action==='mode-live'){state.mode=action==='mode-live'?'live':'overview';state.playing=false;state.captureMessage='';if(state.mode==='live'&&state.person===null)state.person=0;if(state.mode==='overview')state.person=null;render();document.querySelector('[data-action="'+action+'"]').focus();return;}
 if(action==='play'){const person=state.person===null?0:state.person;if(!state.playing&&state.frames[person]===3)state.frames[person]=0;state.playing=!state.playing;render();document.querySelector('[data-action="play"]').focus();return;}
 if(action==='previous-frame'||action==='next-frame'){changeFrame(state.frames[state.person===null?0:state.person]+(action==='next-frame'?1:-1));return;}
 if(action==='capture'){const person=state.person===null?0:state.person,frame=state.frames[person];if(!state.captures[person].includes(frame)){state.captures[person].push(frame);state.captures[person].sort();state.captureMessage='Moment saved for '+people[person].name+'.';}else state.captureMessage='This moment is already captured.';state.playing=false;render();document.querySelector('[data-action="capture"]').focus();return;}
 if(['home','journey','runs','sites'].includes(action)){state.view=action;render();}
 if(action==='collapse'){state.collapsed=!state.collapsed;document.querySelector('.shell').classList.toggle('collapsed',state.collapsed);target.setAttribute('aria-expanded',String(!state.collapsed));}
 if(action==='clear'){state.person=null;render();}
 if(action==='filter'){state.onlyIssues=!state.onlyIssues;render();document.querySelector('[data-action="filter"]').focus();}
 if(action==='new')newRun();
 if(action==='personas')show('<span class="eyebrow">Perspective library</span><h2 id="dialog-title">Four different ways of seeing.</h2><div class="library">'+people.map(person=>'<div class="'+person.color+'"><span class="emoji">'+person.emoji+'</span><strong>'+person.name+'</strong><p>'+person.role+'</p><small>✓ Attached to this sample journey</small></div>').join('')+'</div><p class="disclaimer">These are fictional AI personas. Customize your selection when creating a new sample run.</p>');
 if(action==='run-detail')show('<span class="eyebrow">Illustrative run</span><h2 id="dialog-title">First visit → first project</h2><p>Website: '+escapeHTML(sites[state.site].url)+'</p><p>4 perspectives · 16 steps · 6 flagged moments</p><p class="disclaimer">This is a reusable fictional onboarding journey for comparing interface designs, not results from the selected website.</p>');
 if(action==='findings')show('<span class="eyebrow">Fictional findings</span><h2 id="dialog-title">Moments worth a closer look.</h2>'+findings.map((finding,index)=>'<button class="finding-row" data-finding="'+index+'"><span>'+people[finding.person].emoji+'</span><strong>'+finding.title+'</strong><span>↗</span></button>').join(''));
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='new-run-form')return;event.preventDefault();
 const raw=event.target.elements.url.value.trim();
 let url;
 try{url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:'https://'+raw);if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error();}
 catch{document.getElementById('form-error').textContent='Enter a valid http or https website URL.';return;}
 const selected=[...event.target.querySelectorAll('input[name="persona"]:checked')];
 if(!selected.length){document.getElementById('form-error').textContent='Choose at least one perspective.';return;}
 let site=sites.findIndex(item=>item.url===url.hostname);
 if(site<0){sites.push({name:url.hostname,url:url.hostname,mark:url.hostname[0].toUpperCase(),color:'blue'});site=sites.length-1;}
 runs.unshift({title:'New perspective · Sample',site,date:'Just now',count:0,pending:true,url:url.href,personas:selected.map(input=>Number(input.value))});
 state.site=site;state.view='runs';dialog.close();render();document.getElementById('announcement').textContent='Sample run added. No website was tested.';
});
setInterval(()=>{
 if(!state.playing||state.view!=='journey'||state.mode!=='live'||dialog.open||document.hidden)return;
 const person=state.person===null?0:state.person;
 const focusAction=document.activeElement?.dataset?.action;
 if(state.frames[person]<3)state.frames[person]++;
 if(state.frames[person]===3)state.playing=false;
 render();
 if(focusAction==='play')document.querySelector('[data-action="play"]')?.focus({preventScroll:true});
},2400);
window.addEventListener('hashchange',()=>{history.replaceState(null,'','#1');});
render();
