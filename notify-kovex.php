<?php
// Simple logger del webhook
$raw = file_get_contents('php://input');
file_put_contents(__DIR__.'/pagahoy-webhook.log', date('c').' '.$raw.PHP_EOL, FILE_APPEND);

// Si quieres, aquí parseas y acreditas saldo:
$data = json_decode($raw, true);
// $data['order'], $data['status'], etc.

http_response_code(200);
echo 'OK';
