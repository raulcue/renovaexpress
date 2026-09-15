<?php
/**
 * Renova Express — reseñas de Google
 * ----------------------------------
 * Pide a Google Places API (New) las reseñas de los dos centros y se las entrega a
 * la web en el formato que espera assets/js/main.js.
 *
 * Sustituye al worker de Cloudflare (api/reviews-worker.js): hace el mismo trabajo,
 * pero en el propio hosting, sin cuenta de Cloudflare.
 *
 *  - La clave de API NO está en este archivo: se lee de un fichero privado fuera de
 *    www/ (ver private_dir()). Nunca llega al navegador.
 *  - Caché de 72 h: dos llamadas a Google cada tres días.
 *  - Si Google falla, sigue sirviendo la última respuesta buena aunque esté caducada,
 *    para que la web nunca se quede sin reseñas por un fallo puntual.
 *  - Tras un fallo espera 10 minutos antes de volver a llamar, para no quemar cuota.
 *  - No usa ningún dato de la petición: no hay entrada que se pueda manipular.
 *
 * Compatible con PHP 7.4 (la versión del hosting).
 */

declare(strict_types=1);

const RENOVA_PLACES = [
    'gijon'  => ['id' => 'ChIJiQSuiat9Ng0Rb1mwDmcZcwg', 'label' => 'Centro Gijón'],
    'oviedo' => ['id' => 'ChIJcwg_jYqNNg0RVdkkBTnUWig', 'label' => 'Centro Oviedo'],
];
const RENOVA_CACHE_TTL    = 72 * 3600;
const RENOVA_RETRY_AFTER  = 10 * 60;
const RENOVA_HTTP_TIMEOUT = 10;
const RENOVA_FIELD_MASK   = 'displayName,rating,userRatingCount,reviews';

// Solo se redefinen desde un arnés de pruebas; en producción valen estos.
if (!defined('RENOVA_PLACES_BASE')) {
    define('RENOVA_PLACES_BASE', 'https://places.googleapis.com/v1/places/');
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    renova_fail(405, 'Método no permitido');
}

/**
 * Carpeta privada con la clave y la caché. Preferimos una fuera de www/
 * (/home/<cuenta>/_config), que no es accesible por web de ninguna forma. Si el
 * hosting no deja a PHP salir de www/, se usa api/private/, bloqueada por .htaccess.
 */
function renova_private_dir(): ?string
{
    if (defined('RENOVA_PRIVATE_DIR')) {
        return RENOVA_PRIVATE_DIR;
    }
    foreach ([dirname(__DIR__, 2) . '/_config', __DIR__ . '/private'] as $dir) {
        if (@is_dir($dir) && @is_readable($dir . '/google-places.key')) {
            return $dir;
        }
    }
    return null;
}

function renova_serve(string $json, string $cacheState): void
{
    header('X-Reviews-Cache: ' . $cacheState);
    header('Cache-Control: public, max-age=3600');
    echo $json;
    exit;
}

function renova_fail(int $status, string $message): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function renova_http_get(string $url, array $headers): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => RENOVA_HTTP_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => RENOVA_HTTP_TIMEOUT,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$code, is_string($body) ? $body : ''];
    }

    $ctx = stream_context_create(['http' => [
        'method'        => 'GET',
        'header'        => implode("\r\n", $headers),
        'timeout'       => RENOVA_HTTP_TIMEOUT,
        'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    $code = 0;
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
            $code = (int) $m[1];
        }
    }
    return [$code, is_string($body) ? $body : ''];
}

function renova_fetch_place(string $placeId, string $apiKey): array
{
    $url = RENOVA_PLACES_BASE . rawurlencode($placeId) . '?languageCode=es&regionCode=ES';
    [$code, $body] = renova_http_get($url, [
        'X-Goog-Api-Key: ' . $apiKey,
        'X-Goog-FieldMask: ' . RENOVA_FIELD_MASK,
        'Accept: application/json',
    ]);
    $data = json_decode($body, true);
    if ($code !== 200 || !is_array($data)) {
        // Sin incluir la clave ni la URL: solo el código, el estado y el motivo que da
        // Google (API_KEY_INVALID, SERVICE_DISABLED, BILLING_DISABLED...), que es lo
        // que hace falta para saber qué falta configurar.
        $status = is_array($data) ? (string) ($data['error']['status'] ?? '') : '';
        $reason = '';
        foreach (is_array($data) ? ($data['error']['details'] ?? []) : [] as $detail) {
            if (!empty($detail['reason'])) {
                $reason = (string) $detail['reason'];
                break;
            }
        }
        throw new RuntimeException(trim("Google HTTP $code $status $reason"));
    }
    return $data;
}

