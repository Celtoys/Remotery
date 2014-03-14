
Console = (function()
{
	var BORDER = 10;
	var HEIGHT = 200;


	function Console(wm, server)
	{
		// Create the window and its controls
		this.Window = wm.AddWindow("Console", 10, 10, 100, 100);
		this.PageContainer = this.Window.AddControlNew(new WM.Container(10, 10, 400, 160));
		DOM.Node.AddClass(this.PageContainer.Node, "ConsoleText");
		this.AppContainer = this.Window.AddControlNew(new WM.Container(10, 10, 400, 160));
		DOM.Node.AddClass(this.AppContainer.Node, "ConsoleText");
		this.Window.ShowNoAnim();

		// Setup log requests from the server
		server.SetConsole(this);
		server.AddMessageHandler("LOG", Bind(OnLog, this));
	}


	Console.prototype.Log = function(text)
	{
		LogText(this.PageContainer, text);
	}


	Console.prototype.WindowResized = function(width, height)
	{
		// Place window
		this.Window.SetPosition(BORDER, height - BORDER - 200);
		this.Window.SetSize(width - 2 * BORDER, HEIGHT);

		// Place controls
		var parent_size = this.Window.Size;
		var mid_w = parent_size[0] / 3;
		this.PageContainer.SetPosition(BORDER, BORDER);
		this.PageContainer.SetSize(mid_w - 2 * BORDER, parent_size[1] - 4 * BORDER);
		this.AppContainer.SetPosition(mid_w, BORDER);
		this.AppContainer.SetSize(parent_size[0] - mid_w - BORDER, parent_size[1] - 4 * BORDER);
	}


	function OnLog(self, socket, message)
	{
		LogText(self.AppContainer, message.text);
	}


	function LogText(container, text)
	{
		// Filter the text a little to make it safer
		if (text == null)
			text = "NULL";

		// Find and convert any HTML entities, ensuring the browser doesn't parse any embedded HTML code
		// This also allows the log to contain arbitrary C++ code (e.g. assert comparison operators)
		text = Convert.string_to_html_entities(text);

		var d = new Date();
		text = "[" + d.toLocaleTimeString() + "] " + text;

		// Append the text as html
		var dest = container.Node;
		dest.innerHTML += text + "<br>";
		dest.scrollTop = dest.scrollHeight;
	}


	return Console;
})();
