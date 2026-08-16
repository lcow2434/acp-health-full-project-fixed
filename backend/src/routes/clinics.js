const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/clinics?lat=..&lng=..&urgency=emergency|urgent|self_care
// Server holds the Google Places API key — it is never sent to the client.
router.get('/', requireAuth, async (req, res) => {
  const { lat, lng, urgency } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const keyword = urgency === 'emergency' ? 'hospital emergency room'
    : urgency === 'urgent' ? 'urgent care walk-in clinic'
    : 'family doctor clinic';

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', '8000');
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY);

    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || []).slice(0, 8).map(p => ({
      placeId: p.place_id,
      name: p.name,
      address: p.vicinity,
      rating: p.rating,
      openNow: p.opening_hours?.open_now ?? null,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
    }));

    // Cache each result for reuse / offline fallback
    for (const r of results) {
      await pool.query(
        `INSERT INTO clinic_cache (place_id, name, address, lat, lng, rating, raw_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (place_id) DO UPDATE SET
           name = EXCLUDED.name, address = EXCLUDED.address,
           rating = EXCLUDED.rating, raw_json = EXCLUDED.raw_json,
           fetched_at = now()`,
        [r.placeId, r.name, r.address, r.lat, r.lng, r.rating, JSON.stringify(r)]
      );
    }

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch nearby clinics' });
  }
});

module.exports = router;
