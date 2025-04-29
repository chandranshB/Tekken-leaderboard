// Tekken Tournament Database
// This file manages all database operations using IndexedDB

// Database variables
let db;
const DB_NAME = 'tekkenTournament';
const DB_VERSION = 2; // Increased version for schema changes

// Initialize the database
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Open the database
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Handle database upgrade (or creation)
    request.onupgradeneeded = function(event) {
      db = event.target.result;
      const oldVersion = event.oldVersion;
      
      // Create object stores if they don't exist
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('players')) {
          const playerStore = db.createObjectStore('players', { keyPath: 'id' });
          playerStore.createIndex('byWins', 'wins', { unique: false });
          playerStore.createIndex('byDepartment', 'department', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'entryId', autoIncrement: true });
          queueStore.createIndex('byTimestamp', 'timestamp', { unique: false });
          queueStore.createIndex('byPlayerId', 'playerId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('matches')) {
          const matchStore = db.createObjectStore('matches', { keyPath: 'matchId', autoIncrement: true });
          matchStore.createIndex('byTimestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('departments')) {
          db.createObjectStore('departments', { keyPath: 'name' });
        }
        
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'name' });
        }
      }
      
      // Add tournament store for version 2
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('tournaments')) {
          const tournamentStore = db.createObjectStore('tournaments', { keyPath: 'id', autoIncrement: true });
          tournamentStore.createIndex('byName', 'name', { unique: true });
          tournamentStore.createIndex('byDate', 'startDate', { unique: false });
        }
      }
    };

    // Handle success
    request.onsuccess = function(event) {
      db = event.target.result;
      console.log("Database initialized successfully");
      
      // Set up data sync event listener
      db.onversionchange = function() {
        db.close();
        alert("Database is outdated, please reload the page.");
      };
      
      resolve(db);
    };

    // Handle errors
    request.onerror = function(event) {
      console.error("Database error:", event.target.error);
      reject(event.target.error);
    };
  });
}

// Player Operations
async function getAllPlayers() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['players'], 'readonly');
    const store = transaction.objectStore('players');
    const request = store.getAll();
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
    
    transaction.oncomplete = function() {
      // Transaction complete
    };
  });
}

async function getPlayerById(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['players'], 'readonly');
    const store = transaction.objectStore('players');
    const request = store.get(id);
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function savePlayer(player) {
  if (!player.lastUpdated) {
    player.lastUpdated = new Date().toISOString();
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['players'], 'readwrite');
    const store = transaction.objectStore('players');
    const request = store.put(player);
    
    request.onsuccess = function() {
      resolve(player);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'player', action: 'save', data: player }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function deletePlayer(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['players'], 'readwrite');
    const store = transaction.objectStore('players');
    const request = store.delete(id);
    
    request.onsuccess = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'player', action: 'delete', data: { id } }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function getPlayersSortedByWins() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['players'], 'readonly');
    const store = transaction.objectStore('players');
    const index = store.index('byWins');
    const request = index.openCursor(null, 'prev'); // prev for descending order
    
    const players = [];
    
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if (cursor) {
        players.push(cursor.value);
        cursor.continue();
      } else {
        resolve(players);
      }
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Queue Operations
async function getQueueEntries() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readonly');
    const store = transaction.objectStore('queue');
    const index = store.index('byTimestamp');
    const request = index.getAll();
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function addPlayerToQueue(playerId) {
  const entry = {
    playerId,
    timestamp: new Date().toISOString(),
    status: 'waiting'
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const request = store.add(entry);
    
    request.onsuccess = function(event) {
      entry.entryId = event.target.result;
      resolve(entry);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'queue', action: 'add', data: entry }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function removeFromQueue(entryId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const request = store.delete(entryId);
    
    request.onsuccess = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'queue', action: 'remove', data: { entryId } }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function clearQueue() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const request = store.clear();
    
    request.onsuccess = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'queue', action: 'clear' }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Match Operations
async function getMatches() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['matches'], 'readonly');
    const store = transaction.objectStore('matches');
    const index = store.index('byTimestamp');
    const request = index.getAll();
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function getMatchesByTimeOfDay() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['matches'], 'readonly');
    const store = transaction.objectStore('matches');
    const request = store.getAll();
    
    request.onsuccess = function() {
      const matches = request.result;
      // Group matches by hour of day
      const hourCounts = Array(24).fill(0);
      
      matches.forEach(match => {
        const startDate = new Date(match.timestamp);
        const startHour = startDate.getHours();
        hourCounts[startHour]++;
        
        if (match.completedAt) {
          const endDate = new Date(match.completedAt);
          const endHour = endDate.getHours();
          hourCounts[endHour]++;
        }
      });
      
      resolve(hourCounts);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function createMatch(player1Id, player2Id) {
  const match = {
    player1Id,
    player2Id,
    timestamp: new Date().toISOString(),
    status: 'active'
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['matches'], 'readwrite');
    const store = transaction.objectStore('matches');
    const request = store.add(match);
    
    request.onsuccess = function(event) {
      match.matchId = event.target.result;
      resolve(match);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'match', action: 'create', data: match }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function resolveMatch(matchId, winnerId, loserId) {
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction(['matches', 'players'], 'readwrite');
    const matchStore = transaction.objectStore('matches');
    const playerStore = transaction.objectStore('players');
    
    // First get the match
    const matchRequest = matchStore.get(matchId);
    
    matchRequest.onsuccess = function() {
      const match = matchRequest.result;
      if (!match) {
        reject(new Error('Match not found'));
        return;
      }
      
      // Update match
      match.status = 'completed';
      match.winnerId = winnerId;
      match.loserId = loserId;
      match.completedAt = new Date().toISOString();
      
      // Save updated match
      matchStore.put(match);
      
      // Update winner stats
      const winnerRequest = playerStore.get(winnerId);
      winnerRequest.onsuccess = function() {
        const winner = winnerRequest.result;
        winner.wins++;
        winner.lastUpdated = new Date().toISOString();
        playerStore.put(winner);
      };
      
      // Update loser stats
      const loserRequest = playerStore.get(loserId);
      loserRequest.onsuccess = function() {
        const loser = loserRequest.result;
        loser.losses++;
        loser.lastUpdated = new Date().toISOString();
        playerStore.put(loser);
      };
    };
    
    transaction.oncomplete = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { 
          type: 'match', 
          action: 'resolve', 
          data: { matchId, winnerId, loserId }
        }
      }));
    };
    
    transaction.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function deleteMatch(matchId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['matches'], 'readwrite');
    const store = transaction.objectStore('matches');
    const request = store.delete(matchId);
    
    request.onsuccess = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'match', action: 'delete', data: { matchId } }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Department Operations
