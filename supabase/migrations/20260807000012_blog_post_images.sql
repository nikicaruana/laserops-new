-- Blog post: remove the duplicated intro paragraph and add real feature screenshots.
UPDATE public.blog_posts
SET body_md = $md$## Player accounts

Firstly, players can finally create their own accounts and own their performance. Logging in with Google is easy, and you now have control of how you play with LaserOps.

## One home for everything

Your player portal is the hub. Book a game, join an open game, open your own, check your stats, manage your squad, and pick up your rewards, all from one place.

## Book, join and create games online

No more messaging back and forth. Open games show up in the portal with live player counts, so you can jump into a match that is already filling up, or open your own and let others join. You can invite players directly, book a private game for your group, and see exactly when we are open on the booking calendar.

## Pay online and use game tokens

Confirming your place is now a tap. Pay online to lock in your spot for a game.

We also launched LaserOps Game Tokens. One token equals one game, so you can buy a bundle up front, save per game, and use tokens whenever you play. You can even gift tokens to a friend, or send them to someone by email to claim later.

## Level up and earn rewards

Every game you play now counts toward your XP and your level. Climbing the ranks unlocks rewards along the way, from game tokens to XP boosts. Apply a boost when you sign in to a game and earn extra XP for that session. Your whole progression, and everything still to unlock, is laid out on your Progression tab.

## Streaks and rivalries

Our ever evolving game setup has allowed us to start to reward players for what they do in-game, in real time, in the form of [streaks](/accolades). These add to your real in-game score. On top of that, you can now see everyone you eliminated in a match, and vice-versa. Check out who your nemesis is, not just in a match, but across all your matches.

![Every streak and accolade you can earn, laid out on one page.](/blog-images/v2-accolades.jpg)

## Squads and ladders

We've created squads and ladders to add another layer of competitiveness to LaserOps. Create squads, invite players, join a ladder, challenge other squads to ranked matches, and climb your way to the top!

## Next level player profiles

Your profile now has a number of new additions that we're confident you will love. See all the photos you're tagged in, check your all time rivalries, work towards weapon mastery with your weapons of choice, keep track of your all time streak tally, and more!

## Match photos

The photos from your games live in the gallery, tied to the match they came from. You can tag yourself in a shot and share a match photo story with a number of custom LaserOps overlays with stats from the match.

## Stay in the loop

You will get notifications in the app and by email for the things that matter, like a game getting confirmed, your payment going through, or your match report going live. Confirmed games even send you a calendar invite so you never miss a booking.

## A fresh look

The whole site got a new look to go with it, so everything feels a bit sharper wherever you are, on your phone or at your desk.

![The rebuilt LaserOps site.](/blog-images/v2-fresh-look.jpg)

## This is just the start

The rebuild gives us a foundation to keep adding to, and we have plenty more planned. We will post every new feature and update right here, so check back in. See you on the field.$md$,
    updated_at = now()
WHERE slug = 'whats-new-in-the-v2-rebuild';
