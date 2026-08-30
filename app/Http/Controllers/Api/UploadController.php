<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

class UploadController extends Controller
{
    private const ALLOWED_FOLDERS = ['posts', 'food', 'videos', 'messages', 'recipes'];

    public function store(Request $request)
    {
        $request->validate([
            'image'  => 'required|image|mimes:jpeg,jpg,png,webp|max:8192',
            'folder' => 'required|string|in:' . implode(',', self::ALLOWED_FOLDERS),
        ]);

        $folder  = $request->input('folder');
        $manager = new ImageManager(new Driver());
        $image   = $manager->decode($request->file('image'));

        $maxDim = $folder === 'videos' ? 1280 : 1600;
        if ($image->width() > $maxDim || $image->height() > $maxDim) {
            $image->scaleDown($maxDim, $maxDim);
        }

        $filename = uniqid($request->user()->id . '_', true) . '.jpg';
        $path     = "{$folder}/{$filename}";
        $fullPath = storage_path("app/public/{$path}");
        @mkdir(dirname($fullPath), 0775, true);
        $image->encode(new \Intervention\Image\Encoders\JpegEncoder(quality: 85))->save($fullPath);

        return response()->json([
            'success'   => true,
            'image_url' => asset("storage/{$path}"),
        ], 201);
    }
}
