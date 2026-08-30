<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Mail\CampaignMail;
use App\Models\EmailCampaign;
use App\Models\User;
use App\Services\UserActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/**
 * Bulk email campaigns (§E1).
 *
 * Sent synchronously, not queued — §4.0 is explicit that nothing here has a
 * queue worker running, and a "queued" send with no worker is a send that
 * silently never happens. For a large audience this ties up the request for
 * as long as sending takes; flagged in BUILD_PROGRESS as a scale limit to
 * revisit once a worker exists, not hidden.
 *
 * Resumable by construction, not by special-casing a retry: recipient rows
 * are created up front for the whole resolved audience, and `send()` only
 * ever processes rows where `sent_at IS NULL`. Calling it again after a
 * partial failure — the request timing out at recipient 400 of 1000, say —
 * picks up exactly where it stopped instead of re-sending the first 399.
 */
class EmailCampaignController extends Controller
{
    public function __construct(private UserActivity $activity) {}

    public function index(Request $request)
    {
        return response()->json(
            EmailCampaign::withCount('recipients')->orderByDesc('created_at')->paginate(20)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'subject'          => 'required|string|max:255',
            'body_html'        => 'required|string',
            'audience'         => 'required|in:all,trial,subscribers,inactive_days',
            'audience_params'  => 'required_if:audience,inactive_days|array',
            'audience_params.days' => 'required_if:audience,inactive_days|integer|min:1|max:730',
        ]);

        $userIds = $this->resolveAudience($data['audience'], $data['audience_params'] ?? []);

        $campaign = EmailCampaign::create([
            'subject'          => $data['subject'],
            'body_html'        => $data['body_html'],
            'audience'         => $data['audience'],
            'audience_params'  => $data['audience_params'] ?? null,
            'status'           => 'draft',
            'recipient_count'  => count($userIds),
            'created_by'       => $request->user()->id,
        ]);

        // Recipient rows exist from creation, all unsent — send() below just
        // works through whatever still has sent_at = null, whenever it runs.
        $rows = array_map(fn ($id) => ['campaign_id' => $campaign->id, 'user_id' => $id], $userIds);
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('email_campaign_recipients')->insertOrIgnore($chunk);
        }

        return response()->json(['campaign' => $campaign], 201);
    }

    public function send(Request $request, EmailCampaign $campaign)
    {
        if ($campaign->status === 'sent') {
            return response()->json(['message' => 'This campaign has already fully sent.'], 422);
        }

        $campaign->update(['status' => 'sending']);

        $sent = 0;
        $failed = 0;

        DB::table('email_campaign_recipients')
            ->where('campaign_id', $campaign->id)
            ->whereNull('sent_at')
            ->orderBy('id')
            ->chunkById(200, function ($pending) use ($campaign, &$sent, &$failed) {
                $users = User::whereIn('id', $pending->pluck('user_id'))->get(['id', 'email'])->keyBy('id');

                foreach ($pending as $recipient) {
                    $user = $users->get($recipient->user_id);
                    if (! $user) {
                        DB::table('email_campaign_recipients')->where('id', $recipient->id)
                            ->update(['error' => 'User no longer exists']);
                        $failed++;
                        continue;
                    }
                    try {
                        Mail::to($user->email)->send(new CampaignMail($campaign->subject, $campaign->body_html));
                        DB::table('email_campaign_recipients')->where('id', $recipient->id)
                            ->update(['sent_at' => now()]);
                        $sent++;
                    } catch (\Throwable $e) {
                        DB::table('email_campaign_recipients')->where('id', $recipient->id)
                            ->update(['error' => substr($e->getMessage(), 0, 255)]);
                        $failed++;
                    }
                }
            });

        $stillPending = DB::table('email_campaign_recipients')
            ->where('campaign_id', $campaign->id)->whereNull('sent_at')->whereNull('error')->count();

        $campaign->update([
            'status'  => $stillPending > 0 ? 'sending' : ($failed > 0 && $sent === 0 ? 'failed' : 'sent'),
            'sent_at' => $stillPending > 0 ? null : now(),
        ]);

        return response()->json([
            'campaign'  => $campaign->fresh(),
            'sent_this_run'   => $sent,
            'failed_this_run' => $failed,
        ]);
    }

    private function resolveAudience(string $audience, array $params): array
    {
        return match ($audience) {
            'all'           => User::whereNull('deleted_at')->pluck('id')->all(),
            'trial'         => User::where('account_state', 'trial')->pluck('id')->all(),
            'subscribers'   => User::where('account_state', 'subscriber')->pluck('id')->all(),
            'inactive_days' => $this->activity->inactiveUserIds((int) $params['days']),
        };
    }
}
