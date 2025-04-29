// Dashboard Script with Database Integration

// Global variables
let players = [];
let currentMatches = [];
let updateInterval;

// Initialize the page
async function initializePage() {
  try {
    // Wait for database to initialize
    await TekkenDB.init();
    updateDBStatus('connected');
    
    // Load initial data
    await loadData();
    
    // Set up data change listener
    window.addEventListener('database-updated', handleDatabaseUpdate);
    
    // Set up auto-refresh
    updateInterval = setInterval(refreshData, 30000); // Refresh every 30 seconds
    
    console.log('Dashboard initialized successfully');
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    updateDBStatus('error');
  }
}

// Load all data from database
async function loadData() {
  try {
    // Load players data
    players = await TekkenDB.players.getSortedByWins();
    
    // Load match data
    const matchData = await TekkenDB.matches.getAll();
    currentMatches = matchData.filter(m => m.status === 'active')
                            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Render UI
    renderPlayers(players);
    renderMatches();
    updateTournamentStats();
    updateDepartmentStats();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Refresh data periodically
async function refreshData() {
  try {
    await loadData();
    console.log('Dashboard data refreshed at', new Date().toLocaleTimeString());
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
}

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

// Handle database update events
function handleDatabaseUpdate(event) {
  const { type, action, data } = event.detail;
  
  console.log(`DB update: ${type} - ${action}`);
  
  // Update status indicator with new sync time
  updateDBStatus('connected');
  
  // Reload data based on what changed
  switch (type) {
    case 'player':
      TekkenDB.players.getSortedByWins().then(data => {
        players = data;
        renderPlayers(players);
        updateTournamentStats();
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
      updateDepartmentStats();
      break;
  }
}

// Function to calculate win rate
function calculateWinRate(wins, losses) {
  const total = wins + losses;
  return total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
}

// Function to get win rate class based on percentage
function getWinRateClass(winRate) {
  const rate = parseFloat(winRate);
  if (rate >= 60) return "high-winrate";
  if (rate >= 45) return "medium-winrate";
  return "low-winrate";
}

// Function to update department statistics
async function updateDepartmentStats() {
  // Get all departments
  const departmentCounts = {};
  
  // Count players by department
  players.forEach(player => {
    if (!departmentCounts[player.department]) {
      departmentCounts[player.department] = {
        count: 0,
        contribution: 0
      };
    }
    departmentCounts[player.department].count++;
    departmentCounts[player.department].contribution += 20; // 20rs per player
  });
  
  // Update UI
  const deptContainer = document.getElementById('department-stats');
  deptContainer.innerHTML = '';
  
  Object.keys(departmentCounts).sort().forEach(dept => {
    const deptElement = document.createElement('div');
    deptElement.className = 'department';
    deptElement.innerHTML = `
      <span>${dept}</span>
      <span>${departmentCounts[dept].count} players</span>
    `;
    deptContainer.appendChild(deptElement);
  });
}

// Function to update tournament stats
function updateTournamentStats() {
  try {
    // Get tournament info from localStorage or use default values
    let tournamentInfo;
    const rawData = localStorage.getItem('tekkenTournamentInfo');
    
    // Log debug info
    console.log("Raw tournament info data:", rawData);
    
    if (rawData) {
      tournamentInfo = JSON.parse(rawData);
      console.log("Parsed tournament info:", tournamentInfo);
    } else {
      tournamentInfo = {
        playerCount: 0,
        prizePool: 0,
        maxPrizePool: 2000
      };
      console.log("Using default tournament info");
    }
    
    // Get tournament players if available (these are separate from regular players)
    const tournamentPlayers = JSON.parse(localStorage.getItem('tekkenTournamentPlayers')) || [];
    
    // Use tournament players count (not regular players)
    const playerCount = tournamentPlayers.length;
    const prizePool = tournamentInfo.prizePool || 0; // Ensure we have a number, not undefined
    const maxPrizePool = tournamentInfo.maxPrizePool || 2000; // Ensure we have a default max
    
    // Log what values we're about to display
    console.log(`Displaying prize pool: ${prizePool} of max ${maxPrizePool}`);
    
    // Update the DOM elements
    document.getElementById('prize-pool').textContent = `${prizePool} rs`;
    
    // Animate prize pool fill based on percentage of max prize pool
    const fillPercentage = Math.min(100, (prizePool / maxPrizePool) * 100);
    document.getElementById('prize-pool-fill').style.width = `${fillPercentage}%`;
    
    // Force a redraw by accessing offsetHeight (to trigger any CSS updates)
    document.getElementById('prize-pool-fill').offsetHeight;
    
  } catch (error) {
    console.error("Error updating tournament stats:", error);
    // Set fallback values if there's an error
    document.getElementById('prize-pool').textContent = "0 rs";
    document.getElementById('prize-pool-fill').style.width = "0%";
  }
}

// Function to render players data
function renderPlayers(playersList) {
  const tableBody = document.getElementById("players-data");
  tableBody.innerHTML = "";
  
  playersList.forEach((player, index) => {
    const winRate = calculateWinRate(player.wins, player.losses);
    const totalMatches = player.wins + player.losses;
    
    const row = document.createElement("tr");
    
    // Add special class for top 3 players
    if (index === 0) {
      row.className = 'rank-1';
    } else if (index === 1) {
      row.className = 'rank-2';
    } else if (index === 2) {
      row.className = 'rank-3';
    }
    
    row.innerHTML = `
      <td>
        <div class="player-cell">
          ${index < 3 ? `<span class="rank-badge">${index+1}</span>` : ''}
          <div class="player-name">${player.name}</div>
        </div>
      </td>
      <td>${player.wins}</td>
      <td class="win-rate ${getWinRateClass(winRate)}">${winRate}%</td>
      <td>${totalMatches}</td>
      <td>${player.department}</td>
    `;
    
    tableBody.appendChild(row);
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

// Function to render matches
function renderMatches() {
  const matchesContainer = document.getElementById('matches-display');
  matchesContainer.innerHTML = '';
  
  if (currentMatches.length === 0) {
    matchesContainer.innerHTML = '<p>No matches currently scheduled</p>';
    return;
  }
  
  // Sort matches by timestamp (when they were created/queued)
  const sortedMatches = [...currentMatches].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  sortedMatches.forEach((match, index) => {
    const player1 = players.find(p => p.id === match.player1Id);
    const player2 = players.find(p => p.id === match.player2Id);
    
    if (player1 && player2) {
      const matchCard = document.createElement('div');
      
      // Calculate win rates
      const winRate1 = calculateWinRate(player1.wins, player1.losses);
      const winRate2 = calculateWinRate(player2.wins, player2.losses);
      
      // Determine which player has higher win rate
      const winRateClass1 = getWinRateClass(winRate1);
      const winRateClass2 = getWinRateClass(winRate2);
      
      // Set card classes based on win rates and match status
      let cardClass = '';
      
      if (parseFloat(winRate1) > parseFloat(winRate2)) {
        cardClass = 'player1-winning';
      } else if (parseFloat(winRate2) > parseFloat(winRate1)) {
        cardClass = 'player2-winning';
      }
      
      // First match is the current one being played
      const isCurrentMatch = index === 0;
      if (isCurrentMatch) {
        cardClass += ' current-match';
      }
      
      matchCard.className = `match-card ${cardClass}`;
      
      // Add time information
      const matchTimeInfo = formatTimeAgo(match.timestamp);
      
      matchCard.innerHTML = `
        ${isCurrentMatch ? 
          `<div class="match-header">CURRENT MATCH <span class="match-time">${matchTimeInfo}</span></div>` : 
          `<div class="match-header">MATCH <span class="match-time">${matchTimeInfo}</span></div><div class="match-number">${index}</div>`
        }
        <div class="match-players">
          <div class="match-player">
            <div>${player1.name}</div>
            <div class="match-department">${player1.department}</div>
            <div class="win-rate-display ${winRateClass1}">${winRate1}%</div>
          </div>
          <div class="vs-badge">VS</div>
          <div class="match-player">
            <div>${player2.name}</div>
            <div class="match-department">${player2.department}</div>
            <div class="win-rate-display ${winRateClass2}">${winRate2}%</div>
          </div>
        </div>
      `;
      
      matchesContainer.appendChild(matchCard);
    }
  });
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const filteredPlayers = players.filter(player => 
        player.name.toLowerCase().includes(searchTerm)
      );
      
      renderPlayers(filteredPlayers);
    });
  }
}

// Clean up on page unload
function cleanUp() {
  // Clear the update interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  console.log('Dashboard cleanup complete');
}

// Add sample data if database is empty
async function addSampleDataIfEmpty() {
  try {
    const existingPlayers = await TekkenDB.players.getAll();
    
    // Only add sample data if no players exist yet
    if (existingPlayers.length === 0) {
      console.log('No players found, adding sample data...');
      
      // Sample players data from the original code
      const samplePlayers = [
        {
          id: 1,
          name: "Knee",
          department: "Engineering",
          wins: 482,
          losses: 201,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        },
        {
          id: 2,
          name: "JDCR",
          department: "Marketing",
          wins: 429,
          losses: 198,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        },
        {
          id: 3,
          name: "Arslan Ash",
          department: "Finance",
          wins: 401,
          losses: 187,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        },
        {
          id: 4,
          name: "Qudans",
          department: "Engineering",
          wins: 387,
          losses: 213,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
      ];
      
      // Save each player
      for (const player of samplePlayers) {
        await TekkenDB.players.save(player);
      }
      
      console.log('Sample data added successfully');
    }
  } catch (error) {
    console.error('Error adding sample data:', error);
  }
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializePage();
  await addSampleDataIfEmpty();
  setupSearch();
  
  // Handle page unload
  window.addEventListener('beforeunload', cleanUp);
});