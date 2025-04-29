/**
 * Tekken Fight Club Analytics Dashboard
 * 
 * This file handles all analytics functionality for the Tekken Fight Club system.
 * It displays statistics, charts and activity logs based on match and player data.
 * Provides import/export functionality for analytics data.
 */

// Global state variables
let activityData = [];
let playerData = [];
let matchData = [];
let currentFilter = 'day';
let timeOfDayChart = null;
let departmentChart = null;
let importedData = null;
let conflicts = [];
let currentConflict = 0;
let importSummary = {
  totalImported: 0,
  merged: 0,
  replaced: 0,
  skipped: 0,
  conflicts: 0
};

/**
 * Initialize the analytics dashboard
 */
async function initDashboard() {
  try {
    // Initialize database connection
    await TekkenDB.init();
    updateDatabaseStatus('connected');
    
    // Load all data
    await loadDashboardData();
    
    // Setup UI components and event listeners
    setupEventListeners();
    
    // Listen for database updates to refresh data
    window.addEventListener('database-updated', handleDatabaseUpdate);
    
  } catch (error) {
    console.error('Failed to initialize analytics dashboard:', error);
    updateDatabaseStatus('error');
    
    // Show error in UI
    document.querySelectorAll('.loading').forEach(el => {
      el.classList.remove('loading');
      el.classList.add('empty-state');
      el.innerHTML = `
        <p>Failed to load analytics data</p>
        <p>Error: ${error.message}</p>
      `;
    });
  }
}

/**
 * Load all data needed for the dashboard
 */
async function loadDashboardData() {
  try {
    // Fetch players and matches from database
    playerData = await TekkenDB.players.getAll();
    matchData = await TekkenDB.matches.getAll();
    
    // Generate activity data from players and matches
    generateActivityData();
    
    // Render all dashboard components
    renderTimeOfDayChart();
    renderDepartmentChart();
    renderActivityTable();
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    throw error;
  }
}

/**
 * Generate activity data from players and matches
 */
