const projectName = document.querySelector('#project-name');
const projectRoot = document.querySelector('#project-root');
const projectFiles = document.querySelector('#project-files');
const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const messages = document.querySelector('#messages');
const sendButton = document.querySelector('#send-button');

function addMessage(kind, label, content) {
  const article = document.createElement('article');
  article.className = `message ${kind}`;
  const title = document.createElement('span');
  title.textContent = label;
  const paragraph = document.createElement('p');
  paragraph.textContent = content;
  article.append(title, paragraph);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

async function loadWorkspace() {
  try {
    const workspace = await window.cupaw.getWorkspace();
    projectName.textContent = workspace.name;
    projectRoot.textContent = workspace.root;
    projectFiles.textContent = String(workspace.fileCount);
  } catch (error) {
    projectName.textContent = 'Workspace unavailable';
    projectRoot.textContent = error instanceof Error ? error.message : 'Unknown error';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) return;

  addMessage('user', 'You', content);
  input.value = '';
  input.disabled = true;
  sendButton.disabled = true;

  try {
    const response = await window.cupaw.sendMessage(content);
    addMessage('assistant', 'Cupaw', response.content);
  } catch (error) {
    addMessage('assistant error', 'Cupaw', error instanceof Error ? error.message : 'Unable to reach the runtime.');
  } finally {
    input.disabled = false;
    sendButton.disabled = false;
    input.focus();
  }
});

void loadWorkspace();
