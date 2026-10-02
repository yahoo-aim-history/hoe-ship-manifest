import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import twilio from 'twilio';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(appDirectory, 'public');
const port = Number(process.env.PORT || 3000);
const publicFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};
let smsClient;

function sendJson(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getSmsClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return null;
  smsClient ??= twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return smsClient;
}

async function handleSend(request, response) {
  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    sendJson(response, error.message === 'Request body is too large.' ? 413 : 400, { error: error.message });
    return;
  }

  const body = payload && typeof payload === 'object' ? payload : {};
  const recipient = typeof body.to === 'string' ? body.to.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!/^\+[1-9]\d{7,14}$/.test(recipient)) {
    sendJson(response, 400, { error: 'Enter a valid international number, such as +14155550123.' });
    return;
  }
  if (!message || message.length > 1600) {
    sendJson(response, 400, { error: 'Message must contain 1 to 1,600 characters.' });
    return;
  }
  if (body.consent !== true) {
    sendJson(response, 400, { error: 'Confirm that the recipient has agreed to receive this message.' });
    return;
  }

  const client = getSmsClient();
  if (!client) {
    sendJson(response, 503, { error: 'SMS provider is not configured. Add the Twilio settings to .env.' });
    return;
  }
  try {
    const result = await client.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to: recipient });
    sendJson(response, 201, { sid: result.sid, status: result.status });
  } catch (error) {
    console.error('Twilio send failed:', error.code || error.message);
    sendJson(response, 502, { error: 'Twilio could not send this message. Check your account and number configuration.' });
  }
}

const server = createServer(async (request, response) => {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-frame-options', 'DENY');
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { configured: Boolean(getSmsClient()) });
    return;
  }
  if (url.pathname === '/api/messages' && request.method === 'POST') {
    await handleSend(request, response);
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found.' });
    return;
  }
  const file = publicFiles[url.pathname];
  if (!file || request.method !== 'GET') {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const content = await readFile(path.join(publicDirectory, file[0]));
    response.writeHead(200, {
      'content-type': file[1],
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Hoe Ship Manifest SMS Desk listening on http://127.0.0.1:${port}`);
});