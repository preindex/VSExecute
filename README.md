# VSExecute
An extension allowing you to execute scripts to ROBLOX through WebSockets.

However, this extension still requires you to place a script within your executor's autoexec directory. Not only this, you must run a command as admin in order to use the extension.

#### Command
This command must be ran as it is required for the extension to communicate with the ROBLOX client.
```
CheckNetIsolation LoopbackExempt -a -n="ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr"
```

#### Script
```lua
if not isfile("WebSocketClient.lua") then
    writefile("WebSocketClient.lua", game:HttpGet("https://scripts.system-exodus.com/assets/VSExecute/Client.lua"))
end
loadstring(readfile("WebSocketClient.lua"))()
```