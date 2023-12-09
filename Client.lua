-- 1.4.2 --

--[[ 
    TODO:
    Add alternative port method
    if port goes down, find new port and repeat
    Make workspace path a dropdown menu (still keep the custom path textbox)
    add MAC support
]]

DEBUG = false

if not game:IsLoaded() then
    game.Loaded:Wait()
end

local isfile = isfile
local readfile = readfile
local writefile = writefile

local wait = task.wait
local spawn = task.spawn

while not isfile("VSExecute.json") do
    wait()
end

local Update = Instance.new('BindableEvent')
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

while not LocalPlayer do
    LocalPlayer = Players.LocalPlayer
    wait()
end

LocalPlayer = LocalPlayer.Name

local HttpService = game:GetService("HttpService")
local KeepAlive = HttpService:JSONEncode({
    Type = "KeepAlive",
    User = LocalPlayer,
    Client = DEBUG and "DEBUG" or isfile("VSExecuteClient.lua") and readfile("VSExecuteClient.lua"):split("--")[2]:gsub(" ", "") or ""
})
local Connections = {}

local function CheckSocket(Port)
    return request({
        Url = "http://127.0.0.1:"..Port,
        Method = "GET"
    }).Body == "Upgrade Required"
end

local function Remove(Port, Check)
    if not isfile("VSExecute.json") or Check and not CheckSocket(Port) then
        return
    end
    local Data = HttpService:JSONDecode(readfile("VSExecute.json"))
    if Data then
        Data[Port] = nil
        writefile("VSExecute.json", HttpService:JSONEncode(Data))
    end
end

local function Clean(Decoded)
    for Port,Socket in next, Connections do
        if not CheckSocket(Port) or Decoded and Decoded[Port] == nil then
            Socket.Close()
        end
    end
end

local function FindAlternativeSocket()
    for Port,Socket in next, Connections do
        if CheckSocket(Port) then
            return Port, Socket.Connection
        end
    end
end

local function Connect(Port)
    if Connections[Port] then
        return Remove(Port, true)
    end

    local Socket do
        local Time = 0
        while not CheckSocket(Port) and Time < 1 do
            Time += wait(0.1)
        end
        if Time > 1 then
            return Remove(Port)
        end
        Socket = WebSocket.connect(("ws://localhost:%d+/"):format(Port)) -- [::1]
    end

    local function rawlog(Type, ID, Func, ...)
        if Socket then
            if not CheckSocket(Port) then
                Port, Socket = FindAlternativeSocket()
            end
            Socket:Send(HttpService:JSONEncode({
                ID = ID,
                Type = Type,
                User = LocalPlayer,
                Args = {...}
            }))
        end
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
        local Connection = Socket.OnMessage:Connect(function(Data)
            if not Socket then
                return
            end
            Data = HttpService:JSONDecode(Data)
            if Data.type == "keepalive" then
                Socket:Send(KeepAlive)
            elseif Data.type == "script" then
                spawn(NewScript, Data.script, Data.ID)
            elseif Data.type == "update" then
                if Data.script then
                    writefile("VSExecuteClient.lua", Data.script)
                end
                Clean()
                Update:Fire()
            end
        end)
        local function Close()
            if Socket then
                Socket:Close()
            end
            if Connection then
                Connection = Connection:Disconnect()
            end
            Remove(Port)
            Connections[Port] = nil
        end
        Connections[Port] = {Close = Close, Connection = Socket}
        Socket.OnClose:Connect(function()
            Close()
        end)
        spawn(function()
            while not Closing and CheckSocket(Port) do
                wait(0.1)
            end
            Close()
        end)
    end

    rawlog("SUCCESS", "Client", nil, "This user is now connected to the network.")
end

local Continue = true
spawn(function()
    local Old
    local Data = readfile("VSExecute.json")
    Update.Event:Connect(function()
        Continue = false
        if getgenv().VSExecuteUpdate then
            return
        end
        getgenv().VSExecuteUpdate = true
        spawn(loadstring(readfile("VSExecuteClient.lua")))
        getgenv().VSExecuteUpdate = nil
    end)
    while Continue do
        if Old ~= Data then
            local Decoded = HttpService:JSONDecode(Data)
            local Indexes = 0
            Clean(Decoded)
            for Port in next, Decoded do
                Indexes += 1
                Connect(Port)
            end
            if Indexes == 0 then
                delfile("VSExecute.json")
            end
            Old = Data
        end
        wait(0.1)
        if not isfile("VSExecute.json") then
            continue
        end
        Data = readfile("VSExecute.json")
    end
end)