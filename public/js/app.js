const form = document.getElementById('transcriberForm');
const phraseEl = document.getElementById('phrase');
const outputEl = document.getElementById('output');
const outputList = document.getElementById('outputList');
const notesToggle = document.getElementById('notesToggle');
const tooltip = document.getElementById('wordTooltip');
const API_BASE_URL = window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:8000"
      :  `${window.location.origin}/phonetic-transcriber/proxy`;

let showNotes = false;
let lastResponseData = null;
let lastInputText = '';
let activeTooltipIndex = null;

function updateToggleLabels() {
  notesToggle.textContent = showNotes ? 'Ocultar notas' : 'Mostrar notas';
}

notesToggle.addEventListener('click', () => {
  showNotes = !showNotes;
  updateToggleLabels();
  if (lastResponseData) {
    renderTranscriptionResult(lastResponseData, lastInputText);
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.sentence-word') && !event.target.closest('.tooltip')) {
    hideTooltip();
  }
});

outputList.addEventListener('click', (event) => {
  const target = event.target.closest('.sentence-word');
  if (!target || !lastResponseData) return;
  const index = Number(target.dataset.tokenIndex);
  const tokens = getTokens(lastResponseData);
  const token = tokens[index];
  if (!token) return;

  if (tooltip.classList.contains('show') && activeTooltipIndex === index) {
    hideTooltip();
    return;
  }

  activeTooltipIndex = index;
  showTooltip(token, target);
});

updateToggleLabels();

function tokenDisplay(token) {
  const useFlatDisplay = !showNotes;
  const primaryKey = useFlatDisplay ? 'flat_display' : 'display';
  const primaryValue = token[primaryKey];
  if (primaryValue != null && primaryValue !== '') {
    return primaryValue;
  }
  return (useFlatDisplay ? token.display : token.flat_display) ?? token.word ?? '';
}

function formatListItem(token) {
  const wordValue = token.word ?? '';
  const titleHtml = wordValue ? `<div class="result-token">${wordValue}</div>` : '';
  const displayValue = tokenDisplay(token);
  const ipaValue = Array.isArray(token.ipa)
    ? token.ipa.join(', ')
    : token.ipa ?? '-';

  let notesHtml = '';
  if (showNotes && token.notes) {
    const notes = Array.isArray(token.notes)
      ? token.notes
      : typeof token.notes === 'object'
      ? Object.entries(token.notes)
      : [['', token.notes]];
    const noteItems = notes.map(note =>
      Array.isArray(note)
        ? `<li><strong>${note[0]}:</strong> ${note[1]}</li>`
        : `<li>${note}</li>`
    ).join('');
    notesHtml = `
      <div class="result-notes">
        <strong>Notas:</strong>
        <ul>${noteItems}</ul>
      </div>
    `;
  }

  const useFlatDisplay = !showNotes;
  let alternativesHtml = '';
  if (Array.isArray(token.alternatives) && token.alternatives.length > 0) {
    const alternativeItems = token.alternatives.map((alt) => {
      const altDisplayValue = useFlatDisplay
        ? alt.flat_display ?? alt.display ?? alt.word ?? ''
        : alt.display ?? alt.flat_display ?? alt.word ?? '';
      const altIpa = Array.isArray(alt.ipa) ? alt.ipa.join(', ') : alt.ipa ?? '';
      const ipaText = altIpa ? ` <span class="alt-ipa">(${altIpa})</span>` : '';
      return `<li>${altDisplayValue}${ipaText}</li>`;
    }).join('');
    alternativesHtml = `
      <div class="result-alternatives">
        <strong>Alternativas:</strong>
        <ul>${alternativeItems}</ul>
      </div>
    `;
  }

  const displayHtml = `<div class="result-value">${displayValue || '-'}</div>`;

  if (token.found === false) {
    return `
      <li class="result-item">
        ${titleHtml}
        ${displayHtml}
        ${alternativesHtml}
        ${notesHtml}
      </li>
    `;
  }

  return `
    <li class="result-item">
      ${titleHtml}
      ${displayHtml}
      <div class="result-meta">
        <span><strong>IPA:</strong> ${ipaValue}</span>
      </div>
      ${alternativesHtml}
      ${notesHtml}
    </li>
  `;
}

function getTokens(data) {
  let tokens = [];
  if (Array.isArray(data.token_transcriptions)) {
    tokens = data.token_transcriptions;
  } else if (Array.isArray(data.transcriptions)) {
    tokens = data.transcriptions;
  } else if (Array.isArray(data.transcription)) {
    tokens = data.transcription;
  }
  return tokens.filter((token) => token?.type === 'word');
}

