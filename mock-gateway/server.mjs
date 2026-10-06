// Mock AutomotiveAI gateway for design work: canned inventory, chat replies,
// deal state and a contact request. No real data, no secrets. Port 8099.
import http from 'node:http'
const img = n => `https://images.unsplash.com/photo-${n}?w=1200&q=70`
const vehicles = [
  { stock_number: 'T2201', vin: '2T3P1RFV8NW123456', year: 2022, make: 'Toyota', model: 'RAV4', trim: 'XLE AWD', price: 36900, mileage: 31240, condition: 'used', exterior_color: 'magnetic_gray', image_url: null },
  { stock_number: 'H1903', vin: '5J6RW2H89KL000111', year: 2023, make: 'Honda', model: 'CR-V', trim: 'EX-L Hybrid', price: 38450, mileage: 12880, condition: 'certified', exterior_color: 'platinum_white', image_url: null },
  { stock_number: 'F3310', vin: '1FMCU9H67NUA22222', year: 2021, make: 'Ford', model: 'Bronco Sport', trim: 'Badlands', price: 31200, mileage: 40210, condition: 'used', exterior_color: 'cyber_orange', image_url: null },
  { stock_number: 'K7781', vin: null, year: 2024, make: 'Kia', model: 'Telluride', trim: 'SX X-Pro', price: 52990, mileage: 4100, condition: 'used', exterior_color: 'everlasting_silver', image_url: null },
]
const state = {
  vehicle: { stock_number: 'T2201', year: 2022, make: 'Toyota', model: 'RAV4' },
  pricing_frame: { list_price: 36900, market_price: 35400, open_offer: 33600, good_price: 34500, walk_away: 35400, over_market_pct: 4.2, confidence_tier: 1, deal_state: 'negotiating' },
  current_offer: { user_offer: 34000, asking_price: 36900, round: 1, action: 'counter', counter_price: 35700, deal_score: 78 },
  deal_score: 78,
  last_scenario: { scenario_id: 'what_to_offer', recommendation: 'Open at **$33,600**. Comparable RAV4s within 50 miles sell for about $35,400, and this one has been on the lot for 52 days.', stats: [{ key: 'Market value', value: '$35,400' }, { key: 'Opening offer', value: '$33,600' }, { key: 'Days on lot', value: '52' }, { key: 'Comparables', value: '14' }], data_source: 'live', confidence: 'high', primary_action: { label: 'Make an offer of $33,600', action: 'offer', offer_amount: 33600 } },
}
let turns = 0
let lastConfirm = null
const send = (res, code, body, extra = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...extra }); res.end(JSON.stringify(body)) }
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  let body = ''
  req.on('data', c => (body += c))
  req.on('end', () => {
    const p = u.pathname
    if (p === '/api/motology/vehicles') {
      const q = (u.searchParams.get('q') || u.searchParams.get('make') || '').toLowerCase()
      return send(res, 200, { data: vehicles.filter(v => !q || JSON.stringify(v).toLowerCase().includes(q)) })
    }
    if (p.startsWith('/api/motology/vehicles/')) {
      const v = vehicles.find(x => x.stock_number === decodeURIComponent(p.split('/').pop()))
      return v ? send(res, 200, { data: v }) : send(res, 404, { detail: 'not found' })
    }
    if (p === '/api/motology/chat') {
      const msg = (JSON.parse(body || '{}').message || '').toLowerCase()
      turns = msg.includes('connect') ? 3 : /\d{4}/.test(msg) ? 2 : 1
      const handoff = turns >= 3
      return send(res, 200, {
        conversation_id: 'conv_demo_1234567890', turn_count: turns, handoff,
        contact_request_id: handoff ? 'cr_demo_abcdefghijkl' : null,
        reply: turns === 1
          ? "This **2022 RAV4 XLE** is listed about 4% above similar cars nearby.\n\nHere's how I'd play it:\n- Open at **$33,600**\n- A good price is **$34,500**\n- Walk away above **$35,400**"
          : turns === 2 ? 'At **$34,000** the dealer will most likely counter around $35,700. That is still inside your walk-away, so you have room.' : "Great, I'm connecting you with the dealership's sales assistant.",
        motology: turns === 1 ? { ...state, current_offer: null } : state,
      })
    }
    if (p.startsWith('/api/motology/conversations/')) return send(res, 200, { data: { ...state, conversation_id: 'conv_demo_1234567890' } })
    if (p.startsWith('/api/motology/contact-requests/')) {
      if (req.method === 'POST') {
        const b = JSON.parse(body || '{}')
        lastConfirm = b
        return send(res, 200, { data: { status: 'confirmed', test_drive: b.test_drive_at ? { status: 'requested', scheduled_at: b.test_drive_at } : null } })
      }
      return send(res, 200, { data: { id: 'cr_demo_abcdefghijkl', status: 'pending', agent_name: 'Muse', vehicle: { ...vehicles[0] }, buyer_note: 'Looking for a reliable AWD SUV for a family of four, ideally under $36k.', consent_text: 'By submitting, you agree that Sunrise Toyota may contact you by text message and email about this vehicle inquiry. Msg & data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.', expires_at: new Date(Date.now() + 86400000).toISOString() } })
    }
    send(res, 404, { detail: 'nope' })
  })
}).listen(8099, () => console.log('fake gateway on 8099'))
