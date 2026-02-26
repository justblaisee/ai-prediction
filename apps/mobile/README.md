# Mobile App (Portfolio v1)

This is a new Expo-based mobile client for Inventory AI.

## Features (v1)

- Login with existing API credentials
- Token persistence with `expo-secure-store`
- Product list preview
- Trigger model training
- Live training status polling (`idle/running/completed/failed`)

## Run

```bash
cd apps/mobile
npm install
npm run dev
```

Then open using Expo Go (Android/iOS) or emulator.

## API URL

Set `expo.extra.apiUrl` in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://YOUR_LOCAL_IP:4000"
    }
  }
}
```

For physical devices, do not use `localhost`. Use your machine LAN IP.
