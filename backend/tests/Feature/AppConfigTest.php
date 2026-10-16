<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\View;
use Tests\TestCase;

class AppConfigTest extends TestCase
{
    /**
     * Test that the public logo asset exists in public folder and is readable.
     */
    public function test_official_logo_asset_exists_in_public_directory(): void
    {
        $logoPath = public_path('logo-zootika.png');

        $this->assertFileExists($logoPath);
        $this->assertGreaterThan(0, filesize($logoPath));

        $imageInfo = @getimagesize($logoPath);
        $this->assertNotFalse($imageInfo, 'El archivo logo-zootika.png debe ser una imagen válida.');
        $this->assertEquals('image/png', $imageInfo['mime']);
    }

    /**
     * Test config values for Zootika branding.
     */
    public function test_config_values_contain_zootika_branding_and_official_colors(): void
    {
        $this->assertEquals('Zootika', config('app.name'));
        $this->assertEquals('Zootika', config('zootika.app_name'));

        $this->assertEquals('/logo-zootika.png', config('app.logo_url'));
        $this->assertEquals('/logo-zootika.png', config('zootika.logo_url'));

        $this->assertEquals('#064E3B', config('app.colors.forest_green'));
        $this->assertEquals('#10B981', config('app.colors.emerald_green'));
        $this->assertEquals('#064E3B', config('zootika.colors.forest_green'));
        $this->assertEquals('#10B981', config('zootika.colors.emerald_green'));
    }

    /**
     * Test GET /api/config returns app_name: Zootika and logo_url: /logo-zootika.png with official colors.
     */
    public function test_api_config_endpoint_returns_expected_metadata(): void
    {
        $response = $this->getJson('/api/config');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'app_name' => 'Zootika',
                'logo_url' => '/logo-zootika.png',
                'colors' => [
                    'forest_green' => '#064E3B',
                    'emerald_green' => '#10B981',
                ],
                'data' => [
                    'app_name' => 'Zootika',
                    'logo_url' => '/logo-zootika.png',
                    'colors' => [
                        'forest_green' => '#064E3B',
                        'emerald_green' => '#10B981',
                    ],
                ],
            ]);
    }

    /**
     * Test GET /api/v1/config returns app_name: Zootika and logo_url: /logo-zootika.png.
     */
    public function test_api_v1_config_endpoint_returns_expected_metadata(): void
    {
        $response = $this->getJson('/api/v1/config');

        $response->assertStatus(200)
            ->assertJsonPath('app_name', 'Zootika')
            ->assertJsonPath('logo_url', '/logo-zootika.png')
            ->assertJsonPath('colors.forest_green', '#064E3B')
            ->assertJsonPath('colors.emerald_green', '#10B981');
    }

    /**
     * Test GET /api/metadata and GET /api/v1/metadata endpoints.
     */
    public function test_api_metadata_endpoints_return_expected_branding(): void
    {
        $res1 = $this->getJson('/api/metadata');
        $res1->assertStatus(200)
            ->assertJsonPath('app_name', 'Zootika')
            ->assertJsonPath('logo_url', '/logo-zootika.png');

        $res2 = $this->getJson('/api/v1/metadata');
        $res2->assertStatus(200)
            ->assertJsonPath('app_name', 'Zootika')
            ->assertJsonPath('logo_url', '/logo-zootika.png');
    }

    /**
     * Test web metadata and config routes.
     */
    public function test_web_routes_return_metadata(): void
    {
        $response = $this->getJson('/config');
        $response->assertStatus(200)
            ->assertJsonPath('app_name', 'Zootika')
            ->assertJsonPath('logo_url', '/logo-zootika.png');

        $metaResponse = $this->getJson('/metadata');
        $metaResponse->assertStatus(200)
            ->assertJsonPath('app_name', 'Zootika')
            ->assertJsonPath('logo_url', '/logo-zootika.png');
    }

    /**
     * Test welcome blade view renders Zootika title and logo reference.
     */
    public function test_welcome_blade_view_renders_zootika_branding(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('Zootika');
        $response->assertSee('logo-zootika.png');
        $response->assertSee('#064E3B');
        $response->assertSee('#10B981');
    }

    /**
     * Test report blade layout renders logo reference and official colors.
     */
    public function test_report_blade_layout_renders_logo_reference(): void
    {
        $html = View::make('reports.layout', [
            'title' => 'Reporte de Prueba',
            'subtitle' => 'Subtítulo del Reporte',
            'farm_name' => 'Granja El Roble',
        ])->render();

        $this->assertStringContainsString('logo-zootika.png', $html);
        $this->assertStringContainsString('#064E3B', $html);
        $this->assertStringContainsString('#10B981', $html);
        $this->assertStringContainsString('Zootika', $html);
    }

    /**
     * Test email blade layout renders logo reference and official colors.
     */
    public function test_email_blade_layout_renders_logo_reference(): void
    {
        $html = View::make('emails.layout', [
            'subject' => 'Correo de Notificación',
        ])->render();

        $this->assertStringContainsString('logo-zootika.png', $html);
        $this->assertStringContainsString('#064E3B', $html);
        $this->assertStringContainsString('#10B981', $html);
        $this->assertStringContainsString('Zootika', $html);
    }
}
