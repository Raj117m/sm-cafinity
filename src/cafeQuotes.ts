export type CafeQuote={lead:string;accent:string;line:string};

const headlines:[string,string][]=[
 ['Your usual?','Or something new.'],['Come in slowly.','Leave a little happier.'],['A good day starts','one sip at a time.'],['Take the long way','through your coffee.'],['Small pause.','Excellent decision.'],['Coffee first.','The rest can wait.'],['Find your corner.','We will bring the comfort.'],['Today deserves','something delicious.'],['A table for you.','A moment to keep.'],['Warm cup.','Clearer thoughts.'],['Stay for one.','Make it two.'],['Some days need','a little extra foam.'],['Meet me where','the coffee is warm.'],['A quiet minute.','A very good cup.'],['Made to order.','Meant to linger over.'],['Your break called.','It chose this table.'],['Sip slowly.','There is nowhere to be.'],['A familiar favourite.','A fresh little mood.'],['Good coffee.','Better company.'],['Pick a seat.','Let the day soften.'],['A little ritual.','A lot of comfort.'],['This table has','your name on it.'],['Coffee in hand.','World on pause.'],['Something warm.','Something worth staying for.'],['One more round?','That sounds about right.'],['Your afternoon','just found its flavour.'],['Settle in.','We saved you a sip.'],['The best plans','begin over coffee.'],['A bite between','the good conversations.'],['Not in a hurry?','Neither are we.'],['Choose by craving.','Stay by feeling.'],['Freshly made.','Happily unhurried.'],['A softer hour.','A stronger coffee.'],['Order what feels','like a good idea.'],['Here for coffee.','Staying for the mood.'],['Give the day','a delicious intermission.'],['A cup, a game,','a little more time.'],['Your next favourite','might be right here.'],['The usual comfort.','A new possibility.'],['Let us make','this moment warmer.']
];

const lines=[
 'Coffee, a bite, and no reason to rush.',
 'Fresh pours, warm plates, and time well spent.',
 'Made for cravings, conversations, and one more round.',
 'Good things arrive warm. The best moments take their time.',
 'Pick what feels right. We will take care of the rest.'
];

export const CAFE_QUOTES:CafeQuote[]=headlines.flatMap(([lead,accent])=>lines.map(line=>({lead,accent,line})));

let visitQuote: CafeQuote | undefined;

export function sessionCafeQuote(): CafeQuote {
  if (visitQuote) return visitQuote;

  const key = 'sm-cafinity-last-headline';
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(key);
  } catch {
    // Private or restricted browsing can block storage.
  }
  const choices = CAFE_QUOTES.filter(quote => quote.lead !== previous);
  visitQuote = choices[Math.floor(Math.random() * choices.length)];
  try {
    localStorage.setItem(key, visitQuote.lead);
  } catch {
    // The current page still keeps its selected quote.
  }
  return visitQuote;
}
