// Document Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const docName = document.getElementById('doc-name');
const indexStatus = document.getElementById('index-status');

// Chat Elements
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatWindow = document.getElementById('chat-window');
const emptyState = document.getElementById('empty-state');
const themeToggle = document.getElementById('theme-toggle');

// Theme Controller
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const target = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', target);
  themeToggle.textContent = target === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('documind_theme', target);
});

const savedTheme = localStorage.getItem('documind_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

// File Upload Trigger
dropZone.addEventListener('click', () => {
  fileInput.click();
});

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--accent)';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.borderColor = '';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '';
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    fileInput.files = e.dataTransfer.files;
    uploadFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    uploadFile(e.target.files[0]);
  }
});

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  docName.textContent = file.name;
  indexStatus.textContent = 'Indexing document...';

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    indexStatus.textContent = `Indexed (${data.document.totalChunks} chunks)`;
  } catch (err) {
    indexStatus.textContent = 'Upload failed';
    alert(`Upload error: ${err.message}`);
  }
}

// Chat Query Handler
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  emptyState.style.display = 'none';
  appendMessage('user', question);
  chatInput.value = '';

  const loadingId = appendLoading();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    removeLoading(loadingId);

    if (!res.ok) throw new Error(data.error || 'Query failed');

    appendMessage('assistant', data.answer, data.sources);
  } catch (err) {
    removeLoading(loadingId);
    appendMessage('assistant', `⚠️ Error: ${err.message}`);
  }
});

function appendMessage(sender, text, sources = []) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}-message`;

  let parsedContent = text;
  if (sender === 'assistant' && typeof marked !== 'undefined') {
    parsedContent = marked.parse(text);
  } else {
    parsedContent = `<p>${text.replace(/\n/g, '<br>')}</p>`;
  }

  let sourceHtml = '';
  if (sources && sources.length > 0) {
    sourceHtml = `
      <div class="sources-box">
        <div class="sources-title">Relevant Sources</div>
        <ul>
          ${sources.map(s => `<li>Score: ${s.score.toFixed(2)} — <em>"${s.text.substring(0, 90).replace(/\n/g, ' ')}..."</em></li>`).join('')}
        </ul>
      </div>
    `;
  }

  msgDiv.innerHTML = `<div class="msg-content markdown-body">${parsedContent}</div>${sourceHtml}`;
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendLoading() {
  const id = 'loading-' + Date.now();
  const msgDiv = document.createElement('div');
  msgDiv.id = id;
  msgDiv.className = 'message assistant-message loading-indicator';
  msgDiv.textContent = 'DocuMind is analyzing...';
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return id;
}

function removeLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}