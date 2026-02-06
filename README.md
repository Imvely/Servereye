# ServerEye

**Agentless Server Monitoring for Windows & Linux**

ServerEye is a desktop application for monitoring Windows and Linux servers without installing agents on target machines. It uses WinRM for Windows and SSH for Linux to remotely collect server metrics in real time. Designed for small-to-medium infrastructure (20-30 servers), it runs as a system tray application with a modern web-based UI.

---

## Screenshots

> _Screenshots will be added here._

<!--
![Dashboard](docs/screenshots/dashboard.png)
![Server Detail](docs/screenshots/server-detail.png)
![Alert Rules](docs/screenshots/alert-rules.png)
-->

---

## Key Features

- **Agentless Monitoring** -- No software installation needed on target servers; uses WinRM (Windows) and SSH (Linux)
- **Real-time Dashboard** -- Live server status cards with CPU, Memory, Disk metrics via WebSocket
- **Detailed Server Metrics** -- CPU, Memory, Disk, Network, Processes, Services, and Event Logs
- **Card & Table Views** -- Toggle between visual card view and data-dense table view
- **Group & Tag Management** -- Organize servers by groups and flexible tags
- **Alert System** -- Threshold-based alerts with configurable duration and cooldown
- **Webhook Notifications** -- Push alerts to Slack, Microsoft Teams, or Webex
- **Health Checks** -- PING, TCP, and HTTP availability checks
- **Excel Reports** -- Generate downloadable monitoring reports with customizable periods
- **User Management** -- Role-based access control (Admin, Operator, Viewer)
- **Maintenance Mode** -- Suppress alerts during scheduled maintenance windows
- **Dark Mode** -- Toggle between light and dark themes
- **System Tray** -- Runs in the background with status-colored tray icon
- **Data Aggregation** -- Automatic 5-minute and hourly metric rollups with configurable retention

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.110 | REST API & WebSocket server |
| SQLAlchemy | 2.0 | ORM with async support |
| SQLite (aiosqlite) | - | Embedded database |
| Paramiko | 3.4 | SSH client for Linux servers |
| pywinrm | 0.4 | WinRM client for Windows servers |
| APScheduler | 3.10 | Background job scheduling |
| openpyxl | 3.1 | Excel report generation |
| scikit-learn | 1.5 | Anomaly detection |
| pystray | 0.19 | System tray integration |
| python-jose | 3.3 | JWT authentication |
| passlib | 1.7 | Password hashing |
| httpx | 0.27 | Async HTTP client (webhooks, health checks) |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type-safe JavaScript |
| Vite | 7.2 | Build tool & dev server |
| Tailwind CSS | v4 | Utility-first CSS framework |
| Recharts | 3.7 | Chart & graph components |
| TanStack Query | 5.x | Server state management |
| Zustand | 5.0 | Client state management |
| AG Grid | 35.x | Data grid component |
| React Router | 6.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Lucide React | - | Icon library |
| Headless UI | 2.x | Accessible UI primitives |

---

## Quick Start

### Prerequisites

- **Python 3.11+** installed and available on PATH
- **Node.js 18+** and npm

### 1. Clone the Repository

```bash
git clone <repository-url>
cd server-monitoring
```

### 2. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Run in Development Mode

Start the backend and frontend separately:

**Backend** (from the project root):
```bash
python -m backend.main
```

**Frontend** (from the `frontend/` directory):
```bash
cd frontend
npm run dev
```

- Backend API runs at: `http://localhost:52800`
- Frontend dev server runs at: `http://localhost:5173` (proxied to backend)

### 5. Default Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin1234` |

> Change the default password immediately after first login.

---

## Project Structure