function generateActivityData() {
  // Clear previous data
  activityData = [];
  
  // Player-related activities
  playerData.forEach(player => {
    // Player creation
    activityData.push({
      timestamp: player.createdAt,
      type: 'player_created',
      details: `Player joined: ${player.name}`,
      department: player.department,
      player: player
    });
    
    // Player updates (wins/losses)
    if (player.lastUpdated && player.lastUpdated !== player.createdAt) {
      activityData.push({
        timestamp: player.lastUpdated,
        type: 'player_updated',
        details: `Player stats updated: ${player.name} (W/L: ${player.wins}/${player.losses})`,
        department: player.department,
        player: player
      });
    }
  });
  
  // Match-related activities
  matchData.forEach(match => {
    const player1 = playerData.find(p => p.id === match.player1Id);
    const player2 = playerData.find(p => p.id === match.player2Id);
    
    // Only process if both players exist
    if (player1 && player2) {
      // Match creation
      activityData.push({
        timestamp: match.timestamp,
        type: 'match_created',
        details: `Match started: ${player1.name} vs ${player2.name}`,
        department: `${player1.department}/${player2.department}`,
        match: match,
        players: [player1, player2]
      });
      
      // Match completion
      if (match.status === 'completed' && match.completedAt) {
        const winner = playerData.find(p => p.id === match.winnerId);
        const loser = playerData.find(p => p.id === match.loserId);
        
        if (winner && loser) {
          activityData.push({
            timestamp: match.completedAt,
            type: 'match_completed',
            details: `Match completed: ${winner.name} defeated ${loser.name}`,
            department: `${winner.department}/${loser.department}`,
            match: match,
            players: [winner, loser]
          });
        }
      }
    }
  });
  
  // Sort by timestamp (newest first)
  activityData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Render the time of day activity chart
 */
function renderTimeOfDayChart() {
  const container = document.getElementById('time-chart-container');
  container.innerHTML = ''; // Clear loading state
  
  // Create canvas for Chart.js
  const canvas = document.createElement('canvas');
  canvas.id = 'time-chart';
  container.appendChild(canvas);
  
  // Filter activities by current time filter
  const filteredActivities = filterActivitiesByTime(activityData);
  
  // Group activities by hour of day
  const hourCounts = Array(24).fill(0);
  
  filteredActivities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const hour = date.getHours();
    hourCounts[hour]++;
  });
  
  // Create hour labels (12am, 1am, etc.)
  const hourLabels = Array(24).fill(0).map((_, i) => {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    return `${hour} ${ampm}`;
  });
  
  // Destroy previous chart if it exists
  if (timeOfDayChart) {
    timeOfDayChart.destroy();
  }
  
  // Create the chart
  timeOfDayChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: hourLabels,
      datasets: [{
        label: 'Activity',
        data: hourCounts,
        backgroundColor: '#ff5722',
        borderColor: '#e64a19',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1E1E1E',
          titleColor: '#ff5722',
          bodyColor: '#fff',
          borderColor: '#333',
          borderWidth: 1,
          caretSize: 6,
          cornerRadius: 4,
          displayColors: false,
          callbacks: {
            title: (tooltipItems) => {
              const hour = tooltipItems[0].dataIndex;
              return `${hourLabels[hour]}`;
            },
            label: (context) => {
              return `${context.raw} ${context.raw === 1 ? 'activity' : 'activities'}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#aaa',
            font: {
              size: 10
            }
          },
          title: {
            display: true,
            text: 'Number of Activities',
            color: '#aaa',
            font: {
              size: 12
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#aaa',
            font: {
              size: 10
            },
            maxRotation: 30,
            minRotation: 0
          }
        }
      }
    }
  });
  
  // Show empty state if no data
  if (filteredActivities.length === 0) {
    container.innerHTML = '';
    container.classList.add('empty-state');
    container.innerHTML = `
      <p>No activity data available for this time period</p>
      <p>Try selecting a different time filter</p>
    `;
  }
}

/**
 * Render department activity chart
 */
function renderDepartmentChart() {
  const container = document.getElementById('department-chart-container');
  container.innerHTML = ''; // Clear loading state
  
  // Create canvas for Chart.js
  const canvas = document.createElement('canvas');
  canvas.id = 'department-chart';
  container.appendChild(canvas);
  
  // Filter activities by current time filter
  const filteredActivities = filterActivitiesByTime(activityData);
  
  // Count activities by department
  const departmentCounts = {};
  
  filteredActivities.forEach(activity => {
    if (activity.department) {
      const departments = activity.department.split('/');
      departments.forEach(dept => {
        // Skip if empty
        if (!dept.trim()) return;
        
        // Count each department
        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
      });
    }
  });
  
  // Prepare data for chart
  const departments = Object.keys(departmentCounts);
  const counts = departments.map(dept => departmentCounts[dept]);
  
  // Generate colors for departments
  const backgroundColors = departments.map((_, index) => {
    const hue = (index * 137) % 360; // Use golden angle to distribute colors
    return `hsl(${hue}, 70%, 60%)`;
  });
  
  // Check for existing chart
  if (departmentChart) {
    departmentChart.destroy();
  }
  
  // Create pie chart
  departmentChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: departments,
      datasets: [{
        data: counts,
        backgroundColor: backgroundColors,
        borderColor: '#1E1E1E',
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '50%',
      plugins: {
        legend: {
          display: false // We'll create custom legend
        },
        tooltip: {
          backgroundColor: '#1E1E1E',
          titleColor: '#ff5722',
          bodyColor: '#fff',
          borderColor: '#333',
          borderWidth: 1,
          caretSize: 6,
          cornerRadius: 4,
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw;
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} activities (${percentage}%)`;
            }
          }
        }
      }
    }
  });
  
  // Create custom legend
  if (departments.length > 0) {
    const legendContainer = document.createElement('div');
    legendContainer.className = 'pie-legend';
    
    departments.forEach((dept, index) => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const colorBox = document.createElement('span');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = backgroundColors[index];
      
      const label = document.createElement('span');
      label.textContent = `${dept} (${counts[index]})`;
      
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      legendContainer.appendChild(legendItem);
    });
    
    container.appendChild(legendContainer);
  }
  
  // Show empty state if no data
  if (filteredActivities.length === 0) {
    container.innerHTML = '';
    container.classList.add('empty-state');
    container.innerHTML = `
      <p>No department data available for this time period</p>
      <p>Try selecting a different time filter</p>
    `;
  }
}

/**
 * Render activity log table
 */
