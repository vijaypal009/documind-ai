document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const uploadBtn = document.getElementById('uploadBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const contextPanel = document.getElementById('contextPanel');
  const metaFilename = document.getElementById('metaFilename');
  const metaChunks = document.getElementById('metaChunks');
  const metaTime = document.getElementById('metaTime');
  const activeDocTag = document.getElementById('activeDocTag');
  const chatContainer = document.getElementById('chatContainer');
  const emptyState = document.getElementById('emptyState');
  const queryForm = document.getElementById('queryForm');
  const queryInput = document.getElementById('queryInput');
  const queryBtn = document.getElementById('queryBtn');

  // Theme Toggle Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');

  // Load Saved Theme
  const savedTheme = localStorage.getItem('documind_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    if (themeIcon) themeIcon.textContent = '🌙';
    if (themeLabel) themeLabel.textContent = 'Dark Mode';
  }

  // Handle Theme Toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      if (isLight) {
        themeIcon.textContent = '🌙';
        themeLabel.textContent = 'Dark Mode';
        localStorage.setItem('documind_theme', 'light');
      } else {
        themeIcon.textContent = '☀️';
        themeLabel.textContent = 'Light Mode';
        localStorage.setItem('documind_theme', 'dark');
      }
    });
  }

  let selectedFile = null;

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        if (fileNameDisplay) fileNameDisplay.textContent = selectedFile.name;
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.classList.remove('btn-secondary');
          uploadBtn.classList.add('btn-primary');
        }
      }
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Indexing...';

      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Indexing failed');
        }

        // 1. Clear previous conversation and history
        if (chatContainer) {
          chatContainer.innerHTML = '';
        }

        // 2. Update status & metadata
        if (statusIndicator) statusIndicator.classList.add('active');
        if (statusText) statusText.textContent = 'Index Active';

        if (contextPanel) contextPanel.style.display = 'block';
        if (metaFilename) metaFilename.textContent = data.document.filename;
        if (metaChunks) metaChunks.textContent = data.document.totalChunks;
        if (metaTime) metaTime.textContent = new Date(data.document.uploadedAt).toLocaleTimeString();

        if (activeDocTag) activeDocTag.textContent = data.document.filename;

        // 3. Add a fresh indexed notification banner in console
        const readyNotice = document.createElement('div');
        readyNotice.className = 'empty-state';
        readyNotice.style.margin = '20px auto';
        readyNotice.innerHTML = `<span style="color: var(--accent-color); font-weight: 600;">✓ ${data.document.filename}</span> indexed successfully (${data.document.totalChunks} chunks). Ask any question below.`;
        chatContainer.appendChild(readyNotice);

        // 4. Ready query input
        if (queryInput) {
          queryInput.disabled = false;
          queryInput.value = '';
          queryInput.focus();
        }
        if (queryBtn) queryBtn.disabled = false;

      } catch (err) {
        alert(`Upload error: ${err.message}`);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Index Document';
      }
    });
  }

  if (queryForm) {
    queryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = queryInput.value.trim();
      if (!question) return;

      // Remove the initial ready notice if it exists
      const initialNotice = chatContainer.querySelector('.empty-state');
      if (initialNotice) {
        initialNotice.remove();
      }

      queryInput.value = '';
      queryInput.disabled = true;
      queryBtn.disabled = true;

      const entry = document.createElement('div');
      entry.className = 'query-entry';

      const qEl = document.createElement('div');
      qEl.className = 'query-display';
      qEl.innerHTML = `<strong>Q: ${question}</strong>`;

      const aEl = document.createElement('div');
      aEl.className = 'response-display';
      aEl.innerHTML = '<em>Analyzing document...</em>';

      entry.appendChild(qEl);
      entry.appendChild(aEl);
      chatContainer.appendChild(entry);
      chatContainer.scrollTop = chatContainer.scrollHeight;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to get answer');
        }

        aEl.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.answer) : data.answer;

        if (data.sources && data.sources.length > 0) {
          const sourcesContainer = document.createElement('div');
          sourcesContainer.className = 'grounding-box';
          sourcesContainer.innerHTML = '<div class="grounding-title">GROUNDING SOURCES:</div>';

          data.sources.forEach((source, index) => {
            const item = document.createElement('div');
            item.className = 'source-node';
            item.textContent = `#${index + 1} (Score: ${Number(source.score).toFixed(3)}): "${source.text.substring(0, 180)}..."`;
            sourcesContainer.appendChild(item);
          });

          entry.appendChild(sourcesContainer);
        }
      } catch (err) {
        aEl.innerHTML = `<span style="color: #ef4444;">Error: ${err.message}</span>`;
      } finally {
        queryInput.disabled = false;
        queryBtn.disabled = false;
        queryInput.focus();
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });
  }
});