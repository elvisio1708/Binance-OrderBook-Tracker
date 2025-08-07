# Binance Order Book Real-Time Logger & Dashboard

## Overview

This project streams real-time Binance order book data for the BTCUSDT trading pair, stores the top 20 levels of bids and asks in a ClickHouse database, and visualizes the data live with a Streamlit dashboard.

- **binance.js** — Node.js script to connect to Binance WebSocket and REST APIs, maintain a local order book, and insert updates into ClickHouse.
- **realtime_dashboard.py** — Python Streamlit app to query ClickHouse and display live interactive visualizations and raw order book data.
- **export_to_csv.js** — (Optional) Node.js script to export stored data from ClickHouse to CSV files.
- **logs/** — Directory where Binance script logs runtime info.
- **config.json** — Configuration file with Binance API endpoints, ClickHouse connection details, and app settings.

---

## Features

- Real-time order book updates up to 20 levels deep.
- Efficient deduplicated inserts to ClickHouse to avoid redundant data.
- Volume calculation configurable to base or quote currency.
- Live Streamlit dashboard with:
  - Bid-Ask spread line chart.
  - Heatmap of average volume by order level and side.
  - Interactive raw data table powered by AgGrid.
- Auto-refresh graphs every 5 seconds with minimal UI flicker.
- Automatic ClickHouse table creation if not exists.
- Detailed logging of operations and errors.

---

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v16 or newer recommended)
- [Python 3.10+](https://www.python.org/downloads/)
- [ClickHouse](https://clickhouse.com/docs/en/getting-started/install/) database server running locally or accessible remotely.
- Docker Desktop (optional, recommended for running ClickHouse in a container)
- `pip` package manager for Python

---

## Setup Instructions

### 1. Clone this repository

```bash
git clone <your-repo-url>
cd <your-repo-folder>
```

### 2. Configure ClickHouse

You can run ClickHouse locally via Docker:

```bash
docker run -d --name clickhouse-server -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server
```

Make sure the ports 8123 (HTTP) and 9000 (native) are open.

Alternatively, use an existing ClickHouse instance.

---

### 3. Prepare `config.json`

Create a `config.json` file in the project root with this structure:

```json
{
  "binance": {
    "numLevel": 20,
    "WebSocketUrl": "wss://stream.binance.com:9443/ws/",
    "REST_Url": "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=20",
    "BTCUSDT_tradePair": "btcusdt@depth20@100ms",
    "baseVolume": true
  },
  "table": {
    "BTCUSDT_table": "binance_btcusdt_orderbook"
  },
  "chDatabase": {
    "host": "localhost",
    "port": 8123,
    "user": "default",
    "password": "mysecret"
  }
}
```

- Adjust the `"host"`, `"port"`, `"user"`, and `"password"` to match your ClickHouse setup.
- You can set `"baseVolume"` to `true` or `false` to choose volume calculation mode.

---

### 4. Install Node.js dependencies

```bash
npm install
```

This installs required packages like `ws`, `axios`, and `clickhouse`.

---

### 5. Install Python dependencies

Create a virtual environment (recommended):

```bash
python -m venv venv
# Activate it:
# Windows:
.env\Scriptsctivate
# macOS/Linux:
source venv/bin/activate
```

Install packages:

```bash
pip install -r requirements.txt
```

If you don't have `requirements.txt`, install manually:

```bash
pip install streamlit clickhouse-connect pandas plotly streamlit-aggrid
```

---

### 6. Run the application

You need to run two parts simultaneously:

- Binance data collector (Node.js):

```bash
node binance.js
```

- Streamlit dashboard (Python):

```bash
streamlit run realtime_dashboard.py
```

---

### 7. (Optional) Export data to CSV

You can export stored order book data from ClickHouse by running:

```bash
node export_to_csv.js
```

---

## Project Structure

```
├── binance.js               # Main Node.js data collector
├── realtime_dashboard.py    # Streamlit dashboard app
├── export_to_csv.js         # CSV export script
├── config.json              # Configuration file (not committed)
├── logs/                    # Log files directory
├── package.json             # Node.js project metadata
├── requirements.txt         # Python dependencies (if provided)
├── README.md                # This file
```

---

## Troubleshooting

- **WebSocket connection issues:**  
  Ensure your internet connection is stable and Binance’s API is reachable.

- **ClickHouse connection refused:**  
  Verify ClickHouse server is running and accessible on the configured host/port.

- **Streamlit rerun errors:**  
  Make sure Streamlit is upgraded to latest version (`pip install --upgrade streamlit`).

- **Permission issues running npm scripts on Windows:**  
  Adjust PowerShell execution policy:  
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

 ## Known Bugs

 - **Auto refresh**  
  Dashboard will not refresh on it's own. Manual refresh required every minute.

## Contributing

Feel free to open issues or submit pull requests for improvements or bug fixes.

## Contact

For questions or support, reach out at elvisihaziri@gmail.com

---

Enjoy tracking your Binance order book in real time! 🚀
