const Port = 13370

const vs = require('vscode')
const ws = require('ws')

const Output = vs.window.createOutputChannel("Execution Output")
Output.show()

const Server = new ws.Server({port: Port})
console.log(`Created Server @ Port ${Port}`)

let Connections = []
let Item

function Init(Socket) {
	Connections.push(Socket)
	Socket.on("message", Message => {
		let Data = JSON.parse(Message)
		Output.appendLine(`[${Data.Type} - ${Data.User}]: ${Data.Output}`)
	})
}

function activate(context) {
	console.log('VSExecute has been activated.');

	Server.on("connection", Init)

	context.subscriptions.push(vs.commands.registerCommand('vsexecute.execute', () => {
		// Execute
		let Editor = vs.window.activeTextEditor
		if (Editor) {
			for (let Connection in Connections) {
				Connections[Connection].send(JSON.stringify({type: "script", script: Editor.document.getText()}))
			}
		}
	}))

	if (Item) return;

	Item = vs.window.createStatusBarItem(vs.StatusBarAlignment.Left)
	Item.text = "$(debug-start) Execute"
	Item.tooltip = "Execute Script"
	Item.command = "vsexecute.execute"
	Item.show()
}

// This method is called when your extension is deactivated
function deactivate() {
	Server.close()
	for (let Connection in Connections) {
		Connections[Connection].terminate()
	}
	Item.hide()
	Item.dispose()
}

module.exports = {
	activate,
	deactivate
}