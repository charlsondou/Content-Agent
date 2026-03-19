# Antigravity Local Listener (PowerShell Version)
# Listens on http://localhost:8000/webhook/{workflow_name}
# Triggers: antigravity run-workflow {workflow_name}

$port = 8888
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "🚀 Antigravity Local Listener running on port $port..."
Write-Host "🌊 Connect via Cloudflare Tunnel: cloudflared tunnel --url http://localhost:$port"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        # Expected path format: /webhook/daily_post_generation
        
        if ($request.HttpMethod -eq "POST" -and $path.StartsWith("/webhook/")) {
            $workflowName = $path.Substring(9) # Remove "/webhook/"
            
            Write-Host "📥 Received trigger for workflow: $workflowName"

            # Execute Antigravity Workflow
            # Note: This runs asynchronously relative to the listener loop
            Start-Process -FilePath "antigravity" -ArgumentList "run-workflow", $workflowName -NoNewWindow
            
            $responseText = "Workflow '$workflowName' triggered successfully."
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.StatusCode = 200
        }
        else {
            $responseText = "Invalid Request. Use POST /webhook/{workflow_name}"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.StatusCode = 404
        }

        $response.Close()
    }
}
finally {
    $listener.Stop()
}
