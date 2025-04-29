// Admin Panel Script with Database Integration

// Global variables
let players = [];
let playerQueue = [];
let currentMatches = [];
let editingPlayerId = null;

// DOM elements
let playerForm, playerNameInput, playerDepartmentInput, playerWinsInput, playerLossesInput;
let addPlayerBtn, updatePlayerBtn, cancelEditBtn, playerListBody, queueContainer, matchesContainer;
let autoPairBtn, clearQueueBtn, addToQueueBtn;

// Update database status indicator
function updateDBStatus(status) {
  const statusEl = document.querySelector('#db-status .status');
  statusEl.textContent = status === 'connected' ? 'Connected' : 'Error';
  statusEl.className = `status ${status}`;
  
  // Add last sync time if connected
  if (status === 'connected') {
    // Remove existing last sync if it exists
    const existingSync = document.querySelector('.last-sync');
    if (existingSync) existingSync.remove();
    
    // Create compact time display to prevent overlap
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const lastSyncEl = document.createElement('span');
    lastSyncEl.className = 'last-sync';
    lastSyncEl.textContent = `(${timeString})`;
    document.getElementById('db-status').appendChild(lastSyncEl);
  }
}

// Initialize the page
async function initializePage() {
  // Get DOM elements
  playerForm = document.getElementById('player-form');
  playerNameInput = document.getElementById('player-name');
  playerDepartmentInput = document.getElementById('player-department');
  playerWinsInput = document.getElementById('player-wins');
  playerLossesInput = document.getElementById('player-losses');
  addPlayerBtn = document.getElementById('add-player-btn');
  updatePlayerBtn = document.getElementById('update-player-btn');
  cancelEditBtn = document.getElementById('cancel-edit-btn');
  playerListBody = document.getElementById('player-list-body');
  queueContainer = document.getElementById('queue-container');
  matchesContainer = document.getElementById('matches-container');
  autoPairBtn = document.getElementById('auto-pair-btn');
  clearQueueBtn = document.getElementById('clear-queue-btn');
  addToQueueBtn = document.getElementById('add-to-queue-btn');
  
  // Tournament management elements
  const tournamentPlayerNameInput = document.getElementById('tournament-player-name');
  const tournamentPlayerDepartmentInput = document.getElementById('tournament-player-department');
  const tournamentPlayerSkillInput = document.getElementById('tournament-player-skill');
  const addTournamentPlayerBtn = document.getElementById('add-tournament-player-btn');
  const clearPlayerFormBtn = document.getElementById('clear-player-form-btn');
  const tournamentPlayersTable = document.getElementById('tournament-players-list');
  const prizePerPlayerInput = document.getElementById('prize-per-player');
  const maxPrizePoolInput = document.getElementById('max-prize-pool');
  const maxPrizeDisplay = document.getElementById('max-prize-display');
  const saveTournamentSettingsBtn = document.getElementById('save-tournament-settings-btn');
  const viewDashboardBtn = document.getElementById('view-dashboard-btn');
  
  try {
    // Wait for database to initialize
    await TekkenDB.init();
    updateDBStatus('connected');
    
    // Load initial data
    await loadData();
    
    // Add event listeners
    setupEventListeners();
    
    // Set up data change listener
    window.addEventListener('database-updated', handleDatabaseUpdate);
    
    // Initialize tournament management
    if (tournamentPlayerNameInput) {
      initializeTournamentManagement();
    }
    
    console.log('Admin panel initialized successfully');
  } catch (error) {
    console.error('Error initializing admin panel:', error);
    updateDBStatus('error');
  }
}

