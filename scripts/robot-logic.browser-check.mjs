// Local browser smoke test. Requires Chrome and a running training site.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { units } from '../lib/robot-logic/curriculum.mjs';

const origin = process.env.ROBOT_LOGIC_TEST_ORIGIN || 'http://localhost:3000';
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'robot-logic-smoke-'));
const child = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); }
  }
  assert.ok(port, 'Chrome must start with debugging enabled');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const requests = new Map(); let id = 0;
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    const request = requests.get(message.id);
    if (request) { requests.delete(message.id); if (message.error) request.reject(message.error); else request.resolve(message.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; requests.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(200); } throw new Error(`Timed out: ${expression}\n${await evaluate('JSON.stringify({hash:location.hash,text:document.body.innerText.slice(-2500)})')}`); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/robot-logic' });
  await waitFor(`document.querySelectorAll(".unit-card").length === ${units.length}`);
  await evaluate('document.querySelector(".unit-card").click()');
  await waitFor('!!document.querySelector("#robot-answer")');
  await evaluate('document.querySelector(".quiz-options button").click()');
  assert.equal(await evaluate('document.querySelector(".quiz-options").nextElementSibling.textContent.includes("Correct")'), true);
  const draft = 'WAIT FOR START\nCLOSE claw\nDRIVE forward for 2 seconds\nSTOP drivetrain\nOPEN claw';
  await evaluate(`(() => { const el=document.querySelector('#robot-answer'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(draft)});el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await waitFor('JSON.parse(localStorage.getItem("robot-logic-v1")).drafts.sequence?.includes("WAIT FOR START")');
  await send('Page.reload');
  await waitFor('!!document.querySelector("#robot-answer")');
  assert.equal(await evaluate('document.querySelector("#robot-answer").value'), draft);
  assert.equal(await evaluate('document.querySelector(".quiz-options").nextElementSibling.textContent.includes("Correct")'), true);
  // Stub the browser request, keeping smoke tests repeatable and non-billable.
  await evaluate(`window.fetch=async()=>new Response(JSON.stringify({mode:'ai',passed:true,summary:'Correct.',strengths:['Clear sequence.'],improvements:[],nextStep:'Try another unit.'}),{status:200,headers:{'Content-Type':'application/json'}})`);
  await waitFor('!document.querySelector(".practice button").disabled');
  await evaluate('document.querySelector(".practice button").click()');
  await waitFor('!!document.querySelector(".feedback.success")');
  await evaluate('document.querySelector(".back").click()');
  await waitFor('!!document.querySelector("progress")');
  assert.equal(await evaluate('document.querySelector("progress").value'), 1);
  await evaluate('document.querySelectorAll(".filters button")[2].click()');
  assert.equal(await evaluate('document.querySelectorAll(".unit-card").length'), 1);
  await evaluate('document.querySelector(".unit-card").click()');
  await waitFor('!!document.querySelector("#robot-answer")');
  await evaluate(`(() => {const el=document.querySelector('#robot-answer');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Revised draft');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor('!document.querySelector(".feedback")');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("robot-logic-v1")).passed.sequence === undefined'), true);
  await evaluate('document.querySelector("a[href=\"#glossary\"]").click()');
  await waitFor('document.querySelectorAll(".reference-grid .paper").length===12');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await evaluate('document.querySelector(".back").click()');
  await waitFor('!!document.querySelector(".filters")');
  await evaluate('document.querySelector(".filters button").click()');
  await waitFor(`document.querySelectorAll(".unit-card").length===${units.length}`);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  if (process.env.ROBOT_LOGIC_SCREENSHOT) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(process.env.ROBOT_LOGIC_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
  }
  assert.deepEqual(errors, []);
  console.log(`Browser checks passed: ${units.length} units, quiz, saved draft after reload, feedback, completion, edit invalidation, glossary, mobile overflow, and no uncaught exceptions.`);
} finally {
  socket?.close(); child.kill();
}
