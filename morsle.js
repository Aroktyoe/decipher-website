// Mapping of Morse to letter
const morseToLetter = {
  '.-':'A','-...':'B','-.-.':'C','-..':'D','.':'E','..-.':'F','--.':'G','....':'H','..':'I',
  '.---':'J','-.-':'K','.-..':'L','--':'M','-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R',
  '...':'S','-':'T','..-':'U','...-':'V','.--':'W','-..-':'X','-.--':'Y','--..':'Z'
};

const morseDiv = document.getElementById("morse-alphabet");
for (let [code, letter] of Object.entries(morseToLetter)) {
  morseDiv.innerHTML += `<div class="morse-line"><strong id="morse-${letter}" class="morse-letter">${letter}</strong>:&nbsp;&nbsp;${code}</div>`;
}

let word = null;
let guesses = [];
let maxGuesses = 6;
let gameOver = false;
let userStats = null;
let finalResult = "";
let currentInput = "";
let morseBuffer = "";
let currentLetters = "";
let validWords = [];

function localDate() {
  const now = new Date();
  return now.getFullYear() + '-' +
         String(now.getMonth() + 1).padStart(2, '0') + '-' +
         String(now.getDate()).padStart(2, '0');
}

async function fetchWord() {
  const res = await fetch('morsle.txt');
  const words = (await res.text()).trim().split(/\r?\n/);
  const today = localDate();
  const seed = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
  word = words[seed % words.length].toUpperCase();
}

function updateMorseColors() {
  const letterStatus = {}; // A: 'correct' > 'present' > 'absent'

  for (let g of guesses) {
    const target = word.split('');
    const guess = g.word.split('');
    const used = Array(word.length).fill(false);

    // First pass for corrects
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === target[i]) {
        letterStatus[guess[i]] = 'correct';
        used[i] = true;
      }
    }

    // Second pass for presents
    for (let i = 0; i < guess.length; i++) {
      if (letterStatus[guess[i]] === 'correct') continue;
      for (let j = 0; j < target.length; j++) {
        if (!used[j] && guess[i] === target[j]) {
          if (letterStatus[guess[i]] !== 'correct') {
            letterStatus[guess[i]] = 'present';
          }
          used[j] = true;
          break;
        }
      }
      if (!target.includes(guess[i]) && !letterStatus[guess[i]]) {
        letterStatus[guess[i]] = 'absent';
      }
    }
  }

  for (let [letter, status] of Object.entries(letterStatus)) {
    const el = document.getElementById(`morse-${letter}`);
    if (el) {
      const line = el.closest('.morse-line');
      if (line) {
        line.classList.remove('correct', 'present', 'absent');
        line.classList.add(status);
      }
    }
  }
}



function getMorseLength() {
  return word.split('').map(c => {
    for (let [k, v] of Object.entries(morseToLetter)) {
      if (v === c) return k;
    }
    return '';
  }).join('').length;
}


function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  for (let i = 0; i < maxGuesses; i++) {
    const row = document.createElement('div');
    row.className = 'guess-row';

    const rowLength = word.length;
    const guess = guesses[i]?.word || '';

    for (let j = 0; j < rowLength; j++) {
      const cell = document.createElement('div');
      cell.className = 'guess-cell';

      let char = '';
      if (i === guesses.length && !gameOver) {
        if (j < currentLetters.length) {
          char = currentLetters[j];
        } else if (j === currentLetters.length && morseBuffer) {
          char = morseBuffer.slice(0, 4);
        } else {
          char = '';
        }
      } else {
        char = guess[j] || '';
      }

      cell.textContent = char;

      if (guess) {
  const correct = [];
  const present = [];
  const targetUsed = Array(word.length).fill(false);

  // First pass: exact matches
  for (let k = 0; k < word.length; k++) {
    if (guess[k] === word[k]) {
        correct[k] = true;
        targetUsed[k] = true;
      }
    }

    // Second pass: present but wrong spot
    for (let k = 0; k < word.length; k++) {
      if (!correct[k]) {
        for (let m = 0; m < word.length; m++) {
          if (!targetUsed[m] && guess[k] === word[m]) {
            present[k] = true;
            targetUsed[m] = true;
            break;
          }
        }
      }
    }

    if (correct[j]) cell.classList.add('correct');
    else if (present[j]) cell.classList.add('present');
    else cell.classList.add('absent');
  }


      row.appendChild(cell);
    }

    board.appendChild(row);
  }
}

