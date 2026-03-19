from fastapi import FastAPI, HTTPException, Request
import subprocess
import os
import uvicorn
import logging

# 設定 Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AntigravityListener")

app = FastAPI()

# Antigravity CLI 執行路徑 (假設已加入 PATH，否則請填寫絕對路徑)
# 這裡假設觸發方式為執行某個指令，請根據您的實際 Antigravity CLI 調整
ANTIGRAVITY_CMD = "antigravity" 

@app.post("/webhook/{workflow_name}")
async def trigger_workflow(workflow_name: str, request: Request):
    """
    接收 n8n 的 Webhook，觸發指定的 Antigravity Workflow。
    Example: POST /webhook/daily_post_generation
    """
    logger.info(f"Received trigger for workflow: {workflow_name}")
    
    # 這裡可以加入簡單的驗證 (Optional)
    # auth_header = request.headers.get("x-api-key")
    # if auth_header != "YOUR_SECRET_KEY":
    #     raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        # 1. 檢查 Workflow 檔案是否存在 (安全檢查)
        workflow_path = os.path.join(".agent", "workflows", f"{workflow_name}.md")
        if not os.path.exists(workflow_path):
             logger.error(f"Workflow file not found: {workflow_path}")
             raise HTTPException(status_code=404, detail=f"Workflow '{workflow_name}' not found")

        # 2. 執行指令 (這行是關鍵！)
        # 這裡假設 Antigravity 的 CLI 支援 run-workflow 指令
        # 如果是其他方式 (如寫入 Task 檔案)，請在此處修改邏輯
        command = [ANTIGRAVITY_CMD, "run-workflow", workflow_name]
        
        # 非同步執行，不等待結果 (Fire and Forget)，避免 n8n timeout
        subprocess.Popen(command, cwd=os.getcwd())
        
        logger.info(f"Workflow '{workflow_name}' started successfully.")
        return {"status": "success", "message": f"Workflow '{workflow_name}' triggered"}

    except Exception as e:
        logger.error(f"Error triggering workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🚀 Antigravity Local Listener is running on port 8000...")
    print("🌊 Connect via Cloudflare Tunnel: cloudflared tunnel --url http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