function renderTokenSentence(data, text) {
  const tokens = getTokens(data);
  const words = text.split(/(\s+)/);
  let tokenIndex = 0;

  outputEl.textContent = 'Haz clic en una palabra para ver los detalles.';

  const sentenceHtml = words
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) {
        return chunk;
      }
      const token = tokens[tokenIndex];
      const tokenText = escapeHtml(
        token && token.type === 'word' ? tokenDisplay(token) : chunk
      );
      const isClickable = token && token.type === 'word' && token.found !== false;
      const isNotFound = token && token.type === 'word' && token.found === false;
      const classes = ['sentence-word'];
      if (!isClickable) classes.push('no-link');
      if (isNotFound) classes.push('not-found');
      const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
      const html = isClickable
        ? `<span${classAttr} data-token-index="${tokenIndex}">${tokenText}</span>`
        : `<span${classAttr}>${tokenText}</span>`;
      if (token && token.type === 'word') {
        tokenIndex += 1;
      }
      return html;
    })
    .join('');

  let outputHtml = `<li class="result-item sentence-text">${sentenceHtml}</li>`;

  if (showNotes && data.notes) {
    const notes = Array.isArray(data.notes)
      ? data.notes
      : typeof data.notes === 'object'
      ? Object.entries(data.notes)
      : [['', data.notes]];
    const noteItems = notes.map(note =>
      Array.isArray(note)
        ? `<li><strong>${note[0]}:</strong> ${note[1]}</li>`
        : `<li>${note}</li>`
    ).join('');
    outputHtml += `
      <li class="result-item result-notes-summary">
        <strong>Notas:</strong>
        <ul>${noteItems}</ul>
      </li>
    `;
  }

  outputList.innerHTML = outputHtml;
}

function renderTranscriptionResult(data, text = '') {
  const tokens = getTokens(data);
  if (!tokens.length) {
    outputEl.textContent = 'No token transcription data found. Raw response:';
    const rawItem = document.createElement('li');
    rawItem.className = 'result-item';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    rawItem.appendChild(pre);
    outputList.innerHTML = '';
    outputList.appendChild(rawItem);
    return;
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 1) {
    renderTokenSentence(data, text);
    return;
  }

  outputEl.textContent = 'Transcripciones:';
  let outputHtml = tokens.map(formatListItem).join('');

  if (showNotes && data.notes) {
    const notes = Array.isArray(data.notes)
      ? data.notes
      : typeof data.notes === 'object'
      ? Object.entries(data.notes)
      : [['', data.notes]];
    const noteItems = notes.map(note =>
      Array.isArray(note)
        ? `<li><strong>${note[0]}:</strong> ${note[1]}</li>`
        : `<li>${note}</li>`
    ).join('');
    outputHtml += `
      <li class="result-item result-notes-summary">
        <strong>Notas:</strong>
        <ul>${noteItems}</ul>
      </li>
    `;
  }

  outputList.innerHTML = outputHtml;
}

function showTooltip(token, target) {
  tooltip.innerHTML = formatTooltipContent(token);
  tooltip.style.visibility = 'hidden';
  tooltip.classList.add('show');
  tooltip.setAttribute('aria-hidden', 'false');

  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const left = rect.left + window.scrollX;
  const top = rect.bottom + window.scrollY + 8;

  tooltip.style.left = `${Math.min(left, window.scrollX + window.innerWidth - tooltipRect.width - 12)}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.visibility = 'visible';
}

function hideTooltip() {
  tooltip.classList.remove('show');
  tooltip.setAttribute('aria-hidden', 'true');
  activeTooltipIndex = null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTooltipContent(token) {
  const wordValue = token.word ?? '';
  const displayValue = tokenDisplay(token);
  const ipaValue = Array.isArray(token.ipa)
    ? token.ipa.join(', ')
    : token.ipa ?? '-';

  const alternativesHtml = Array.isArray(token.alternatives) && token.alternatives.length > 0
    ? `
      <div class="result-alternatives">
        <strong>Alternativas:</strong>
        <ul>
          ${token.alternatives.map((alt) => {
            const altDisplayValue = !showNotes
              ? alt.flat_display ?? alt.display ?? alt.word ?? ''
              : alt.display ?? alt.flat_display ?? alt.word ?? '';
            const altIpa = Array.isArray(alt.ipa) ? alt.ipa.join(', ') : alt.ipa ?? '';
            const ipaText = altIpa ? ` <span class="alt-ipa">(${altIpa})</span>` : '';
            return `<li>${escapeHtml(altDisplayValue)}${ipaText}</li>`;
          }).join('')}
        </ul>
      </div>
    `
    : '';

  return `
    <div class="tooltip-title">${escapeHtml(wordValue)}</div>
    <div class="result-value">${escapeHtml(displayValue || '-')}</div>
    <div class="result-meta">
      <span><strong>IPA:</strong> ${escapeHtml(ipaValue)}</span>
    </div>
    ${alternativesHtml}
  `;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = phraseEl.value.trim();

  if (!text) {
    outputEl.textContent = 'Por favor, introduce una palabra o frase.';
    outputList.innerHTML = '';
    return;
  }

  outputEl.textContent = 'Transcribiendo...';
  outputList.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE_URL}/transcription/formatted/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      outputEl.textContent = 'Error: ' + (errorText || response.statusText);
      return;
    }

    const data = await response.json();
    lastResponseData = data;
    lastInputText = text;
    renderTranscriptionResult(data, text);
  } catch (error) {
    outputEl.textContent = 'Solicitud fallida: ' + error.message;
    outputList.innerHTML = '';
  }
});
