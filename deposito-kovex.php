<?php
// =============================
// CONFIG PAGA HOY
// =============================
$PAGAHOY_API_KEY = 'abd8bcae95742d5155a28d2d0a7eab4a9a27c173';
$PAGAHOY_API_URL = 'https://api.pagahoy.com/api/v1/checkout'; // PDF

// URL donde PagaHoy te avisará (webhook)
$NOTIFY_URL = 'https://kovex.net/notify-kovex.php';

// Páginas de éxito / error para el usuario (las puedes crear en WP)
$SUCCESS_URL = 'https://kovex.net/deposito-exitoso';
$CANCEL_URL  = 'https://kovex.net/deposito-cancelado';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $amount    = floatval($_POST['amount'] ?? 0);
    $currency  = $_POST['currency'] ?? 'USD';
    $fullName  = trim($_POST['fullName'] ?? '');
    $email     = trim($_POST['email'] ?? '');
    $accountId = trim($_POST['accountId'] ?? '');

    if ($amount <= 0) {
        $error = 'El monto debe ser mayor a 0.';
    } elseif ($amount < 10) {
        $error = 'El depósito mínimo es 10.';
    } else {

        // order único recomendado por Pagahoy
        $order = 'KVX-'.date('Ymd-His').'-'.mt_rand(1000,9999).'-'.$accountId;

        // Body EXACTO según la doc: amount, currency, notifyUrl, order
        $payload = [
            'amount'    => round($amount, 2),
            'currency'  => $currency,
            'notifyUrl' => $NOTIFY_URL,
            'order'     => $order,
        ];

        $ch = curl_init($PAGAHOY_API_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Api-Key: '.$PAGAHOY_API_KEY,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $error = 'No se pudo conectar con PagaHoy.';
        } else {
            $data = json_decode($response, true);

            // Según la doc, en éxito viene status=success y token (URL) :contentReference[oaicite:2]{index=2}
            if ($httpCode === 200 && isset($data['status']) && $data['status'] === 'success' && isset($data['token'])) {
                $checkoutUrl = $data['token'];
                header('Location: '.$checkoutUrl);
                exit;
            } else {
                $error = 'Error en la respuesta de PagaHoy: '.$response;
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Depósito | Kovex</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --kovex-pink: #ff2b7a;
    --kovex-pink-soft: #ffe3f0;
    --kovex-dark: #111827;
    --kovex-muted: #6b7280;
    --kovex-border: #e5e7eb;
  }
  * { box-sizing: border-box; }
  body {
    margin:0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background:#ffffff;
    color:var(--kovex-dark);
  }
  header {
    border-bottom:1px solid var(--kovex-border);
    padding:14px 24px;
    display:flex;
    align-items:center;
    justify-content:space-between;
  }
  .logo{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.06em;font-size:18px;}
  .logo-mark{width:28px;height:28px;border-radius:999px;background:radial-gradient(circle at 30% 20%,#ffe3f0,#ff2b7a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;}
  .logo span:nth-child(2){color:var(--kovex-dark);}
  .logo span:nth-child(3){color:var(--kovex-pink);}
  main{max-width:480px;margin:40px auto;padding:0 16px;}
  h1{margin-bottom:8px;color:var(--kovex-pink);}
  p{color:var(--kovex-muted);font-size:14px;}
  .card{
    border-radius:18px;
    border:1px solid var(--kovex-border);
    padding:24px 20px 26px;
    box-shadow:0 18px 45px rgba(17,24,39,0.04);
  }
  label{display:block;margin-bottom:4px;font-size:13px;font-weight:500;}
  input,select{
    width:100%;padding:10px 12px;margin-bottom:14px;
    border-radius:999px;border:1px solid var(--kovex-border);
    font-size:13px;outline:none;
  }
  input:focus,select:focus{
    border-color:var(--kovex-pink);
    box-shadow:0 0 0 1px rgba(255,43,122,.18);
  }
  button{
    width:100%;padding:11px 16px;border-radius:999px;border:none;
    background:linear-gradient(135deg,#ff2b7a,#ff4fa0);
    color:#fff;font-weight:600;font-size:14px;cursor:pointer;
  }
  button:hover{filter:brightness(1.05);}
  .error{
    background:#fef2f2;
    border:1px solid #fecaca;
    color:#b91c1c;
    padding:10px 12px;
    border-radius:10px;
    font-size:12px;
    margin-bottom:14px;
  }
  small{font-size:11px;color:var(--kovex-muted);}
</style>
</head>
<body>
<header>
  <div class="logo">
    <div class="logo-mark">K</div>
    <span>KOVEX</span><span>TRADER</span>
  </div>
</header>

<main>
  <div class="card">
    <h1>Depositar fondos</h1>
    <p>Genera tu link de pago seguro con PagaHoy y abona saldo a tu cuenta Kovex.</p>

    <?php if ($error): ?>
      <div class="error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="POST">
      <label for="amount">Monto</label>
      <input type="number" id="amount" name="amount" step="0.01" min="10" required>

      <label for="currency">Moneda</label>
      <select id="currency" name="currency">
        <option value="USD">USD – Dólares</option>
        <option value="MXN">MXN – Pesos mexicanos</option>
      </select>

      <label for="fullName">Nombre completo</label>
      <input type="text" id="fullName" name="fullName" required>

      <label for="email">Correo electrónico</label>
      <input type="email" id="email" name="email" required>

      <label for="accountId">ID de cuenta Kovex</label>
      <input type="text" id="accountId" name="accountId" placeholder="Ej. KVX-123456" required>

      <button type="submit">Continuar al pago seguro</button>
      <small>Al continuar aceptas los términos y condiciones de Kovex y PagaHoy.</small>
    </form>
  </div>
</main>
</body>
</html>
