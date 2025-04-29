/**
 * Tekken Tournament Brackets
 * 
 * This file provides functionality for tournament bracket management,
 * including single and double elimination tournament formats.
 */

// Global variables
let tournamentPlayers = [];
let bracketMatches = [];
let tournamentState = {
  type: 'single',          // single or double elimination
  status: 'not_started',   // not_started, in_progress, completed
  currentRound: 0,
  currentMatch: null,      // current active match id
  winner: null             // tournament winner id
};

// DOM Elements
const playerCountValueEl = document.getElementById('player-count-value');
const playerValidationEl = document.getElementById('player-validation');
const playersContainerEl = document.getElementById('players-container');
const bracketDisplayEl = document.getElementById('bracket-display');
const loadingBracketEl = document.getElementById('loading-bracket');
const btnSeedPlayersEl = document.getElementById('btn-seed-players');
const btnGenerateBracketEl = document.getElementById('btn-generate-bracket');
const btnResetBracketEl = document.getElementById('btn-reset-bracket');
const btnSaveTournamentEl = document.getElementById('btn-save-tournament');
const bracketTypeSelectEl = document.getElementById('bracket-type');
const adminCheckEl = document.getElementById('admin-check');
const mainTournamentContentEl = document.getElementById('main-tournament-content');

// Stats elements
const playerCountEl = document.getElementById('player-count');
const matchCountEl = document.getElementById('match-count');
const currentRoundEl = document.getElementById('current-round');
const tournamentStatusEl = document.getElementById('tournament-status');

// Match detail elements
const matchDetailEl = document.getElementById('match-detail');
const player1DetailsEl = document.getElementById('player1-details');
const player2DetailsEl = document.getElementById('player2-details');
const player1ScoreEl = document.getElementById('player1-score');
const player2ScoreEl = document.getElementById('player2-score');
const saveMatchResultEl = document.getElementById('save-match-result');
const cancelMatchEditEl = document.getElementById('cancel-match-edit');

// View toggle elements
const bracketViewEl = document.getElementById('bracket-view');
const matchesViewEl = document.getElementById('matches-view'); 
const upcomingMatchesEl = document.getElementById('upcoming-matches-list');
const completedMatchesEl = document.getElementById('completed-matches-list');

// Database status
const dbStatusEl = document.getElementById('db-status');

/**
 * Initialize the tournament page
 */
async function initTournamentPage() {
  try {
    // Initialize database
    await TekkenDB.init();
    updateDBStatus('connected');
    
    // Check for admin authentication
    if (!checkAdmin()) {
      // Show admin-only message and hide content
      adminCheckEl.classList.remove('hidden');
      mainTournamentContentEl.classList.add('hidden');
      return;
    }
    
    // Load tournament data
    await loadTournamentData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check if we have an existing tournament state
    const savedState = localStorage.getItem('tournamentBracketState');
    if (savedState) {
      try {
        tournamentState = JSON.parse(savedState);
        bracketTypeSelectEl.value = tournamentState.type;
        
        // If we have matches, load them and the bracket
        if (tournamentState.status !== 'not_started') {
          const savedMatches = localStorage.getItem('tournamentBracketMatches');
          if (savedMatches) {
            bracketMatches = JSON.parse(savedMatches);
            renderBracket();
            updateTournamentSummary();
            btnResetBracketEl.disabled = false;
          }
        }
      } catch (error) {
        console.error('Error loading saved tournament state:', error);
        // Continue with default state
      }
    }
  } catch (error) {
    console.error('Failed to initialize tournament page:', error);
    updateDBStatus('error');
  }
}

/**
 * Load tournament data from localStorage (shared with admin panel)
 */
