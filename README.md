# VSExecute
An extension allowing you to execute scripts to ROBLOX through WebSockets.

However, this extension still requires you to place a script within your executor's autoexec directory. Not only this, you must run a command as admin in order to use the extension.

When VSExcute is ready, it will show the console and output a message based on the status.

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

#### Logging System
VSExecute provides three logging functions that allow you to communicate directly with the Execution Output:
```lua
logprint("Hello World!") -- Prints to the roblox AND VSCode console
logwarn("Hello World!") -- Warns to the roblox AND VSCode console
logerror("Hello World!") -- Outputs an error VSCode console (and causes an error)
```