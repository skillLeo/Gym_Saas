<?php

namespace App\Console\Commands;

use App\Models\Physician;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Replaces the shared demo password with a different random one per account.
 *
 * WHY THIS EXISTS. Every account the seeders and the `audit/` scripts create
 * gets the same literal password, `password123`. That was fine while the app
 * only ever ran on a laptop, but the same seeders and the same test accounts
 * now reach a live test site, and a shared password that appears in committed
 * files is not a password — it is a published one. This command takes the
 * known string off those accounts and puts a distinct random secret on each,
 * so that knowing one demo login tells you nothing about the next.
 *
 * WHY IT IS LOCAL-ONLY, WITH NO OVERRIDE. Rotating a password is destructive
 * and silent: the old one is a one-way hash, so once it is replaced there is
 * nothing to roll back to, and the only copy of the new one is the console
 * output of the run that made it. Pointed at a real database by accident — a
 * stray `DB_DATABASE=`, a production `.env` left in place after a deploy — it
 * would lock real members out of their own accounts with no recovery but the
 * password-reset mail. So it refuses to run unless BOTH the app environment
 * is `local` AND the database host is a loopback address, and there is
 * deliberately no `--force` and no `--i-know-what-im-doing`: a flag that
 * disables the guard is the flag someone types at 2am. Running this against a
 * remote database is not a thing to confirm, it is a mistake to stop.
 *
 * The host check is a tripwire, not a proof. A loopback host forwarded down
 * an SSH tunnel is still a remote database and would pass it. What it catches
 * is the realistic mistake — running with the production environment loaded —
 * which is the one that actually happens to people.
 *
 *   php artisan demo:rotate-passwords --dry-run   # show what would change
 *   php artisan demo:rotate-passwords             # change it, print once
 */
class RotateDemoPasswords extends Command
{
    protected $signature = 'demo:rotate-passwords {--dry-run : List the accounts that would change, and change nothing}';

    protected $description = 'Replace the shared demo password with a fresh random one per account. Local only.';

    /**
     * The password the seeders and audit scripts hand out.
     *
     * Matching on the plaintext rather than on an email pattern or a seeder
     * flag is the whole point: it finds every account that really does carry
     * this credential, including ones created by hand months ago, and it
     * cannot touch an account that does not.
     */
    private const DEMO_PASSWORD = 'password123';

    /**
     * Hosts that mean "the database is on this machine".
     */
    private const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

    /**
     * Every table that holds a login, labelled for the report.
     *
     * A list rather than a hardcoded `User::`, so that adding a third
     * authenticatable is one line here instead of a silently incomplete
     * sweep. Both models soft-delete and both cast `password` to `hashed`,
     * which is what the walk below assumes.
     *
     * @return array<string, class-string<\Illuminate\Database\Eloquent\Model>>
     */
    private static function accountSources(): array
    {
        return ['member' => User::class, 'physician' => Physician::class];
    }

    public function handle(): int
    {
        if (! $this->guardIsSatisfied()) {
            return self::FAILURE;
        }

        $dry = (bool) $this->option('dry-run');

        /*
         * One bcrypt verification per user, so this is deliberately a chunked
         * walk rather than one clever query — there is no way to ask the
         * database "which rows hash to this string", and nor should there be.
         * At demo-database sizes the cost is irrelevant; the chunking is here
         * so it stays honest if someone points it at a seeded 10k-user set.
         *
         * withTrashed() on purpose: a soft-deleted account can be restored,
         * and its password comes back with it. Leaving the known string on a
         * row because a column says `deleted_at` is leaving the door shut but
         * unlocked.
         */
        $rotated = [];
        $skipped = 0;

        /*
         * BOTH login tables, because there are two.
         *
         * Physicians are a separate authenticatable with their own guard and
         * their own table — they never appear in `users`. The seeded and
         * audit-created physician accounts carry the same `password123`, and a
         * physician login reaches another person's health information, which a
         * member login does not. Walking only `users` would have left the more
         * sensitive half of the problem in place while reporting success.
         */
        foreach (self::accountSources() as $kind => $model) {
            $model::withTrashed()
                ->orderBy('id')
                ->chunkById(200, function ($accounts) use (&$rotated, &$skipped, $dry, $kind) {
                    foreach ($accounts as $account) {
                        /*
                         * Accounts with no password at all — invited but never
                         * finished — would make Hash::check() complain about a
                         * null hash rather than simply answering false.
                         */
                        if (! is_string($account->password) || $account->password === '') {
                            $skipped++;
                            continue;
                        }

                        if (! Hash::check(self::DEMO_PASSWORD, $account->password)) {
                            continue;
                        }

                        $fresh = $this->freshPassword();

                        if (! $dry) {
                            /*
                             * Hash::make() explicitly, rather than leaning on
                             * the model's `password => 'hashed'` cast. The cast
                             * would do the right thing today, but a command
                             * whose entire job is writing password hashes
                             * should not depend on a cast staying declared in a
                             * model it does not own. The cast recognises an
                             * already-hashed value and leaves it alone, so
                             * nothing is hashed twice.
                             */
                            $account->password = Hash::make($fresh);
                            $account->save();
                        }

                        $rotated[] = ['kind' => $kind, 'email' => $account->email, 'password' => $fresh];
                    }
                });
        }

        return $dry
            ? $this->reportDryRun($rotated, $skipped)
            : $this->reportRotation($rotated, $skipped);
    }

