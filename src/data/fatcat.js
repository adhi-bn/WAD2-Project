// Biscuit the fat cat (inline SVG) and the lucky draw prizes.

export const CAT_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M22 52 L25 13 L53 34 Z" fill="#F2A65A" stroke="#2B1D12" stroke-width="4" stroke-linejoin="round"/><path d="M98 52 L95 13 L67 34 Z" fill="#F2A65A" stroke="#2B1D12" stroke-width="4" stroke-linejoin="round"/><path d="M30 40 L30 24 L43 34 Z" fill="#F7B8B0"/><path d="M90 40 L90 24 L77 34 Z" fill="#F7B8B0"/><ellipse cx="60" cy="93" rx="47" ry="24" fill="#F2A65A" stroke="#2B1D12" stroke-width="4"/><ellipse cx="60" cy="58" rx="43" ry="36" fill="#F2A65A" stroke="#2B1D12" stroke-width="4"/><path d="M50 25 q10 7 20 0 M45 33 q15 8 30 0" stroke="#D9803A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M37 58 q6 -7 12 0 M71 58 q6 -7 12 0" stroke="#2B1D12" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="33" cy="70" r="6" fill="#F7B8B0"/><circle cx="87" cy="70" r="6" fill="#F7B8B0"/><path d="M55 65 h10 l-5 5 z" fill="#E77A86" stroke="#2B1D12" stroke-width="2" stroke-linejoin="round"/><path d="M60 70 q-4 6 -9 3 M60 70 q4 6 9 3" stroke="#2B1D12" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 62 L31 65 M12 72 L31 71 M108 62 L89 65 M108 72 L89 71" stroke="#2B1D12" stroke-width="2.5" stroke-linecap="round"/><rect x="43" y="89" width="34" height="25" rx="6" fill="#3346FF" stroke="#2B1D12" stroke-width="3"/><rect x="47" y="91" width="26" height="16" rx="4" fill="#6573FF"/><ellipse cx="43" cy="104" rx="9" ry="7" fill="#FBE3C8" stroke="#2B1D12" stroke-width="3"/><ellipse cx="77" cy="104" rx="9" ry="7" fill="#FBE3C8" stroke="#2B1D12" stroke-width="3"/></svg>`

// w = weight (chance). 15% off is rare, "Good try" is most common.
export const PRIZES = {
  p15: { label: '15% OFF', name: '15% off', code: 'FATCAT15', type: 'pct', val: 15, w: 5, fill: '#FFB020', ink: '#15171C', title: 'Jackpot! 15% off your build' },
  p10: { label: '10% OFF', name: '10% off', code: 'FATCAT10', type: 'pct', val: 10, w: 20, fill: '#3346FF', ink: '#FFFFFF', title: 'You won 10% off!' },
  p5: { label: 'S$5 OFF', name: 'S$5 off', code: 'FATCAT5', type: 'amt', val: 5, w: 35, fill: '#15171C', ink: '#F1F2F4', title: 'You won S$5 off!' },
  none: { label: 'GOOD TRY', name: 'no prize', code: null, w: 40, fill: '#F4F5F9', ink: '#15171C', title: 'Good try!' },
}
// The eight slices of the wheel, clockwise from the top.
export const SLICES = ['p15', 'none', 'p5', 'p10', 'none', 'p5', 'p10', 'none']
export const VOUCHER_MINUTES = 15