async function loadTournamentData() {
  try {
    // Show loading state
    loadingBracketEl.classList.remove('hidden');
    bracketDisplayEl.classList.add('hidden');
    
    // Get tournament players from localStorage
    const savedPlayers = localStorage.getItem('tekkenTournamentPlayers');
    if (savedPlayers) {
      tournamentPlayers = JSON.parse(savedPlayers);
      renderPlayerList();
      validatePlayerCount();
    } else {
      // No players found
      showInfoMessage('No tournament players found. Add players in the admin panel first.', 'warning');
    }
    
    // Hide loading
    loadingBracketEl.classList.add('hidden');
  } catch (error) {
    console.error('Error loading tournament data:', error);
    showInfoMessage('Failed to load tournament data', 'error');
  }
}

/**
 * Check if user has admin privileges
 */
function checkAdmin() {
  // For now, we'll assume admin access. In a real implementation,
  // this would check for user credentials or an auth token
  return true;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Bracket type change
  bracketTypeSelectEl.addEventListener('change', () => {
    tournamentState.type = bracketTypeSelectEl.value;
    validatePlayerCount();
  });
  
  // Seed players button
  btnSeedPlayersEl.addEventListener('click', () => {
    seedPlayers();
    renderPlayerList();
  });
  
  // Generate bracket button
  btnGenerateBracketEl.addEventListener('click', () => {
    generateBracket();
  });
  
  // Reset bracket button
  btnResetBracketEl.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the tournament bracket? All match results will be lost.')) {
      resetTournament();
    }
  });
  
  // Save tournament state
  btnSaveTournamentEl.addEventListener('click', () => {
    saveTournamentState();
    showInfoMessage('Tournament state saved successfully!', 'success');
  });
  
  // View toggle (bracket / matches)
  document.querySelectorAll('.bracket-type-option').forEach(option => {
    option.addEventListener('click', () => {
      // Update active class
      document.querySelectorAll('.bracket-type-option').forEach(opt => {
        opt.classList.remove('active');
      });
      option.classList.add('active');
      
      // Show the corresponding view
      const viewType = option.getAttribute('data-view');
      if (viewType === 'bracket') {
        bracketViewEl.classList.remove('hidden');
        matchesViewEl.classList.add('hidden');
      } else {
        bracketViewEl.classList.add('hidden');
        matchesViewEl.classList.remove('hidden');
        renderMatchesView();
      }
    });
  });
  
  // Match result submission
  saveMatchResultEl.addEventListener('click', saveMatchResult);
  
  // Cancel match edit
  cancelMatchEditEl.addEventListener('click', () => {
    matchDetailEl.classList.add('hidden');
  });
}

/**
 * Update database connection status
 */
function updateDBStatus(status) {
  const statusEl = dbStatusEl.querySelector('.status');
  if (status === 'connected') {
    statusEl.textContent = 'Connected';
    statusEl.className = 'status connected';
    
    // Update last sync time
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Check if we already have a last-sync element
    let lastSyncEl = dbStatusEl.querySelector('.last-sync');
    if (!lastSyncEl) {
      lastSyncEl = document.createElement('span');
      lastSyncEl.className = 'last-sync';
      dbStatusEl.appendChild(lastSyncEl);
    }
    
    lastSyncEl.textContent = `(${timeString})`;
  } else {
    statusEl.textContent = 'Error';
    statusEl.className = 'status error';
  }
}

/**
 * Render the player list
 */
function renderPlayerList() {
  // Update the player count
  playerCountValueEl.textContent = tournamentPlayers.length;
  
  // Clear the container
  playersContainerEl.innerHTML = '';
  
  if (tournamentPlayers.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'player-item';
    emptyMessage.textContent = 'No players added yet';
    playersContainerEl.appendChild(emptyMessage);
    return;
  }
  
  // Render each player
  tournamentPlayers.forEach((player, index) => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    
    const playerInfoDiv = document.createElement('div');
    
    const playerName = document.createElement('div');
    playerName.className = 'player-name';
    playerName.textContent = player.name;
    
    const playerDept = document.createElement('div');
    playerDept.className = 'player-department';
    playerDept.textContent = player.department;
    
    playerInfoDiv.appendChild(playerName);
    playerInfoDiv.appendChild(playerDept);
    
    const seedDiv = document.createElement('div');
    seedDiv.className = 'player-seed';
    seedDiv.textContent = player.seed || '-';
    
    playerItem.appendChild(playerInfoDiv);
    playerItem.appendChild(seedDiv);
    
    playersContainerEl.appendChild(playerItem);
  });
}

