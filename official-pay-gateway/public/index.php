<?php

declare(strict_types=1);

use Yansongda\Pay\Pay;

require dirname(__DIR__) . '/vendor/autoload.php';

$configPath = dirname(__DIR__) . '/config.php';

if (!is_file($configPath)) {
    response(['ok' => false, 'message' => 'Missing official-pay-gateway/config.php'], 500);
}

$appConfig = require $configPath;

Pay::config([
    'logger' => [
        'enable' => false,
    ],
    'wechat' => [
        'default' => $appConfig['wechat'],
    ],
    'alipay' => [
        'default' => $appConfig['alipay'],
    ],
]);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/official-pay#', '', $path) ?: '/';

try {
    if ($method === 'GET' && $path === '/health') {
        response(['ok' => true]);
    }

    if (str_starts_with($path, '/notify/')) {
        handle_channel_notify($path, $appConfig);
    }

    $payload = read_signed_json($appConfig['gateway_secret'], $appConfig['gateway_encryption_key'] ?? '');

    match ($path) {
        '/payments' => response(create_payment($payload, $appConfig)),
        '/payments/query' => response(query_payment($payload, $appConfig)),
        '/payments/close' => response(close_payment($payload, $appConfig)),
        '/refunds' => response(create_refund($payload, $appConfig)),
        '/refunds/query' => response(query_refund($payload, $appConfig)),
        default => response(['ok' => false, 'message' => 'Not found'], 404),
    };
} catch (Throwable $error) {
    response(['ok' => false, 'message' => $error->getMessage()], 500);
}

