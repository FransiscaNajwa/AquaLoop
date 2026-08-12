<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed.',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

require_once __DIR__ . '/db.php';

function response_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        response_json([
            'success' => false,
            'error' => 'Invalid JSON payload.',
        ], 400);
    }

    return $decoded;
}

function require_string(array $data, string $key, string $fallback = ''): string
{
    $value = trim((string) ($data[$key] ?? $fallback));
    if ($value === '') {
        response_json([
            'success' => false,
            'error' => "Missing required field: {$key}.",
        ], 422);
    }

    return $value;
}

function normalize_number(mixed $value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_numeric($value)) {
        return null;
    }

    return (float) $value;
}

function normalize_int(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_numeric($value)) {
        return null;
    }

    return (int) $value;
}

function decode_or_null(mixed $value): mixed
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_array($value)) {
        return $value;
    }

    $decoded = json_decode((string) $value, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

try {
    $payload = json_body();
    $pdo = aqualoop_db();
    $pdo->beginTransaction();

    $pondCode = strtoupper(require_string($payload, 'pond_code'));
    $pondName = trim((string) ($payload['pond_name'] ?? 'Pond ' . $pondCode));
    $pondLocation = trim((string) ($payload['pond_location'] ?? ''));
    $pondNotes = trim((string) ($payload['pond_notes'] ?? ''));

    $pondStmt = $pdo->prepare(
        'INSERT INTO ponds (code, name, location, notes, is_active)
         VALUES (:code, :name, :location, :notes, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           location = VALUES(location),
           notes = VALUES(notes),
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP'
    );
    $pondStmt->execute([
        'code' => $pondCode,
        'name' => $pondName !== '' ? $pondName : 'Pond ' . $pondCode,
        'location' => $pondLocation !== '' ? $pondLocation : null,
        'notes' => $pondNotes !== '' ? $pondNotes : null,
    ]);

    $pondIdStmt = $pdo->prepare('SELECT id FROM ponds WHERE code = :code LIMIT 1');
    $pondIdStmt->execute(['code' => $pondCode]);
    $pondRow = $pondIdStmt->fetch();
    if (!$pondRow) {
        throw new RuntimeException('Failed to resolve pond id.');
    }
    $pondId = (int) $pondRow['id'];

    $deviceCode = trim((string) ($payload['device_code'] ?? ''));
    $deviceId = null;
    if ($deviceCode !== '') {
        $deviceName = trim((string) ($payload['device_name'] ?? $deviceCode));
        $deviceType = trim((string) ($payload['device_type'] ?? 'sensor_node'));
        $status = trim((string) ($payload['device_status'] ?? 'online'));
        $meta = decode_or_null($payload['device_meta'] ?? null);

        $allowedTypes = ['sensor_node', 'aerator', 'feeder', 'relay', 'solar_controller', 'camera'];
        if (!in_array($deviceType, $allowedTypes, true)) {
            $deviceType = 'sensor_node';
        }

        $allowedStatuses = ['online', 'offline', 'maintenance', 'warning'];
        if (!in_array($status, $allowedStatuses, true)) {
            $status = 'online';
        }

        $deviceStmt = $pdo->prepare(
            'INSERT INTO devices (pond_id, device_code, device_name, device_type, status, last_seen_at, meta)
             VALUES (:pond_id, :device_code, :device_name, :device_type, :status, NOW(), :meta)
             ON DUPLICATE KEY UPDATE
               pond_id = VALUES(pond_id),
               device_name = VALUES(device_name),
               device_type = VALUES(device_type),
               status = VALUES(status),
               last_seen_at = NOW(),
               meta = VALUES(meta),
               updated_at = CURRENT_TIMESTAMP'
        );
        $deviceStmt->execute([
            'pond_id' => $pondId,
            'device_code' => $deviceCode,
            'device_name' => $deviceName !== '' ? $deviceName : $deviceCode,
            'device_type' => $deviceType,
            'status' => $status,
            'meta' => $meta !== null ? json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        ]);

        $deviceIdStmt = $pdo->prepare('SELECT id FROM devices WHERE device_code = :device_code LIMIT 1');
        $deviceIdStmt->execute(['device_code' => $deviceCode]);
        $deviceRow = $deviceIdStmt->fetch();
        $deviceId = $deviceRow ? (int) $deviceRow['id'] : null;
    }

    $rawPayload = $payload['raw_payload'] ?? $payload;
    $rawPayloadJson = json_encode($rawPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $readingStmt = $pdo->prepare(
        'INSERT INTO sensor_readings
         (pond_id, device_id, reading_time, ph, dissolved_oxygen, salinity, temperature, ammonia, water_level, battery_percent, pump_power_watts, raw_payload)
         VALUES
         (:pond_id, :device_id, :reading_time, :ph, :dissolved_oxygen, :salinity, :temperature, :ammonia, :water_level, :battery_percent, :pump_power_watts, :raw_payload)'
    );
    $readingStmt->execute([
        'pond_id' => $pondId,
        'device_id' => $deviceId,
        'reading_time' => date('Y-m-d H:i:s'),
        'ph' => normalize_number($payload['ph'] ?? null),
        'dissolved_oxygen' => normalize_number($payload['dissolved_oxygen'] ?? null),
        'salinity' => normalize_number($payload['salinity'] ?? null),
        'temperature' => normalize_number($payload['temperature'] ?? null),
        'ammonia' => normalize_number($payload['ammonia'] ?? null),
        'water_level' => normalize_number($payload['water_level'] ?? null),
        'battery_percent' => normalize_int($payload['battery_percent'] ?? null),
        'pump_power_watts' => normalize_number($payload['pump_power_watts'] ?? null),
        'raw_payload' => $rawPayloadJson,
    ]);
    $readingId = (int) $pdo->lastInsertId();

    $eventType = trim((string) ($payload['event_type'] ?? ''));
    $auditId = null;

    if ($eventType !== '') {
        $allowedEvents = ['relay_cutoff', 'relay_resume', 'do_anomaly', 'ph_calibration', 'feed_hold', 'system_check', 'maintenance', 'warning', 'info'];
        if (!in_array($eventType, $allowedEvents, true)) {
            $eventType = 'info';
        }

        $severity = trim((string) ($payload['severity'] ?? 'low'));
        $allowedSeverities = ['low', 'medium', 'high', 'critical'];
        if (!in_array($severity, $allowedSeverities, true)) {
            $severity = 'low';
        }

        $title = trim((string) ($payload['event_title'] ?? 'Sensor reading received'));
        $details = trim((string) ($payload['event_details'] ?? ''));
        $metadata = decode_or_null($payload['event_metadata'] ?? null);
        $metadataJson = $metadata !== null ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;

        $auditStmt = $pdo->prepare(
            'INSERT INTO audit_logs (pond_id, device_id, event_time, event_type, severity, title, details, metadata)
             VALUES (:pond_id, :device_id, :event_time, :event_type, :severity, :title, :details, :metadata)'
        );
        $auditStmt->execute([
            'pond_id' => $pondId,
            'device_id' => $deviceId,
            'event_time' => date('Y-m-d H:i:s'),
            'event_type' => $eventType,
            'severity' => $severity,
            'title' => $title !== '' ? $title : 'Sensor reading received',
            'details' => $details !== '' ? $details : null,
            'metadata' => $metadataJson,
        ]);
        $auditId = (int) $pdo->lastInsertId();
    }

    $pdo->commit();

    response_json([
        'success' => true,
        'data' => [
            'pond_id' => $pondId,
            'device_id' => $deviceId,
            'reading_id' => $readingId,
            'audit_id' => $auditId,
        ],
    ], 201);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    response_json([
        'success' => false,
        'error' => 'Failed to ingest sensor payload.',
        'details' => $e->getMessage(),
    ], 500);
}