function renderActivityTable() {
  const tableBody = document.getElementById('activity-table-body');
  tableBody.innerHTML = '';
  
  // Filter activities based on time filter
  const filteredActivities = filterActivitiesByTime(activityData);
  
  // Show max 50 most recent activities
  const displayActivities = filteredActivities.slice(0, 50);
  
  if (displayActivities.length === 0) {
    // Show empty state
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="4" style="text-align: center; padding: 30px;">
        No activity data available for this time period
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  // Add activity rows to table
  displayActivities.forEach(activity => {
    const row = document.createElement('tr');
    
    // Format timestamp
    const date = new Date(activity.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + 
                          date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    // Format activity type
    const activityType = activity.type.replace(/_/g, ' ')
                              .replace(/\b\w/g, c => c.toUpperCase());
    
    // Type class for styling
    const typeClass = activity.type.includes('player') ? 'activity-player' : 'activity-match';
    
    // Create department tag(s)
    const departmentHTML = activity.department 
      ? activity.department.split('/').filter(d => d.trim())
                         .map(dept => `<span class="department-tag">${dept}</span>`)
                         .join('')
      : '';
    
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td><span class="activity-type ${typeClass}">${activityType}</span></td>
      <td>${activity.details}</td>
      <td>${departmentHTML}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * Filter activities based on selected time period
 */
function filterActivitiesByTime(activities) {
  const now = new Date();
  let startDate;
  
  // Determine start date based on filter
  switch (currentFilter) {
    case 'day':
      // Start of today
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      // Start of this week (Sunday)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      // Start of this month
      startDate = new Date(now);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'all':
    default:
      // Return everything
      return activities;
  }
  
  // Filter activities after start date
  return activities.filter(activity => {
    const activityDate = new Date(activity.timestamp);
    return activityDate >= startDate && activityDate <= now;
  });
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Time filter buttons
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', () => {
      // Update active button
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      
      // Update filter and refresh views
      currentFilter = button.getAttribute('data-period');
      
      // Refresh charts and tables
      renderTimeOfDayChart();
      renderDepartmentChart();
      renderActivityTable();
    });
  });
  
  // Export buttons
  document.getElementById('export-csv-btn').addEventListener('click', () => exportActivityData('csv'));
  document.getElementById('export-json-btn').addEventListener('click', () => exportActivityData('json'));
  document.getElementById('export-excel-btn').addEventListener('click', () => exportActivityData('excel'));
  document.getElementById('export-pdf-btn').addEventListener('click', () => exportActivityData('pdf'));
  
  // Toggle advanced export options
  document.getElementById('show-export-options').addEventListener('click', toggleExportOptions);
  
  // Import button
  document.getElementById('import-data-btn').addEventListener('click', handleImportClick);
}

/**
 * Toggle advanced export options visibility
 */
function toggleExportOptions() {
  const advancedOptions = document.getElementById('advanced-export-options');
  const currentDisplay = advancedOptions.style.display;
  
  if (currentDisplay === 'none') {
    advancedOptions.style.display = 'block';
  } else {
    advancedOptions.style.display = 'none';
  }
}

/**
 * Get export configuration from UI options
 */
function getExportConfig() {
  return {
    includeTime: document.getElementById('export-include-time').checked,
    includeDepartment: document.getElementById('export-include-department').checked,
    includeDetails: document.getElementById('export-include-details').checked,
    maxRows: parseInt(document.getElementById('export-max-rows').value, 10) || 0
  };
}

/**
 * Get filtered activities for export based on configuration
 */
function getFilteredActivitiesForExport() {
  // Get filtered activities based on time filter
  const filteredByTime = filterActivitiesByTime(activityData);
  
  // No data to export
  if (filteredByTime.length === 0) {
    alert('No data to export for the selected time period.');
    return null;
  }
  
  // Apply max rows limit if specified
  const config = getExportConfig();
  const maxRows = config.maxRows;
  
  if (maxRows > 0 && filteredByTime.length > maxRows) {
    return filteredByTime.slice(0, maxRows);
  }
  
  return filteredByTime;
}

/**
 * Export activity data in the specified format
 */
function exportActivityData(format) {
  const activities = getFilteredActivitiesForExport();
  if (!activities) return;
  
  const config = getExportConfig();
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `tekken-activity-${currentFilter}-${timestamp}`;
  
  switch(format) {
    case 'csv':
      exportAsCSV(activities, filename, config);
      break;
    case 'json':
      exportAsJSON(activities, filename, config);
      break;
    case 'excel':
      exportAsExcel(activities, filename, config);
      break;
    case 'pdf':
      exportAsPDF(activities, filename, config);
      break;
  }
}

/**
 * Export activity data as CSV
 */
function exportAsCSV(activities, filename, config) {
  // Build CSV header
  let headers = ['Timestamp'];
  
  if (config.includeTime) {
    headers.push('Time');
  }
  
  headers.push('Type');
  
  if (config.includeDetails) {
    headers.push('Details');
  }
  
  if (config.includeDepartment) {
    headers.push('Department');
  }
  
  let csv = headers.join(',') + '\n';
  
  // Add each activity as a row
  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const datePart = date.toISOString().split('T')[0];
    const timePart = date.toTimeString().split(' ')[0];
    
    let row = [`"${datePart}"`];
    
    if (config.includeTime) {
      row.push(`"${timePart}"`);
    }
    
    row.push(`"${activity.type.replace(/_/g, ' ')}"`);
    
    if (config.includeDetails) {
      row.push(`"${activity.details.replace(/"/g, '""')}"`);
    }
    
    if (config.includeDepartment) {
      const department = activity.department ? activity.department.replace(/"/g, '""') : '';
      row.push(`"${department}"`);
    }
    
    csv += row.join(',') + '\n';
  });
  
  // Create and trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${filename}.csv`);
}

