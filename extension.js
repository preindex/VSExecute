const Port = 13370

const vs = require('vscode')
const ws = require('ws')
const rs = require('randomstring')

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
let Item, D1, D2
let Timeout, CurrentEditor

let maxClients
let single
let alertExecution
let allowBackupEditors
let allowSelectionExecution
let strictLanguageExecution

function UpdateSettings() {
	const Config = vs.workspace.getConfiguration("vsexecute")
	maxClients = Config.get("maxClients")
	single = Config.get("singleExecution")
	alertExecution = Config.get("alertExecution")
	allowBackupEditors = Config.get("allowBackupEditors")
	allowSelectionExecution = Config.get("allowSelectionExecution")
	strictLanguageExecution = Config.get("strictLanguageExecution")
}

UpdateSettings()

function Init(Socket) {
	Connections.push(Socket)
	Socket.Updated = true
	Socket.on("message", Message => {
		let Data = JSON.parse(Message)
		if (!Socket.User) {
			Connections.forEach(Connection => {
				if (Connection.User == Data.User) {
					Connection.terminate();
					const Index = Connections.indexOf(Connection)
					Connections.splice(Index, Index + 1)
                    return;
                }
			})
			Socket.User = Data.User
		}
		if (Data.Type == "KeepAlive") {
			Socket.Updated = true
			return;
		}
		const Final = `${Emojis[Data.Type]} [${Data.Type} - ${Data.User}] (${Data.ID || "No ID"}): ${Data.Args.join(" ")}`
		if (Data.Debug) {
			Debug.appendLine(Final)
			return;
		}
		if (Data.Type == "CLIENT" && alertExecution) return;
		if (Data.Type == "ERROR") {
			vs.window.showErrorMessage("An error occured. See the Execution Output for details.")
		}
		Output.appendLine(Final)
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

	Timeout = setInterval(() => {
		Connections.forEach(Connection => {
			if (!Connection.Updated) {
				Connection.terminate();
				const Index = Connections.indexOf(Connection)
				Connections.splice(Index, Index + 1)
				return
			}
			Connection.Updated = false
			Connection.send(JSON.stringify({type: "keepalive"}))
		})
	}, 5000)

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
	
	if (Item) return Item.show();

	Item = vs.window.createStatusBarItem(vs.StatusBarAlignment.Left)
	Item.text = "$(debug-start) Execute"
	Item.tooltip = "Execute Script"
	Item.command = "vsexecute.execute"
	Item.show()
}

function deactivate() {
	Server.close()
	for (let Connection in Connections) {
		Connections[Connection].terminate()
	}
	Item.hide()
	Item = Item.dispose()
	D1 = D1.dispose()
	D2 = D2.dispose()
	clearTimeout(Timeout)
}

Output.appendLine("VSExecute is ready to go!")

module.exports = {
	activate,
	deactivate
}