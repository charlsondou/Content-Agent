# Content Agent Template

這是一個可以利用 LLM (例如透過 OpenRouter 或 Gemini API) 來自動生成、處理社群內容的 Headless Agent 版型 (Template)。
本專案提供了一個與 n8n Webhook 串接的 Express 伺服器，以及一組能讓你在本機與雲端環境彈性執行的自動化腳本。

## 系統需求

- [Node.js](https://nodejs.org/) (建議 v18 以上)
- [Antigravity CLI](https://github.com/) (若需要使用在地自動化 Workflow 功能)
- [Cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (包含在 `start_services.ps1` 自動執行指令中，或可自行透過 WinGet 預先安裝)

## 安裝與設定

1. **複製原始碼並安裝依賴套件**
   ```bash
   npm install
   ```

2. **設定環境變數**
   請複製 `.env.example` 檔案並重新命名為 `.env`：
   ```bash
   cp .env.example .env
   ```
   接著，請使用文字編輯器打開 `.env` 檔案，並填入您的 API 密鑰及相關設定：
   - `OPENROUTER_API_KEY`: 您的 OpenRouter API 密鑰。
   - `RETURN_WEBHOOK_URL`: 當內容處理完畢後，結果要回傳至的 n8n Webhook URL。
   - `PORT`: 若需更改預設伺服器 Port 可在此調整 (預設為 3000，但在 `local_listener.js` 等本機腳本預設使用了 8888)。

## 如何啟動服務

### 方法一：啟動獨立 Agent 伺服器 (供部署時使用)
若您已將專案部署在伺服器環境 (如 Zeabur)，可用以下正常指令啟動：
```bash
npm start
```
伺服器將預設運行於 `.env` 所設定的 Port 號 (預設為 `3000`)。

### 方法二：啟動本機開發 / 自動化 Listener (供本機實機操作)
本專案提供腳本，可自動將本機服務推播至一個暫時的開放網域供外部測試與觸發。

1. **若您使用 Windows 系統：**
   可以直接右鍵執行 `start_services.ps1` (或在 PowerShell 下執行)。
   它會同時啟動 `local_listener.js` (Port 8888) 以及自動用 `cloudflared` 建立 Tunnel 對外連線。請複製終端機上提供的 `https://...` 網址使用。

2. **各語言 Listener 說明**
   依據您的偏好，本版型提供了多種語系的本機會聽器 (`local_listener`) 實作：
   - `local_listener.js` (Node.js Express)
   - `local_listener.py` (Python FastAPI)
   - `local_listener.ps1` (PowerShell)

   您可以彈性地替換使用。預設 `start_services.ps1` 會使用 Node.js 版本。

## 使用方法

### Webhook 觸發
傳送 `POST` 請求到我們伺服器的 `/webhook/{workflow_name}` 端點。例如：
```bash
POST https://你的伺服器網址/webhook/daily_post_generation
```
本機端收到請求後，將會自動觸發系統終端執行指令 `antigravity run-workflow daily_post_generation`。

### PDF 解析工具
我們提供了一個簡單的工具，可供解析 PDF 並輸出為 Markdown 檔案。
```bash
node parse_pdf.js <輸入檔案路徑> <輸出檔案路徑>

# 例如
node parse_pdf.js ./assets/book.pdf ./assets/book_output.md
```