/**
 * Export activity data as JSON
 */
function exportAsJSON(activities, filename, config) {
  // Format activities based on config
  const formattedActivities = activities.map(activity => {
    const date = new Date(activity.timestamp);
    
    const output = {
      date: date.toISOString().split('T')[0],
      type: activity.type
    };
    
    if (config.includeTime) {
      output.time = date.toTimeString().split(' ')[0];
    }
    
    if (config.includeDetails) {
      output.details = activity.details;
    }
    
    if (config.includeDepartment) {
      output.department = activity.department;
    }
    
    return output;
  });
  
  // Create formatted JSON with indentation
  const jsonString = JSON.stringify({
    exportInfo: {
      exportDate: new Date().toISOString(),
      timeFilter: currentFilter,
      totalRecords: formattedActivities.length
    },
    data: formattedActivities
  }, null, 2);
  
  // Create and trigger download
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  downloadFile(blob, `${filename}.json`);
}

/**
 * Export activity data in Excel-compatible format
 * Uses CSV with UTF-8 BOM for Excel compatibility
 */
function exportAsExcel(activities, filename, config) {
  // Build CSV header with Excel compatibility for UTF-8
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel
  
  let headers = ['Timestamp'];
  
  if (config.includeTime) {
    headers.push('Time');
  }
  
  headers.push('Type');
  
  if (config.includeDetails) {
    headers.push('Details');
  }
  
  if (config.includeDepartment) {
    headers.push('Department');
  }
  
  let csv = BOM + headers.join('\t') + '\r\n'; // Tab-separated for Excel
  
  // Add each activity as a row
  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const datePart = date.toISOString().split('T')[0];
    const timePart = date.toTimeString().split(' ')[0];
    
    let row = [datePart];
    
    if (config.includeTime) {
      row.push(timePart);
    }
    
    row.push(activity.type.replace(/_/g, ' '));
    
    if (config.includeDetails) {
      row.push(activity.details);
    }
    
    if (config.includeDepartment) {
      row.push(activity.department || '');
    }
    
    csv += row.join('\t') + '\r\n';
  });
  
  // Create and trigger download
  const blob = new Blob([csv], { type: 'text/tab-separated-values;charset=utf-8' });
  downloadFile(blob, `${filename}.xls`);
}

/**
 * Export activity data as PDF
 * This uses a simple HTML-to-PDF approach
 */
function exportAsPDF(activities, filename, config) {
  // Create a printable HTML version
  let printWindow = window.open('', '_blank');
  
  // Basic styles for the PDF
  const styles = `
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #ff5722; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background-color: #ff5722; color: white; text-align: left; padding: 8px; }
    td { border: 1px solid #ddd; padding: 8px; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .export-info { margin-bottom: 20px; color: #666; font-size: 14px; }
  `;
  
  // Build table headers
  let headers = ['<th>Date</th>'];
  
  if (config.includeTime) {
    headers.push('<th>Time</th>');
  }
  
  headers.push('<th>Type</th>');
  
  if (config.includeDetails) {
    headers.push('<th>Details</th>');
  }
  
  if (config.includeDepartment) {
    headers.push('<th>Department</th>');
  }
  
  // Create table rows
  let rows = '';
  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const datePart = date.toLocaleDateString();
    const timePart = date.toLocaleTimeString();
    
    let cells = [`<td>${datePart}</td>`];
    
    if (config.includeTime) {
      cells.push(`<td>${timePart}</td>`);
    }
    
    cells.push(`<td>${activity.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>`);
    
    if (config.includeDetails) {
      cells.push(`<td>${activity.details}</td>`);
    }
    
    if (config.includeDepartment) {
      cells.push(`<td>${activity.department || ''}</td>`);
    }
    
    rows += `<tr>${cells.join('')}</tr>`;
  });
  
  // Assemble the HTML for printing/PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tekken Fight Club - Analytics Export</title>
      <style>${styles}</style>
    </head>
    <body>
      <h1>Tekken Fight Club Analytics</h1>
      <div class="export-info">
        <p>Time period: ${currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)}</p>
        <p>Exported on: ${new Date().toLocaleString()}</p>
        <p>Total records: ${activities.length}</p>
      </div>
      <table>
        <thead>
          <tr>${headers.join('')}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
            setTimeout(() => window.close(), 500);
          }, 500);
        };
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Helper function to trigger download
 */
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Set up download link
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Handle database update events
 */
