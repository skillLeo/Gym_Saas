<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Launch blocker fix: `system_settings.value` was stored in plaintext (the
 * `is_secret` flag only masked it on *read*, in `SystemSetting::getGroup()` —
 * it never encrypted anything). This affects the SMTP password and the
 * Nutritionix API key today, and any future secret saved through the model.
 *
 * This migration re-encrypts existing rows in place so they match what
 * `SystemSetting::$casts = ['value' => 'encrypted']` expects to decrypt.
 * Idempotent: a row that already decrypts successfully (e.g. this migration
 * re-run after a partial failure) is left untouched rather than
 * double-encrypted.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->orderBy('id')->get(['id', 'value'])->each(function ($row) {
            if ($row->value === null) {
                return;
            }
            if ($this->alreadyEncrypted($row->value)) {
                return;
            }
            DB::table('system_settings')
                ->where('id', $row->id)
                ->update(['value' => Crypt::encryptString($row->value)]);
        });
    }

    public function down(): void
    {
        DB::table('system_settings')->orderBy('id')->get(['id', 'value'])->each(function ($row) {
            if ($row->value === null) {
                return;
            }
            try {
                $plain = Crypt::decryptString($row->value);
            } catch (\Illuminate\Contracts\Encryption\DecryptException) {
                // Already plaintext (e.g. rolled back twice) — nothing to undo.
                return;
            }
            DB::table('system_settings')->where('id', $row->id)->update(['value' => $plain]);
        });
    }

    private function alreadyEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);
            return true;
        } catch (\Illuminate\Contracts\Encryption\DecryptException) {
            return false;
        }
    }
};
