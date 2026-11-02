<?php

namespace Tests\Feature\Ai;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The admin screens must be able to SEE the per-member AI flag, not just set it.
 *
 * Switching the flag has been possible since Stage 1, but nothing in the admin
 * UI called it, because neither the user list nor the user detail response
 * carried `ai_features_enabled` — so a toggle had nothing to render its state
 * from. AI_SETUP.md meanwhile told operators to use a "Manage Users" control
 * that did not exist.
 *
 * These tests pin the two responses the new toggles read. Without them the
 * switches would render "off" for everyone on first paint and then flip once
 * an admin touched them, which is worse than having no switch at all: it would
 * misreport who is spending money.
 *
 * The act of switching is covered by AiGroundworkTest; this is about the state
 * the screens are drawn from, and the round trip between the two.
 */
class AdminAiToggleTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'is_admin'          => true,
            'email_verified_at' => now(),
            'trial_ends_at'     => now()->addDays(20),
        ]);
    }

    private function member(array $attrs = []): User
    {
        return User::factory()->create($attrs + [
            'email_verified_at' => now(),
            'trial_ends_at'     => now()->addDays(20),
        ]);
    }

    // ------------------------------------------------- what the list reports

    public function test_the_user_list_reports_each_member_s_ai_flag(): void
    {
        $on  = $this->member(['ai_features_enabled' => true]);
        $off = $this->member(['ai_features_enabled' => false]);

        Sanctum::actingAs($this->admin());

        $rows = collect($this->getJson('/api/admin/users')->assertOk()->json('data'))
            ->keyBy('id');

        $this->assertTrue($rows[$on->id]['ai_features_enabled'], 'enabled member reported as off');
        $this->assertFalse($rows[$off->id]['ai_features_enabled'], 'disabled member reported as on');
    }

    public function test_the_list_always_sends_the_field_even_when_false(): void
    {
        // A missing key and `false` look the same to `Boolean(x)` in the
        // client, but only one of them survives a later refactor honestly.
        $this->member();

        Sanctum::actingAs($this->admin());

        $row = $this->getJson('/api/admin/users')->assertOk()->json('data.0');

        $this->assertArrayHasKey('ai_features_enabled', $row);
        $this->assertIsBool($row['ai_features_enabled']);
    }

    // ----------------------------------------------- what the detail reports

    public function test_the_user_detail_reports_the_ai_flag(): void
    {
        $member = $this->member(['ai_features_enabled' => true]);

        Sanctum::actingAs($this->admin());

        $this->getJson("/api/admin/users/{$member->id}")
            ->assertOk()
            ->assertJsonPath('user.ai_features_enabled', true);
    }

    // ------------------------------------------------------- the round trip

    public function test_switching_the_flag_changes_what_both_screens_report(): void
    {
        $member = $this->member(['ai_features_enabled' => false]);

        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/users/{$member->id}/ai-features", ['enabled' => true])
            ->assertOk();

        // This is exactly what the two screens do after a successful toggle.
        $this->assertTrue(
            collect($this->getJson('/api/admin/users')->json('data'))
                ->firstWhere('id', $member->id)['ai_features_enabled'],
        );
        $this->assertTrue(
            $this->getJson("/api/admin/users/{$member->id}")->json('user.ai_features_enabled'),
        );

        $this->postJson("/api/admin/users/{$member->id}/ai-features", ['enabled' => false])
            ->assertOk();

        $this->assertFalse(
            $this->getJson("/api/admin/users/{$member->id}")->json('user.ai_features_enabled'),
        );
    }

    // ------------------------------------------------------------ admin only

    public function test_a_member_cannot_read_the_admin_user_list(): void
    {
        Sanctum::actingAs($this->member());

        $this->getJson('/api/admin/users')->assertStatus(403);
    }

    public function test_a_member_cannot_read_another_member_s_detail(): void
    {
        $other = $this->member();

        Sanctum::actingAs($this->member());

        $this->getJson("/api/admin/users/{$other->id}")->assertStatus(403);
    }

    public function test_a_member_cannot_switch_the_flag_for_anyone(): void
    {
        $victim = $this->member();

        Sanctum::actingAs($this->member());

        $this->postJson("/api/admin/users/{$victim->id}/ai-features", ['enabled' => true])
            ->assertStatus(403);

        $this->assertFalse($victim->fresh()->ai_features_enabled);
    }

    // ------------------------------------------- the case the UI disables

    public function test_an_admin_account_is_refused_and_says_why(): void
    {
        /*
         * The toggle is disabled for admins in both screens. That is a
         * convenience, not the rule — the rule is here, and the UI would be
         * lying if the server ever started accepting it silently.
         */
        $target = $this->admin();

        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/users/{$target->id}/ai-features", ['enabled' => true])
            ->assertStatus(422)
            ->assertJsonPath('code', 'member_only');

        $this->assertFalse($target->fresh()->ai_features_enabled);
    }
}
