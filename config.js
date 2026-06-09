// Shared configuration for Mystic Seoul.
// Edit prices, slot times, and capacity here — both the server and the
// front-end read these values so everything stays in sync.

module.exports = {
  // Each booking slot can hold this many participants.
  SLOT_CAPACITY: 8,

  // Time slots offered on every bookable day (24h format).
  SLOTS: ['11:00', '15:00'],

  // How long (minutes) a seat is held while a customer is at the payment page,
  // before the pending reservation expires and the seat is released.
  HOLD_MINUTES: 15,

  // Packages. Prices are in Korean won (whole numbers — KRW has no decimals).
  PACKAGES: {
    standard: {
      id: 'standard',
      name: 'The Encounter',
      tagline: 'Witness, learn, and ask',
      price: 105000,
      description:
        'A guided introduction to Korean shamanism. Observe a mudang at work, ' +
        'hear each ritual act explained, learn the history and meaning behind it, ' +
        'and ask anything in an open Q&A.',
      features: [
        'Live observation of ritual practice',
        'Step-by-step explanation of each act',
        'History and cultural context',
        'Open Q&A with an interpreter',
        'Small group (max 8 guests)',
        'About 90 minutes'
      ]
    },
    premium: {
      id: 'premium',
      name: 'The Reading',
      tagline: 'Your own personal fortune',
      price: 165000,
      premium: true,
      description:
        'Everything in The Encounter, plus a genuine personal fortune reading ' +
        '(jeom) performed for you by the shaman — your questions, your year ahead, ' +
        'interpreted and translated.',
      features: [
        'Everything in The Encounter',
        'A real personal fortune reading (jeom)',
        'Private interpretation of your reading',
        'Keepsake written summary',
        'Priority seating',
        'About 2 hours'
      ]
    }
  }
};
