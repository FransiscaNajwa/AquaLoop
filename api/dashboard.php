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

function latest_reading(PDO $pdo, int $pondId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT id, pond_id, device_id, reading_time, ph, dissolved_oxygen, salinity, temperature, ammonia, water_level, battery_percent, pump_power_watts, raw_payload
         FROM sensor_readings
         WHERE pond_id = :pond_id
         ORDER BY reading_time DESC, id DESC
         LIMIT 1'
    );
    $stmt->execute(['pond_id' => $pondId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    $row['raw_payload'] = decode_json_value($row['raw_payload']);
    return $row;
}

function audit_logs(PDO $pdo, int $pondId, int $limit = 8): array
{
    $stmt = $pdo->prepare(
        'SELECT id, pond_id, device_id, event_time, event_type, severity, title, details, metadata
         FROM audit_logs
         WHERE pond_id = :pond_id
         ORDER BY event_time DESC, id DESC
         LIMIT ' . max(1, min($limit, 50))
    );
    $stmt->execute(['pond_id' => $pondId]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['metadata'] = decode_json_value($row['metadata']);
    }

    return $rows;
}

function devices(PDO $pdo, int $pondId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, pond_id, device_code, device_name, device_type, status, last_seen_at, meta
         FROM devices
         WHERE pond_id = :pond_id
         ORDER BY FIELD(device_type, "sensor_node", "camera", "aerator", "feeder", "relay", "solar_controller"), id ASC'
    );
    $stmt->execute(['pond_id' => $pondId]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['meta'] = decode_json_value($row['meta']);
    }

    return $rows;
}

try {
    $pdo = aqualoop_db();
    $ponds = $pdo->query('SELECT id, code, name, location, notes, is_active FROM ponds WHERE is_active = 1 ORDER BY id ASC')->fetchAll();

    $requestedPond = strtoupper(trim((string) ($_GET['pond'] ?? '')));
    $currentPond = null;

    foreach ($ponds as $pond) {
        if ($requestedPond !== '' && $pond['code'] === $requestedPond) {
            $currentPond = $pond;
            break;
        }
    }

    if ($currentPond === null && !empty($ponds)) {
        $currentPond = $ponds[0];
    }

    if ($currentPond === null) {
        json_response([
            'success' => true,
            'data' => [
                'ponds' => [],
                'current_pond' => null,
                'latest_reading' => null,
                'audit_logs' => [],
                'devices' => [],
            ],
        ]);
    }

    $pondId = (int) $currentPond['id'];
    $latest = latest_reading($pdo, $pondId);

    json_response([
        'success' => true,
        'data' => [
            'ponds' => $ponds,
            'current_pond' => $currentPond,
            'latest_reading' => $latest,
            'audit_logs' => audit_logs($pdo, $pondId),
            'devices' => devices($pdo, $pondId),
        ],
    ]);
} catch (Throwable $e) {
    json_response([
        'success' => false,
        'error' => 'Database connection or query failed.',
        'details' => $e->getMessage(),
    ], 500);
}