function response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('content-type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_raw_body(): string
{
    return file_get_contents('php://input') ?: '';
}

function sign_body(string $secret, string $timestamp, string $body): string
{
    return hash_hmac('sha256', $timestamp . '.' . $body, $secret);
}

function base64url_encode_bin(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64url_decode_bin(string $value, string $field): string
{
    if (!preg_match('/^[A-Za-z0-9_-]+={0,2}$/', $value)) {
        throw new RuntimeException('Invalid encrypted payload ' . $field);
    }

    $normalized = strtr($value, '-_', '+/');
    $padded = str_pad($normalized, (int) (ceil(strlen($normalized) / 4) * 4), '=', STR_PAD_RIGHT);
    $decoded = base64_decode($padded, true);

    if ($decoded === false) {
        throw new RuntimeException('Invalid encrypted payload ' . $field);
    }

    return $decoded;
}

function internal_encryption_key(string $secret): string
{
    $value = trim($secret);

    if (preg_match('/^[a-f0-9]{64}$/i', $value)) {
        $decoded = hex2bin($value);

        if ($decoded !== false) {
            return $decoded;
        }
    }

    if (preg_match('/^[A-Za-z0-9+\/_-]+={0,2}$/', $value)) {
        $normalized = strtr($value, '-_', '+/');
        $padded = str_pad($normalized, (int) (ceil(strlen($normalized) / 4) * 4), '=', STR_PAD_RIGHT);
        $decoded = base64_decode($padded, true);

        if ($decoded !== false && strlen($decoded) === 32) {
            return $decoded;
        }
    }

    if (strlen($value) === 32) {
        return $value;
    }

    throw new RuntimeException('CONFIG_MISSING: invalid internal encryption key');
}

function encrypt_internal_payload(array $payload, string $keySecret): string
{
    $key = internal_encryption_key($keySecret);
    $nonce = random_bytes(12);
    $tag = '';
    $plaintext = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($plaintext === false) {
        throw new RuntimeException('Failed to encode internal payload');
    }

    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        $nonce,
        $tag,
        'buy_web:official-pay:v1',
        16
    );

    if ($ciphertext === false) {
        throw new RuntimeException('Failed to encrypt internal payload');
    }

    $body = json_encode([
        'v' => 1,
        'kid' => 'primary',
        'alg' => 'AES-256-GCM',
        'nonce' => base64url_encode_bin($nonce),
        'ciphertext' => base64url_encode_bin($ciphertext),
        'tag' => base64url_encode_bin($tag),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($body === false) {
        throw new RuntimeException('Failed to encode encrypted envelope');
    }

    return $body;
}

function decrypt_internal_payload(string $body, string $keySecret): array
{
    $envelope = json_decode($body, true);

    if (
        !is_array($envelope)
        || ($envelope['v'] ?? null) !== 1
        || ($envelope['kid'] ?? null) !== 'primary'
        || ($envelope['alg'] ?? null) !== 'AES-256-GCM'
        || !is_string($envelope['nonce'] ?? null)
        || !is_string($envelope['ciphertext'] ?? null)
        || !is_string($envelope['tag'] ?? null)
    ) {
        throw new RuntimeException('Invalid encrypted payload envelope');
    }

    $plaintext = openssl_decrypt(
        base64url_decode_bin($envelope['ciphertext'], 'ciphertext'),
        'aes-256-gcm',
        internal_encryption_key($keySecret),
        OPENSSL_RAW_DATA,
        base64url_decode_bin($envelope['nonce'], 'nonce'),
        base64url_decode_bin($envelope['tag'], 'tag'),
        'buy_web:official-pay:v1'
    );

    if ($plaintext === false) {
        throw new RuntimeException('Invalid encrypted payload');
    }

    $payload = json_decode($plaintext, true);

    if (!is_array($payload)) {
        throw new RuntimeException('Encrypted payload must contain a JSON object');
    }

    return $payload;
}

function read_signed_json(string $secret, string $encryptionKey): array
{
    $body = read_raw_body();
    $timestamp = $_SERVER['HTTP_X_BUY_WEB_TIMESTAMP'] ?? '';
    $signature = $_SERVER['HTTP_X_BUY_WEB_SIGNATURE'] ?? '';

    if ($timestamp === '' || $signature === '') {
        throw new RuntimeException('Missing internal signature');
    }

    if (abs((int) floor(microtime(true) * 1000) - (int) $timestamp) > 300000) {
        throw new RuntimeException('Expired internal request');
    }

    if (!hash_equals(sign_body($secret, $timestamp, $body), $signature)) {
        throw new RuntimeException('Invalid internal signature');
    }

    return decrypt_internal_payload($body, $encryptionKey);
}

function signed_post(string $url, array $payload, string $secret, string $encryptionKey): void
{
    $body = encrypt_internal_payload($payload, $encryptionKey);
    $timestamp = (string) floor(microtime(true) * 1000);
    $signature = sign_body($secret, $timestamp, $body);
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", [
                'content-type: application/json',
                'x-buy-web-timestamp: ' . $timestamp,
                'x-buy-web-signature: ' . $signature,
            ]),
            'content' => $body,
            'timeout' => 10,
        ],
    ]);

    $result = @file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';

    if ($result === false || !preg_match('#\s2\d\d\s#', $statusLine)) {
        throw new RuntimeException('Failed to forward verified callback to buy_web');
    }
}

function money_yuan(int $amountCent): string
{
    return number_format($amountCent / 100, 2, '.', '');
}

function public_notify_url(array $appConfig, string $channel, string $type): string
{
    return rtrim($appConfig['public_base_url'], '/') . '/notify/' . $channel . '/' . $type;
}

function wechat_action_from_way_code(string $wayCode): string
{
    return match ($wayCode) {
        'WX_H5' => 'h5',
        'WX_NATIVE' => 'native',
        default => 'jsapi',
    };
}

function wechat_refund_query_action_from_way_code(string $wayCode): string
{
    return match ($wayCode) {
        'WX_H5' => 'refund_h5',
        'WX_NATIVE' => 'refund_native',
        default => 'refund',
    };
}

function alipay_action_from_way_code(string $wayCode): string
{
    return $wayCode === 'ALI_WAP' ? 'h5' : 'web';
}

