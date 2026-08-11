-- AquaLoop MySQL schema for Laragon
-- Target: MySQL 8.x / MariaDB-compatible setup in Laragon
-- Import this file via HeidiSQL, phpMyAdmin, or mysql CLI.

CREATE DATABASE IF NOT EXISTS aqualoop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aqualoop;

SET NAMES utf8mb4;
SET time_zone = "+07:00";

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS ponds;

CREATE TABLE ponds (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(150) NULL,
  notes VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ponds_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE devices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pond_id INT UNSIGNED NOT NULL,
  device_code VARCHAR(50) NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_type ENUM('sensor_node', 'aerator', 'feeder', 'relay', 'solar_controller', 'camera') NOT NULL,
  status ENUM('online', 'offline', 'maintenance', 'warning') NOT NULL DEFAULT 'offline',
  last_seen_at DATETIME NULL,
  meta JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_devices_code (device_code),
  KEY idx_devices_pond_id (pond_id),
  CONSTRAINT fk_devices_ponds
    FOREIGN KEY (pond_id) REFERENCES ponds(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sensor_readings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pond_id INT UNSIGNED NOT NULL,
  device_id INT UNSIGNED NULL,
  reading_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ph DECIMAL(4,2) NULL,
  dissolved_oxygen DECIMAL(4,2) NULL,
  salinity DECIMAL(5,2) NULL,
  temperature DECIMAL(4,1) NULL,
  ammonia DECIMAL(6,3) NULL,
  water_level DECIMAL(6,2) NULL,
  battery_percent TINYINT UNSIGNED NULL,
  pump_power_watts DECIMAL(6,2) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sensor_pond_time (pond_id, reading_time),
  KEY idx_sensor_device_time (device_id, reading_time),
  CONSTRAINT fk_sensor_ponds
    FOREIGN KEY (pond_id) REFERENCES ponds(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sensor_devices
    FOREIGN KEY (device_id) REFERENCES devices(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pond_id INT UNSIGNED NOT NULL,
  device_id INT UNSIGNED NULL,
  event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type ENUM(
    'relay_cutoff',
    'relay_resume',
    'do_anomaly',
    'ph_calibration',
    'feed_hold',
    'system_check',
    'maintenance',
    'warning',
    'info'
  ) NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  title VARCHAR(150) NOT NULL,
  details TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_pond_time (pond_id, event_time),
  KEY idx_audit_type_time (event_type, event_time),
  CONSTRAINT fk_audit_ponds
    FOREIGN KEY (pond_id) REFERENCES ponds(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_audit_devices
    FOREIGN KEY (device_id) REFERENCES devices(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Useful view for dashboards
CREATE OR REPLACE VIEW v_latest_pond_status AS
SELECT
  p.id AS pond_id,
  p.code,
  p.name,
  sr.reading_time,
  sr.ph,
  sr.dissolved_oxygen,
  sr.salinity,
  sr.temperature,
  sr.ammonia,
  sr.battery_percent,
  sr.pump_power_watts
FROM ponds p
LEFT JOIN sensor_readings sr
  ON sr.id = (
    SELECT sr2.id
    FROM sensor_readings sr2
    WHERE sr2.pond_id = p.id
    ORDER BY sr2.reading_time DESC, sr2.id DESC
    LIMIT 1
  );
