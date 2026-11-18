/* Kopitiam 21 — connection settings.
   Phones on mobile data (and some Wi-Fi) can't connect directly, so they need a TURN relay.
   Free relay: sign up at https://dashboard.metered.ca (free plan), create an app,
   then paste your "TURN credentials" URL below, e.g.
   'https://YOURAPP.metered.live/api/v1/turn/credentials?apiKey=YOUR_API_KEY' */
window.K21_CONFIG = {
  turnCredentialsUrl: '',
  // or list relay servers directly: [{ urls: 'turn:host:3478', username: 'u', credential: 'p' }]
  iceServers: [],
};
