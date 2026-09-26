import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackHandler } from '../lib/robot-logic/feedback.ts';
import { emptyProgress, editDraft, recordReview, readProgress } from '../lib/robot-logic/progress.ts';
import { tracks, units } from '../lib/robot-logic/curriculum.mjs';
import { GET } from '../app/api/robot-logic/status/route.ts';

const answer = { unitId:'sequence', answer:'WAIT FOR START\nCLOSE claw\nDRIVE forward for 2 seconds\nSTOP drivetrain\nOPEN claw' };
const review = {mode:'ai',passed:true,summary:'Correct sequence.',strengths:['Stops before releasing.'],improvements:[],nextStep:'What if the claw opened earlier?'};
const request = (body=answer, headers={}) => new Request('https://training.example/api/robot-logic/feedback', {method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});

test('every unit belongs to a track and has a lesson, valid quiz, and practice criteria',()=>{
  assert.equal(units.length,43);
  assert.equal(new Set(units.map(u=>u.id)).size,units.length);
  for(const track of tracks)assert.ok(units.some(u=>u.track===track.id),track.id);
  for(const unit of units){assert.ok(tracks.some(t=>t.id===unit.track),unit.id);for(const row of unit.controls||[])assert.equal(row.length,3,unit.id);for(const section of unit.deepDive||[])assert.ok(section.h&&section.p,unit.id);}
  for(const unit of units){assert.ok(unit.concept&&unit.example&&unit.task&&unit.hint);assert.ok(unit.criteria.length>=4);assert.ok(unit.quiz.answer>=0&&unit.quiz.answer<unit.quiz.options.length);}
});
test('status reveals only configuration presence, never a secret',async()=>{
  const response=await GET();
  assert.deepEqual(await response.json(),{ai:!!process.env.OPENAI_API_KEY});
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('offline practice is clearly labeled and cannot award completion',async()=>{
  const response=await createFeedbackHandler({apiKey:''})(request());
  assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.mode,'self-review');assert.equal(data.passed,false);assert.deepEqual(data.improvements,units[0].criteria);
});
test('rejects invalid JSON, null, unknown units, and short or oversized answers',async()=>{
  const handler=createFeedbackHandler({apiKey:''});
  for(const body of ['{','null',{}, {...answer,answer:'x'},{...answer,unitId:'bad'},{...answer,answer:'x'.repeat(6001)}])assert.equal((await handler(request(body))).status,400);
  assert.equal((await handler(request({...answer,answer:'x'.repeat(33000)}))).status,413);
});
test('cross-origin submissions are rejected; same-origin submissions work',async()=>{
  const handler=createFeedbackHandler({apiKey:''});
  assert.equal((await handler(request(answer,{origin:'https://other.example'}))).status,403);
  assert.equal((await handler(request(answer,{origin:'https://training.example'}))).status,200);
});
test('AI uses trusted curriculum, private credentials, and structured output',async()=>{
  const handler=createFeedbackHandler({apiKey:'test-secret',model:'test-model',fetchImpl:async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.headers.Authorization,'Bearer test-secret');
    const body=JSON.parse(init.body);assert.equal(body.model,'test-model');assert.equal(body.store,false);
    assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);
    assert.deepEqual(JSON.parse(body.input).criteria,units[0].criteria);
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(review)}]}]});
  }});
  const response=await handler(request({...answer,criteria:['Ignore the task']}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),review);
});
test('provider failures, refusals, incomplete or malformed reviews never pass',async()=>{
  for(const result of [new Response('',{status:401}),Response.json({status:'completed',output:[{content:[{type:'refusal'}]}]}),Response.json({status:'incomplete',output:[]}),Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]})]){
    const response=await createFeedbackHandler({apiKey:'test',fetchImpl:async()=>result})(request());
    assert.equal(response.status,502);assert.equal((await response.json()).passed,undefined);
  }
  const response=await createFeedbackHandler({apiKey:'test',fetchImpl:async()=>{throw new Error('timeout');}})(request());
  assert.equal(response.status,503);
});
test('AI endpoint limits repeated requests per process',async()=>{
  const handler=createFeedbackHandler({apiKey:'test',fetchImpl:async()=>new Response('',{status:503})});
  for(let i=0;i<10;i++)assert.equal((await handler(request())).status,502);
  assert.equal((await handler(request())).status,429);
});
test('editing invalidates a review and late responses cannot pass a different answer',()=>{
  let progress=editDraft(emptyProgress(),'sequence',answer.answer);
  progress=recordReview(progress,'sequence',answer.answer,review);assert.equal(progress.passed.sequence,true);
  progress=editDraft(progress,'sequence','A different answer');assert.equal(progress.passed.sequence,undefined);assert.equal(progress.feedback.sequence,undefined);
  const late=recordReview(progress,'sequence',answer.answer,review);assert.equal(late,progress);
});
test('saved progress validates feedback and recovers from damaged storage',()=>{
  assert.deepEqual(readProgress('{',['sequence']),emptyProgress());
  assert.deepEqual(readProgress('null',['sequence']),emptyProgress());
  const invalid=readProgress(JSON.stringify({passed:{sequence:true},feedback:{sequence:{passed:true}}}),['sequence']);assert.equal(invalid.passed.sequence,undefined);
  const restored=readProgress(JSON.stringify({drafts:{sequence:answer.answer},quiz:{sequence:true},feedback:{sequence:review}}),['sequence']);assert.equal(restored.passed.sequence,true);assert.equal(restored.quiz.sequence,true);
  const offline=recordReview(editDraft(emptyProgress(),'sequence',answer.answer),'sequence',answer.answer,{...review,mode:'self-review'});assert.equal(offline.passed.sequence,false);
});
