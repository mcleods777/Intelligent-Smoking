// ============ Smoker AI — wood & pellet pairing guide ============
// Strength: 1 (mild) – 5 (bold). pairs lists the animals/cuts it shines with.

export const WOOD_GUIDE = [
  {
    name: 'Post Oak', emoji: '🪵', strength: 3,
    flavor: 'Medium, clean, classic Texas BBQ backbone — smoky without bitterness.',
    pairs: ['Brisket', 'Beef ribs', 'Anything beef'],
    tip: 'The Central Texas standard. If you only stock one wood for beef, make it this.',
  },
  {
    name: 'Hickory', emoji: '🥓', strength: 4,
    flavor: 'Strong, bacon-like, hearty. The definitive "BBQ smell".',
    pairs: ['Pork shoulder', 'Ribs', 'Bacon', 'Chicken'],
    tip: 'Easy to overdo on long cooks — blend 50/50 with oak or a fruit wood.',
  },
  {
    name: 'Mesquite', emoji: '🌵', strength: 5,
    flavor: 'Earthy, intense, fast-burning. Bold or bust.',
    pairs: ['Tri-tip', 'Fajita meats', 'Hot & fast beef'],
    tip: 'Great for short cooks; harsh on long ones. Rarely the right call for a 12-hour brisket.',
  },
  {
    name: 'Cherry', emoji: '🍒', strength: 2,
    flavor: 'Mildly sweet and fruity — famous for a gorgeous mahogany color.',
    pairs: ['Pork ribs', 'Poultry', 'Duck', 'Ham'],
    tip: 'The best color wood there is. Blend with hickory for ribs that look as good as they taste.',
  },
  {
    name: 'Apple', emoji: '🍎', strength: 2,
    flavor: 'Sweet, mellow, subtle — takes a while to penetrate.',
    pairs: ['Pork', 'Chicken', 'Turkey', 'Fish'],
    tip: 'Ideal for poultry and pork when you want smoke as a supporting actor, not the star.',
  },
  {
    name: 'Pecan', emoji: '🥧', strength: 3,
    flavor: 'Rich, nutty, slightly sweet — like hickory\'s smoother cousin.',
    pairs: ['Pork', 'Poultry', 'Brisket blends'],
    tip: 'A Southern favorite. Burns cooler than oak; excellent in pellet blends.',
  },
  {
    name: 'Maple', emoji: '🍁', strength: 2,
    flavor: 'Gentle, sweet, a touch smoky — pairs beautifully with cures.',
    pairs: ['Ham', 'Bacon', 'Turkey', 'Vegetables'],
    tip: 'The traditional choice for smoked hams and breakfast bacon.',
  },
  {
    name: 'Alder', emoji: '🐟', strength: 1,
    flavor: 'Delicate, lightly sweet — the classic Pacific Northwest fish wood.',
    pairs: ['Salmon', 'Trout', 'Seafood', 'Poultry'],
    tip: 'The definitive salmon wood. Mild enough for anything delicate.',
  },
  {
    name: 'Oak (Red/White)', emoji: '🌳', strength: 3,
    flavor: 'Medium-bodied, reliable, burns long and even.',
    pairs: ['Beef', 'Lamb', 'Sausages', 'Blends'],
    tip: 'The workhorse base of most pellet blends — plays well with everything.',
  },
  {
    name: 'Peach', emoji: '🍑', strength: 2,
    flavor: 'Soft, sweet, slightly floral fruit smoke.',
    pairs: ['Pork', 'Poultry', 'Ribs'],
    tip: 'A Georgia secret weapon for ribs and pulled pork.',
  },
];
