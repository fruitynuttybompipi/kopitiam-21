# Kopitiam 21 · Blackjack & Telur Pong

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

## Telur Pong (2 players)

Pick **TELUR PONG** on the first screen before tapping BUKA MEJA.

- Throw eggs into the other player's 6 kopi cups. **Swipe up** on the table (or drag up with the mouse): a longer swipe throws further, and tilting the swipe left or right aims.
- The ceiling fan blows the egg sideways. Check **ANGIN** before you throw; it changes every turn.
- 2 throws per turn. If both go in, it's **Telur balik!** and you throw 2 more.
- The first to sink all 6 of the other player's cups wins. The host can tap **REMATCH**, and the loser throws first.
- Playing alone? The host can add a bot.

## Blackjack house rules

- Everyone starts with **1000 chips**. These are play chips only, with no real money.
- Blackjack pays 3:2. Insurance pays 2:1. The Tauke stands on 17. You can double on any two cards, and split up to 4 hands.
- **The Tauke's chips are the bank.** Players win from the Tauke and lose to the Tauke.
- **No credit.** A player who runs out of chips sits out. If the Tauke goes broke, they pay out what they can and a new Tauke is picked at random.
- The game ends when only one person still has chips. The host can then start a **NEW GAME**.

## Good to know

- **The host's browser runs the table.** The host should keep that tab open and the screen on. The game asks the phone to stay awake, but if the host closes the tab, the table closes for everyone.
- If a player refreshes the page or loses signal, they rejoin the same seat automatically.
- Messages go through a free public relay (MQTT over secure WebSocket: EMQX, with HiveMQ as backup). It works on any Wi-Fi or mobile data, and nobody needs an account. You can change the relay list in `js/config.js`.

## Testing alone

Open `index.html?offline&autohost&bots=4&autostart` for Blackjack against 4 bots, or `index.html?offline&autohost&bots=1&autostart&mode=pong` for Telur Pong against a bot. No network is used.

## Files

| File | What it does |
|---|---|
| `js/engine.js` | Blackjack rules and round flow. Runs on the host. |
| `js/pong.js` | Telur Pong rules, turns and egg physics. Runs on the host. |
| `js/pongview.js` | Telur Pong table view, flying eggs and swipe controls. |
| `js/net.js` | Room codes and connections through the relay (MQTT). |
| `js/config.js` | Which relay servers to use. |
| `js/app.js` | Screens, rendering and animations. |
| `js/scene.js` | Animated kopitiam background and the marble table. |
| `js/sprites.js` | All pixel art, drawn in code. |
| `js/audio.js` | 8-bit sound effects and music, generated in code. |

Fonts: Press Start 2P and VT323 (SIL Open Font License).
