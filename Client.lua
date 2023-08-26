local wait = task.wait
local Port = 13370
local Connected, Socket

local Script = Instance.new('BindableEvent')
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer.Name
local KeepAlive = '{"Type":"KeepAlive","User":"'..LocalPlayer..'"}'

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

local function rawlog(Type, ID, Func, ...)
    Socket:Send(HttpService:JSONEncode({
        ID = ID,
        Type = Type,
        User = LocalPlayer,
        Args = {...}
    }))
    if Func then
        Func(...)
    end
end

Script.Event:Connect(function(Text, ID)
    local Function  = loadstring(Text)
    local function log(...)
        rawlog("CLIENT", ID, nil, ...)
    end
    local function logerror(...)
        rawlog("ERROR", ID, error, ...)
    end
    setfenv(Function, setmetatable({
        logprint = function(...)
            rawlog("OUTPUT", ID, print, ...)
        end,
        logwarn = function(...)
            rawlog("WARN", ID, warn, ...)
        end,
        logerror = logerror
    }, {
        __index = getgenv()
    }))
    log("Starting execution...")
    xpcall(function()
        Function()
    end, function(Error)
        logerror(Error)
    end)
    log("Finished execution.")
end)

Socket.OnMessage:Connect(function(Data)
    Data = HttpService:JSONDecode(Data)
    if Data.type == "keepalive" then
        Socket:Send(KeepAlive)
    end
    if Data.type == "script" then
        Script:Fire(Data.script, Data.ID)
    end
end)

Socket:Send(KeepAlive)

rawlog("OUTPUT", "Init", nil, "This user is now connected to the network.")