```
server-monitoring/
├── backend/                    # Python backend (FastAPI)
│   ├── main.py                 # Application entry point
│   ├── config.py               # Configuration & path settings
│   ├── api/                    # API route handlers
│   │   ├── auth.py             # Authentication (JWT)
│   │   ├── servers.py          # Server CRUD & connection test
│   │   ├── dashboard.py        # Dashboard data aggregation
│   │   ├── metrics.py          # Metrics query endpoints
│   │   ├── alerts.py           # Alert history endpoints
│   │   ├── alert_rules.py      # Alert rule management
│   │   ├── health_checks.py    # Health check configuration & results
│   │   ├── reports.py          # Report generation & download
│   │   ├── settings.py         # Application settings
│   │   ├── users.py            # User management
│   │   └── websocket.py        # WebSocket real-time updates
│   ├── core/                   # Core business logic
│   │   ├── collector.py        # Metric collection engine
│   │   ├── collector_ssh.py    # SSH collector (Linux)
│   │   ├── collector_winrm.py  # WinRM collector (Windows)
│   │   ├── connection_pool.py  # Connection pooling
│   │   ├── alert_engine.py     # Alert evaluation engine
│   │   ├── notifier.py         # Webhook notification sender
│   │   ├── health_checker.py   # Health check executor
│   │   ├── aggregator.py       # Metric data aggregation
│   │   ├── anomaly.py          # Anomaly detection (ML)
│   │   ├── report_gen.py       # Excel report generator
│   │   ├── ws_manager.py       # WebSocket connection manager
│   │   └── crypto.py           # AES encryption for credentials
│   ├── db/                     # Database layer
│   │   ├── database.py         # Async SQLAlchemy engine & session
│   │   ├── models.py           # ORM models
│   │   ├── schemas.py          # Pydantic schemas
│   │   └── init_db.py          # Database initialization
│   └── scheduler/              # Background jobs
│       └── jobs.py             # APScheduler job definitions
├── frontend/                   # React frontend
│   ├── index.html              # HTML entry point
│   ├── vite.config.ts          # Vite configuration
│   ├── package.json            # npm dependencies
│   └── src/
│       ├── main.tsx            # React entry point
│       ├── App.tsx             # Root component & routing
│       ├── index.css           # Global styles (Tailwind)
│       ├── api/                # API layer
│       │   ├── client.ts       # Axios instance & interceptors
│       │   ├── websocket.ts    # WebSocket client
│       │   └── hooks/          # TanStack Query hooks
│       │       ├── useServers.ts
│       │       ├── useMetrics.ts
│       │       ├── useAlerts.ts
│       │       ├── useHealthChecks.ts
│       │       ├── useReports.ts
│       │       ├── useSettings.ts
│       │       └── useUsers.ts
│       ├── components/         # Reusable components
│       │   ├── charts/         # Chart components (Recharts)
│       │   ├── common/         # Shared components
│       │   ├── dashboard/      # Dashboard-specific components
│       │   ├── layout/         # Layout (Header, Sidebar)
│       │   ├── server-detail/  # Server detail tab components
│       │   └── ui/             # Base UI components
│       ├── pages/              # Page components
│       │   ├── Dashboard.tsx
│       │   ├── Login.tsx
│       │   ├── ServerList.tsx
│       │   ├── ServerDetail.tsx
│       │   ├── Alerts.tsx
│       │   ├── AlertRules.tsx
│       │   ├── Reports.tsx
│       │   ├── Settings.tsx
│       │   └── Users.tsx
│       ├── stores/             # Zustand state stores
│       ├── types/              # TypeScript type definitions
│       └── utils/              # Utility functions
├── data/                       # Runtime data (auto-created)
│   ├── servereye.db            # SQLite database
│   ├── servereye.log           # Application logs
│   └── reports/                # Generated Excel reports
├── docs/                       # Documentation
│   └── user-guide.md           # User guide (Korean)
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

---

## Development Setup

### Backend Development

```bash
# Create a virtual environment (recommended)
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Run the backend
python -m backend.main
```

The backend starts at `http://localhost:52800` and serves both the API and the built frontend (when available in `frontend/dist/`).

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Lint the code
npm run lint

# Type check
npx tsc -b
```

The Vite dev server runs on `http://localhost:5173` and proxies API requests to the backend.

---

## Build & Packaging

### Frontend Production Build

```bash
cd frontend
npm run build
```

The build output is placed in `frontend/dist/` and automatically served by the FastAPI backend.

### Desktop Application Packaging

ServerEye is packaged as a standalone Windows executable using the system tray integration (`pystray`). The packaged installer is distributed as `ServerEye_Setup_v1.0.0.exe`.

The application:
- Runs as a system tray application
- Bundles the Python backend and built frontend
- Uses an embedded SQLite database stored in `%LOCALAPPDATA%\ServerEye\`
- Opens the web UI in the default browser on launch

### Command-line Options

```bash
python -m backend.main [options]

Options:
  --port=PORT       Set the server port (default: 52800)
  --minimized       Start minimized to system tray without opening browser
```

---

## License

This project is licensed under the [MIT License](LICENSE).
