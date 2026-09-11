const QUOTES = [
  '把经历写清楚，机会才找得到你。',
  '先对齐岗位，再开口。',
  '会的说清楚，比多说更有力量。',
  '每一次校对，都是把机会握紧一点。',
  '先看缺口，再改简历。',
  '准备不是堆砌，是取舍。',
  '你已经走在准备的路上。',
];

export function pickWelcomeQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