async function refreshStats() {
  try {
    const u = await fetch('/me', { credentials: 'include' });
    if (u.ok) {
      userStats = await u.json();
      const streak = userStats.morsle_streak ?? 0;
      const best = userStats.morsle_best_streak ?? 0;
      document.getElementById('user-stats').textContent = `Streak: ${streak} | Best: ${best}`;
      return userStats;
    }
  } catch {}
  return null;
}

async function checkGameOver(guessWord) {
  if (guessWord === word) {
    document.getElementById('status').textContent = "You solved it in " + guesses.length + " guesses!";
    localStorage.setItem('morsle-' + localDate(), guesses.length);
    gameOver = true;

    await sendStats(guesses.length);
    userStats = await refreshStats(); // only once

    if (userStats && userStats.morsle_streak != null && userStats.morsle_best_streak != null) {
      finalResult = `Morsle ${localDate()}: ${guesses.length}/6\nStreak: ${userStats.morsle_streak} (Best: ${userStats.morsle_best_streak})`;
    } else {
      finalResult = `Morsle ${localDate()}: ${guesses.length}/6`;
    }

    document.getElementById('copy-button').style.display = "block";
    document.getElementById("copy-button").onclick = copyResults;
  } else if (guesses.length >= maxGuesses) {
    document.getElementById('status').textContent = "The word was: " + word;
    gameOver = true;
  }
}



function sendStats(n) {
  return fetch('/morsle/stats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': getCSRFToken()
    },
    credentials: 'include',
    body: JSON.stringify({
      guesses: n,
      date: localDate()
    })
  });
}

function shakeBoard() {
  const board = document.getElementById('board');
  board.classList.add('shake');
  setTimeout(() => board.classList.remove('shake'), 400);
}

async function loadGame() {
  await fetchWord();

  try {
    const wordlistRes = await fetch('wordlist.txt');
    validWords = (await wordlistRes.text()).trim().split(/\r?\n/).map(w => w.toUpperCase());

    const localDateStr = localDate();
    const res = await fetch(`/morsle/average?date=${localDateStr}`);
    const data = await res.json();
    document.getElementById('average').textContent = "Today's average: " + data.average + " guesses";
  } catch {}

  try {
    const u = await fetch('/me', { credentials: 'include' });
    if (u.ok) {
      userStats = await u.json();
      const streak = userStats.morsle_streak ?? 0;
      const best = userStats.morsle_best_streak ?? 0;
      document.getElementById('user-stats').textContent = `Streak: ${streak} | Best: ${best}`;
    }
  } catch {}

  const dateKey = localDate();
  const localKey = 'morsle-last-played';
  const todayLocal = localDate();

  const lastPlayed = localStorage.getItem(localKey);

  if (lastPlayed === todayLocal) {
    const savedGuesses = localStorage.getItem('morsle-guesses-' + dateKey);
    const savedScore = localStorage.getItem('morsle-' + dateKey);

    if (savedGuesses) {
      guesses = JSON.parse(savedGuesses);
      renderBoard();

      const lastGuess = guesses[guesses.length - 1]?.word;
      if (lastGuess === word) {
        gameOver = true;
        document.getElementById('status').textContent = "You already solved it in " + guesses.length + " guesses.";
        document.getElementById('copy-button').style.display = "block";

        if (userStats && userStats.morsle_streak != null && userStats.morsle_best_streak != null) {
          finalResult = `Morsle ${localDate()}: ${guesses.length}/6\nStreak: ${userStats.morsle_streak} (Best: ${userStats.morsle_best_streak})`;
        } else {
          finalResult = `Morsle ${localDate()}: ${guesses.length}/6`;
        }

        updateMorseColors();
      } else {
        updateMorseColors();
      }
    } else if (savedScore) {
      document.getElementById('status').textContent = "You already solved it in " + savedScore + " guesses.";
      gameOver = true;
      renderBoard();
      document.getElementById('copy-button').style.display = "block";

      if (userStats && userStats.morsle_streak != null && userStats.morsle_best_streak != null) {
        finalResult = `Morsle ${localDate()}: ${savedScore}/6\nStreak: ${userStats.morsle_streak} (Best: ${userStats.morsle_best_streak})`;
      } else {
        finalResult = `Morsle ${localDate()}: ${savedScore}/6`;
      }
    } else {
      renderBoard();
    }
  } else {
    localStorage.setItem(localKey, todayLocal);
    renderBoard(); // fresh start allowed
  }
}


