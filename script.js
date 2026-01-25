// script.js - Prompter functionality

// Get DOM elements
const scriptInput = document.getElementById('scriptInput');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const displayArea = document.getElementById('displayArea');

let chars = []; // array of span elements
let currentIndex = 0;
let intervalId = null;
let isPaused = false;
let speed = parseInt(speedRange.value); // chars per minute

// Update speed display when slider moves
speedRange.addEventListener('input', () => {
  speed = parseInt(speedRange.value);
  speedValue.textContent = speed;
  // If running, adjust interval timing
  if (intervalId) {
    clearInterval(intervalId);
    startInterval();
  }
});

function prepareScript(text) {
  // Clear previous content
  displayArea.innerHTML = '';
  chars = [];
  currentIndex = 0;

  // Split text into characters (including spaces and newlines)
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.textContent = text[i];
    // Preserve line breaks
    if (text[i] === '\n') {
      span.innerHTML = '<br>';
    }
    fragment.appendChild(span);
    chars.push(span);
  }
  displayArea.appendChild(fragment);
}

function highlightCurrent() {
  if (currentIndex > 0) {
    chars[currentIndex - 1].classList.remove('highlight');
  }
  if (currentIndex < chars.length) {
    chars[currentIndex].classList.add('highlight');
    // Scroll into view smoothly
    chars[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    currentIndex++;
  } else {
    // End of script
    stopPrompter();
  }
}

function startInterval() {
  const intervalMs = 60000 / speed; // ms per character
  intervalId = setInterval(highlightCurrent, intervalMs);
}

function startPrompter() {
  const scriptText = scriptInput.value.trim();
  if (!scriptText) {
    alert('セリフを入力してください。');
    return;
  }
  prepareScript(scriptText);
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  isPaused = false;
  startInterval();
}

function pausePrompter() {
  if (isPaused) {
    // resume
    startInterval();
    pauseBtn.textContent = '一時停止';
    isPaused = false;
  } else {
    // pause
    clearInterval(intervalId);
    intervalId = null;
    pauseBtn.textContent = '再開';
    isPaused = true;
  }
}

function stopPrompter() {
  clearInterval(intervalId);
  intervalId = null;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = '一時停止';
  isPaused = false;
}

startBtn.addEventListener('click', startPrompter);
pauseBtn.addEventListener('click', pausePrompter);

// Optional: allow Enter key to start when focus is on textarea
scriptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) {
    // Shift+Enter for new line, do nothing
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    startPrompter();
  }
});
