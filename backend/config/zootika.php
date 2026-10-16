<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Zootika Official Branding & Asset Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for official brand identity, logo assets, and color palette.
    | Official colors:
    | - Verde Bosque (Forest Green): #064E3B
    | - Verde Esmeralda (Emerald Green): #10B981
    |
    */

    'app_name' => env('APP_NAME', 'Zootika'),

    'logo_url' => env('APP_LOGO_URL', '/logo-zootika.png'),

    'logo_path' => public_path('logo-zootika.png'),

    'colors' => [
        'forest_green' => '#064E3B',
        'emerald_green' => '#10B981',
        'primary' => '#064E3B',
        'secondary' => '#10B981',
    ],

];
