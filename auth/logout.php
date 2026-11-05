<?php

header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_start();

$_SESSION = [];

session_destroy();

header("Content-Type: application/json");

echo json_encode([
    "success" => true,
    "message" => "Logout berhasil"
]);

?>