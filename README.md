# Create the local cached directory matching your target framework version

mkdir -p ~/Library/Caches/electron/

# Force download the exact framework zip file into your cache directory

curl -L -o ~/Library/Caches/electron/electron-v40.9.3-darwin-x64.zip <https://npmmirror.com/mirrors/electron/40.9.3/electron-v40.9.3-darwin-x64.zip>
curl -L -o ~/Library/Caches/electron/electron-v40.9.3-darwin-arm64.zip <https://npmmirror.com/mirrors/electron/40.9.3/electron-v40.9.3-darwin-arm64.zip>

# Run with no mirrors declared; it picks up the pre-cached zips and pulls utilities from GitHub natively

npm run build:all

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# ekklesienter

// TODO: Когда импортируешь презентацию, то слайды в ней показывают контент в превью на таймлайне, а на самам превью показывает библейскую ссылку на Бытие 1:1 и больше ничего на экране превью. Нужно чтобы на экране превью показывался контент слайда.