function parseMorse(input) {
  return input.trim().split(' ').map(code => morseToLetter[code] || '?').join('');
}

async function trySubmit() {
  if (currentLetters.length !== word.length) {
    showTempMessage("Not enough letters.");
    shakeBoard();
    return;
  }

  if (!validWords.includes(currentLetters)) {
    showTempMessage("Not in word list.");
    shakeBoard();
    return;
  }

  guesses.push({ word: currentLetters });
  currentLetters = '';
  morseBuffer = '';
  renderBoard();
  updateMorseColors();
  await checkGameOver(guesses[guesses.length - 1].word);
  localStorage.setItem('morsle-guesses-' + localDate(), JSON.stringify(guesses));
}

function handleInput(ch) {
  if (gameOver) return;

  if (ch === 'BACKSPACE') {
    if (morseBuffer.length > 0) {
      morseBuffer = morseBuffer.slice(0, -1);
    } else if (currentLetters.length > 0) {
      currentLetters = currentLetters.slice(0, -1);
    }

  } else if (ch === '.' || ch === '-') {
    morseBuffer += ch;

  } else if (ch === ' ' || ch === 'ENTER') {
    if (morseBuffer.length > 0) {
      const letter = morseToLetter[morseBuffer];
      if (letter && currentLetters.length < word.length) {
        currentLetters += letter;
        morseBuffer = '';
      } else {
        shakeBoard();
      }
    } else if (currentLetters.length === word.length) {
      trySubmit();
    }
  }

  renderBoard();
}

function addMorse(symbol, event) {
  event.preventDefault();
  event.stopPropagation();
  handleInput(symbol);
}

function removeMorse(event) {
  event.preventDefault();
  event.stopPropagation();
  handleInput('BACKSPACE');
}

function submitGuess(event) {
  event.preventDefault();
  event.stopPropagation();
  handleInput('ENTER');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleInput('ENTER');
  else if (e.key === 'Backspace') handleInput('BACKSPACE');
  else if (e.key === '.' || e.key === '-' || e.key === ' ') handleInput(e.key);
});

document.getElementById('input-area').innerHTML = `
  <button onclick="addMorse('.', event)">.</button>
  <button onclick="addMorse('-', event)">-</button>
  <button onclick="addMorse(' ', event)">space</button>
  <button onclick="removeMorse(event)">&larr;</button>
  <button onclick="submitGuess(event)">Enter</button>
`;

function showTempMessage(msg) {
  const status = document.getElementById('status');
  status.textContent = msg;
  setTimeout(() => {
    if (!gameOver) status.textContent = '';
  }, 2000);
}

function copyResults() {
  if (!finalResult) return;

  const date = localDate().split('-');
  const formattedDate = `${date[2]}/${date[1]}/${date[0]}`;

  let grid = guesses.map(g => {
    return [...g.word].map((ch, i) => {
      if (word[i] === ch) return '🟩';
      else if (word.includes(ch)) return '🟨';
      else return '⬜';
    }).join('');
  }).join('\n');

  const shareText = `${finalResult}\n${grid}\nCan you beat todays Morsle? https://decipher.wiki/morsle`;

  // Clipboard fallback
  navigator.clipboard.writeText(shareText)
    .then(() => {
      document.getElementById("copy-msg").textContent = "Copied to clipboard!";
    })
    .catch(() => {
      document.getElementById("copy-msg").textContent = "Copy failed.";
    });
  }


loadGame();
