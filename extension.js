const Port = 13370

const vs = require('vscode')
const ws = require('ws')
const rs = require('randomstring')

const Output = vs.window.createOutputChannel("Execution Output")
Output.show()

const Debug = vs.window.createOutputChannel("Execution Output - Debug")

const Server = new ws.Server({port: Port})
console.log(`Created Server @ Port ${Port}`)

let Connections = []
let Item, Timeout

function Init(Socket) {
	Connections.push(Socket)
	Socket.Updated = true
	Socket.on("message", Message => {
		let Data = JSON.parse(Message)
		if (!Socket.User) {
			Socket.User = Data.User
		}
		if (Data.Type == "KeepAlive") {
			Socket.Updated = true
			return;
		}
		const Final = `[${Data.Type} - ${Data.User}] (${Data.ID || "No ID"}): ${Data.Args.join(" ")}`
		if (Data.Debug) {
			Debug.appendLine(Final)
			return;
		}
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
		// Execute
		let Editor = vs.window.activeTextEditor
		if (Editor.document.languageId == "code-runner-output" || !Editor) {
			let Editors = vs.window.visibleTextEditors
			if (Editors < 2) return;
			Editor = null;
			vs.window.visibleTextEditors.forEach(VisibleEditor => {
				if (VisibleEditor.document.languageId == "lua") {
					Editor = VisibleEditor
					return;
				}
			})
			if (!Editor) return;
		}
		let Name = Editor.document.fileName.split('/').pop()
		let Text = Editor.document.getText()
		Connections.forEach(Connection => {
			const ID = `${rs.generate(7)}@${Name}`
			Connection.send(JSON.stringify({type: "script", script: Text, ID: ID}))
			Debug.appendLine(`[${Connection.User || "Awaiting Verfication"}]: Executing ${Name} as ${ID}`)
		})
	}))

	Timeout = setInterval(() => {
		Connections.forEach(Connection => {
			if (!Connection.Updated) {
				Connection.terminate();
				const Index = Connections.indexOf(Value);
				Connections.splice(Index, Index + 1)
				return;
			}
			Connection.Updated = false
			Connection.send(JSON.stringify({type: "keepalive"}))
		})
	}, 5000)

	if (Item) return;

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
	Item.dispose()
	clearTimeout(Timeout)
}

Output.appendLine("[OUTPUT - Alpha_Guardians] (Centauri.luau@vnXHn3): This is a test!")

module.exports = {
	activate,
	deactivate
}