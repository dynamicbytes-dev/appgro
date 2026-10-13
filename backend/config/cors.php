<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'v1/*', '*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', '*'],

    'allowed_origins' => ['http://localhost:5175', 'http://localhost:5173', 'http://localhost:3000', '*'],

    'allowed_origins_patterns' => ['#^http://localhost:\d+$#'],

    'allowed_headers' => ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', '*'],

    'exposed_headers' => ['Authorization'],

    'max_age' => 0,

    'supports_credentials' => true,

];
