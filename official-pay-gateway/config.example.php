<?php

return [
    'gateway_secret' => getenv('BUY_WEB_GATEWAY_SECRET') ?: 'replace-with-a-long-random-secret',
    'public_base_url' => getenv('OFFICIAL_PAY_PUBLIC_BASE_URL') ?: 'https://example.com/official-pay',
    'buy_web_base_url' => getenv('BUY_WEB_BASE_URL') ?: 'https://example.com',
    'wechat' => [
        'mch_id' => getenv('WECHAT_PAY_MCH_ID') ?: '',
        'mch_secret_key' => getenv('WECHAT_PAY_API_V3_KEY') ?: '',
        'mch_secret_cert' => getenv('WECHAT_PAY_MCH_PRIVATE_KEY_PATH') ?: '',
        'mch_public_cert_path' => getenv('WECHAT_PAY_PLATFORM_CERT_PATH') ?: '',
        'mp_app_id' => getenv('WECHAT_PAY_MP_APP_ID') ?: '',
    ],
    'alipay' => [
        'app_id' => getenv('ALIPAY_APP_ID') ?: '',
        'app_secret_cert' => getenv('ALIPAY_APP_PRIVATE_KEY_PATH') ?: '',
        'alipay_public_cert_path' => getenv('ALIPAY_PUBLIC_CERT_PATH') ?: '',
        'app_public_cert_path' => getenv('ALIPAY_APP_PUBLIC_CERT_PATH') ?: '',
        'alipay_root_cert_path' => getenv('ALIPAY_ROOT_CERT_PATH') ?: '',
        'return_url' => getenv('ALIPAY_RETURN_URL') ?: '',
    ],
];
