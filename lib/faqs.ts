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
      "Anyone from age 13 upwards. We host community open games for regular players, corporate events, stag and hen dos, birthday parties for kids and adults, and private bookings for friend groups.",
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
