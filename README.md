# Kopitiam 21 · Blackjack

A pixel-art multiplayer blackjack game set in a Malaysian kopitiam. You play with friends in the browser, and each person uses their own phone or laptop. No sign-up and no server to run.

## Put it on GitHub Pages

1. Create a new **public** repo, e.g. `kopitiam-21`.
2. Upload **everything in this folder** and keep the folders as they are (`css/`, `js/`, `fonts/`, `index.html`, `.nojekyll`).
3. In the repo, go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, then branch `main` and folder `/ (root)`, and save.
4. After a minute the game is live at `https://<your-username>.github.io/kopitiam-21/`.

## Play with friends

1. Open the link, type your name, then pick an avatar and a drink.
2. One person taps **BUKA MEJA** (create table). They become the host and get a 4-letter code.
3. The host taps **MEJA ···· SHARE** to send the link. Friends can also type the code and tap **MASUK**.
4. The host can pick the **Tauke** (dealer) in the **TAUKE** menu. If nobody is picked, the Tauke is chosen at random. Then tap **START!**
5. You can have up to 6 people at a table: 1 Tauke and 5 players. The host can also add bots to fill seats.

## House rules

- Everyone starts with **1000 chips**. These are play chips only, with no real money.
- Blackjack pays 3:2. Insurance pays 2:1. The Tauke stands on 17. You can double on any two cards, and split up to 4 hands.
- **The Tauke's chips are the bank.** Players win from the Tauke and lose to the Tauke.
- **No credit.** A player who runs out of chips sits out. If the Tauke goes broke, they pay out what they can and a new Tauke is picked at random.
- The game ends when only one person still has chips. The host can then start a **NEW GAME**.

## Good to know

- **The host's browser runs the table.** The host should keep that tab open and the screen on. The game asks the phone to stay awake, but if the host closes the tab, the table closes for everyone.
- If a player refreshes the page or loses signal, they rejoin the same seat automatically.
- Matchmaking uses the free PeerJS cloud server. After that, game data goes straight between the devices over WebRTC.
- Some strict office or hotel Wi-Fi networks block peer-to-peer connections. If someone can't connect, they should switch to mobile data.

## Testing alone

Open `index.html?offline&autohost&bots=4&autostart`. This starts a local table against 4 bots with no network.

## Files

| File | What it does |
|---|---|
| `js/engine.js` | Blackjack rules and round flow. Runs on the host. |
| `js/net.js` | Room codes and peer-to-peer connections (PeerJS). |
| `js/app.js` | Screens, rendering and animations. |
| `js/scene.js` | Animated kopitiam background and the marble table. |
| `js/sprites.js` | All pixel art, drawn in code. |
| `js/audio.js` | 8-bit sound effects and music, generated in code. |

Fonts: Press Start 2P and VT323 (SIL Open Font License).
