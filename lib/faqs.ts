/**
 * lib/faqs.ts
 * --------------------------------------------------------------------
 * Plain-text FAQ content, used to emit FAQPage structured data
 * (JSON-LD) on /faqs for Google rich results.
 *
 * NOTE: the on-page FAQ list is rendered by components/faqs/FaqSearch.tsx,
 * which keeps richer JSX answers (with inline links) for display. This
 * file mirrors those questions with clean plain-text answers for the
 * schema. Keep the two in sync when FAQ copy changes.
 */

export type Faq = { question: string; answer: string };

export const FAQS: Faq[] = [
  {
    question: "What actually is laser tag at LaserOps?",
    answer:
      "Outdoor laser tag, played in a proper arena, with kit that tracks every shot, tag, and objective in real time. Not the kids' party version with foam barriers and music. The game runs on real strategy, real teamwork, and a stat system that follows you between sessions.",
  },
  {
    question: "Who is it for?",
    answer:
      "Open games are for ages 13 and up. We also host corporate events, stag and hen dos, birthday parties for kids and adults, and private bookings for friend groups, where younger ages can be accommodated in the right setting.",
  },
  {
    question: "Where do you play?",
    answer:
      "There are a number of different locations that we use for games, which can be discussed during the booking process. Have your own venue? We can come to you.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Standard rate is €30 per person for a 3-hour session. There is a €300 minimum flat fee for groups smaller than 10.",
  },
  {
    question: "Do I need any experience?",
    answer:
      "No. Most people who walk in have never played proper laser tag before. Our staff handle the briefing, the team balancing, and the rules, so you can pick it up in your first round.",
  },
  {
    question: "How long does a session last?",
    answer:
      "Sessions vary by booking type. Our standard session is 3 hours long, the recommended length to maximise your experience, but we can be flexible to your needs.",
  },
  {
    question: "How many people do you need for a booking?",
    answer:
      "We handle small groups through to 16v16 games. If your group is on the smaller side, get in touch and we'll let you know the options, including joining an open game where teams get filled out from the wider community.",
  },
  {
    question: "What should I wear?",
    answer:
      "Anything you can move in. Closed shoes, layers you don't mind getting sweaty, and ideally not bright white if you'd rather not stand out in the arena. We provide all the kit you actually need to play.",
  },
  {
    question: "Can you handle food and drinks?",
    answer:
      "Yes. We can work towards getting the kind of catering that you desire, and drinks are available throughout. Tell us what you're after when you book and we'll put a package together.",
  },
  {
    question: "Do you offer match photography?",
    answer:
      "Yes, as an optional add on. A photographer captures the action across your session and you get high quality images afterwards, the kind that actually get used in speeches, slideshows, and social posts rather than left in a camera roll.",
  },
  {
    question: "What are the post game stats?",
    answer:
      "Every match is tracked by our persistent stat system. Score, Kills, Damage, Accuracy, and more. You walk out of every session with a full breakdown, and if you keep playing your stats follow you between visits.",
  },
  {
    question: "Do I need an account to play?",
    answer:
      "You can just show up and play, but a free player profile is what tracks your stats, XP, levels and unlocks, and lets you join open games online. Sign in with Google, and if you've played with us before, your past games attach to your profile automatically when you use the email you registered with.",
  },
  {
    question: "How do XP and levels work?",
    answer:
      "You earn XP every game, from your performance, round and match wins, and any accolades you pick up. XP builds your level, and levelling up unlocks rewards like XP boosts. It all carries over between sessions.",
  },
  {
    question: "What are LaserOps game tokens?",
    answer:
      "Prepaid game credits, where 1 token = 1 game. Buy them in bundles from the store (cheaper per game than paying each time), then use them to pay for any game. You can even part-pay, putting a fraction of a token towards a game and paying the rest online.",
  },
  {
    question: "Do game tokens expire?",
    answer:
      "Yes, tokens are valid for 6 months from when you get them, whether bought, gifted or earned. Your wallet shows exactly how many expire and when, and when you spend tokens the ones expiring soonest are always used first, so you never lose them unnecessarily.",
  },
  {
    question: "Can I gift game tokens?",
    answer:
      "Yes. You can buy tokens as a gift, even for someone who doesn't have an account yet, and they claim them when they sign in. Gifted tokens carry the same 6-month validity.",
  },
  {
    question: "What are open games and how do I join one?",
    answer:
      "Open games are public games anyone can join. Browse upcoming games on the booking page or in your player portal, reserve your spot, and pay with a token or online. Perfect if you're coming solo or with a few friends, teams get filled out from the community.",
  },
  {
    question: "What are beginner games?",
    answer:
      "Some open games are flagged for beginners, with a maximum player level so newer players can enjoy a game without going up against seasoned veterans. If you're above the cap you'll see it noted on the game and won't be able to join that one.",
  },
  {
    question: "What is the cancellation and refund policy?",
    answer:
      "Cancel more than 48 hours before a game for an automatic full refund. Between 48 and 24 hours before, refunds are by request. Within 24 hours the game is non-refundable, but you can always pass your spot to another player.",
  },
  {
    question: "What are squads, ladders and accolades?",
    answer:
      "Squads let you team up with friends under one banner; ladders are competitive seasonal rankings; and accolades and streaks are badges you earn for standout performances, like topping the kills or stringing together a streak. You'll find them all in your player portal.",
  },
  {
    question: "Can I see my match report and photos?",
    answer:
      "Yes. After each game you get a full match report, with scores, kills, accuracy, objectives and more, and any photos from your sessions appear in the gallery, filterable to the games you played in.",
  },
  {
    question: "How do I book?",
    answer:
      "Get in touch through the booking page or drop us a message. Tell us roughly what you're after, the size of the group, and the kind of event, and we'll handle it from there.",
  },
  {
    question: "How do I join the community side of things?",
    answer:
      "The WhatsApp community is the easiest way in. Open games get posted there, new players are welcomed, and you can show up to your first session without committing to anything in advance.",
  },
];
