const http = require('node:http');
const { spawn } = require('node:child_process');
const electron = require('electron');

const debuggingPort = 9333;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getDebugTarget(child, getMainErrors) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${debuggingPort}/json/list`, (response) => {
          let body = '';
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch {
      // Electron has not opened its debugging endpoint yet.
    }
    if (child.exitCode !== null) {
      throw new Error(`Electron exited before opening a renderer page (code ${child.exitCode}): ${getMainErrors()}`);
    }
    await delay(250);
  }
  throw new Error('Electron debugging endpoint did not expose a renderer page.');
}

async function evaluate(webSocketUrl, expression) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const replies = new Map();
  const consoleErrors = [];

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(message.params.exceptionDetails.text);
    }
    if (message.id) {
      const reply = replies.get(message.id);
      if (reply) {
        replies.delete(message.id);
        reply(message);
      }
    }
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    replies.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });

  await command('Runtime.enable');
  const result = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  socket.close();
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return { value: result.result.value, consoleErrors };
}

async function run() {
  const environment = { ...process.env, CUPAW_SMOKE: '1' };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, ['.'], {
    cwd: process.cwd(),
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let mainErrors = '';
  child.stderr.on('data', (chunk) => { mainErrors += chunk; });

  try {
    const target = await getDebugTarget(child, () => mainErrors);
    const { value, consoleErrors } = await evaluate(target.webSocketDebuggerUrl, `
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!window.cupaw) throw new Error('window.cupaw is unavailable');
        const input = document.querySelector('#message-input');
        const form = document.querySelector('#chat-form');
        input.value = 'مرحبا';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const reply = document.querySelector('.message.assistant p');
          if (reply) {
            return {
              projectName: document.querySelector('#project-name').textContent,
              projectRoot: document.querySelector('#project-root').textContent,
              fileCount: document.querySelector('#project-files').textContent,
              response: reply.textContent,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error('No runtime response appeared in the chat UI');
      })()
    `);
    if (value.projectName === 'Workspace unavailable') throw new Error('Workspace did not load');
    if (!value.response) throw new Error('Chat response is empty');
    if (consoleErrors.length) throw new Error(`Renderer console errors: ${consoleErrors.join('; ')}`);
    console.log(`Desktop smoke passed: ${value.projectName} (${value.fileCount} files), response: ${value.response}`);
  } finally {
    child.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