async function getDepartments() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['departments'], 'readonly');
    const store = transaction.objectStore('departments');
    const request = store.getAll();
    
    request.onsuccess = function() {
      resolve(request.result.map(dept => dept.name));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function getDepartmentDetails() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['departments'], 'readonly');
    const store = transaction.objectStore('departments');
    const request = store.getAll();
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function addDepartment(name) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['departments'], 'readwrite');
    const store = transaction.objectStore('departments');
    const request = store.put({ 
      name, 
      createdAt: new Date().toISOString(),
      isCustom: true
    });
    
    request.onsuccess = function() {
      resolve(name);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'department', action: 'add', data: { name } }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function deleteDepartment(name) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['departments'], 'readwrite');
    const store = transaction.objectStore('departments');
    const request = store.delete(name);
    
    request.onsuccess = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'department', action: 'delete', data: { name } }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Tournament Operations
async function getTournaments() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tournaments'], 'readonly');
    const store = transaction.objectStore('tournaments');
    const request = store.getAll();
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function getTournamentById(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tournaments'], 'readonly');
    const store = transaction.objectStore('tournaments');
    const request = store.get(id);
    
    request.onsuccess = function() {
      resolve(request.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function saveTournament(tournament) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tournaments'], 'readwrite');
    const store = transaction.objectStore('tournaments');
    const request = store.put(tournament);
    
    request.onsuccess = function(event) {
      // If it's a new tournament, get the generated ID
      if (!tournament.id) {
        tournament.id = event.target.result;
      }
      
      resolve(tournament);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'tournament', action: 'save', data: tournament }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

async function deleteTournament(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tournaments'], 'readwrite');
    const store = transaction.objectStore('tournaments');
    const request = store.delete(id);
    
    request.onsuccess = function() {
      resolve(true);
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('database-updated', {
        detail: { type: 'tournament', action: 'delete', data: { id } }
      }));
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Export functions for use in other modules
window.TekkenDB = {
  init: initDatabase,
  players: {
    getAll: getAllPlayers,
    getById: getPlayerById,
    save: savePlayer,
    delete: deletePlayer,
    getSortedByWins: getPlayersSortedByWins
  },
  queue: {
    getAll: getQueueEntries,
    add: addPlayerToQueue,
    remove: removeFromQueue,
    clear: clearQueue
  },
  matches: {
    getAll: getMatches,
    getByTimeOfDay: getMatchesByTimeOfDay,
    create: createMatch,
    resolve: resolveMatch,
    delete: deleteMatch
  },
  departments: {
    getAll: getDepartments,
    getDetails: getDepartmentDetails,
    add: addDepartment,
    delete: deleteDepartment
  },
  tournaments: {
    getAll: getTournaments,
    getById: getTournamentById,
    save: saveTournament,
    delete: deleteTournament
  }
};

// Auto-initialize the database when script loads
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await initDatabase();
    console.log('Database ready');
    
    // Initialize default departments if they don't exist
    const defaultDepts = ['Engineering', 'Marketing', 'Finance', 'HR', 'IT'];
    const existingDepts = await getDepartments();
    
    for (const dept of defaultDepts) {
      if (!existingDepts.includes(dept)) {
        await addDepartment(dept);
        console.log(`Added default department: ${dept}`);
      }
    }
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
});

// Add data sync listener to update UI
window.addEventListener('database-updated', function(event) {
  console.log('Database updated:', event.detail);
  // This event can be listened for in other files to update UI
});