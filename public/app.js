let authToken = localStorage.getItem('documind_token') || null;

// Auth Elements
const authModal = document.getElementById('auth-modal');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const userDisplay = document.getElementById('user-display');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

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

let isRegisterMode = false;

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

// Auth Mode Switch
authToggleBtn.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? 'Create Account' : 'Welcome Back';
  authSubmit.textContent = isRegisterMode ? 'Sign Up' : 'Sign In';
  authToggleText.textContent = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
  authToggleBtn.textContent = isRegisterMode ? 'Sign In' : 'Register';
});

// Submit Login / Register
authSubmit.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }

  const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    authToken = data.token;
    localStorage.setItem('documind_token', authToken);
    userEmailSpan.textContent = data.email;
    authModal.style.display = 'none';
    userDisplay.style.display = 'flex';
  } catch (err) {
    alert(err.message);
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  authToken = null;
  localStorage.removeItem('documind_token');
  userDisplay.style.display = 'none';
  authModal.style.display = 'flex';
});

// Check Session on Start
async function checkAuth() {
  if (!authToken) {
    authModal.style.display = 'flex';
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      userEmailSpan.textContent = data.email;
      authModal.style.display = 'none';
      userDisplay.style.display = 'flex';
      if (data.document) {
        docName.textContent = data.document.filename;
        indexStatus.textContent = `Indexed (${data.document.totalChunks} chunks)`;
      }
    } else {
      authToken = null;
      localStorage.removeItem('documind_token');
      authModal.style.display = 'flex';
    }
  } catch {
    authModal.style.display = 'flex';
  }
}

// File Upload Trigger
dropZone.addEventListener('click', () => {
  if (!authToken) {
    authModal.style.display = 'flex';
    return;
  }
  fileInput.click();
});

// Drag and drop support
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
  if (!authToken) {
    authModal.style.display = 'flex';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  docName.textContent = file.name;
  indexStatus.textContent = 'Indexing document...';

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
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

  if (!authToken) {
    authModal.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  appendMessage('user', question);
  chatInput.value = '';

  const loadingId = appendLoading();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
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

  let sourceHtml = '';
  if (sources && sources.length > 0) {
    sourceHtml = `
      <div class="sources-box">
        <strong>Sources cited:</strong>
        <ul>
          ${sources.map(s => `<li>Similarity: ${(s.score * 100).toFixed(0)}% — "${s.text.substring(0, 90)}..."</li>`).join('')}
        </ul>
      </div>
    `;
  }

  msgDiv.innerHTML = `<div class="msg-content">${text.replace(/\n/g, '<br>')}</div>${sourceHtml}`;
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

checkAuth();