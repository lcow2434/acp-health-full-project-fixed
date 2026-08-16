/**
 * ACP Health — Zoom meeting creation
 * =========================================================
 * Uses Zoom's Server-to-Server OAuth app type (recommended
 * over the deprecated JWT app type). Creates a scheduled
 * meeting hosted under the doctor's Zoom account/email so it
 * shows on their calendar, then returns join/host links.
 * =========================================================
 */

async function getZoomAccessToken() {
  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Zoom auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

/**
 * @param {object} params
 * @param {string} params.doctorZoomEmail — the doctor's Zoom account email (meeting host)
 * @param {string} params.topic
 * @param {Date}   params.startTime
 */
async function createZoomMeeting({ doctorZoomEmail, topic, startTime }) {
  const token = await getZoomAccessToken();

  const res = await fetch(`https://api.zoom.us/v2/users/${doctorZoomEmail}/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      type: 2, // scheduled meeting
      start_time: startTime.toISOString(),
      duration: 20,
      settings: {
        join_before_host: false,
        waiting_room: true,     // keeps the call private until the doctor admits the patient
        approval_type: 2,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Zoom meeting creation failed: ' + JSON.stringify(data));

  return {
    meetingId: data.id,
    joinUrl: data.join_url,
    hostUrl: data.start_url,
  };
}

module.exports = { createZoomMeeting };
