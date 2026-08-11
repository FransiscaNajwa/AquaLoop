<?php
declare(strict_types=1);

function aqualoop_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('AQUALOOP_DB_HOST') ?: '127.0.0.1';
    $port = getenv('AQUALOOP_DB_PORT') ?: '3306';
    $name = getenv('AQUALOOP_DB_NAME') ?: 'aqualoop';
    $user = getenv('AQUALOOP_DB_USER') ?: 'root';
    $pass = getenv('AQUALOOP_DB_PASS') ?: '';

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
