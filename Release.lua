local File = isfile("WebSocketClient.lua")

if not File then
    writefile("WebSocketClient.lua", game:HttpGet("https://scripts.system-exodus.com/assets/VSExecute.lua"))
end

loadstring(readfile("WebSocketClient.lua"))()