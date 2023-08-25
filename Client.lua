local wait = task.wait
local Port = 13370
local Connected, Socket
local KeepAlive = '{"Type":"KeepAlive"}'

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer.Name

local HttpService = game:GetService("HttpService")

while not LocalPlayer do
    LocalPlayer = Players.LocalPlayer
    wait()
end

do
    local Address = ("ws://[::1]:%d+/"):format(Port)
    while not Connected do
        Connected, Socket = pcall(WebSocket.connect, Address)
        task.wait(3)
    end
end

local function logprint(...)
    Socket:Send(HttpService:JSONEncode({
        Type = "OUTPUT",
        User = LocalPlayer,
        Args = {...}
    }))
    print(...)
end

local function logwarn(...)
    Socket:Send(HttpService:JSONEncode({
        Type = "WARN",
        User = LocalPlayer,
        Args = {...}
    }))
    warn(...)
end

local function logerror(...)
    Socket:Send(HttpService:JSONEncode({
        Type = "ERROR",
        User = LocalPlayer,
        Args = {...}
    }))
    error(...)
end

Socket.OnMessage:Connect(function(Data)
    Data = HttpService:JSONDecode(Data)
    if Data.type == "keepalive" then
        Socket:Send(KeepAlive)
    end
    if Data.type == "script" then
        xpcall(loadstring(Data.script), function(Error)
        
        end)
    end
end)

Socket:Send(KeepAlive)
logprint("This client is now connected to the network.")

getgenv().logprint = logprint
getgenv().logwarn = logwarn
getgenv().logerror = logerror