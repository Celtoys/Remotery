
Console = (function()
{
	var BORDER = 10;
	var HEIGHT = 200;


	function Console(wm)
	{
		// Create the window and its controls
		this.Window = wm.AddWindow("Console", 10, 10, 100, 100);
		this.Container = this.Window.AddControlNew(new WM.Container(10, 10, 780, 160));
		DOM.Node.AddClass(this.Container.Node, "ConsoleText");
		this.Window.ShowNoAnim();
	}


	Console.prototype.Log = function(text)
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
		var dest = this.Container.Node;
		dest.innerHTML += text + "<br>";
		dest.scrollTop = dest.scrollHeight;
	}


	Console.prototype.WindowResized = function(width, height)
	{
		// Place window
		this.Window.SetPosition(BORDER, height - BORDER - 200);
		this.Window.SetSize(width - 2 * BORDER, HEIGHT);

		// Place controls
		var parent_size = this.Window.Size;
		this.Container.SetPosition(BORDER, BORDER);
		this.Container.SetSize(parent_size[0] - 2 * BORDER, parent_size[1] - 4 * BORDER);
	}


	return Console;
})();