function alipay_refund_query_action_from_way_code(string $wayCode): string
{
    return $wayCode === 'ALI_WAP' ? 'refund_h5' : 'refund_web';
}

function require_config_value(array $config, string $key, string $label): void
{
    if (trim((string) ($config[$key] ?? '')) === '') {
        throw new RuntimeException('CONFIG_MISSING: ' . $label . ' is not configured');
    }
}

function require_readable_config_file(array $config, string $key, string $label): void
{
    $path = trim((string) ($config[$key] ?? ''));

    if ($path === '' || !is_readable($path)) {
        throw new RuntimeException('CONFIG_MISSING: ' . $label . ' is not readable');
    }
}

function assert_channel_config(array $appConfig, string $wayCode): void
{
    if (str_starts_with($wayCode, 'ALI')) {
        $alipay = $appConfig['alipay'] ?? [];
        require_config_value($alipay, 'app_id', 'Alipay app_id');
        require_readable_config_file($alipay, 'app_secret_cert', 'Alipay app private key');
        require_readable_config_file($alipay, 'alipay_public_cert_path', 'Alipay public certificate');
        require_readable_config_file($alipay, 'app_public_cert_path', 'Alipay app public certificate');
        require_readable_config_file($alipay, 'alipay_root_cert_path', 'Alipay root certificate');
        return;
    }

    $wechat = $appConfig['wechat'] ?? [];
    require_config_value($wechat, 'mch_id', 'WeChat Pay merchant id');
    require_config_value($wechat, 'mch_secret_key', 'WeChat Pay API v3 key');
    require_config_value($wechat, 'mp_app_id', 'WeChat Pay app id');
    require_readable_config_file($wechat, 'mch_secret_cert', 'WeChat Pay merchant private key');
    require_readable_config_file($wechat, 'mch_public_cert_path', 'WeChat Pay platform certificate');
}

function create_payment(array $payload, array $appConfig): array
{
    $wayCode = (string) ($payload['wayCode'] ?? '');
    $amountCent = (int) ($payload['amountCent'] ?? 0);
    $subject = mb_substr((string) ($payload['subject'] ?? '订单支付'), 0, 64);
    $mchOrderNo = (string) ($payload['mchOrderNo'] ?? '');

    if ($mchOrderNo === '' || $amountCent <= 0) {
        throw new RuntimeException('Invalid payment payload');
    }

    assert_channel_config($appConfig, $wayCode);

    if ($wayCode === 'WX_NATIVE') {
        $result = Pay::wechat()->scan([
            'out_trade_no' => $mchOrderNo,
            'description' => $subject,
            'amount' => ['total' => $amountCent],
            'notify_url' => public_notify_url($appConfig, 'wechat', 'pay'),
        ]);
        $data = to_array($result);

        return ok_payment($mchOrderNo, 'PAYING', 'codeUrl', (string) ($data['code_url'] ?? ''));
    }

    if ($wayCode === 'WX_H5') {
        $result = Pay::wechat()->h5([
            'out_trade_no' => $mchOrderNo,
            'description' => $subject,
            'amount' => ['total' => $amountCent],
            'scene_info' => [
                'payer_client_ip' => $payload['clientIp'] ?? '127.0.0.1',
                'h5_info' => ['type' => 'Wap'],
            ],
            'notify_url' => public_notify_url($appConfig, 'wechat', 'pay'),
        ]);
        $data = to_array($result);

        return ok_payment($mchOrderNo, 'PAYING', 'payUrl', (string) ($data['h5_url'] ?? ''));
    }

    if ($wayCode === 'ALI_PC' || $wayCode === 'ALI_WAP') {
        $params = [
            'out_trade_no' => $mchOrderNo,
            'total_amount' => money_yuan($amountCent),
            'subject' => $subject,
            'notify_url' => public_notify_url($appConfig, 'alipay', 'pay'),
            'return_url' => $payload['returnUrl'] ?? ($appConfig['alipay']['return_url'] ?? ''),
            '_method' => 'get',
        ];
        $result = $wayCode === 'ALI_PC'
            ? Pay::alipay()->web($params)
            : Pay::alipay()->wap($params);

        return ok_payment($mchOrderNo, 'PAYING', 'form', (string) $result->getBody());
    }

    throw new RuntimeException('Unsupported wayCode: ' . $wayCode);
}

