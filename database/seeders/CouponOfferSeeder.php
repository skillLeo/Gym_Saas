<?php

namespace Database\Seeders;

use App\Models\CouponOffer;
use Illuminate\Database\Seeder;

/**
 * The two default conversion offers (§4.3).
 *
 * These are starting values, not fixed behaviour — every field here is editable
 * from the admin panel. Seeded with `updateOrCreate` on `key` so re-running does
 * not overwrite copy the client has since edited... except on first insert.
 *
 * Timing assumes a trial longer than the day-18 trigger. The live trial is 30
 * days, so both offers land inside it. If the trial is ever shortened below 19
 * days the second offer would fall outside — ProcessTrials refuses to send an
 * offer past the trial end rather than emailing a discount to someone whose
 * trial has already lapsed.
 */
class CouponOfferSeeder extends Seeder
{
    public function run(): void
    {
        $offers = [
            [
                'key'                => 'trial_offer_1',
                'name'               => 'Trial conversion — stage 1',
                'stage'              => 1,
                'trigger_day_offset' => 7,
                'expires_after_days' => 3,
                'discount_type'      => 'percent',
                'discount_value'     => 30.00,
                'email_subject'      => 'A little something to keep you going',
                'email_body_html'    => <<<'HTML'
<p>Hi {{name}},</p>

<p>You have been training with us for a week now, and your logs are starting to
add up. Here is 30% off your first payment if you want to keep everything you
have built.</p>

<p><strong>Your code: {{code}}</strong><br>
Valid until {{expires}}.</p>

<p><a href="{{url}}">Choose a plan</a></p>

<p>— Team Extreme</p>
HTML,
            ],
            [
                'key'                => 'trial_offer_2',
                'name'               => 'Trial conversion — stage 2',
                'stage'              => 2,
                'trigger_day_offset' => 18,
                'expires_after_days' => 3,
                'discount_type'      => 'percent',
                'discount_value'     => 15.00,
                'email_subject'      => 'Your trial is nearly up',
                'email_body_html'    => <<<'HTML'
<p>Hi {{name}},</p>

<p>Your trial ends soon. Everything you have logged — meals, workouts, weight,
progress — stays exactly where it is when you subscribe.</p>

<p>Here is 15% off your first payment.</p>

<p><strong>Your code: {{code}}</strong><br>
Valid until {{expires}}.</p>

<p><a href="{{url}}">Choose a plan</a></p>

<p>— Team Extreme</p>
HTML,
            ],
        ];

        foreach ($offers as $offer) {
            CouponOffer::updateOrCreate(['key' => $offer['key']], $offer + ['is_active' => true]);
        }
    }
}