/**
 * Validate if we have enough players for the tournament
 */
function validatePlayerCount() {
  const playerCount = tournamentPlayers.length;
  
  // Enable/disable the seed players button
  btnSeedPlayersEl.disabled = playerCount < 2;
  
  // Update validation message
  if (playerCount < 2) {
    playerValidationEl.textContent = 'Need at least 2 players to start';
    playerValidationEl.className = 'player-validation invalid';
    btnGenerateBracketEl.disabled = true;
    return false;
  }
  
  // Single elimination requires power of 2 for perfect brackets
  if (tournamentState.type === 'single') {
    // Check if player count is a power of 2
    const isPowerOfTwo = (playerCount & (playerCount - 1)) === 0;
    if (!isPowerOfTwo) {
      playerValidationEl.textContent = `Player count (${playerCount}) is not a power of 2. Add or remove players for a perfect bracket.`;
      playerValidationEl.className = 'player-validation invalid';
      btnGenerateBracketEl.disabled = true;
      return false;
    }
  }
  
  // All validations passed
  playerValidationEl.textContent = `${playerCount} players ready for tournament`;
  playerValidationEl.className = 'player-validation valid';
  btnGenerateBracketEl.disabled = false;
  return true;
}

/**
 * Seed players based on skill level
 */
function seedPlayers() {
  // Sort players by skill level (descending)
  tournamentPlayers.sort((a, b) => b.skillLevel - a.skillLevel);
  
  // Assign seed numbers
  tournamentPlayers.forEach((player, index) => {
    player.seed = index + 1;
  });
  
  // Save the updated players to localStorage
  localStorage.setItem('tekkenTournamentPlayers', JSON.stringify(tournamentPlayers));
}

/**
 * Generate tournament bracket
 */
function generateBracket() {
  // Validate player count
  if (!validatePlayerCount()) {
    return;
  }
  
  // Sort players by seed
  tournamentPlayers.sort((a, b) => (a.seed || 999) - (b.seed || 999));
  
  // Generate matches based on bracket type
  bracketMatches = [];
  if (tournamentState.type === 'single') {
    generateSingleEliminationBracket();
  } else {
    generateDoubleEliminationBracket();
  }
  
  // Update tournament state
  tournamentState.status = 'in_progress';
  tournamentState.currentRound = 1;
  tournamentState.currentMatch = null;
  tournamentState.winner = null;
  
  // Enable reset button
  btnResetBracketEl.disabled = false;
  
  // Save the tournament state
  saveTournamentState();
  
  // Render the bracket
  renderBracket();
  
  // Update the tournament summary
  updateTournamentSummary();
}

/**
 * Generate single elimination bracket
 */
function generateSingleEliminationBracket() {
  const playerCount = tournamentPlayers.length;
  const rounds = Math.log2(playerCount);
  
  // Create first round matches
  for (let i = 0; i < playerCount / 2; i++) {
    // For optimal bracketing in single elimination, we pair:
    // 1 vs N, 2 vs N-1, 3 vs N-2, etc.
    const player1Index = i;
    const player2Index = playerCount - 1 - i;
    
    bracketMatches.push({
      id: `match-r1-${i + 1}`,
      round: 1,
      player1Id: tournamentPlayers[player1Index].id,
      player2Id: tournamentPlayers[player2Index].id,
      player1Score: 0,
      player2Score: 0,
      winnerId: null,
      loserId: null,
      status: 'upcoming',
      nextMatchId: generateNextMatchId(1, i + 1, rounds),
      bracketPosition: i + 1
    });
  }
  
  // Create placeholder matches for later rounds
  for (let round = 2; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    
    for (let i = 0; i < matchesInRound; i++) {
      const nextMatchId = round < rounds ? generateNextMatchId(round, i + 1, rounds) : null;
      
      bracketMatches.push({
        id: `match-r${round}-${i + 1}`,
        round: round,
        player1Id: null,
        player2Id: null,
        player1Score: 0,
        player2Score: 0,
        winnerId: null,
        loserId: null,
        status: 'pending',
        nextMatchId: nextMatchId,
        bracketPosition: i + 1
      });
    }
  }
}

