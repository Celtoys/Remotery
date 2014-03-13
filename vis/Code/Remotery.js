
//
// TODO: Window resizing needs finer-grain control
// TODO: Take into account where user has moved the windows
// TODO: Controls need automatic resizing within their parent windows
//

Remotery = (function()
{
	function Remotery()
	{
		this.WindowManager = new WM.WindowManager();

		// Create the console up front as everything reports to it
		this.Console = new Console(this.WindowManager);

		// Connect to the server
		this.Server = new WebSocketConnection(this.Console);
		this.Server.Connect("ws://127.0.0.1:17815/remotery");

		// Create required windows
		this.TitleWindow = new TitleWindow(this.WindowManager, this.Server);

		// Hook up resize event handler
		DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
		OnResizeWindow(this);

		this.Console.Log("Remotery Created");
	}


	function OnResizeWindow(self)
	{
		// Resize windows
		var w = window.innerWidth;
		var h = window.innerHeight;
		self.Console.WindowResized(w, h);
		self.TitleWindow.WindowResized(w, h);
	}


	return Remotery;
})();