function handleDatabaseUpdate(event) {
  const { type, action } = event.detail;
  
  // Update status indicator
  updateDatabaseStatus('connected');
  
  // Reload data if relevant database changes occurred
  if (type === 'player' || type === 'match') {
    loadDashboardData();
  }
}

/**
 * Update database connection status indicator
 */
function updateDatabaseStatus(status) {
  const statusEl = document.querySelector('#db-status .status');
  statusEl.textContent = status === 'connected' ? 'Connected' : 'Error';
  statusEl.className = `status ${status}`;
  
  // Add/update sync time if connected
  if (status === 'connected') {
    // Remove existing time if it exists
    const existingTime = document.querySelector('.last-sync');
    if (existingTime) existingTime.remove();
    
    // Add current time
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const syncTime = document.createElement('span');
    syncTime.className = 'last-sync';
    syncTime.textContent = `(${timeString})`;
    document.getElementById('db-status').appendChild(syncTime);
  }
}

/**
 * Handle import button click
 * Opens the import modal and sets up event handlers
 */
function handleImportClick() {
  // Reset import state
  resetImportState();
  
  // Show the modal
  const modal = document.getElementById('import-modal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
  
  // Set up event listeners for the modal
  setupImportModalEvents();
}

/**
 * Reset all import related state variables
 */
function resetImportState() {
  importedData = null;
  conflicts = [];
  currentConflict = 0;
  importSummary = {
    totalImported: 0,
    merged: 0,
    replaced: 0,
    skipped: 0,
    conflicts: 0
  };
  
  // Reset UI elements
  document.getElementById('selected-file-name').textContent = 'No file selected';
  document.getElementById('file-error-message').style.display = 'none';
  document.getElementById('upload-file-btn').disabled = true;
  
  // Show step 1, hide others
  document.getElementById('import-step-1').style.display = 'block';
  document.getElementById('import-step-2').style.display = 'none';
  document.getElementById('import-step-3').style.display = 'none';
  document.getElementById('import-step-4').style.display = 'none';
}

/**
 * Setup event listeners for the import modal
 */
function setupImportModalEvents() {
  // Close modal button
  const closeButtons = document.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', closeImportModal);
  });
  
  // Click outside modal to close
  const modal = document.getElementById('import-modal');
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeImportModal();
    }
  });
  
  // File input change
  const fileInput = document.getElementById('import-file-input');
  fileInput.addEventListener('change', handleFileSelect);
  
  // File upload button click
  document.querySelector('.file-upload-button').addEventListener('click', () => {
    fileInput.click();
  });
  
  // Upload button
  document.getElementById('upload-file-btn').addEventListener('click', processImportedFile);
  
  // Import options
  document.getElementById('merge-option').addEventListener('click', () => selectImportOption('merge'));
  document.getElementById('replace-option').addEventListener('click', () => selectImportOption('replace'));
  
  // Conflict resolution
  document.getElementById('resolve-all-existing').addEventListener('click', () => resolveAllConflicts('existing'));
  document.getElementById('resolve-all-imported').addEventListener('click', () => resolveAllConflicts('imported'));
  document.getElementById('complete-merge').addEventListener('click', completeMerge);
  
  // Done button
  document.getElementById('import-done-btn').addEventListener('click', closeImportModal);
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  const errorMessage = document.getElementById('file-error-message');
  const uploadButton = document.getElementById('upload-file-btn');
  
  if (!file) {
    document.getElementById('selected-file-name').textContent = 'No file selected';
    errorMessage.style.display = 'none';
    uploadButton.disabled = true;
    return;
  }
  
  // Update file name display
  document.getElementById('selected-file-name').textContent = file.name;
  
  // Validate file type
  const fileExtension = file.name.split('.').pop().toLowerCase();
  
  if (fileExtension !== 'json' && fileExtension !== 'csv') {
    errorMessage.textContent = 'Only JSON and CSV files are supported.';
    errorMessage.style.display = 'block';
    uploadButton.disabled = true;
    return;
  }
  
  // Enable upload button if file is valid
  errorMessage.style.display = 'none';
  uploadButton.disabled = false;
}

/**
 * Process the imported file
 */
function processImportedFile() {
  const fileInput = document.getElementById('import-file-input');
  const file = fileInput.files[0];
  const errorMessage = document.getElementById('file-error-message');
  
  if (!file) {
    errorMessage.textContent = 'Please select a file first.';
    errorMessage.style.display = 'block';
    return;
  }
  
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      if (fileExtension === 'json') {
        processJsonData(e.target.result);
      } else if (fileExtension === 'csv') {
        processCsvData(e.target.result);
      }
      
      // Move to step 2 - import options
      document.getElementById('import-step-1').style.display = 'none';
      document.getElementById('import-step-2').style.display = 'block';
      
    } catch (error) {
      errorMessage.textContent = `Error processing file: ${error.message}`;
      errorMessage.style.display = 'block';
    }
  };
  
  reader.onerror = function() {
    errorMessage.textContent = 'Error reading file.';
    errorMessage.style.display = 'block';
  };
  
  if (fileExtension === 'json') {
    reader.readAsText(file);
  } else if (fileExtension === 'csv') {
    reader.readAsText(file);
  }
}

