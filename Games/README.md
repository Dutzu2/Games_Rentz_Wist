# Games Project

## Overview
This project contains two card games: Whist and Rentz. Each game has its own set of files for HTML, JavaScript, and CSS, allowing for a modular and organized structure.

## Directory Structure
- **WHIST**: Contains files related to the Whist game.
  - `index.html`: The HTML structure for the Whist game interface.
  - `script.js`: The JavaScript logic for managing the Whist game, including player management, game state, and database interactions.
  - `styles.css`: The CSS styles for the Whist game interface.

- **RENTZ**: Contains files related to the Rentz game.
  - `index.html`: The HTML structure for the Rentz game interface.
  - `rentz.js`: The JavaScript logic for managing the Rentz game, including player management, game state, and database interactions.
  - `styles.css`: The CSS styles for the Rentz game interface.

- **db**: Contains database-related files.
  - `create_tables.sql`: SQL commands to create the necessary tables for the database, including definitions for users and game records.

- **src**: Contains the main application logic.
  - `main.js`: The main entry point for the application, potentially initializing the game logic and handling user interactions.

- **index.html**: The main menu for the games, allowing users to select which game to play.

- **package.json**: The configuration file for npm, listing the dependencies and scripts for the project.

## Setup Instructions
1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Install the necessary dependencies using npm:
   ```
   npm install
   ```
4. Create the database tables by executing the SQL commands in `db/create_tables.sql`.
5. Open `index.html` in a web browser to access the main menu and select a game to play.

## Running the Games
- To play Whist, navigate to the WHIST folder and open `index.html`.
- To play Rentz, navigate to the RENTZ folder and open `index.html`.

## Contributing
Feel free to contribute to the project by submitting issues or pull requests. Your feedback and suggestions are welcome!