// Load all data from database
async function loadData() {
  try {
    // Load players data
    players = await TekkenDB.players.getAll();
    
    // Load queue data
    const queueData = await TekkenDB.queue.getAll();
    playerQueue = queueData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Load match data
    const matchData = await TekkenDB.matches.getAll();
    currentMatches = matchData.filter(m => m.status === 'active')
                             .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Load department data
    const departments = await TekkenDB.departments.getAll();
    populateDepartmentsDropdown(departments);
    
    // Render UI
    renderPlayerList();
    renderQueue();
    renderMatches();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Form submission event
  playerForm.addEventListener('submit', handleAddPlayer);
  
  // Button click events
  updatePlayerBtn.addEventListener('click', updatePlayer);
  cancelEditBtn.addEventListener('click', cancelEdit);
  autoPairBtn.addEventListener('click', autoPairPlayers);
  clearQueueBtn.addEventListener('click', clearQueue);
  addToQueueBtn.addEventListener('click', addSelectedToQueue);
  document.getElementById('add-department-btn').addEventListener('click', showAddDepartmentForm);
  document.getElementById('save-department-btn').addEventListener('click', saveNewDepartment);
  document.getElementById('cancel-department-btn').addEventListener('click', cancelAddDepartment);
  
  // Tournament management button events (if they exist)
  if (document.getElementById('add-tournament-player-btn')) {
    document.getElementById('add-tournament-player-btn').addEventListener('click', addTournamentPlayer);
  }
  
  if (document.getElementById('clear-player-form-btn')) {
    document.getElementById('clear-player-form-btn').addEventListener('click', clearPlayerForm);
  }
  
  if (document.getElementById('max-prize-pool')) {
    document.getElementById('max-prize-pool').addEventListener('input', updatePrizePoolDisplay);
  }
  
  if (document.getElementById('prize-per-player')) {
    document.getElementById('prize-per-player').addEventListener('input', updatePreviewDisplay);
  }
  
  if (document.getElementById('manual-prize-pool-toggle')) {
    document.getElementById('manual-prize-pool-toggle').addEventListener('change', function() {
      // Toggle visibility of automatic vs manual settings
      const isManual = this.checked;
      document.getElementById('automatic-prize-settings').style.display = isManual ? 'none' : 'block';
      document.getElementById('manual-prize-settings').style.display = isManual ? 'block' : 'none';
      // Update preview when toggle changes
      updatePreviewDisplay();
    });
  }
  
  if (document.getElementById('manual-prize-pool')) {
    document.getElementById('manual-prize-pool').addEventListener('input', updatePreviewDisplay);
  }
  
  if (document.getElementById('save-tournament-settings-btn')) {
    document.getElementById('save-tournament-settings-btn').addEventListener('click', saveTournamentSettings);
  }
  
  if (document.getElementById('view-dashboard-btn')) {
    document.getElementById('view-dashboard-btn').addEventListener('click', function() {
      window.location.href = 'index.html';
    });
  }
}

// Handle database update events
function handleDatabaseUpdate(event) {
  const { type, action, data } = event.detail;
  
  console.log(`DB update: ${type} - ${action}`);
  
  // Update status indicator with new sync time
  updateDBStatus('connected');
  
  // Reload data based on what changed
  switch (type) {
    case 'player':
      TekkenDB.players.getAll().then(data => {
        players = data;
        renderPlayerList();
      });
      break;
      
    case 'queue':
      TekkenDB.queue.getAll().then(data => {
        playerQueue = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        renderQueue();
      });
      break;
      
    case 'match':
      TekkenDB.matches.getAll().then(data => {
        currentMatches = data.filter(m => m.status === 'active')
                              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        renderMatches();
      });
      break;
      
    case 'department':
      TekkenDB.departments.getAll().then(departments => {
        populateDepartmentsDropdown(departments);
      });
      break;
  }
}

// PLAYER FUNCTIONS //

// Populate departments dropdown
async function populateDepartmentsDropdown(departments) {
  const select = document.getElementById('player-department');
  const departmentList = document.getElementById('department-management');
  
  if (!departmentList) {
    // Create department management panel if it doesn't exist
    const adminPanel = document.querySelector('.admin-panel');
    const managementPanel = document.createElement('div');
    managementPanel.className = 'department-management-panel';
    managementPanel.id = 'department-management';
    managementPanel.innerHTML = `
      <h3>Department Management</h3>
      <div class="department-list"></div>
    `;
    adminPanel.appendChild(managementPanel);
  }
  
  const departmentListContainer = document.querySelector('.department-list');
  if (departmentListContainer) {
    departmentListContainer.innerHTML = '';
  }
  
  // Default departments
  const defaultDepartments = ['Engineering', 'Marketing', 'Finance', 'HR', 'IT'];
  
  // Keep the default options
  const defaultOptions = Array.from(select.options).filter(option => {
    return defaultDepartments.includes(option.value);
  });
  
  // Clear and add default options
  select.innerHTML = '';
  defaultOptions.forEach(option => select.appendChild(option));
  
  // Get full department details
  const departmentDetails = await TekkenDB.departments.getDetails();
  
  // Add all departments to dropdown
  departments.forEach(dept => {
    // Check if this is not already in the dropdown
    if (!select.querySelector(`option[value="${dept}"]`)) {
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = dept;
      select.appendChild(option);
    }
  });
  
  // Display custom departments in management panel with delete option
  if (departmentListContainer) {
    departmentDetails.forEach(dept => {
      // Only show custom departments in the management panel
      if (dept.isCustom && !defaultDepartments.includes(dept.name)) {
        const deptElement = document.createElement('div');
        deptElement.className = 'department-item';
        deptElement.innerHTML = `
          <span>${dept.name}</span>
          <span>Added: ${new Date(dept.createdAt).toLocaleDateString()}</span>
          <button class="action-button danger-button" data-delete-dept="${dept.name}">Delete</button>
        `;
        departmentListContainer.appendChild(deptElement);
      }
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('[data-delete-dept]').forEach(button => {
      button.addEventListener('click', async function() {
        const deptName = this.getAttribute('data-delete-dept');
        if (confirm(`Are you sure you want to delete department ${deptName}?`)) {
          try {
            // Check if any players use this department
            const playersWithDept = players.filter(p => p.department === deptName);
            
            if (playersWithDept.length > 0) {
              alert(`Cannot delete department "${deptName}" because it is used by ${playersWithDept.length} players.`);
              return;
            }
            
            await TekkenDB.departments.delete(deptName);
            // Reload departments
            const updatedDepartments = await TekkenDB.departments.getAll();
            populateDepartmentsDropdown(updatedDepartments);
          } catch (error) {
            console.error('Error deleting department:', error);
            alert('Error deleting department');
          }
        }
      });
    });
  }
}

// Function to render player list
function renderPlayerList() {
  playerListBody.innerHTML = '';
  
  const sortedPlayers = [...players].sort((a, b) => b.wins - a.wins);
  
  sortedPlayers.forEach(player => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${player.name}</td>
      <td>${player.department}</td>
      <td>${player.wins}/${player.losses}</td>
      <td class="action-buttons">
        <button class="action-button success-button" data-action="edit" data-id="${player.id}">Edit</button>
        <button class="action-button danger-button" data-action="delete" data-id="${player.id}">Delete</button>
        <button class="action-button" data-action="queue" data-id="${player.id}">Queue</button>
        <button class="action-button" data-action="queue" data-id="${player.id}" title="Add another instance of this player to queue">+</button>
      </td>
    `;
    
    playerListBody.appendChild(row);
  });
  
  // Add event listeners to action buttons
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', handlePlayerAction);
  });
}

// Function to handle player form submission (add new player)
async function handleAddPlayer(e) {
  e.preventDefault();
  
  const name = playerNameInput.value.trim();
  const department = playerDepartmentInput.value;
  const wins = parseInt(playerWinsInput.value) || 0;
  const losses = parseInt(playerLossesInput.value) || 0;
  
  if (name === '') {
    alert('Player name is required');
    return;
  }
  
  try {
    // Check if we're editing or adding
    if (editingPlayerId !== null) {
      // Update existing player
      const player = await TekkenDB.players.getById(editingPlayerId);
      if (player) {
        player.name = name;
        player.department = department;
        player.wins = wins;
        player.losses = losses;
        player.lastUpdated = new Date().toISOString();
        
        await TekkenDB.players.save(player);
      }
      
      // Reset edit mode
      editingPlayerId = null;
      addPlayerBtn.textContent = 'Add Player';
      updatePlayerBtn.disabled = true;
      cancelEditBtn.disabled = true;
    } else {
      // Add new player
      const newPlayerId = players.length > 0 
        ? Math.max(...players.map(p => p.id)) + 1 
        : 1;
        
      const newPlayer = {
        id: newPlayerId,
        name,
        department,
        wins,
        losses,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      await TekkenDB.players.save(newPlayer);
    }
    
    // Reset form
    playerForm.reset();
  } catch (error) {
    console.error('Error saving player:', error);
    alert('Error saving player data');
  }
}

// Function to handle player actions (edit, delete, queue)
async function handlePlayerAction(e) {
  const action = this.getAttribute('data-action');
  const playerId = parseInt(this.getAttribute('data-id'));
  
  try {
    const player = await TekkenDB.players.getById(playerId);
    if (!player) return;
    
    switch (action) {
      case 'edit':
        // Set form fields to player values
        playerNameInput.value = player.name;
        playerDepartmentInput.value = player.department;
        playerWinsInput.value = player.wins;
        playerLossesInput.value = player.losses;
        
        // Update UI for editing
        editingPlayerId = player.id;
        addPlayerBtn.textContent = 'Save New Player';
        updatePlayerBtn.disabled = false;
        cancelEditBtn.disabled = false;
        break;

      case 'delete':
        if (confirm(`Are you sure you want to delete ${player.name}?`)) {
          await TekkenDB.players.delete(playerId);
          
          // Also remove from queue if present
          const queueEntries = playerQueue.filter(entry => entry.playerId === playerId);
          for (const entry of queueEntries) {
            await TekkenDB.queue.remove(entry.entryId);
          }
        }
        break;

      case 'queue':
        await addToQueue(playerId);
        break;
    }
  } catch (error) {
    console.error('Error performing player action:', error);
    alert('Error performing action');
  }
}

// Function to update player
async function updatePlayer() {
  if (editingPlayerId === null) return;
  
  try {
    const name = playerNameInput.value.trim();
    const department = playerDepartmentInput.value;
    const wins = parseInt(playerWinsInput.value) || 0;
    const losses = parseInt(playerLossesInput.value) || 0;
    
    if (name === '') {
      alert('Player name is required');
      return;
    }
    
    // Update the player
    const player = await TekkenDB.players.getById(editingPlayerId);
    if (player) {
      player.name = name;
      player.department = department;
      player.wins = wins;
      player.losses = losses;
      player.lastUpdated = new Date().toISOString();
      
      await TekkenDB.players.save(player);
      
      // Reset form
      playerForm.reset();
      editingPlayerId = null;
      addPlayerBtn.textContent = 'Add Player';
      updatePlayerBtn.disabled = true;
      cancelEditBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error updating player:', error);
    alert('Error updating player');
  }
}

// Function to cancel edit
function cancelEdit() {
  playerForm.reset();
  editingPlayerId = null;
  addPlayerBtn.textContent = 'Add Player';
  updatePlayerBtn.disabled = true;
  cancelEditBtn.disabled = true;
}

// QUEUE FUNCTIONS //

// Function to render queue
function renderQueue() {
  queueContainer.innerHTML = '';
  
  if (playerQueue.length === 0) {
    queueContainer.innerHTML = '<p>No players in queue</p>';
    return;
  }
  
  // Group players by ID to show counts
  const playerCounts = {};
  playerQueue.forEach((entry, index) => {
    const playerId = entry.playerId;
    if (!playerCounts[playerId]) {
      playerCounts[playerId] = {
        count: 0,
        entries: []
      };
    }
    playerCounts[playerId].count++;
    playerCounts[playerId].entries.push(entry);
  });
  
  // Render each queue entry
  Object.entries(playerCounts).forEach(([playerId, data]) => {
    const player = players.find(p => p.id === parseInt(playerId));
    if (player) {
      const count = data.count;
      const firstEntry = data.entries[0];
      
      const queueItem = document.createElement('div');
      queueItem.className = 'queue-item';
      queueItem.innerHTML = `
        <span>${player.name} (${player.department})${count > 1 ? ` Ã—${count}` : ''}</span>
        <div>
          <span class="queue-time">${formatTimeAgo(firstEntry.timestamp)}</span>
          <button class="action-button danger-button" data-queue-remove="${firstEntry.entryId}">Remove</button>
          ${count > 1 ? `<button class="action-button danger-button" data-queue-remove-all="${playerId}">Remove All</button>` : ''}
        </div>
      `;
      
      queueContainer.appendChild(queueItem);
    }
  });
  
  // Add event listeners to remove buttons
  document.querySelectorAll('[data-queue-remove]').forEach(button => {
    button.addEventListener('click', async function() {
      const entryId = parseInt(this.getAttribute('data-queue-remove'));
      await removeFromQueue(entryId);
    });
  });
  
  document.querySelectorAll('[data-queue-remove-all]').forEach(button => {
    button.addEventListener('click', async function() {
      const playerId = parseInt(this.getAttribute('data-queue-remove-all'));
      await removeAllFromQueue(playerId);
    });
  });
}

// Format time ago
function formatTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

// Function to add player to queue
async function addToQueue(playerId) {
  try {
    // Check if player is already in a match
    const playerInMatch = currentMatches.some(match => 
      match.player1Id === playerId || match.player2Id === playerId
    );
    
    if (playerInMatch) {
      alert('Player is already in a match');
      return;
    }
    
    // Add to queue with timestamp
    await TekkenDB.queue.add(playerId);
  } catch (error) {
    console.error('Error adding to queue:', error);
    alert('Error adding player to queue');
  }
}

// Function to remove player from queue
async function removeFromQueue(entryId) {
  try {
    await TekkenDB.queue.remove(entryId);
  } catch (error) {
    console.error('Error removing from queue:', error);
  }
}

// Function to remove all instances of a player from queue
async function removeAllFromQueue(playerId) {
  try {
    // Get all entries for this player
    const entries = playerQueue.filter(entry => entry.playerId === playerId);
    
    // Remove each entry
    for (const entry of entries) {
      await TekkenDB.queue.remove(entry.entryId);
    }
  } catch (error) {
    console.error('Error removing all from queue:', error);
  }
}

// MATCH FUNCTIONS //

// Function to render matches
function renderMatches() {
  matchesContainer.innerHTML = '';
  
  if (currentMatches.length === 0) {
    matchesContainer.innerHTML = '<p>No active matches</p>';
    return;
  }
  
  currentMatches.forEach((match, index) => {
    const player1 = players.find(p => p.id === match.player1Id);
    const player2 = players.find(p => p.id === match.player2Id);
    
    if (player1 && player2) {
      const matchItem = document.createElement('div');
      matchItem.className = 'match-item';
      
      const matchTime = formatTimeAgo(match.timestamp);
      
      matchItem.innerHTML = `
        <div>
          <span>${player1.name}</span>
          <span class="vs">VS</span>
          <span>${player2.name}</span>
        </div>
        <div>
          <span class="match-time">${matchTime}</span>
          <button class="action-button success-button" data-winner="${player1.id}" data-match="${match.matchId}">P1 Win</button>
          <button class="action-button success-button" data-winner="${player2.id}" data-match="${match.matchId}">P2 Win</button>
          <button class="action-button danger-button" data-match-cancel="${match.matchId}">Cancel</button>
        </div>
      `;
      
      matchesContainer.appendChild(matchItem);
    }
  });
  
  // Add event listeners to match buttons
  document.querySelectorAll('[data-winner]').forEach(button => {
    button.addEventListener('click', async function() {
      const winnerId = parseInt(this.getAttribute('data-winner'));
      const matchId = parseInt(this.getAttribute('data-match'));
      await recordMatchResult(matchId, winnerId);
    });
  });
  
  document.querySelectorAll('[data-match-cancel]').forEach(button => {
    button.addEventListener('click', async function() {
      const matchId = parseInt(this.getAttribute('data-match-cancel'));
      await cancelMatch(matchId);
    });
  });
}

// Function to auto-pair players from queue
async function autoPairPlayers() {
  try {
    // Get all queue entries
    const entries = await TekkenDB.queue.getAll();
    
    // Create a map of player IDs to track which have been paired
    const pairedPlayers = new Set();
    
    // Match players
    for (let i = 0; i < entries.length; i++) {
      if (pairedPlayers.has(entries[i].entryId)) continue;
      
      const player1Id = entries[i].playerId;
      
      // Find a second player to pair with
      let player2Entry = null;
      for (let j = 0; j < entries.length; j++) {
        if (i !== j && 
            !pairedPlayers.has(entries[j].entryId) && 
            entries[j].playerId !== player1Id) {
          player2Entry = entries[j];
          break;
        }
      }
      
      if (player2Entry) {
        const player2Id = player2Entry.playerId;
        
        // Mark as paired
        pairedPlayers.add(entries[i].entryId);
        pairedPlayers.add(player2Entry.entryId);
        
        // Create a match
        await TekkenDB.matches.create(player1Id, player2Id);
        
        // Remove from queue
        await TekkenDB.queue.remove(entries[i].entryId);
        await TekkenDB.queue.remove(player2Entry.entryId);
      }
    }
  } catch (error) {
    console.error('Error pairing players:', error);
  }
}

// Function to clear the queue
async function clearQueue() {
  if (confirm('Are you sure you want to clear the queue?')) {
    try {
      await TekkenDB.queue.clear();
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }
}

// Function to record match result
async function recordMatchResult(matchId, winnerId) {
  try {
    const match = currentMatches.find(m => m.matchId === matchId);
    if (!match) return;
    
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
    
    // Update the match and player stats with current timestamp
    await TekkenDB.matches.resolve(matchId, winnerId, loserId);
    
    // Log the match completion time
    console.log(`Match completed at ${new Date().toLocaleTimeString()}. Winner: ${winnerId}, Loser: ${loserId}`);
  } catch (error) {
    console.error('Error recording match result:', error);
  }
}

// Function to cancel a match
async function cancelMatch(matchId) {
  try {
    const match = currentMatches.find(m => m.matchId === matchId);
    if (!match) return;
    
    // Get player IDs from the match
    const player1Id = match.player1Id;
    const player2Id = match.player2Id;
    
    // Delete the match
    await TekkenDB.matches.delete(matchId);
    
    // Add players back to queue
    await TekkenDB.queue.add(player1Id);
    await TekkenDB.queue.add(player2Id);
  } catch (error) {
    console.error('Error canceling match:', error);
  }
}

// Function to add selected players to queue
async function addSelectedToQueue() {
  const checkboxes = document.querySelectorAll('input[name="player-select"]:checked');
  
  if (checkboxes.length === 0) {
    alert('No players selected');
    return;
  }
  
  try {
    for (const checkbox of checkboxes) {
      const playerId = parseInt(checkbox.value);
      await TekkenDB.queue.add(playerId);
    }
  } catch (error) {
    console.error('Error adding selected players to queue:', error);
  }
}

// DEPARTMENT FUNCTIONS //

// Function to add new department
function showAddDepartmentForm() {
  document.getElementById('player-department').disabled = true;
  document.getElementById('new-department-group').style.display = 'block';
  document.getElementById('add-department-btn').disabled = true;
}

// Function to cancel adding department
function cancelAddDepartment() {
  document.getElementById('player-department').disabled = false;
  document.getElementById('new-department-group').style.display = 'none';
  document.getElementById('add-department-btn').disabled = false;
  document.getElementById('new-department').value = '';
}

// Function to save new department
async function saveNewDepartment() {
  const newDepartment = document.getElementById('new-department').value.trim();
  if (!newDepartment) {
    alert('Please enter a department name');
    return;
  }
  
  try {
    // Check if department already exists
    const departments = await TekkenDB.departments.getAll();
    if (departments.includes(newDepartment)) {
      alert('This department already exists');
      return;
    }
    
    // Add new department
    await TekkenDB.departments.add(newDepartment);
    
    // Update the dropdown and select the new option
    const select = document.getElementById('player-department');
    const option = document.createElement('option');
    option.value = newDepartment;
    option.textContent = newDepartment;
    select.appendChild(option);
    select.value = newDepartment;
    
    // Hide the new department form
    cancelAddDepartment();
  } catch (error) {
    console.error('Error saving department:', error);
  }
}

// Tournament Management Functions

// Tournament settings
let tournamentSettings = {
  maxPlayers: 20,
  prizePerPlayer: 20,
  maxPrizePool: 2000
};

// Tournament players
let tournamentPlayers = [];

function initializeTournamentManagement() {
  // Load settings and players
  loadTournamentSettings();
  loadTournamentPlayers();
  
  // Initialize preview display
  updatePreviewDisplay();
}

// Load settings from localStorage
function loadTournamentSettings() {
  const savedSettings = JSON.parse(localStorage.getItem('tekkenSettings'));
  if (savedSettings) {
    tournamentSettings = {...tournamentSettings, ...savedSettings};
  }
  
  // Apply settings to form inputs
  document.getElementById('prize-per-player').value = tournamentSettings.prizePerPlayer;
  document.getElementById('max-prize-pool').value = tournamentSettings.maxPrizePool;
  
  // Check if using manual prize pool
  if (tournamentSettings.useManualPrizePool) {
    document.getElementById('manual-prize-pool-toggle').checked = true;
    document.getElementById('manual-prize-pool').value = tournamentSettings.manualPrizePool || 0;
    
    // Toggle visibility of settings panels
    document.getElementById('automatic-prize-settings').style.display = 'none';
    document.getElementById('manual-prize-settings').style.display = 'block';
  } else {
    document.getElementById('manual-prize-pool-toggle').checked = false;
    document.getElementById('automatic-prize-settings').style.display = 'block';
    document.getElementById('manual-prize-settings').style.display = 'none';
  }
  
  // Update display
  document.getElementById('max-prize-display').textContent = `${tournamentSettings.maxPrizePool} Rs`;
}

// Load tournament players from localStorage
function loadTournamentPlayers() {
  const savedPlayers = JSON.parse(localStorage.getItem('tekkenTournamentPlayers'));
  if (savedPlayers) {
    tournamentPlayers = savedPlayers;
  }
  
  // Render players table
  renderTournamentPlayers();
}

// Update prize pool display when slider changes
function updatePrizePoolDisplay() {
  const value = this.value;
  document.getElementById('max-prize-display').textContent = `${value} Rs`;
  updatePreviewDisplay();
}

// Update preview display based on current settings
function updatePreviewDisplay() {
  const playerCount = tournamentPlayers.length;
  const prizePerPlayer = parseInt(document.getElementById('prize-per-player').value) || 20;
  const maxPrizePool = parseInt(document.getElementById('max-prize-pool').value) || 2000;
  
  // Check if manual override is enabled
  const isManual = document.getElementById('manual-prize-pool-toggle').checked;
  let prizePool;
  
  if (isManual) {
    // Get manual prize pool value
    prizePool = parseInt(document.getElementById('manual-prize-pool').value) || 0;
  } else {
    // Calculate prize pool (capped at max prize pool)
    prizePool = Math.min(playerCount * prizePerPlayer, maxPrizePool);
  }
  
  // Update preview elements
  document.getElementById('preview-player-count').textContent = playerCount;
  document.getElementById('preview-prize-pool').textContent = `${prizePool} rs`;
  
  // Animate prize pool fill based on percentage of max prize pool
  const fillPercentage = Math.min(100, (prizePool / maxPrizePool) * 100);
  document.getElementById('preview-prize-fill').style.width = `${fillPercentage}%`;
}

// Function to render tournament players
function renderTournamentPlayers() {
  const tournamentPlayersTable = document.getElementById('tournament-players-list');
  if (!tournamentPlayersTable) return;
  
  // Clear existing table rows
  tournamentPlayersTable.innerHTML = '';
  
  if (tournamentPlayers.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="4" style="text-align: center;">No tournament players registered yet</td>`;
    tournamentPlayersTable.appendChild(emptyRow);
    return;
  }
  
  // Add each player to the table
  tournamentPlayers.forEach((player, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${player.name}</td>
      <td>${player.department}</td>
      <td>${player.skillLevel}</td>
      <td>
        <div class="action-buttons">
          <button class="action-button danger-button" data-tournament-player-remove="${index}">Remove</button>
        </div>
      </td>
    `;
    tournamentPlayersTable.appendChild(row);
  });
  
  // Add event listeners for action buttons
  document.querySelectorAll('[data-tournament-player-remove]').forEach(button => {
    button.addEventListener('click', removeTournamentPlayer);
  });
}

// Function to add a tournament player
function addTournamentPlayer() {
  const nameInput = document.getElementById('tournament-player-name');
  const departmentInput = document.getElementById('tournament-player-department');
  const skillInput = document.getElementById('tournament-player-skill');
  
  const name = nameInput.value.trim();
  const department = departmentInput.value.trim();
  const skillLevel = parseInt(skillInput.value) || 5;
  
  if (!name || !department) {
    alert('Please enter player name and department');
    return;
  }
  
  // Create new tournament player
  const newPlayer = {
    id: Date.now(), // Use timestamp as unique ID
    name,
    department,
    skillLevel,
    wins: 0,
    losses: 0,
    createdAt: new Date().toISOString()
  };
  
  // Add to tournament players array
  tournamentPlayers.push(newPlayer);
  
  // Save to localStorage
  saveTournamentPlayers();
  
  // Render updated list
  renderTournamentPlayers();
  
  // Clear form
  clearPlayerForm();
  
  // Update preview display
  updatePreviewDisplay();
  
  // Update dashboard stats
  updateDashboardStats();
}

// Function to remove a tournament player
function removeTournamentPlayer() {
  const index = parseInt(this.getAttribute('data-tournament-player-remove'));
  if (index >= 0 && index < tournamentPlayers.length) {
    if (confirm(`Remove ${tournamentPlayers[index].name} from tournament?`)) {
      tournamentPlayers.splice(index, 1);
      saveTournamentPlayers();
      renderTournamentPlayers();
      updatePreviewDisplay();
      updateDashboardStats();
    }
  }
}

// Function to clear the player form
function clearPlayerForm() {
  document.getElementById('tournament-player-name').value = '';
  document.getElementById('tournament-player-department').value = '';
  document.getElementById('tournament-player-skill').value = 5;
}

// Function to save tournament players to localStorage
function saveTournamentPlayers() {
  localStorage.setItem('tekkenTournamentPlayers', JSON.stringify(tournamentPlayers));
}

// Function to save tournament settings
function saveTournamentSettings() {
  // Check if we're using manual prize pool
  const isManual = document.getElementById('manual-prize-pool-toggle').checked;
  
  if (isManual) {
    // Get the manual prize pool value
    const manualPrizePool = parseInt(document.getElementById('manual-prize-pool').value) || 0;
    const maxPrizePool = parseInt(document.getElementById('max-prize-pool').value) || 2000;
    
    // Update settings with manual override
    tournamentSettings = {
      prizePerPlayer: 20, // Keep default value
      maxPrizePool: maxPrizePool,
      manualPrizePool: manualPrizePool,
      useManualPrizePool: true
    };
  } else {
    // Using automatic calculation
    const prizePerPlayer = parseInt(document.getElementById('prize-per-player').value) || 20;
    const maxPrizePool = parseInt(document.getElementById('max-prize-pool').value) || 2000;
    
    // Update settings without manual override
    tournamentSettings = {
      prizePerPlayer,
      maxPrizePool,
      useManualPrizePool: false
    };
  }
  
  // Save to localStorage
  localStorage.setItem('tekkenSettings', JSON.stringify(tournamentSettings));
  
  // Update dashboard stats
  updateDashboardStats();
  
  alert('Tournament settings saved successfully!');
}

// Function to update dashboard stats
function updateDashboardStats() {
  // Get tournament info
  const playerCount = tournamentPlayers.length;
  const prizePerPlayer = tournamentSettings.prizePerPlayer;
  const maxPrizePool = tournamentSettings.maxPrizePool;
  
  let prizePool;
  
  // Determine prize pool value based on settings
  if (tournamentSettings.useManualPrizePool) {
    // Use the manually set prize pool
    prizePool = tournamentSettings.manualPrizePool;
  } else {
    // Calculate prize pool based on formula (capped at max prize pool)
    prizePool = Math.min(playerCount * prizePerPlayer, maxPrizePool);
  }
  
  // Store tournament info for dashboard
  const tournamentInfo = {
    playerCount: playerCount,
    prizePool: prizePool,
    maxPrizePool: maxPrizePool,
    isManual: tournamentSettings.useManualPrizePool
  };
  
  console.log("Saving tournament info to localStorage:", tournamentInfo);
  localStorage.setItem('tekkenTournamentInfo', JSON.stringify(tournamentInfo));
  
  // Verify the data was stored properly by reading it back
  const savedData = localStorage.getItem('tekkenTournamentInfo');
  console.log("Verified saved tournament info:", savedData);
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initializePage);