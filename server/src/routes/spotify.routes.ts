import { Router } from 'express';
import axios from 'axios';
import { getShop } from '../models';

const router = Router();

// GET /spotify/login
router.get('/login', (_req, res) => {
  const SPOTIFY_CLIENT_ID = getShop().systemSettings['SPOTIFY_CLIENT_ID'] || '';
  if (!SPOTIFY_CLIENT_ID) {
    res.send('Spotify Client ID ayarlarda yok!');
    return;
  }
  const scope = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing';
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=https://bilalgnd.shop/spotify/callback&state=${encodeURIComponent(getShop().shopId)}`;
  res.redirect(authUrl);
});

// GET /spotify/callback
router.get('/callback', async (req: any, res: any) => {
  const code = req.query.code as string;
  if (!code) {
    res.send('Spotify baglantisi reddedildi.');
    return;
  }

  const SPOTIFY_CLIENT_ID = getShop().systemSettings['SPOTIFY_CLIENT_ID'] || '';
  const SPOTIFY_CLIENT_SECRET = getShop().systemSettings['SPOTIFY_CLIENT_SECRET'] || '';
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://bilalgnd.shop/spotify/callback',
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    getShop().systemSettings['SPOTIFY_ACCESS_TOKEN'] = response.data.access_token;
    getShop().systemSettings['SPOTIFY_TOKEN_EXPIRY'] = Date.now() + response.data.expires_in * 1000;
    getShop().systemSettings['SPOTIFY_REFRESH_TOKEN'] = response.data.refresh_token;
    getShop().saveSettings();
    res.send('Spotify basariyla baglandi! Kasa uygulamasina donebilirsiniz. Bu pencereyi kapatabilirsiniz.');
  } catch (error: any) {
    res.send(`Hata: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
  }
});

// GET /spotify/token
router.get('/token', async (_req, res) => {
  let accessToken = getShop().systemSettings['SPOTIFY_ACCESS_TOKEN'] || '';
  let refreshToken = getShop().systemSettings['SPOTIFY_REFRESH_TOKEN'] || '';
  let tokenExpiry = getShop().systemSettings['SPOTIFY_TOKEN_EXPIRY'] || 0;

  if (!accessToken || !refreshToken) {
    res.status(401).json({ error: 'not_logged_in' });
    return;
  }

  // Refresh if < 5 minutes remaining
  if (Date.now() > tokenExpiry - 5 * 60 * 1000 || !tokenExpiry) {
    const SPOTIFY_CLIENT_ID = getShop().systemSettings['SPOTIFY_CLIENT_ID'] || '';
    const SPOTIFY_CLIENT_SECRET = getShop().systemSettings['SPOTIFY_CLIENT_SECRET'] || '';
    const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    try {
      const refRes = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      getShop().systemSettings['SPOTIFY_ACCESS_TOKEN'] = refRes.data.access_token;
      getShop().systemSettings['SPOTIFY_TOKEN_EXPIRY'] = Date.now() + ((refRes.data.expires_in || 3600) * 1000);
      if (refRes.data.refresh_token) {
        getShop().systemSettings['SPOTIFY_REFRESH_TOKEN'] = refRes.data.refresh_token;
      }
      getShop().saveSettings();
      accessToken = getShop().systemSettings['SPOTIFY_ACCESS_TOKEN'];
    } catch (refErr) {
      res.status(401).json({ error: 'refresh_failed' });
      return;
    }
  }

  res.json({ access_token: accessToken });
});

export default router;
