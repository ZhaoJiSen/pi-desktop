import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
const root='/Users/zhaojisen/.nvm/versions/node/v24.18.0/lib/node_modules/@earendil-works/pi-coding-agent'
const dir=await mkdtemp(join(tmpdir(),'pi-desktop-capabilities-'))
const agent=join(dir,'agent'), project=join(dir,'project')
await Promise.all([mkdir(join(agent,'prompts'),{recursive:true}),mkdir(join(agent,'extensions'),{recursive:true}),mkdir(project),mkdir(join(dir,'home'))])
let child,seq=0,requests=[],events=[],pending=new Map(),stderr=''
const server=createServer(async(req,res)=>{
 let chunks=[];for await(const chunk of req)chunks.push(chunk)
 const body=JSON.parse(Buffer.concat(chunks).toString());requests.push(body)
 const lastUser=body.messages.findLast(m=>m.role==='user'&&!/PLAN_INSTRUCTIONS|HIDDEN_REVIEW_PROMPT/.test(JSON.stringify(m.content)))
 const text=JSON.stringify(lastUser?.content)
 const after=body.messages.at(-1)?.role==='tool'
 const bad=text.includes('ATTEMPT_WRITES')&&!after
 const delta=bad?{role:'assistant',tool_calls:[
  {index:0,id:'attempt-write-'+requests.length,type:'function',function:{name:'write',arguments:JSON.stringify({path:join(project,'forbidden.txt'),content:'should not exist'})}},
  {index:1,id:'attempt-bash-'+requests.length,type:'function',function:{name:'bash',arguments:JSON.stringify({command:'touch forbidden-bash.txt'})}},
  {index:2,id:'attempt-plugin-'+requests.length,type:'function',function:{name:'plugin_write',arguments:'{}'}}
 ]}:{role:'assistant',content:'Local verification response'}
 res.writeHead(200,{'Content-Type':'text/event-stream'})
 const base={id:'fixture',object:'chat.completion.chunk',created:0,model:'fixture'}
 res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n')
 res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:bad?'tool_calls':'stop'}],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}})+'\n\n')
 res.end('data: [DONE]\n\n')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
