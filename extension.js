/*
	TODO:
	Fix crashing
	fix workspace and add default and workspace path
*/

let Random = (min, max) => {
    return Math.round(Math.random() * (max - min) + min);
}

const Port = Random(13370, 65536)

const vs = require('vscode')
const ws = require('ws')
const fs = require('fs')
const rs = require('randomstring')
const fetch = require('node-fetch')
const axios = require('axios')

const Output = vs.window.createOutputChannel("Execution Output")
Output.show()

const Debug = vs.window.createOutputChannel("Execution Output - Debug")

const Server = new ws.Server({port: Port})
console.log(`Created Server @ Port ${Port}`)

const Emojis = {
	ERROR: "❌",
	WARN: "⚠️",
	SUCCESS: "✔️",
	OUTPUT: "🛠️",
	CLIENT: "⚙️"
}

let Connections = []
let Item, D1, D2, CurrentEditor

let Timeout, UpdateLoop
let CurrentScriptVersion, Script

let UWPPath
let maxClients
let single
let timeout
let workspacePath
let alertExecution
let allowBackupEditors
let allowSelectionExecution
let strictLanguageExecution

function Close(Socket, Reason, Type) {
	Type = Type || "OUTPUT"
	Output.appendLine(`${Emojis[Type]} [${Type} - ${Socket.User}] (Server): ${Reason}`)
	const Index = Connections.indexOf(Socket)
	Connections.splice(Index, Index + 1)
	Socket.terminate()
}

function Ping() {
	Connections.forEach(Connection => {
		if (!Connection.Updated) {
			return Close(Connection, `This user left the network. (Failed to ping.)`, "ERROR")
		}
		Connection.Updated = false
		Connection.send(JSON.stringify({type: "keepalive"}))
	})
}

function ResetTimeout() {
	Timeout = setInterval(Ping, timeout)
}

function UpdateSettings() {
	const Config = vs.workspace.getConfiguration("vsexecute")
	timeout = Config.get("timeout")
	UWPPath = Config.get("workspace.UWP")
	maxClients = Config.get("maxClients")
	single = Config.get("singleExecution")
	workspacePath = Config.get("workspace.Path")
	alertExecution = Config.get("alertExecution")
	allowBackupEditors = Config.get("allowBackupEditors")
	allowSelectionExecution = Config.get("allowSelectionExecution")
	strictLanguageExecution = Config.get("strictLanguageExecution")
	if (Timeout) {
		Timeout = clearInterval(Timeout)
		Ping()
		setTimeout(ResetTimeout, 1000)
	}
}

function UpdateStatus(Extra, Close) {
	let Path
	Data = {Port: Port, maxClients: maxClients, single: single}
	if (Extra && Object.keys(Extra).length > 0) {
		Extra.forEach((Index, Value) => {
			Data[Index] = Value
		})
	}
	CurrentData[Port] = Data
	if (UWPPath || workspacePath == "%LocalAppData%\\Packages\\ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr\\AC\\workspace") {
		Path = (`${process.env.LocalAppData || process.env.HOME || process.env.USERPROFILE}\\Packages\\ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr\\AC\\workspace\\VSExecute.json`)
	} else if (workspacePath.length > 0) {
		Path = (`${workspacePath}\\VSExecute.json`)
	}
	let CurrentData = JSON.parse(fs.existsSync(Path) ? fs.readFileSync(Path, "utf8") : "{}")
	Object.keys(CurrentData).forEach((Port) => {
		fetch(`http://127.0.0.1:${Port}`).catch(() => {
			CurrentData[Port] = null
			Connections.forEach((Connection) => {
				Connection.send(JSON.stringify({Type: "SERVER_CLOSE", Port: Port}))	
			})
		})
	})
	if (Close) {
		CurrentData[Port] = null	
		if (Object.keys(CurrentData).length > 0) {
			fs.unlinkSync(Path)
		}
	}
	fs.writeFileSync(Path, JSON.stringify(CurrentData))
}

function Sync(Socket) {
	let Path
	if (UWPPath || workspacePath == "%LocalAppData%\\Packages\\ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr\\AC\\workspace") {
		Path = (`${process.env.LocalAppData || process.env.HOME || process.env.USERPROFILE}\\Packages\\ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr\\AC\\workspace\\VSExecuteClient.lua`)
	} else if (workspacePath.length > 0) {
		Path = (`${workspacePath}\\VSExecuteClient.lua`)
	}
	if (Path) {
		fs.writeFileSync(Path, Script)
		Socket.send(JSON.stringify({type: "update", ID: "Client"}))
	} else {
		Socket.send(JSON.stringify({type: "update", ID: "Client", script: Script}))
	}
	vs.window.showInformationMessage("Sorry, we have to update something. You should be good to go. If you experience any problems, just restart the game. If you continue to have problems, DM xxxYoloxxx999 on Discord.")
	// return Close(Socket, "Sorry, we had to update something. Please restart the game.")
}

