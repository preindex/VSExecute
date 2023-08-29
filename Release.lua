if not isfile("VSExecuteClient.lua") then
    writefile("VSExecuteClient.lua", game:HttpGet("https://scripts.system-exodus.com/assets/VSExecute/Client.lua"))
end
loadstring(readfile("VSExecuteClient.lua"))()