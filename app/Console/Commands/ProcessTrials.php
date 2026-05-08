<?php
namespace App\Console\Commands;
use App\Mail\TrialExpiredMail;
use App\Mail\TrialExpiringMail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class ProcessTrials extends Command
{
    protected $signature   = 'trials:process';
    protected $description = 'Process trial expirations and send reminder emails';

    public function handle(): int
    {
        // Send 3-day expiry reminders
        User::where('subscription_status', 'trial')
            ->where('trial_reminder_sent', false)
            ->where('trial_ends_at', '<=', now()->addDays(3))
            ->where('trial_ends_at', '>', now())
            ->chunk(100, function ($users) {
                foreach ($users as $user) {
                    try {
                        Mail::to($user->email)->send(new TrialExpiringMail($user));
                    } catch (\Exception $e) {}
                    $user->update(['trial_reminder_sent' => true]);
                }
            });

        // Expire trials
        User::where('subscription_status', 'trial')
            ->where('trial_ends_at', '<=', now())
            ->chunk(100, function ($users) {
                foreach ($users as $user) {
                    $user->update(['subscription_status' => 'expired']);
                    try {
                        Mail::to($user->email)->send(new TrialExpiredMail($user));
                    } catch (\Exception $e) {}
                }
            });

        $this->info('Trials processed successfully.');
        return self::SUCCESS;
    }
}