function renova_map_place(array $place, string $label): array
{
    $reviews = [];
    foreach ($place['reviews'] ?? [] as $r) {
        $text = trim((string) ($r['text']['text'] ?? $r['originalText']['text'] ?? ''));
        if ($text === '') {
            continue; // reseñas solo con estrellas: no se pueden mostrar como tarjeta
        }
        // publishTime viene en RFC 3339 con nanosegundos; strtotime no los entiende.
        $published = isset($r['publishTime']) ? strtotime(preg_replace('/\.\d+/', '', (string) $r['publishTime'])) : false;
        $reviews[] = [
            'author_name'               => (string) ($r['authorAttribution']['displayName'] ?? 'Cliente de Google'),
            'author_url'                => (string) ($r['authorAttribution']['uri'] ?? ''),
            'profile_photo_url'         => (string) ($r['authorAttribution']['photoUri'] ?? ''),
            'rating'                    => (int) ($r['rating'] ?? 0),
            'text'                      => $text,
            'relative_time_description' => (string) ($r['relativePublishTimeDescription'] ?? ''),
            'time'                      => $published === false ? 0 : $published,
            'center'                    => $label,
        ];
    }

    return [
        'name'               => (string) ($place['displayName']['text'] ?? $label),
        'rating'             => isset($place['rating']) ? (float) $place['rating'] : null,
        'user_ratings_total' => (int) ($place['userRatingCount'] ?? 0),
        'reviews'            => $reviews,
    ];
}

function renova_build_payload(string $apiKey): string
{
    $centers = [];
    foreach (RENOVA_PLACES as $key => $cfg) {
        $centers[$key] = renova_map_place(renova_fetch_place($cfg['id'], $apiKey), $cfg['label']);
    }

    $merged = [];
    $total = 0;
    $weighted = 0.0;
    foreach ($centers as $c) {
        foreach ($c['reviews'] as $r) {
            if ($r['rating'] >= 4) {
                $merged[] = $r;
            }
        }
        $total += $c['user_ratings_total'];
        $weighted += ($c['rating'] ?? 0) * $c['user_ratings_total'];
    }
    usort($merged, function (array $a, array $b): int {
        return $b['time'] <=> $a['time'];
    });

    return json_encode([
        'rating'    => $total > 0 ? round($weighted / $total, 1) : null,
        'total'     => $total,
        'centers'   => $centers,
        'reviews'   => $merged,
        'cached_at' => gmdate('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// ---------------------------------------------------------------------------

$dir = renova_private_dir();
if ($dir === null) {
    renova_fail(503, 'Reseñas no configuradas');
}

$cacheFile = $dir . '/reviews-cache.json';
$errorFile = $dir . '/reviews-last-error.txt';

$cached = @file_get_contents($cacheFile);
$cached = is_string($cached) && $cached !== '' ? $cached : null;
if ($cached !== null && time() - (int) filemtime($cacheFile) < RENOVA_CACHE_TTL) {
    renova_serve($cached, 'HIT');
}

// Un fallo reciente: no volvemos a llamar a Google todavía.
if (is_file($errorFile) && time() - (int) filemtime($errorFile) < RENOVA_RETRY_AFTER) {
    $cached !== null ? renova_serve($cached, 'STALE') : renova_fail(503, 'Reseñas no disponibles temporalmente');
}

// Un solo proceso refresca a la vez; el resto espera y aprovecha su resultado.
$lock = @fopen($dir . '/reviews.lock', 'c');
if ($lock !== false) {
    flock($lock, LOCK_EX);
    clearstatcache(true, $cacheFile);
    $fresh = @file_get_contents($cacheFile);
    if (is_string($fresh) && $fresh !== '' && time() - (int) filemtime($cacheFile) < RENOVA_CACHE_TTL) {
        renova_serve($fresh, 'HIT');
    }
}

try {
    $apiKey = trim((string) @file_get_contents($dir . '/google-places.key'));
    if ($apiKey === '') {
        throw new RuntimeException('Sin clave de API');
    }
    $json = renova_build_payload($apiKey);

    $tmp = $cacheFile . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, $json) !== false) {
        @rename($tmp, $cacheFile);
    }
    @unlink($errorFile);
    renova_serve($json, 'MISS');
} catch (Throwable $e) {
    @file_put_contents($errorFile, gmdate('c') . ' ' . $e->getMessage() . "\n");
    $cached !== null ? renova_serve($cached, 'STALE') : renova_fail(502, 'Reseñas no disponibles');
}