/**
 * Generate double elimination bracket
 */
function generateDoubleEliminationBracket() {
  const playerCount = tournamentPlayers.length;
  const winnerRounds = Math.log2(playerCount) + 1; // +1 for final
  
  // Generate winner bracket (similar to single elimination)
  generateSingleEliminationBracket();
  
  // We need to modify the matches to indicate they're in the winner bracket
  bracketMatches.forEach(match => {
    match.bracket = 'winner';
    
    // Final match doesn't connect to any next match
    if (match.round === winnerRounds - 1) {
      match.nextMatchId = 'final';
    }
  });
  
  // Generate loser bracket matches
  // This is more complex - we'll add a simplified version
  
  // Add a final match (between winner bracket and loser bracket champions)
  bracketMatches.push({
    id: 'match-final',
    round: winnerRounds,
    player1Id: null, // Winner bracket champion
    player2Id: null, // Loser bracket champion
    player1Score: 0,
    player2Score: 0,
    winnerId: null,
    loserId: null,
    status: 'pending',
    nextMatchId: null,
    bracketPosition: 1,
    isFinal: true
  });
}

/**
 * Generate next match ID for a given match
 */
function generateNextMatchId(round, position, totalRounds) {
  if (round >= totalRounds) {
    return null; // Final match doesn't have a next match
  }
  
  // Calculate the position in the next round
  const nextPosition = Math.ceil(position / 2);
  return `match-r${round + 1}-${nextPosition}`;
}

/**
 * Render the tournament bracket
 */
function renderBracket() {
  // First hide loading and show bracket display
  loadingBracketEl.classList.add('hidden');
  bracketDisplayEl.classList.remove('hidden');
  
  // Clear the bracket display
  bracketDisplayEl.innerHTML = '';
  
  // Get the maximum round number
  const maxRound = Math.max(...bracketMatches.map(match => match.round));
  
  // Create a container for each round
  for (let round = 1; round <= maxRound; round++) {
    const roundContainer = document.createElement('div');
    roundContainer.className = 'bracket-round';
    
    const roundTitle = document.createElement('div');
    roundTitle.className = 'bracket-round-title';
    
    if (round === maxRound && bracketMatches.some(m => m.isFinal)) {
      roundTitle.textContent = 'Final';
    } else {
      roundTitle.textContent = `Round ${round}`;
    }
    
    roundContainer.appendChild(roundTitle);
    
    // Get matches for this round
    const roundMatches = bracketMatches
      .filter(match => match.round === round)
      .sort((a, b) => a.bracketPosition - b.bracketPosition);
    
    // Add match containers
    roundMatches.forEach(match => {
      const matchElement = createMatchElement(match);
      roundContainer.appendChild(matchElement);
    });
    
    bracketDisplayEl.appendChild(roundContainer);
  }
  
  // Also update the matches view
  renderMatchesView();
}

/**
 * Create HTML element for a match
 */
