
Remotery = (function()
{
	var BORDER = 10;

	var LOG_H = 200;


	function Remotery()
	{
		this.WindowManager = new WM.WindowManager();

		// Create the log window
		this.LogWindow = this.WindowManager.AddWindow("Log", 10, 10, 100, 100);
		this.LogContainer = this.LogWindow.AddControlNew(new WM.Container(10, 10, 780, 160));
		DOM.Node.AddClass(this.LogContainer.Node, "LogText");
		this.LogWindow.ShowNoAnim();

		// Hook up resize event handler
		DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
		OnResizeWindow(this);

		this.Log("Remotery Started");
	}


	Remotery.prototype.Log = function(text)
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
		var dest = this.LogContainer.Node;
		dest.innerHTML += text + "<br>";
		dest.scrollTop = dest.scrollHeight;
	}


	function OnResizeWindow(self)
	{
		// Resize windows
		self.LogWindow.SetPosition(BORDER, window.innerHeight - BORDER - 200);
		self.LogWindow.SetSize(window.innerWidth - 2 * BORDER, LOG_H);

		// Resize controls
		// TODO: This can not be done manually!
		// TODO: Take into account where user has moved the windows
		var parent_size = self.LogWindow.Size;
		self.LogContainer.SetPosition(BORDER, BORDER);
		self.LogContainer.SetSize(parent_size[0] - 2 * BORDER, parent_size[1] - 4 * BORDER);
	}


	return Remotery;
})();