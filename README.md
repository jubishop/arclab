# ARC Raiders Item Tracker

A Node.js/Express web application for tracking items and crafting recipes from the game ARC Raiders.

## Features

- Track all game items with categories, stack sizes, and crafting recipes
- View complete crafting chains (what materials are needed, recursively)
- **Stash Planner** - Calculate optimal inventory for carrying items vs raw materials
- CRUD operations for items and recipes
- SQLite database for persistence

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Templating:** EJS (server-side rendering)

## Database

Contains 187 items across 7 categories:

| Category | Count |
|----------|-------|
| Guns | 75 |
| Crafting Materials | 47 |
| Quick Use | 37 |
| Augments | 12 |
| Gun Mods | 8 |
| Ammunition | 5 |
| Shields | 3 |

371 recipe entries linking crafted items to their required materials.

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
open http://localhost:3000
```

## Project Structure

```
arclab/
├── app.js                 # Express app entry point
├── db/
│   ├── database.js        # Database connection & queries
│   ├── schema.sql         # Table definitions
│   └── arclab.db          # SQLite database
├── lib/
│   └── inventory.js       # Inventory efficiency calculations
├── routes/
│   ├── items.js           # Item CRUD routes
│   └── stash.js           # Stash planner routes
├── views/
│   ├── partials/          # Header/footer
│   ├── items/             # Item views (index, new, show, edit)
│   └── stash/             # Stash planner view
└── public/
    └── css/
        └── style.css
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /items | List all items |
| GET | /items/new | New item form |
| POST | /items | Create item |
| GET | /items/:id | View item details |
| GET | /items/:id/edit | Edit item form |
| POST | /items/:id | Update item |
| POST | /items/:id/delete | Delete item |
| GET | /stash | Stash planner (auto-calculates saved stash) |
| POST | /stash | Calculate and save optimal stash |

## Data Source

Item data scraped from the [ARC Raiders Wiki](https://arcraiders.wiki/).
