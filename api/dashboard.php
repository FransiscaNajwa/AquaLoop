<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function decode_json_value($value): mixed
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string) $value, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

function latest_reading(PDO $pdo): ?array
{
    // Menghilangkan kolom salinity fisik karena sudah disederhanakan
    $stmt = $pdo->query(
        'SELECT id, device_id, reading_time, dissolved_oxygen, temperature, water_level, battery_percent, pump_power_watts, raw_payload
         FROM sensor_readings
         ORDER BY reading_time DESC, id DESC
         LIMIT 1'
    );
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    $row['raw_payload'] = decode_json_value($row['raw_payload']);
    return $row;
}

function audit_logs(PDO $pdo, int $limit = 8): array
{
    $stmt = $pdo->query(
        'SELECT id, device_id, event_time, event_type, severity, title, details, metadata
         FROM audit_logs
         ORDER BY event_time DESC, id DESC
         LIMIT ' . max(1, min($limit, 50))
    );
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['metadata'] = decode_json_value($row['metadata']);
    }

    return $rows;
}

function devices(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT id, device_code, device_name, device_type, status, last_seen_at, meta
         FROM devices
         ORDER BY FIELD(device_type, "sensor_node", "camera", "aerator", "feeder", "relay", "solar_controller"), id ASC'
    );
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['meta'] = decode_json_value($row['meta']);
    }

    return $rows;
}

try {
    $pdo = aqualoop_db();

    $latest = latest_reading($pdo);

    json_response([
        'success' => true,
        'data' => [
            'latest_reading' => $latest,
            'audit_logs' => audit_logs($pdo),
            'devices' => devices($pdo),
        ],
    ]);
} catch (Throwable $e) {
    json_response([
        'success' => false,
        'error' => 'Database connection or query failed.',
        'details' => $e->getMessage(),
    ], 500);
}