    /**
     * Both halves of the guard, reported together.
     *
     * It names the values it rejected. Someone who gets refused needs to know
     * *which* check stopped them, or the only way forward is reading this
     * file — and the environment name and database host are not secrets,
     * while the thing being protected is.
     */
    private function guardIsSatisfied(): bool
    {
        $environment = (string) app()->environment();
        $hosts       = $this->configuredHosts();

        $environmentIsLocal = app()->environment('local');
        $hostsAreLocal      = $hosts !== []
            && collect($hosts)->every(fn ($h) => in_array(strtolower($h), self::LOCAL_HOSTS, true));

        if ($environmentIsLocal && $hostsAreLocal) {
            return true;
        }

        $this->newLine();
        $this->error('Refusing to run: this command rotates passwords irreversibly.');
        $this->newLine();

        if (! $environmentIsLocal) {
            $this->line("  APP_ENV is <options=bold>{$environment}</>, and this command runs only in <options=bold>local</>.");
        }

        if (! $hostsAreLocal) {
            $shown = $hosts === [] ? '(none configured)' : implode(', ', $hosts);
            $this->line("  Database host is <options=bold>{$shown}</>, and this command requires a loopback host.");
        }

        $this->newLine();
        $this->line('  Nothing was changed. There is no override flag: if this refuses on a');
        $this->line('  machine where you did mean to run it, fix the environment it is');
        $this->line('  reading rather than the check that read it.');
        $this->newLine();

        return false;
    }

    /**
     * Every host the default connection might actually talk to.
     *
     * Laravel allows `host` to be an array, and read/write splitting puts
     * further hosts under `read` and `write`. Checking only `host` would wave
     * through a connection whose writes go to a remote primary — which is
     * exactly the connection that must never be touched. If any host in the
     * set is not loopback, the whole check fails.
     */
    private function configuredHosts(): array
    {
        $config = config('database.connections.'.config('database.default'), []);

        $hosts = array_merge(
            (array) ($config['host'] ?? []),
            (array) ($config['read']['host'] ?? []),
            (array) ($config['write']['host'] ?? []),
        );

        return array_values(array_filter(
            array_map('strval', $hosts),
            fn ($h) => $h !== ''
        ));
    }

    /**
     * A password a human has to read off a terminal and type into a login box.
     *
     * Hand-rolled alphabet rather than Str::password(), for one reason:
     * everything that could be mistaken for something else is gone. No O or
     * 0, no l/1/I, and no backslash or quote characters to be eaten by a
     * shell or mangled in a copy-paste. The cost of an ambiguous character
     * here is a support message; the cost of a smaller alphabet is bought
     * back by length — 20 characters of this set is around 118 bits, which is
     * far past anything that matters for a demo account.
     *
     * random_int() because it is the CSPRNG. mt_rand() output is recoverable
     * from a handful of samples, and this prints several samples per run.
     */
    private function freshPassword(int $length = 20): string
    {
        $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-+=_';
        $max      = strlen($alphabet) - 1;

        $password = '';
        for ($i = 0; $i < $length; $i++) {
            $password .= $alphabet[random_int(0, $max)];
        }

        return $password;
    }

    private function reportDryRun(array $rotated, int $skipped): int
    {
        $this->newLine();
        $this->info('Dry run — nothing has been changed.');
        $this->newLine();

        if ($rotated === []) {
            $this->line('  No account is using the demo password.');
            $this->newLine();

            return self::SUCCESS;
        }

        foreach ($rotated as $row) {
            $this->line(sprintf('  %-10s %s', $row['kind'], $row['email']));
        }

        $this->newLine();
        $this->line(sprintf('  %d account(s) would get a new random password.', count($rotated)));

        if ($skipped > 0) {
            $this->line(sprintf('  %d account(s) have no password set and were not examined.', $skipped));
        }

        $this->newLine();
        $this->comment('  Re-run without --dry-run to rotate them. The new passwords are');
        $this->comment('  printed once and saved nowhere, so capture them as they appear.');
        $this->newLine();

        return self::SUCCESS;
    }

    private function reportRotation(array $rotated, int $skipped): int
    {
        $this->newLine();

        if ($rotated === []) {
            $this->info('No account was using the demo password. Nothing to do.');
            $this->newLine();

            return self::SUCCESS;
        }

        $this->info(sprintf('Rotated %d account(s).', count($rotated)));
        $this->newLine();

        /*
         * This is the only moment these strings exist in readable form. They
         * are not written to a file, not logged, and not recoverable from the
         * database, which holds a one-way hash — so the warning goes both
         * above and below the list, because a long list scrolls the top one
         * off the screen, and that is precisely when it matters.
         */
        $this->warn('  These passwords are shown ONCE. They are stored nowhere else —');
        $this->warn('  not in a file, not in the log, and not in the database, which keeps');
        $this->warn('  only a one-way hash. Copy them now, or rotate them again later.');
        $this->newLine();

        foreach ($rotated as $row) {
            $this->line(sprintf('  %-10s %-40s %s', $row['kind'], $row['email'], $row['password']));
        }

        $this->newLine();
        $this->warn('  Last chance: nothing above is retrievable once this console closes.');

        if ($skipped > 0) {
            $this->line(sprintf('  (%d account(s) have no password set and were not examined.)', $skipped));
        }

        $this->newLine();

        return self::SUCCESS;
    }
}
