<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Species extends Model
{
    use HasFactory, BelongsToFarm, Auditable;

    public const VALID_CATEGORIES = [
        'bovina',
        'porcina',
        'avícola',
        'ovina',
        'caprina',
        'cunícola',
    ];

    /**
     * Taxonomía oficial del sector pecuario: categoría => [nombre canónico => alias aceptados].
     * Los alias se comparan sin tildes y en minúsculas.
     */
    public const TAXONOMY = [
        'bovina' => [
            'Vaca' => ['vaca'],
            'Toro' => ['toro'],
            'Búfalo' => ['bufalo'],
        ],
        'avícola' => [
            'Pollo' => ['pollo'],
            'Gallina' => ['gallina'],
            'Codorniz' => ['codorniz'],
        ],
        'porcina' => [
            'Cerdo' => ['cerdo'],
        ],
        'cunícola' => [
            'Conejo' => ['conejo'],
        ],
        'ovina' => [
            'Oveja' => ['oveja'],
            'Carnero' => ['carnero'],
            'Cordero/Borrego' => ['cordero/borrego', 'cordero', 'borrego'],
        ],
        'caprina' => [
            'Cabra' => ['cabra'],
            'Chivo' => ['chivo'],
        ],
    ];

    /**
     * Alias de categoría (sin tildes, minúsculas) => categoría canónica almacenada.
     */
    public const CATEGORY_ALIASES = [
        'bovina' => 'bovina', 'bovino' => 'bovina',
        'porcina' => 'porcina', 'porcino' => 'porcina',
        'avicola' => 'avícola', 'avicolo' => 'avícola',
        'ovina' => 'ovina', 'ovino' => 'ovina',
        'caprina' => 'caprina', 'caprino' => 'caprina',
        'cunicola' => 'cunícola', 'cunicolo' => 'cunícola', 'cunicula' => 'cunícola',
    ];

    /**
     * Lowercase, trim, collapse spaces and strip Spanish accents for comparisons.
     */
    public static function normalizeKey(?string $value): string
    {
        $value = mb_strtolower(trim((string) $value), 'UTF-8');
        $value = preg_replace('/\s*\/\s*/u', '/', $value);
        $value = preg_replace('/\s+/u', ' ', $value);

        return strtr($value, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u']);
    }

    /**
     * Resolve any accepted category spelling to its canonical stored value (or null if invalid).
     */
    public static function canonicalCategory(?string $category): ?string
    {
        return self::CATEGORY_ALIASES[self::normalizeKey($category)] ?? null;
    }

    /**
     * Resolve a species name to its canonical official name within the given canonical category.
     */
    public static function canonicalSpeciesName(?string $category, ?string $name): ?string
    {
        $key = self::normalizeKey($name);

        foreach (self::TAXONOMY[$category] ?? [] as $canonical => $aliases) {
            if (in_array($key, $aliases, true)) {
                return $canonical;
            }
        }

        return null;
    }

    protected $table = 'species';

    protected $fillable = [
        'farm_id',
        'name',
        'category',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Specify audit module name for activity logs.
     */
    public function getAuditModule(): string
    {
        return 'Especies';
    }
}
