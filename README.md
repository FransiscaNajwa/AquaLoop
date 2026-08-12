# AquaLoop Web

AquaLoop Web is a smart aquaculture dashboard for semi-intensive fish ponds.  
It is built as a Laragon-friendly web app with a MySQL backend, PHP API layer, and a desktop-style monitoring UI.

## Highlights

- Multi-pond monitoring for `Pond A`, `Pond B`, and `Pond C`
- Water quality dashboard for DO, pH, salinity, and temperature
- AI Analytics view with live-camera style monitoring
- Hardware view for edge node, solar, and actuator status
- Sustainability view for recirculation and economic summary
- Audit trail timeline for historical events and system actions
- MySQL-backed API so the UI can read live data from the database
- HTTP POST ingestion from the sensor script into the PHP backend

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: PHP
- Database: MySQL / MariaDB
- Local dev: Laragon

## Folder Structure

```text
aqualoop-web/
  index.html
  style.css
  app.js
  api/
    db.php
    dashboard.php
  database/
    aqualoop_mysql.sql
```

## How It Works

1. The browser opens `index.html`.
2. `app.js` requests pond data from `api/dashboard.php`.
3. `dashboard.php` connects to MySQL through `api/db.php`.
4. `sensor_reading.py` sends readings with HTTP POST to `api/ingest.php`.
5. `ingest.php` saves pond, device, sensor, and audit data into MySQL.
6. The API returns JSON for the latest reading, devices, and audit logs.
7. The frontend renders the dashboard and switches between ponds.

## Setup With Laragon

### 1. Start Laragon
- Open Laragon
- Start Apache
- Start MySQL

If Apache uses port `8080`, use that port in the browser URL.

### 2. Put the project in `www`

Make sure this folder exists:

```text
D:\laragon\www\aqualoop-web
```

### 3. Import the database

Import this file into MySQL:

```text
database/aqualoop_mysql.sql
```

You can import it with:
- HeidiSQL from Laragon
- phpMyAdmin
- MySQL CLI

### 4. Check database config

Database settings are in:

- `api/db.php`

Default values:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `aqualoop`
- User: `root`
- Password: empty

## Sensor Ingestion Flow

The recommended data path is:

```text
sensor_reading.py -> HTTP POST -> api/ingest.php -> MySQL -> api/dashboard.php -> browser
```

The Python script uses:

- `POST http://localhost:8080/aqualoop-web/api/ingest.php`

The backend accepts JSON like:

```json
{
  "pond_code": "A",
  "device_code": "POND-A-NODE-01",
  "ph": 7.5,
  "dissolved_oxygen": 6.8,
  "salinity": 5,
  "temperature": 28.5,
  "ammonia": 0.02,
  "battery_percent": 85,
  "pump_power_watts": 62
}
```

## Run the App

If Apache runs on port `8080`, open:

```text
http://localhost:8080/aqualoop-web/
```

To test the API directly:

```text
http://localhost:8080/aqualoop-web/api/dashboard.php
```

To test ingestion:

```text
POST http://localhost:8080/aqualoop-web/api/ingest.php
```

## API Response

`api/dashboard.php` returns JSON like this:

```json
{
  "success": true,
  "data": {
    "ponds": [],
    "current_pond": {},
    "latest_reading": {},
    "audit_logs": [],
    "devices": []
  }
}
```

## Database Tables

The schema creates:

- `ponds`
- `devices`
- `sensor_readings`
- `audit_logs`

It also includes:

- `v_latest_pond_status`

## Important Files

- `index.html` - main dashboard UI
- `style.css` - dashboard styling
- `app.js` - tab switching, pond switching, and API fetching
- `api/db.php` - MySQL connection helper
- `api/dashboard.php` - dashboard JSON endpoint
- `api/ingest.php` - sensor ingestion endpoint
- `database/aqualoop_mysql.sql` - schema for Laragon MySQL

## Notes

- The UI is designed to work even when the database is empty.
- If no data exists yet, the dashboard shows an empty-state message.
- This repository is focused on the web app only.
- `api-mock.js` is no longer used by the dashboard.

## Troubleshooting

### Site shows connection refused
- Check Apache is running in Laragon
- Make sure you use the correct port, such as `8080`
- Open the app through the browser, not by double-clicking the HTML file

### API returns database error
- Check MySQL is running
- Verify the database import succeeded
- Confirm `api/db.php` credentials

### Dashboard shows empty state
- Insert at least one active pond
- Insert sensor readings and audit logs

## License

For AquaLoop demo and development use.