function ok_payment(string $providerOrderId, string $status, string $payDataType, string $payData): array
{
    return [
        'ok' => true,
        'data' => [
            'providerOrderId' => $providerOrderId,
            'status' => $status,
            'payDataType' => $payDataType,
            'payData' => $payData,
        ],
    ];
}

function query_payment(array $payload, array $appConfig): array
{
    $mchOrderNo = (string) ($payload['mchOrderNo'] ?? '');
    $wayCode = (string) ($payload['wayCode'] ?? '');
    assert_channel_config($appConfig, $wayCode);
    $result = str_starts_with($wayCode, 'ALI')
        ? Pay::alipay()->query([
            'out_trade_no' => $mchOrderNo,
            '_action' => alipay_action_from_way_code($wayCode),
        ])
        : Pay::wechat()->query([
            'out_trade_no' => $mchOrderNo,
            '_action' => wechat_action_from_way_code($wayCode),
        ]);
    $data = to_array($result);

    return ['ok' => true, 'data' => [
        'providerOrderId' => (string) ($data['transaction_id'] ?? $data['trade_no'] ?? $mchOrderNo),
        'status' => (string) ($data['trade_state'] ?? $data['trade_status'] ?? 'CREATED'),
        'paidAt' => $data['success_time'] ?? $data['send_pay_date'] ?? null,
    ]];
}

function close_payment(array $payload, array $appConfig): array
{
    $mchOrderNo = (string) ($payload['mchOrderNo'] ?? '');
    $wayCode = (string) ($payload['wayCode'] ?? '');
    assert_channel_config($appConfig, $wayCode);
    if (str_starts_with($wayCode, 'ALI')) {
        Pay::alipay()->close([
            'out_trade_no' => $mchOrderNo,
            '_action' => alipay_action_from_way_code($wayCode),
        ]);
    } else {
        Pay::wechat()->close([
            'out_trade_no' => $mchOrderNo,
            '_action' => wechat_action_from_way_code($wayCode),
        ]);
    }

    return ['ok' => true, 'data' => [
        'providerOrderId' => $payload['providerOrderId'] ?? $mchOrderNo,
        'status' => 'CLOSED',
    ]];
}

function create_refund(array $payload, array $appConfig): array
{
    $mchRefundNo = (string) ($payload['mchRefundNo'] ?? '');
    $mchOrderNo = (string) ($payload['mchOrderNo'] ?? '');
    $amountCent = (int) ($payload['amountCent'] ?? 0);

    if ($mchRefundNo === '' || $mchOrderNo === '' || $amountCent <= 0) {
        throw new RuntimeException('Invalid refund payload');
    }

    $wayCode = (string) ($payload['wayCode'] ?? '');
    assert_channel_config($appConfig, $wayCode);
    $result = str_starts_with($wayCode, 'ALI')
        ? Pay::alipay()->refund([
            'out_trade_no' => $mchOrderNo,
            'out_request_no' => $mchRefundNo,
            'refund_amount' => money_yuan($amountCent),
            'refund_reason' => $payload['reason'] ?? 'refund',
            '_action' => alipay_action_from_way_code($wayCode),
        ])
        : Pay::wechat()->refund([
            'out_trade_no' => $mchOrderNo,
            'out_refund_no' => $mchRefundNo,
            'reason' => $payload['reason'] ?? 'refund',
            'notify_url' => public_notify_url($appConfig, 'wechat', 'refund'),
            '_action' => wechat_action_from_way_code($wayCode),
            'amount' => [
                'refund' => $amountCent,
                'total' => $amountCent,
                'currency' => strtoupper((string) ($payload['currency'] ?? 'CNY')),
            ],
        ]);
    $data = to_array($result);

    return ['ok' => true, 'data' => [
        'providerRefundId' => (string) ($data['refund_id'] ?? $data['trade_no'] ?? $mchRefundNo),
        'status' => (string) ($data['status'] ?? 'REFUNDING'),
    ]];
}