/**
 * Process imported JSON data
 */
function processJsonData(jsonString) {
  let data;
  
  try {
    data = JSON.parse(jsonString);
    
    // Handle different JSON formats
    if (data.data && Array.isArray(data.data)) {
      // Standard format with data in .data property
      importedData = data.data;
    } else if (Array.isArray(data)) {
      // Direct array of activity records
      importedData = data;
    } else {
      throw new Error('JSON format not recognized. Expected array of records or {data: [...]} format.');
    }
    
    // Basic validation of imported data
    validateImportedData();
    
    importSummary.totalImported = importedData.length;
  } catch (error) {
    throw new Error(`Invalid JSON data: ${error.message}`);
  }
}

/**
 * Process imported CSV data
 */
function processCsvData(csvString) {
  try {
    // Split CSV into lines
    const lines = csvString.split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file must have a header row and at least one data row.');
    }
    
    // Parse header row
    const headers = lines[0].split(',').map(header => 
      header.trim().replace(/^"(.+)"$/, '$1').toLowerCase()
    );
    
    // Verify required fields are present
    const requiredFields = ['timestamp', 'type', 'date'];
    const hasRequiredFields = requiredFields.some(field => headers.includes(field));
    
    if (!hasRequiredFields) {
      throw new Error('CSV must contain at least one of the following fields: timestamp, type, date');
    }
    
    // Parse data rows
    importedData = [];
    
    for (let i = 1; i < lines.length; i++) {
      // Skip empty lines
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        console.warn(`Skipping line ${i+1}: column count doesn't match header count`);
        continue;
      }
      
      const record = {};
      
      // Map each value to its header
      headers.forEach((header, index) => {
        record[header] = values[index].replace(/^"(.+)"$/, '$1'); // Remove quotes if present
      });
      
      // Convert to standard format
      const standardizedRecord = standardizeRecord(record);
      importedData.push(standardizedRecord);
    }
    
    importSummary.totalImported = importedData.length;
  } catch (error) {
    throw new Error(`Invalid CSV data: ${error.message}`);
  }
}

/**
 * Parse CSV line handling quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let inQuote = false;
  let currentValue = '';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  result.push(currentValue);
  return result;
}

/**
 * Convert various import record formats to a standard format
 */
function standardizeRecord(record) {
  const standardRecord = {
    type: record.type || 'unknown',
    details: record.details || record.description || '',
    department: record.department || ''
  };
  
  // Handle different date formats
  if (record.timestamp) {
    standardRecord.timestamp = record.timestamp;
  } else if (record.date) {
    // If date and time are separate fields
    const dateStr = record.date;
    const timeStr = record.time || '00:00:00';
    standardRecord.timestamp = new Date(`${dateStr}T${timeStr}`).toISOString();
  } else {
    // Default to current time if no timestamp
    standardRecord.timestamp = new Date().toISOString();
  }
  
  return standardRecord;
}

/**
 * Validate imported data has required fields
 */
function validateImportedData() {
  if (!Array.isArray(importedData) || importedData.length === 0) {
    throw new Error('No valid data records found in the imported file.');
  }
  
  // Check required fields in first few records
  const sampleSize = Math.min(5, importedData.length);
  
  for (let i = 0; i < sampleSize; i++) {
    const record = importedData[i];
    
    if (!record.timestamp) {
      throw new Error('Each record must have a timestamp field.');
    }
    
    if (!record.type) {
      throw new Error('Each record must have a type field.');
    }
  }
}

/**
 * Select import option (merge or replace)
 */
function selectImportOption(option) {
  // Update UI
  document.querySelector('.import-option.selected')?.classList.remove('selected');
  document.getElementById(`${option}-option`).classList.add('selected');
  
  if (option === 'merge') {
    // Find potential conflicts
    findDataConflicts();
    
    if (conflicts.length > 0) {
      // Move to conflict resolution step
      document.getElementById('import-step-2').style.display = 'none';
      document.getElementById('import-step-3').style.display = 'block';
      
      // Update conflict count info
      document.getElementById('conflict-count').textContent = 
        `Found ${conflicts.length} potential data conflict${conflicts.length > 1 ? 's' : ''}. Please resolve each conflict:`;
      
      // Show first conflict
      showConflict(0);
    } else {
      // No conflicts, proceed with merge
      mergeDatabaseData();
    }
  } else {
    // Replace option - confirm and replace
    if (confirm('Are you sure you want to replace all existing analytics data? This cannot be undone.')) {
      replaceDatabaseData();
    }
  }
}

