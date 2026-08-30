<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // §6.4 — swap this one binding to change detection strategy later
        // (Phase 11 AI detection) without touching any caller.
        $this->app->bind(
            \App\Services\ContentModeration\ContentScanner::class,
            \App\Services\ContentModeration\KeywordScanner::class,
        );
    }

    public function boot(): void
    {
        // Content flags (§E4) store `flaggable_type` as one of these short
        // strings rather than a fully-qualified class name, so renaming a
        // model's namespace later can never orphan existing flag rows.
        //
        // Non-enforcing: `enforceMorphMap()` requires every polymorphic
        // relation in the whole app to be registered here, and other morphs
        // (e.g. notifications' notifiable) already exist unregistered — this
        // only maps the two types content flags actually uses.
        Relation::morphMap([
            'post'    => \App\Models\SocialPost::class,
            'comment' => \App\Models\PostComment::class,
        ]);

        ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = config('app.frontend_url', 'http://localhost:3000');
            return $frontendUrl . '/auth/reset-password?token=' . $token . '&email=' . urlencode($user->getEmailForPasswordReset());
        });

        // Keep the searchable name-alias projection in sync (§5.6). Doing this
        // with a model event rather than at each call site means an alias can
        // never be written without the index being updated — including from
        // tinker, seeders and admin tooling.
        \App\Models\User::saved(function (\App\Models\User $user) {
            if ($user->wasChanged(['nickname', 'alternate_names']) || $user->wasRecentlyCreated) {
                $user->syncNameAliases();
            }
        });
    }
}
