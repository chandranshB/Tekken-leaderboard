# Tekken Fight Club Leaderboard & Tournament Manager

This project is a client-side web application designed to manage a local Tekken 8 fight club or tournament. It provides features for tracking players, managing matches, displaying rankings, viewing analytics, and running tournaments with brackets, all stored directly in the user's browser using IndexedDB.

This application was initially developed for my Tekken 8 stall at my college tech fest.

## Features

*   **Dashboard (`index.html`):**
    *   Displays a dynamic ranking of players based on wins.
    *   Shows current matches being played.
    *   Provides tournament information (Prize Pool, Start Time).
    *   Shows department-wise player counts.
    *   Includes a search bar to find players.
*   **Admin Panel (`admin.html`):**
    *   CRUD (Create, Read, Update, Delete) operations for players.
    *   Manage departments for players.
    *   Configure tournament settings (Prize Pool - manual or automatic).
    *   Manage the match queue (add players, clear queue).
    *   Auto-pair players from the queue to create matches.
    *   Manage active matches (resolve with scores).
*   **Analytics (`analytics.html`):**
    *   Visualize activity by time of day and department using charts (requires Chart.js).
    *   View a recent activity log of player and match events.
    *   Functionality for exporting and importing data (CSV, JSON, Excel, PDF - note: export/import functionality might be partially implemented client-side).
*   **Tournament Brackets (`tournament-brackets.html`):**
    *   Select bracket types (Single Elimination, Double Elimination).
    *   View tournament summary stats (player count, match count, current round, status).
    *   List participants and seed them.
    *   Generate tournament brackets.
    *   Record match results within the tournament structure.
    *   Save and reset tournament state.
*   **Client-Side Database (`database.js`):**
    *   Uses IndexedDB to store all application data (players, queue, matches, departments, tournaments, stats) directly in the browser.
    *   Provides a set of asynchronous functions (Promises) to interact with the database.
    *   Includes database versioning and upgrade logic.
    *   Dispatches custom events (`database-updated`) for real-time UI updates.

## Technologies Used

*   **HTML5:** Structure of the web pages.
*   **CSS3:** Styling and layout.
*   **JavaScript:** Core logic, DOM manipulation, and interaction with the database.
*   **IndexedDB:** Client-side database for data persistence.
*   **Chart.js (referenced in `analytics.html`):** For creating data visualizations.
*   **YourWare Library (referenced in HTML files):** An external library (`https://lib.yourware.so/yourware-lib.umd.js`) which seems to provide some core utilities or features used across the application.

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone [<repository-url>](https://github.com/chandranshB/Tekken-leaderboard)
    cd tekken-leaderboard
    ```
2.  **Ensure all necessary files are present:** The project requires specific JavaScript files to function correctly, which are referenced by the HTML pages but may not be included in the repository yet. Based on the HTML references, the following files are needed:
    *   `index-db.js`
    *   `admin-db.js`
    *   `analytics.js`
    *   `tournament-brackets.js`
    *   `database.js` (already included)
    *   `qr-chandu.jpg` (already included)
    *   Along with the HTML files (`index.html`, `admin.html`, `analytics.html`, `tournament-brackets.html`, `tournaments.html`).
3.  **Open in a browser:** Simply open the `index.html` file in a modern web browser that supports IndexedDB. Since it's a client-side application, no web server is strictly required for basic functionality, but serving it from a local server might resolve certain browser security restrictions (like file access).

## File Structure

*   `index.html`: The main dashboard page.
*   `admin.html`: The administration interface.
*   `analytics.html`: Data analytics and visualization page.
*   `tournament-brackets.html`: Page for managing tournament structure and matches.
*   `tournaments.html`: (Content not fully described, likely a list or overview of tournaments).
*   `database.js`: Contains all IndexedDB database logic and operations.
*   `qr-chandu.jpg`: Image file (likely a QR code for payments/registration).
*   `README.md`: This file.

## Usage

*   Open `index.html` to see the live leaderboard and matches.
*   Navigate to `admin.html` to add players, manage settings, and set up matches/queue.
*   Visit `analytics.html` to view statistics about player and match activity.
*   Go to `tournament-brackets.html` to set up and run a tournament.

**Note:** The application's data is stored locally in your browser's IndexedDB. Clearing browser data will erase all application data.

## Development Notes

*   The core database logic is centralized in `database.js`.
*   Each HTML page is designed to load `database.js` and its own specific JavaScript file (e.g., `admin.html` loads `admin-db.js`) to handle UI interactions and call the database functions.
*   The `database-updated` custom event is dispatched after database operations to signal other parts of the application to refresh their data/UI.