/**
 * Find conflicts between imported data and existing data
 */
function findDataConflicts() {
  conflicts = [];
  
  // Compare imported records with existing activity data
  importedData.forEach(importedRecord => {
    activityData.forEach(existingRecord => {
      // Check for potential duplicates based on timestamp and type
      if (isSameRecord(existingRecord, importedRecord)) {
        conflicts.push({
          existing: existingRecord,
          imported: importedRecord,
          resolution: null // Will be set to 'existing', 'imported', or 'combine'
        });
      }
    });
  });
  
  importSummary.conflicts = conflicts.length;
}

/**
 * Check if two records likely represent the same data
 */
function isSameRecord(record1, record2) {
  // Compare timestamps (allowing small differences)
  const time1 = new Date(record1.timestamp).getTime();
  const time2 = new Date(record2.timestamp).getTime();
  const timeDiff = Math.abs(time1 - time2);
  
  // If timestamps are within 1 second and types match
  if (timeDiff < 1000 && record1.type === record2.type) {
    return true;
  }
  
  // If details are very similar and types match
  if (record1.type === record2.type && record1.details && record2.details) {
    const similarity = calculateStringSimilarity(record1.details, record2.details);
    if (similarity > 0.8) { // 80% similarity threshold
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate string similarity (simple implementation)
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  // If the longer string is empty, both are empty
  if (longer.length === 0) return 1.0;
  
  // Calculate Levenshtein distance
  const costs = new Array();
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  
  return (longer.length - costs[shorter.length]) / parseFloat(longer.length);
}

/**
 * Show conflict resolution UI for a specific conflict
 */
function showConflict(index) {
  if (index < 0 || index >= conflicts.length) return;
  
  currentConflict = index;
  const conflict = conflicts[index];
  
  // Create conflict item
  let conflictHTML = `
    <div class="conflict-item">
      <h4>Conflict ${index + 1} of ${conflicts.length}</h4>
      <div class="conflict-data">
        <div class="existing-data">
          <h5>Existing Data</h5>
          <p><strong>Type:</strong> ${conflict.existing.type.replace(/_/g, ' ')}</p>
          <p><strong>Time:</strong> ${new Date(conflict.existing.timestamp).toLocaleString()}</p>
          <p><strong>Details:</strong> ${conflict.existing.details}</p>
          <p><strong>Department:</strong> ${conflict.existing.department || 'None'}</p>
        </div>
        <div class="imported-data">
          <h5>Imported Data</h5>
          <p><strong>Type:</strong> ${conflict.imported.type.replace(/_/g, ' ')}</p>
          <p><strong>Time:</strong> ${new Date(conflict.imported.timestamp).toLocaleString()}</p>
          <p><strong>Details:</strong> ${conflict.imported.details}</p>
          <p><strong>Department:</strong> ${conflict.imported.department || 'None'}</p>
        </div>
      </div>
      <div class="conflict-resolution">
        <button class="btn" onclick="resolveConflict(${index}, 'existing')">Keep Existing</button>
        <button class="btn" onclick="resolveConflict(${index}, 'imported')">Use Imported</button>
        <button class="btn" onclick="resolveConflict(${index}, 'combine')">Combine Both</button>
      </div>
    </div>
  `;
  
  // Update conflict list
  document.getElementById('conflict-list').innerHTML = conflictHTML;
}

/**
 * Resolve a specific conflict
 */
function resolveConflict(index, resolution) {
  if (index < 0 || index >= conflicts.length) return;
  
  // Update resolution
  conflicts[index].resolution = resolution;
  
  // Move to next conflict if available
  if (index < conflicts.length - 1) {
    showConflict(index + 1);
  } else {
    // All conflicts resolved, check if any are unresolved
    const unresolvedConflicts = conflicts.filter(c => c.resolution === null).length;
    
    if (unresolvedConflicts === 0) {
      // Ready to complete merge
      document.getElementById('complete-merge').disabled = false;
    }
  }
}

/**
 * Resolve all conflicts at once with the same resolution
 */
function resolveAllConflicts(resolution) {
  // Update all conflicts
  conflicts.forEach((conflict, index) => {
    conflicts[index].resolution = resolution;
  });
  
  // Enable complete button
  document.getElementById('complete-merge').disabled = false;
  
  // Show success message
  alert(`All ${conflicts.length} conflicts will be resolved by keeping the ${resolution} data.`);
}

/**
 * Complete the merge process after conflict resolution
 */
function completeMerge() {
  // Check for unresolved conflicts
  const unresolvedConflicts = conflicts.filter(c => c.resolution === null).length;
  
  if (unresolvedConflicts > 0) {
    alert(`Please resolve all ${unresolvedConflicts} remaining conflicts before proceeding.`);
    return;
  }
  
  // Process the merge with resolved conflicts
  mergeDatabaseData();
}

/**
 * Merge imported data with existing database data
 */
async function mergeDatabaseData() {
  try {
    // Start with a copy of existing activity data
    let mergedActivities = [...activityData];
    
    // Create a set of existing record IDs to check for duplicates
    const existingTimestamps = new Set(activityData.map(a => a.timestamp));
    
    // Process each imported record
    for (const importedRecord of importedData) {
      // Check if this record conflicts with any existing one
      const conflictRecord = conflicts.find(c => 
        c.imported.timestamp === importedRecord.timestamp &&
        c.imported.type === importedRecord.type
      );
      
      if (conflictRecord) {
        // Handle based on resolution choice
        switch (conflictRecord.resolution) {
          case 'existing':
            // Keep existing, skip this record
            importSummary.skipped++;
            break;
          
          case 'imported':
            // Replace existing with imported
            // Find and remove existing record
            const existingIndex = mergedActivities.findIndex(a => 
              a.timestamp === conflictRecord.existing.timestamp &&
              a.type === conflictRecord.existing.type
            );
            
            if (existingIndex !== -1) {
              mergedActivities.splice(existingIndex, 1);
            }
            
            // Add imported record
            mergedActivities.push(importedRecord);
            importSummary.replaced++;
            break;
          
          case 'combine':
            // Combine fields from both records
            const existingRecordIndex = mergedActivities.findIndex(a => 
              a.timestamp === conflictRecord.existing.timestamp &&
              a.type === conflictRecord.existing.type
            );
            
            if (existingRecordIndex !== -1) {
              // Combine records
              mergedActivities[existingRecordIndex] = {
                ...mergedActivities[existingRecordIndex],
                details: importedRecord.details || mergedActivities[existingRecordIndex].details,
                department: importedRecord.department || mergedActivities[existingRecordIndex].department
              };
            }
            importSummary.merged++;
            break;
          
          default:
            // No resolution, skip
            importSummary.skipped++;
        }
      } else if (!existingTimestamps.has(importedRecord.timestamp)) {
        // This is a new record, add it
        mergedActivities.push(importedRecord);
        importSummary.merged++;
      } else {
        // Skip records with matching timestamps that weren't identified as conflicts
        importSummary.skipped++;
      }
    }
    
    // Update the activity data
    activityData = mergedActivities;
    
    // Resort by timestamp
    activityData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Regenerate charts and tables
    renderTimeOfDayChart();
    renderDepartmentChart();
    renderActivityTable();
    
    // Show success message and summary
    showImportResults();
    
  } catch (error) {
    alert(`Error during merge: ${error.message}`);
    console.error('Merge error:', error);
  }
}

/**
 * Replace all existing data with imported data
 */
function replaceDatabaseData() {
  try {
    // Replace activity data with imported data
    activityData = [...importedData];
    
    // Sort by timestamp (newest first)
    activityData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Update summary
    importSummary.replaced = importedData.length;
    
    // Regenerate charts and tables
    renderTimeOfDayChart();
    renderDepartmentChart();
    renderActivityTable();
    
    // Show success message
    showImportResults();
    
  } catch (error) {
    alert(`Error during replacement: ${error.message}`);
    console.error('Replace error:', error);
  }
}

/**
 * Show import results summary
 */
function showImportResults() {
  // Move to final step
  document.getElementById('import-step-1').style.display = 'none';
  document.getElementById('import-step-2').style.display = 'none';
  document.getElementById('import-step-3').style.display = 'none';
  document.getElementById('import-step-4').style.display = 'block';
  
  // Generate summary HTML
  const summaryHTML = `
    <div class="import-stat">
      <span>Total records imported:</span>
      <span>${importSummary.totalImported}</span>
    </div>
    <div class="import-stat">
      <span>New records added:</span>
      <span>${importSummary.merged}</span>
    </div>
    <div class="import-stat">
      <span>Records replaced:</span>
      <span>${importSummary.replaced}</span>
    </div>
    <div class="import-stat">
      <span>Records skipped:</span>
      <span>${importSummary.skipped}</span>
    </div>
    <div class="import-stat">
      <span>Conflicts resolved:</span>
      <span>${importSummary.conflicts}</span>
    </div>
  `;
  
  // Update summary container
  document.querySelector('.import-summary').innerHTML = summaryHTML;
}

/**
 * Close the import modal
 */
function closeImportModal() {
  const modal = document.getElementById('import-modal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 300);
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);