function createMatchElement(match) {
  const matchDiv = document.createElement('div');
  matchDiv.className = 'bracket-match';
  matchDiv.id = match.id;
  
  // Add special classes
  if (match.id === tournamentState.currentMatch) {
    matchDiv.classList.add('current');
  }
  
  if (match.status === 'completed') {
    matchDiv.classList.add('completed');
  }
  
  // Add player 1
  const player1 = getPlayerById(match.player1Id);
  const player1Div = document.createElement('div');
  player1Div.className = 'bracket-player';
  
  if (match.winnerId === match.player1Id) {
    player1Div.classList.add('winner');
  } else if (match.loserId === match.player1Id) {
    player1Div.classList.add('loser');
  }
  
  player1Div.innerHTML = `
    <span class="bracket-player-name">${player1 ? player1.name : 'TBD'}</span>
    <span class="bracket-player-score">${match.player1Score || 0}</span>
  `;
  
  // Add player 2
  const player2 = getPlayerById(match.player2Id);
  const player2Div = document.createElement('div');
  player2Div.className = 'bracket-player';
  
  if (match.winnerId === match.player2Id) {
    player2Div.classList.add('winner');
  } else if (match.loserId === match.player2Id) {
    player2Div.classList.add('loser');
  }
  
  player2Div.innerHTML = `
    <span class="bracket-player-name">${player2 ? player2.name : 'TBD'}</span>
    <span class="bracket-player-score">${match.player2Score || 0}</span>
  `;
  
  // Append players to match
  matchDiv.appendChild(player1Div);
  matchDiv.appendChild(player2Div);
  
  // Add click event to edit the match
  if ((match.player1Id && match.player2Id) && match.status !== 'completed') {
    matchDiv.style.cursor = 'pointer';
    matchDiv.addEventListener('click', () => {
      showMatchDetail(match);
    });
  }
  
  return matchDiv;
}

/**
 * Render the matches view (upcoming and completed matches)
 */
function renderMatchesView() {
  // Clear the containers
  upcomingMatchesEl.innerHTML = '';
  completedMatchesEl.innerHTML = '';
  
  // Separate matches by status
  const upcomingMatches = bracketMatches.filter(m => m.status !== 'completed' && m.player1Id && m.player2Id);
  const completedMatches = bracketMatches.filter(m => m.status === 'completed');
  
  // Sort upcoming matches by round (ascending)
  upcomingMatches.sort((a, b) => a.round - b.round);
  
  // Sort completed matches by completion time (if available) or round
  completedMatches.sort((a, b) => b.round - a.round);
  
  // Render upcoming matches
  if (upcomingMatches.length === 0) {
    upcomingMatchesEl.innerHTML = '<p>No upcoming matches</p>';
  } else {
    upcomingMatches.forEach(match => {
      const matchDiv = createMatchListItem(match);
      upcomingMatchesEl.appendChild(matchDiv);
    });
  }
  
  // Render completed matches
  if (completedMatches.length === 0) {
    completedMatchesEl.innerHTML = '<p>No completed matches</p>';
  } else {
    completedMatches.forEach(match => {
      const matchDiv = createMatchListItem(match);
      completedMatchesEl.appendChild(matchDiv);
    });
  }
}

/**
 * Create a list item for a match
 */
function createMatchListItem(match) {
  const player1 = getPlayerById(match.player1Id);
  const player2 = getPlayerById(match.player2Id);
  
  const matchDiv = document.createElement('div');
  matchDiv.className = 'bracket-match';
  
  if (match.status === 'completed') {
    matchDiv.classList.add('completed');
  }
  
  const player1Div = document.createElement('div');
  player1Div.className = 'bracket-player';
  if (match.winnerId === match.player1Id) {
    player1Div.classList.add('winner');
  }
  
  player1Div.innerHTML = `
    <span class="bracket-player-name">${player1 ? player1.name : 'TBD'}</span>
    <span class="bracket-player-score">${match.player1Score || 0}</span>
  `;
  
  const player2Div = document.createElement('div');
  player2Div.className = 'bracket-player';
  if (match.winnerId === match.player2Id) {
    player2Div.classList.add('winner');
  }
  
  player2Div.innerHTML = `
    <span class="bracket-player-name">${player2 ? player2.name : 'TBD'}</span>
    <span class="bracket-player-score">${match.player2Score || 0}</span>
  `;
  
  const matchInfoDiv = document.createElement('div');
  matchInfoDiv.textContent = `Round ${match.round}`;
  matchInfoDiv.style.fontSize = '0.8rem';
  matchInfoDiv.style.color = 'var(--text-secondary)';
  matchInfoDiv.style.marginTop = '5px';
  
  matchDiv.appendChild(player1Div);
  matchDiv.appendChild(player2Div);
  matchDiv.appendChild(matchInfoDiv);
  
  if ((match.player1Id && match.player2Id) && match.status !== 'completed') {
    matchDiv.style.cursor = 'pointer';
    matchDiv.addEventListener('click', () => {
      showMatchDetail(match);
    });
  }
  
  return matchDiv;
}

