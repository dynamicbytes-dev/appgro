<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ResetFarmDataCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:reset-farm-data
        {--force : Omitir la confirmación y ejecutar directamente}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Vacía todas las tablas operativas de la granja (lotes, animales, galpones, especies, servicios, actividad) conservando users, farms y módulos';

    /**
     * Tablas operativas a vaciar, ordenadas de HIJO a PADRE
     * para que ninguna referencia FK quede apuntando a filas
     * eliminadas durante el proceso:
     *
     *  - animal_services  → hijo de lote_animals
     *  - lote_animals     → hijo de lots (animales individuales)
     *  - lots             → hijo de farms / galpones / barns / species
     *  - galpones         → hijo de farms / species
     *  - barns            → hijo de farms
     *  - species          → hijo de farms
     *  - activities       → hijo de farms / users (tareas asignadas)
     *  - notifications    → hijo de users (canal database)
     *  - activity_logs    → hijo de users / farms
     *
     * La producción de huevos y las cosechas NO tienen tabla
     * propia: viven como columnas en `lots` y `lote_animals`,
     * por lo que se vacían con estas tablas.
     *
     * @var array<int, string>
     */
    protected array $operationalTables = [
        'animal_services',
        'lote_animals',
        'lots',
        'galpones',
        'barns',
        'species',
        'activities',
        'notifications',
        'activity_logs',
    ];

    /**
     * Tablas que NUNCA se tocan (se conservan intactas).
     *
     * @var array<int, string>
     */
    protected array $protectedTables = [
        'users',
        'farms',
        'modules',
        'farm_modules',
        'subordinate_modules',
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $driver = DB::getDriverName();

        // Solo las tablas que realmente existen en este esquema
        $tables = array_values(array_filter(
            $this->operationalTables,
            fn (string $t) => Schema::hasTable($t)
        ));

        if (empty($tables)) {
            $this->info('No hay tablas operativas que limpiar. Nada que hacer.');

            return self::SUCCESS;
        }

        $this->info('Tablas que serán VACIADAS:');
        foreach ($tables as $table) {
            $count = (int) DB::table($table)->count();
            $this->line(sprintf('  • %-16s %8d registros', $table, $count));
        }

        $this->newLine();
        $this->info('Tablas CONSERVADAS intactas: '.implode(', ', $this->protectedTables));
        $this->newLine();

        if (! $this->option('force') && ! $this->confirm('¿Confirmas que deseas vaciar estas tablas operativas? Esta acción es irreversible.', false)) {
            $this->warn('Operación cancelada por el usuario.');

            return self::SUCCESS;
        }

        // Desactiva restricciones FK durante la limpieza para no
        // depender del orden y poder reordenar/reintentar con safety.
        Schema::disableForeignKeyConstraints();

        try {
            if ($driver === 'pgsql') {
                $this->truncatePostgres($tables);
            } else {
                $this->truncateGeneric($tables);
            }
        } finally {
            // Siempre se reactivan las FK, incluso si algo falla.
            Schema::enableForeignKeyConstraints();
        }

        $this->newLine();
        $this->info('✓ Limpieza completada. Datos operativos vaciados; usuarios, granjas y módulos conservados.');
        $this->line('  Sugerencia: usa el módulo de Lotes para crear datos de prueba con los cambios recientes.');

        return self::SUCCESS;
    }

    /**
     * PostgreSQL: un único TRUNCATE multi-tabla con RESTART IDENTITY.
     *
     * TRUNCATE sobre varias tablas en la MISMA sentencia es válido
     * aunque se referencien entre sí (todas se vacían juntas). Como
     * ninguna tabla conservada referencia a las operativas, no se
     * necesita CASCADE. RESTART IDENTITY reinicia las secuencias
     * (ids) para un arranque limpio "desde cero".
     */
    protected function truncatePostgres(array $tables): void
    {
        $quoted = array_map(fn (string $t) => DB::getSchemaBuilder()->wrapTable($t), $tables);

        DB::statement('TRUNCATE TABLE '.implode(', ', $quoted).' RESTART IDENTITY');

        $this->info('✓ TRUNCATE ... RESTART IDENTITY ejecutado en PostgreSQL (secuencias reiniciadas).');
    }

    /**
     * Genérico (SQLite / MySQL): tabla por tabla en orden hijo→padre.
     * truncate() en SQLite resetea sqlite_sequence y en MySQL resetea
     * AUTO_INCREMENT, por lo que no hace falta reiniciar secuencias.
     */
    protected function truncateGeneric(array $tables): void
    {
        foreach ($tables as $table) {
            DB::table($table)->truncate();
            $this->line("  ✓ {$table} vaciada");
        }
    }
}