function Init(Socket) {
	Connections.push(Socket)
	Socket.Updated = true
	Socket.on("message", Message => {
		let Data = JSON.parse(Message)
		Socket.Updated = true
		if (!Socket.User) {
			Connections.forEach(Connection => {
				if (Connection.User == Data.User) {
					return Close(Connection, `Removed previous connection.`)
                }
			})
			Socket.User = Data.User
		}
		if (Data.Type == "KeepAlive") {
			Socket.Version = Data.Client
			if (Socket.Version != "DEBUG" && Data.Client != CurrentScriptVersion) {
				Sync(Socket)
			}
			return
		}
		const Final = `${Emojis[Data.Type]} [${Data.Type} - ${Data.User}] (${Data.ID || "No ID"}): ${Data.Args.join(" ")}`
		if (Data.Debug) {
			Debug.appendLine(Final)
			return
		}
		if (Data.Type == "UPDATE") return UpdateStatus();
		if (Data.Type == "CLIENT" && !alertExecution) return;
		if (Data.Type == "ERROR") {
			vs.window.showErrorMessage("An error occured. See the Execution Output for details.")
		}
		Output.appendLine(Final)
	})
	Socket.on("close", () => {
		return Close(Socket, `This user left the network. (Requested closure)`)
	})
}

function UpdateScript() { 
	axios.get("https://scripts.system-exodus.com/assets/VSExecute/Client.lua").then((Response) => {
		if (Response.status!= 200) return;
		Script = Response.data
		CurrentScriptVersion = Script.replaceAll(" ", "").split('--')[1]
	})
}

function activate(context) {
	console.log('VSExecute has been activated.');

	Server.on("connection", Init)

	context.subscriptions.push(vs.commands.registerCommand('vsexecute.execute', () => {
		let Editor = CurrentEditor
		if (!Editor) {
			if (!allowBackupEditors) return;
			let Editors = vs.window.visibleTextEditors
			if (Editors < 2) return;
			Editor = null;
			vs.window.visibleTextEditors.forEach(VisibleEditor => {
				if (VisibleEditor.document.languageId == "lua" || !strictLanguageExecution && VisibleEditor.document.languageId == "plaintext") {
					Editor = VisibleEditor
					return;
				}
			})
			if (!Editor) return;
		}
		let Name = Editor.document.fileName.split('/').pop()
		let Text = Editor.document.getText()
		if (allowSelectionExecution) {
			const Selection = Editor.selections
			if (Selection.length > 0) {
				Text = Text.substring(Selection[0].start.character, Selection[0].end.character)
			}
		}
		let Clients = 0
		Connections.forEach(Connection => {
			if (single && Clients >= 1 || Clients >= maxClients) return;
			const ID = `${rs.generate(7)}@${Name}`
			Connection.send(JSON.stringify({type: "script", script: Text, ID: ID}))
			Debug.appendLine(`[${Connection.User || "Awaiting Verfication"}]: Executing ${Name} as ${ID}`)
			Clients++
		})
	}))

	ResetTimeout()

	D1 = vs.window.onDidChangeActiveTextEditor(Editor => {
		const ID = Editor.document.languageId
		if (ID == "code-runner-output") {
			return;
		}
		if (strictLanguageExecution && (ID != "lua" && ID != "plaintext")) return;
		CurrentEditor = Editor
	})
	
	D2 = vs.workspace.onDidChangeConfiguration((Event) => {
		if (!Event.affectsConfiguration("vsexecute")) return;
		UpdateSettings()
	})

	UpdateLoop = setInterval(UpdateScript, 10000)

	UpdateScript()
	UpdateStatus()

	if (Item) return Item.show();

	Item = vs.window.createStatusBarItem(vs.StatusBarAlignment.Left)
	Item.text = "$(debug-start) Execute"
	Item.tooltip = "Execute Script"
	Item.command = "vsexecute.execute"
	Item.show()
}

function deactivate() {
	Server.close()
	UpdateStatus(null, true)
	for (let Connection in Connections) {
		Connections[Connection].terminate()
	}
	Item.hide()
	Item = Item.dispose()
	D1 = D1.dispose()
	D2 = D2.dispose()
	Timeout = clearInterval(Timeout)
	UpdateLoop = clearInterval(UpdateLoop)
}

UpdateSettings()
Output.appendLine("VSExecute is ready to go!")

module.exports = {
	activate,
	deactivate
}