await writeFile(join(agent,'models.json'),JSON.stringify({providers:{'fixture-local':{baseUrl:`http://127.0.0.1:${server.address().port}/v1`,api:'openai-completions',apiKey:'fixture-only',models:[{id:'fixture',contextWindow:100000,maxTokens:1024}]}}}))
await writeFile(join(agent,'settings.json'),JSON.stringify({compaction:{enabled:false},retry:{enabled:false}}))
await writeFile(join(agent,'prompts','review-loop.md'),'---\ndescription: Loop fixture\n---\nREVIEW_LOOP_INSTRUCTIONS $@\n')
await writeFile(join(agent,'extensions','plugin.mjs'),`import { writeFileSync } from 'node:fs';export default pi=>{let active=0;pi.events.on('subagents:rpc:v1:request',r=>pi.events.emit('subagents:rpc:v1:reply:'+r.requestId,{success:true,data:{fleet:{totalActive:active}}}));pi.registerCommand('bg-on',{handler:()=>active=1});pi.registerCommand('bg-off',{handler:()=>active=0});pi.registerTool({name:'subagent',label:'Subagent fixture',description:'Fixture dependency',parameters:{type:'object',properties:{}},execute:async()=>({content:[]})});pi.registerTool({name:'plugin_write',label:'Plugin write',description:'Fixture write tool',parameters:{type:'object',properties:{}},execute:async()=>{writeFileSync(${JSON.stringify(join(project,'forbidden-plugin.txt'))},'bad');return {content:[{type:'text',text:'wrote'}]}}});pi.registerCommand('consume',{description:'Consume fixture',handler:()=>pi.appendEntry('consumed',{})})}`)
const cli=join(root,'dist/cli.js')
function start(session){
 child=spawn(process.execPath,[cli,'--mode','rpc','--offline','--no-context-files','--extension',resolve('src-tauri/bridge/desktop-bridge.mjs'),'--extension',join(agent,'extensions','plugin.mjs'),'--provider','fixture-local','--model','fixture',...(session?['--session',session]:[])],{cwd:project,env:{PATH:process.env.PATH,HOME:join(dir,'home'),PI_CODING_AGENT_DIR:agent,PI_OFFLINE:'1'},stdio:'pipe'})
 child.stderr.on('data',x=>stderr+=x)
 createInterface({input:child.stdout}).on('line',line=>{let e;try{e=JSON.parse(line)}catch{return}if(e.type==='extension_ui_request'&&e.method==='notify'){try{const decoded=JSON.parse(e.message);if(decoded.protocol==='pi-desktop-bridge-v1')e=decoded}catch{}}if(e.type==='response'){const p=pending.get(e.id);if(p){pending.delete(e.id);clearTimeout(p.timer);e.success?p.resolve(e.data):p.reject(new Error(e.error))}}else events.push(e)})
}
function rpc(command){const id='verify-'+(++seq);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('timeout '+JSON.stringify(command)+' '+stderr))},12000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,...command})+'\n')})}
function bridge(call){const id='bridge-'+(++seq);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('bridge timeout '+JSON.stringify(call)+' '+stderr))},12000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id:'transport-'+id,type:'prompt',message:'/desktop-bridge '+JSON.stringify({...call,id,version:1})})+'\n')})}
async function settle(after){const deadline=Date.now()+12000;while(Date.now()<deadline){if(events.slice(after).some(e=>e.type==='agent_settled'))return;await new Promise(r=>setTimeout(r,15))}throw new Error('not settled '+stderr)}
async function stop(){if(!child)return;const c=child;await new Promise(r=>{c.once('exit',r);c.kill()});child=null}
const output=[]
try{
 start();const commands=await rpc({type:'get_commands'});assert(commands.commands.some(c=>c.name==='desktop-bridge'))
 const loop=commands.commands.find(c=>c.name==='review-loop'),consume=commands.commands.find(c=>c.name==='consume');assert(loop&&consume,JSON.stringify({commands,stderr}))
 let s=await bridge({op:'status'});assert.equal(s.version,1);assert(s.tools.includes('write'))
 const plan={id:'builtin:plan',builtin:'plan',name:'Plan',scope:'session',prompt:'PLAN_INSTRUCTIONS',enabled:true,modifies:false}
 await rpc({type:'prompt',message:'/bg-on'});await assert.rejects(bridge({op:'mode',mode:plan}),/capability.busy/);await rpc({type:'prompt',message:'/bg-off'});
 s=await bridge({op:'mode',mode:plan});assert.equal(s.plan,true);assert(s.tools.length>0);assert(s.tools.every(t=>['read','grep','find','ls'].includes(t)))
 s=await bridge({op:'mode',mode:{...plan,builtin:undefined,id:'copied-plan',readOnly:true}});assert(s.plan);assert(s.tools.every(t=>['read','grep','find','ls'].includes(t)));await bridge({op:'mode',mode:plan});
 let mark=events.length
 await bridge({op:'prepare',submission:{id:'plan-test',body:'ATTEMPT_WRITES',mode:plan}})
 await rpc({type:'prompt',message:'ATTEMPT_WRITES'});await settle(mark)
 s=await bridge({op:'status'});assert.equal(s.receipts.find(r=>r.id==='plan-test')?.body,'ATTEMPT_WRITES');assert.equal(typeof s.receipts[0].sourceTimestamp,'number')
 assert(events.slice(mark).some(e=>e.type==='tool_execution_end'),'model attempted tool execution');assert(!events.slice(mark).some(e=>e.type==='message_end'&&e.message?.stopReason==='error'),'model request succeeded');
 for(const f of ['forbidden.txt','forbidden-bash.txt','forbidden-plugin.txt'])assert.equal(await readFile(join(project,f)).then(()=>true,()=>false),false)
 assert(requests.at(-1).messages.some(m=>JSON.stringify(m.content).includes('PLAN_INSTRUCTIONS')))
 await assert.rejects(bridge({op:'prepare',submission:{id:'conflict',body:'test',mode:plan,task:{modifies:true}}}),/planConflict/)
 await assert.rejects(bridge({op:'prepare',submission:{id:'command-conflict',body:'/consume',mode:plan}}),/planConflict/)
 const file=(await rpc({type:'get_state'})).sessionFile
 await stop();start(file);await rpc({type:'get_state'});s=await bridge({op:'status'});assert(s.plan);assert(s.tools.every(t=>['read','grep','find','ls'].includes(t)))
 await rpc({type:'new_session'});s=await bridge({op:'status'});assert.equal(s.plan,false);assert.equal(s.receipts.length,0);assert(s.tools.includes('write'),'new session restores write tools')
 await rpc({type:'switch_session',sessionPath:file});s=await bridge({op:'status'});assert(s.plan)
 s=await bridge({op:'mode',mode:null});assert.equal(s.plan,false);assert(s.tools.includes('write'));assert(s.tools.includes('plugin_write'))
 const task={id:'review',scope:'once',prompt:'HIDDEN_REVIEW_PROMPT',modifies:false}
 mark=events.length;await bridge({op:'prepare',submission:{id:'review-test',body:'visible question',task}})
 await rpc({type:'prompt',message:'visible question'});await settle(mark);await bridge({op:'finish',requestId:'review-test'})
 const msgs=(await rpc({type:'get_messages'})).messages
 assert(msgs.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('visible question')))
 assert(msgs.some(m=>m.role==='custom'&&m.customType==='pi-desktop-context-v1'&&m.display===false&&m.content==='HIDDEN_REVIEW_PROMPT'))
 const count=requests.length;const duplicate=await bridge({op:'prepare',submission:{id:'review-test',body:'visible question',task}});assert(duplicate.accepted);assert.equal(requests.length,count)
 mark=events.length;await rpc({type:'prompt',message:'ordinary follow-up'});await settle(mark);assert(!JSON.stringify(requests.at(-1)).includes('HIDDEN_REVIEW_PROMPT'))
 const target={name:'review-loop',source:loop.source,origin:loop.sourceInfo.path}
 mark=events.length;await bridge({op:'prepare',submission:{id:'loop-test',body:'visible loop request',task:{target,modifies:true}}});await rpc({type:'prompt',message:'/review-loop visible loop request'});await settle(mark)
 s=await bridge({op:'status'});assert(s.receipts.some(r=>r.id==='loop-test'&&r.sourceTimestamp))
 await assert.rejects(bridge({op:'prepare',submission:{id:'missing',body:'x',task:{target:{...target,origin:'/wrong/path'}}}}),/unavailable/)
 await bridge({op:'prepare',submission:{id:'consume-test',body:'visible extension request',task:{target:{name:'consume',source:consume.source,origin:consume.sourceInfo.path}}}})
 await rpc({type:'prompt',message:'/consume value'});s=await bridge({op:'finish',requestId:'consume-test'});assert(s.receipts.some(r=>r.id==='consume-test'&&r.userIndex===undefined))
 output.push({passed:true,version:JSON.parse(await readFile(join(root,'package.json'))).version,modelRequests:requests.length,receipts:s.receipts.length,cases:['plan tool blocking','plugin blocking','resume','new session','switch back','restore tools','hidden context','once context cleanup','request deduplication','native template expansion','origin validation','consumed command receipt']})
 process.stdout.write(JSON.stringify(output,null,2)+'\n')
}catch(e){console.error(e);console.error(stderr);process.exitCode=1}finally{await stop();server.close();await rm(dir,{recursive:true,force:true})}
