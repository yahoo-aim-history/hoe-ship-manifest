const form = document.querySelector('#message-form');
const recipient = document.querySelector('#recipient');
const message = document.querySelector('#message');
const notice = document.querySelector('#notice');
const activity = [];

function updatePreview() {
  document.querySelector('#character-count').textContent = `${message.value.length.toLocaleString()} / 1,600`;
  const segments = message.value.length <= 160 ? 1 : Math.ceil(message.value.length / 153);
  document.querySelector('#segment-estimate').textContent = `${segments} segment${segments === 1 ? '' : 's'} est.`;
  document.querySelector('#message-preview').textContent = message.value || 'Your message preview appears here.';
  document.querySelector('#preview-contact').textContent = recipient.value.trim() || 'Unknown number';
}

function renderActivity() {
  const list = document.querySelector('#activity-list');
  document.querySelector('#activity-count').textContent = String(activity.length);
  list.replaceChildren();
  if (!activity.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const glyph = document.createElement('span');
    glyph.className = 'empty-mark';
    glyph.textContent = '↗';
    glyph.setAttribute('aria-hidden', 'true');
    const label = document.createElement('p');
    label.textContent = 'No messages sent this session.';
    empty.append(glyph, label);
    list.append(empty);
    return;
  }
  for (const item of activity) {
    const row = document.createElement('div');
    row.className = 'activity-item';
    const main = document.createElement('div');
    main.className = 'activity-main';
    const number = document.createElement('div');
    number.className = 'activity-number';
    number.textContent = item.to;
    const time = document.createElement('div');
    time.className = 'activity-time';
    time.textContent = item.time;
    const state = document.createElement('span');
    state.className = `activity-state${item.ok ? '' : ' failed'}`;
    state.textContent = item.ok ? 'Accepted' : 'Failed';
    main.append(number, time);
    row.append(main, state);
    list.append(row);
  }
}

async function checkProvider() {
  const badge = document.querySelector('#connection');
  const label = document.querySelector('#connection-label');
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    badge.dataset.state = data.configured ? 'ready' : 'offline';
    label.textContent = data.configured ? 'Provider ready' : 'Provider not configured';
  } catch {
    badge.dataset.state = 'offline';
    label.textContent = 'Server unavailable';
  }
}

recipient.addEventListener('input', updatePreview);
message.addEventListener('input', updatePreview);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  notice.hidden = true;
  const button = document.querySelector('#send-button');
  const buttonLabel = button.querySelector('.button-label');
  button.disabled = true;
  buttonLabel.textContent = 'Sending...';
  const payload = {
    to: recipient.value.trim(),
    message: message.value.trim(),
    consent: document.querySelector('#consent').checked,
  };
  let result;
  let ok = false;
  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    result = await response.json();
    ok = response.ok;
  } catch {
    result = { error: 'Could not reach the local SMS server.' };
  }

  activity.unshift({
    to: payload.to,
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()),
    ok,
  });
  activity.splice(5);
  renderActivity();
  notice.textContent = ok ? `Message accepted by your provider. Reference: ${result.sid}` : (result.error || 'Message could not be sent.');
  notice.dataset.state = ok ? 'success' : 'error';
  notice.hidden = false;
  if (ok) {
    message.value = '';
    updatePreview();
  }
  button.disabled = false;
  buttonLabel.textContent = 'Send message';
});

updatePreview();
renderActivity();
checkProvider();