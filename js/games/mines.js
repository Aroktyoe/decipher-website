import { fetchBalance, getCSRFToken } from "../api.js";

export async function playMines(event) {
  if (window.cooldown) return;
  window.cooldown = true;
  const button = event.target;
  button.disabled = true;
  button.style.opacity = '0.6';
  button.style.cursor = 'not-allowed';
  setTimeout(() => {
    button.disabled = false;
    button.style.opacity = '';
    button.style.cursor = '';
    window.cooldown = false;
  }, 1200);

  const bet = parseInt(document.getElementById('mines-bet').value);
  const minesCount = parseInt(document.getElementById('mines-count').value); // Get the selected number of mines
  if (!bet || isNaN(bet) || bet <= 0 || !minesCount || isNaN(minesCount) || minesCount <= 0) {
    console.warn("Ignored invalid bet or mines count");
    return;
  }

  // Fetch the user's balance
  const userBalance = await fetchBalance();
  if (userBalance < bet) {
    alert("You don't have enough balance to play!");
    return;
  }

  const display = document.getElementById('mines-display');
  const resultText = document.getElementById('mines-result');
  const gridSize = 5; // 5x5 grid, 25 tiles total
  let revealedTiles = 0;
  let gameOver = false;
  let quitGame = false;
  let currentPayout = 0;

  // Generate grid with random mines
  const mines = generateMines(gridSize, minesCount);

  // Set up grid display
  let gridHTML = '';
  for (let i = 0; i < gridSize; i++) {
    gridHTML += '<div class="mines-row">';
    for (let j = 0; j < gridSize; j++) {
      gridHTML += `<button class="mines-tile" data-x="${i}" data-y="${j}">?</button>`;
    }
    gridHTML += '</div>';
  }
  display.innerHTML = gridHTML;

  // Add event listeners to tiles
  const tiles = document.querySelectorAll('.mines-tile');
  tiles.forEach(tile => {
    tile.addEventListener('click', async (e) => {
      if (gameOver || quitGame) return;

      const x = e.target.getAttribute('data-x');
      const y = e.target.getAttribute('data-y');
      const tileIndex = x * gridSize + parseInt(y);

      if (mines.includes(tileIndex)) {
        // Hit a mine, game over
        e.target.textContent = '💎'; // Show mine
        resultText.textContent = "Game Over! You hit a mine!";
        gameOver = true;
        revealMines(mines, gridSize);
        setTimeout(() => {
          delayedBalanceUpdate(-bet); // Deduct bet on loss
        }, 10);
      } else {
        // No mine, reveal surrounding tiles
        e.target.textContent = '✔️';
        revealedTiles++;

        // Check if player has revealed enough tiles to quit
        if (revealedTiles >= 3) { // You can change the number of tiles for quitting
          currentPayout = bet;  // Set the current payout based on the bet
          resultText.textContent = `You can quit now with ${currentPayout} payout! Click 'Quit' to stop.`;
          enableQuitButton(currentPayout);  // Enable the quit button
        }

        // If all safe tiles are revealed, player wins
        if (revealedTiles >= gridSize * gridSize - minesCount) {
          resultText.textContent = "You won! No mines hit!";
          setTimeout(() => {
            delayedBalanceUpdate(bet); // Reward on win
          }, 10);
        }
      }
    });
  });

  // Quit Button Handler
  function enableQuitButton(payout) {
    const quitButton = document.getElementById('quit-button');
    quitButton.style.display = 'inline-block';
    quitButton.addEventListener('click', () => {
      quitGame = true;
      resultText.textContent = `You quit the game with ${payout} payout.`;
      delayedBalanceUpdate(payout); // Reward the player
      revealMines(mines, gridSize); // Reveal all mines
    });
  }

  // Fetch result from backend with the number of mines selected and the bet
  const token = getCSRFToken();
  const res = await fetch('/casino/play/mines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': token
    },
    credentials: 'include',
    body: JSON.stringify({ bet, mines: minesCount })
  });
  const data = await res.json();
  if (data.message) {
    resultText.textContent = data.message;
  }
}

// Generate random mines
function generateMines(gridSize, mineCount) {
  const mines = [];
  while (mines.length < mineCount) {
    const randomTile = Math.floor(Math.random() * (gridSize * gridSize));
    if (!mines.includes(randomTile)) {
      mines.push(randomTile);
    }
  }
  return mines;
}

// Reveal all mines when the game ends
function revealMines(mines, gridSize) {
  const tiles = document.querySelectorAll('.mines-tile');
  mines.forEach(mineIndex => {
    const x = Math.floor(mineIndex / gridSize);
    const y = mineIndex % gridSize;
    const tile = tiles[x * gridSize + y];
    tile.textContent = '💎'; // Reveal mines
  });
}