/**
 * Show match detail for editing
 */
function showMatchDetail(match) {
  // Store the current match ID for reference
  tournamentState.currentMatch = match.id;
  saveTournamentState();
  
  // Update UI to show the current match
  document.querySelectorAll('.bracket-match').forEach(el => {
    el.classList.remove('current');
  });
  
  const matchElement = document.getElementById(match.id);
  if (matchElement) {
    matchElement.classList.add('current');
  }
  
  // Get player details
  const player1 = getPlayerById(match.player1Id);
  const player2 = getPlayerById(match.player2Id);
  
  if (!player1 || !player2) {
    showInfoMessage('Cannot edit this match: One or both players are not defined.', 'error');
    return;
  }
  
  // Update match detail view
  const player1NameEl = player1DetailsEl.querySelector('.match-player-name');
  const player1DeptEl = player1DetailsEl.querySelector('.match-player-department');
  player1NameEl.textContent = player1.name;
  player1DeptEl.textContent = player1.department;
  
  const player2NameEl = player2DetailsEl.querySelector('.match-player-name');
  const player2DeptEl = player2DetailsEl.querySelector('.match-player-department');
  player2NameEl.textContent = player2.name;
  player2DeptEl.textContent = player2.department;
  
  // Set current scores
  player1ScoreEl.value = match.player1Score || 0;
  player2ScoreEl.value = match.player2Score || 0;
  
  // Store match ID on the save button
  saveMatchResultEl.setAttribute('data-match-id', match.id);
  
  // Show the match detail section
  matchDetailEl.classList.remove('hidden');
  
  // Scroll to the match detail section
  matchDetailEl.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Save match result
 */
function saveMatchResult() {
  // Get the match ID
  const matchId = saveMatchResultEl.getAttribute('data-match-id');
  if (!matchId) return;
  
  // Find the match
  const matchIndex = bracketMatches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return;
  
  const match = bracketMatches[matchIndex];
  
  // Get scores
  const player1Score = parseInt(player1ScoreEl.value) || 0;
  const player2Score = parseInt(player2ScoreEl.value) || 0;
  
  // Validate scores
  if (player1Score === player2Score) {
    alert('Scores cannot be equal. There must be a winner.');
    return;
  }
  
  // Update match
  match.player1Score = player1Score;
  match.player2Score = player2Score;
  
  // Determine winner and loser
  match.winnerId = player1Score > player2Score ? match.player1Id : match.player2Id;
  match.loserId = player1Score > player2Score ? match.player2Id : match.player1Id;
  match.status = 'completed';
  
  // Update player statistics
  updatePlayerStats(match.winnerId, match.loserId);
  
  // Move winner to next match if available
  if (match.nextMatchId) {
    advancePlayerToNextMatch(match);
  }
  
  // Check if tournament is completed
  checkTournamentCompletion();
  
  // Hide match detail
  matchDetailEl.classList.add('hidden');
  
  // Update bracket display
  renderBracket();
  
  // Update the tournament summary
  updateTournamentSummary();
  
  // Save tournament state
  saveTournamentState();
  
  // Show notification
  showInfoMessage('Match result saved successfully!', 'success');
}

/**
 * Update player statistics
 */
function updatePlayerStats(winnerId, loserId) {
  // Find the players
  const winnerIndex = tournamentPlayers.findIndex(p => p.id === winnerId);
  const loserIndex = tournamentPlayers.findIndex(p => p.id === loserId);
  
  // Update winner stats
  if (winnerIndex !== -1) {
    if (!tournamentPlayers[winnerIndex].wins) {
      tournamentPlayers[winnerIndex].wins = 0;
    }
    tournamentPlayers[winnerIndex].wins++;
  }
  
  // Update loser stats
  if (loserIndex !== -1) {
    if (!tournamentPlayers[loserIndex].losses) {
      tournamentPlayers[loserIndex].losses = 0;
    }
    tournamentPlayers[loserIndex].losses++;
  }
  
  // Save updated players
  localStorage.setItem('tekkenTournamentPlayers', JSON.stringify(tournamentPlayers));
}

/**
 * Advance winner to next match
 */
function advancePlayerToNextMatch(match) {
  // Find the next match
  const nextMatchIndex = bracketMatches.findIndex(m => m.id === match.nextMatchId);
  if (nextMatchIndex === -1) return;
  
  const nextMatch = bracketMatches[nextMatchIndex];
  const isEvenPosition = match.bracketPosition % 2 === 0;
  
  // In single elimination, even positions go to player2, odd to player1
  if (isEvenPosition) {
    nextMatch.player2Id = match.winnerId;
  } else {
    nextMatch.player1Id = match.winnerId;
  }
  
  // If both players are set, update match status
  if (nextMatch.player1Id && nextMatch.player2Id) {
    nextMatch.status = 'upcoming';
  }
  
  // Special handling for final match
  if (match.nextMatchId === 'final') {
    const finalMatch = bracketMatches.find(m => m.id === 'match-final');
    if (finalMatch) {
      finalMatch.player1Id = match.winnerId;
      
      // If both finalists are ready, update match status
      if (finalMatch.player1Id && finalMatch.player2Id) {
        finalMatch.status = 'upcoming';
      }
    }
  }
  
  // Update the current round based on the most recent match
  tournamentState.currentRound = Math.max(match.round, tournamentState.currentRound);
}

/**
 * Check if tournament is completed
 */
function checkTournamentCompletion() {
  // Find the final match
  let finalMatch;
  
  if (tournamentState.type === 'single') {
    // In single elimination, it's the match with the highest round
    const maxRound = Math.max(...bracketMatches.map(m => m.round));
    finalMatch = bracketMatches.find(m => m.round === maxRound);
  } else {
    // In double elimination, it's the match marked as final
    finalMatch = bracketMatches.find(m => m.isFinal);
  }
  
  // Check if the final match is completed
  if (finalMatch && finalMatch.status === 'completed') {
    tournamentState.status = 'completed';
    tournamentState.winner = finalMatch.winnerId;
    
    // Show tournament winner notification
    const winner = getPlayerById(finalMatch.winnerId);
    if (winner) {
      showInfoMessage(`Tournament completed! The winner is: ${winner.name}`, 'success');
    }
  }
}

/**
 * Update tournament summary
 */
function updateTournamentSummary() {
  // Update player count
  playerCountEl.textContent = tournamentPlayers.length;
  
  // Update match count (exclude pending matches)
  const matchCount = bracketMatches.filter(m => m.player1Id && m.player2Id).length;
  matchCountEl.textContent = matchCount;
  
  // Update current round
  currentRoundEl.textContent = tournamentState.currentRound || '-';
  
  // Update tournament status
  let statusText = 'Not Started';
  if (tournamentState.status === 'in_progress') {
    statusText = 'In Progress';
  } else if (tournamentState.status === 'completed') {
    statusText = 'Completed';
  }
  tournamentStatusEl.textContent = statusText;
  
  // If tournament is completed, highlight the winner
  if (tournamentState.status === 'completed' && tournamentState.winner) {
    const winner = getPlayerById(tournamentState.winner);
    if (winner) {
      tournamentStatusEl.textContent = `Winner: ${winner.name}`;
    }
  }
}

/**
 * Reset tournament
 */
function resetTournament() {
  // Clear bracket matches
  bracketMatches = [];
  
  // Reset tournament state
  tournamentState = {
    type: bracketTypeSelectEl.value, // Keep current type selection
    status: 'not_started',
    currentRound: 0,
    currentMatch: null,
    winner: null
  };
  
  // Disable reset button
  btnResetBracketEl.disabled = true;
  
  // Hide match detail
  matchDetailEl.classList.add('hidden');
  
  // Clear bracket display
  bracketDisplayEl.innerHTML = '';
  bracketDisplayEl.classList.add('hidden');
  
  // Show loading placeholder
  loadingBracketEl.classList.remove('hidden');
  
  // Delete saved tournament state
  localStorage.removeItem('tournamentBracketState');
  localStorage.removeItem('tournamentBracketMatches');
  
  // Update the tournament summary
  updateTournamentSummary();
  
  // Re-validate player count
  validatePlayerCount();
  
  // Show notification
  showInfoMessage('Tournament bracket has been reset. Generate a new bracket to start again.', 'warning');
}

/**
 * Save tournament state
 */
function saveTournamentState() {
  // Save tournament state
  localStorage.setItem('tournamentBracketState', JSON.stringify(tournamentState));
  
  // Save bracket matches
  localStorage.setItem('tournamentBracketMatches', JSON.stringify(bracketMatches));
}

/**
 * Get player by ID
 */
function getPlayerById(playerId) {
  if (!playerId) return null;
  return tournamentPlayers.find(p => p.id === playerId) || null;
}

/**
 * Show info message
 */
function showInfoMessage(message, type = 'info') {
  // Create message element
  const msgDiv = document.createElement('div');
  msgDiv.className = `info-message info-${type}`;
  msgDiv.textContent = message;
  
  // Find bracket container to insert before the first element
  const bracketContainer = document.querySelector('.bracket-container');
  bracketContainer.insertBefore(msgDiv, bracketContainer.firstChild);
  
  // Automatically remove after 5 seconds
  setTimeout(() => {
    msgDiv.style.opacity = '0';
    msgDiv.style.transition = 'opacity 0.5s';
    
    setTimeout(() => {
      if (msgDiv.parentNode) {
        msgDiv.parentNode.removeChild(msgDiv);
      }
    }, 500);
  }, 5000);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', initTournamentPage);

// Make the status indicator draggable
document.addEventListener('DOMContentLoaded', function() {
  const statusIndicator = document.getElementById('db-status');
  let isDragging = false;
  let offsetX, offsetY;
  
  // Load saved position from localStorage if available
  const savedPosition = localStorage.getItem('statusPosition');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      statusIndicator.style.left = position.left;
      statusIndicator.style.top = position.top;
      statusIndicator.style.bottom = 'auto';
      statusIndicator.style.right = 'auto';
    } catch (e) {
      console.error('Error loading saved position:', e);
    }
  }
  
  // Handle mouse down event to start dragging
  statusIndicator.addEventListener('mousedown', function(e) {
    isDragging = true;
    
    // Calculate the offset from the mouse to the element's top-left corner
    const rect = statusIndicator.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Add a dragging class for visual feedback
    statusIndicator.classList.add('dragging');
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  // Handle mouse move event to drag the element
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    // Calculate new position based on mouse position and offset
    let left = e.clientX - offsetX;
    let top = e.clientY - offsetY;
    
    // Keep element within viewport bounds
    const width = statusIndicator.offsetWidth;
    const height = statusIndicator.offsetHeight;
    
    left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - height - 10));
    
    // Set the new position
    statusIndicator.style.left = left + 'px';
    statusIndicator.style.top = top + 'px';
    statusIndicator.style.bottom = 'auto';
    statusIndicator.style.right = 'auto';
  });
  
  // Handle mouse up event to stop dragging
  document.addEventListener('mouseup', function() {
    if (isDragging) {
      // Save position to localStorage
      const position = {
        left: statusIndicator.style.left,
        top: statusIndicator.style.top
      };
      localStorage.setItem('statusPosition', JSON.stringify(position));
      
      // Remove visual feedback
      statusIndicator.classList.remove('dragging');
      isDragging = false;
    }
  });
  
  // Handle mouse leaving the window
  document.addEventListener('mouseleave', function() {
    if (isDragging) {
      statusIndicator.classList.remove('dragging');
      isDragging = false;
    }
  });
});