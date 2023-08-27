if not game:IsLoaded() then
    game.Loaded:Wait()
end

local Port = 13370
local Socket

local wait = task.wait
local spawn = task.spawn

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

while not LocalPlayer do
    LocalPlayer = Players.LocalPlayer
    wait()
end

LocalPlayer = LocalPlayer.Name

local KeepAlive = '{"Type":"KeepAlive","User":"'..LocalPlayer..'"}'
local HttpService = game:GetService("HttpService")

do
    local Address, Connected = ("ws://[::1]:%d+/"):format(Port)
    while not Connected do
        Connected, Socket = pcall(WebSocket.connect, Address)
        task.wait(1)
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

local function NewScript(Text, ID)
    local Function, Output  = loadstring(Text)
    local function log(...)
        rawlog("CLIENT", ID, nil, ...)
    end
    local function logerror(...)
        rawlog("ERROR", ID, error, ...)
    end
    if not Function then
        return logerror(Output)
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
end

do -- WIP
    local LastKeepAlive = os.time()
    local self = debug.info(1, 'f')
    local function Reconnect()
        print("Reconnecting...")
        spawn(self)
    end
    Socket.OnMessage:Connect(function(Data)
        Data = HttpService:JSONDecode(Data)
        if Data.type == "keepalive" then
            Socket:Send(KeepAlive)
            LastKeepAlive = os.time()
        end
        if Data.type == "script" then
            spawn(NewScript, Data.script, Data.ID)
        end
    end)
    spawn(function()
        while (os.time() - LastKeepAlive) < 6 do
            wait()
        end
        Socket = Socket:Close()
        return Reconnect()
    end)
end

Socket:Send(KeepAlive)

rawlog("OUTPUT", "Init", nil, "This user is now connected to the network.")