function query_refund(array $payload, array $appConfig): array
{
    $mchRefundNo = (string) ($payload['mchRefundNo'] ?? '');
    $mchOrderNo = (string) ($payload['mchOrderNo'] ?? '');
    $wayCode = (string) ($payload['wayCode'] ?? '');
    assert_channel_config($appConfig, $wayCode);

    if (str_starts_with($wayCode, 'ALI') && $mchOrderNo === '') {
        throw new RuntimeException('Missing mchOrderNo for Alipay refund query');
    }

    $result = str_starts_with($wayCode, 'ALI')
        ? Pay::alipay()->query([
            'out_trade_no' => $mchOrderNo,
            'out_request_no' => $mchRefundNo,
            '_action' => alipay_refund_query_action_from_way_code($wayCode),
        ])
        : Pay::wechat()->query([
            'out_refund_no' => $mchRefundNo,
            '_action' => wechat_refund_query_action_from_way_code($wayCode),
        ]);
    $data = to_array($result);

    return ['ok' => true, 'data' => [
        'providerRefundId' => (string) ($data['refund_id'] ?? $mchRefundNo),
        'status' => (string) ($data['status'] ?? 'CREATED'),
        'refundedAt' => $data['success_time'] ?? null,
    ]];
}

function handle_channel_notify(string $path, array $appConfig): never
{
    $parts = array_values(array_filter(explode('/', $path)));
    $channel = $parts[1] ?? '';
    $type = $parts[2] ?? '';
    $notify = $channel === 'alipay'
        ? Pay::alipay()->callback()
        : Pay::wechat()->callback();
    $data = to_array($notify);
    $notifyUrl = rtrim((string) ($appConfig['buy_web_base_url'] ?? ''), '/')
        . ($type === 'refund' ? '/api/refunds/official/notify' : '/api/payments/official/notify');

    $payload = $type === 'refund'
        ? [
            'mchRefundNo' => (string) ($data['out_refund_no'] ?? ''),
            'providerRefundId' => (string) ($data['refund_id'] ?? ''),
            'amountCent' => (int) ($data['amount']['refund'] ?? ((float) ($data['refund_fee'] ?? $data['refund_amount'] ?? 0) * 100)),
            'status' => (string) ($data['refund_status'] ?? $data['status'] ?? 'CREATED'),
            'refundedAt' => $data['success_time'] ?? null,
        ]
        : [
            'mchOrderNo' => (string) ($data['out_trade_no'] ?? ''),
            'providerOrderId' => (string) ($data['transaction_id'] ?? $data['trade_no'] ?? ''),
            'amountCent' => (int) ($data['amount']['total'] ?? ((float) ($data['total_amount'] ?? 0) * 100)),
            'status' => (string) ($data['trade_state'] ?? $data['trade_status'] ?? 'CREATED'),
            'paidAt' => $data['success_time'] ?? $data['gmt_payment'] ?? null,
        ];

    signed_post($notifyUrl, $payload, $appConfig['gateway_secret'], $appConfig['gateway_encryption_key'] ?? '');
    echo $channel === 'alipay' ? 'success' : json_encode(['code' => 'SUCCESS', 'message' => 'success']);
    exit;
}

function to_array(mixed $value): array
{
    if (is_array($value)) {
        return $value;
    }

    if ($value instanceof JsonSerializable) {
        return (array) $value->jsonSerialize();
    }

    if (is_object($value) && method_exists($value, 'all')) {
        return (array) $value->all();
    }

    if (is_object($value) && method_exists($value, 'toArray')) {
        return (array) $value->toArray();
    }

    return [];
}
