
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

		this.Server = new WebSocketConnection(this.Console);

		// Create required windows
		this.TitleWindow = new TitleWindow(this.WindowManager, this.Server);

		// Kick-off the auto-connect loop
		AutoConnect(this);

		// Hook up resize event handler
		DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
		OnResizeWindow(this);

		this.Console.Log("Remotery Created");
	}


	function AutoConnect(self)
	{
		// Only attempt to connect if there isn't already a connection or an attempt to connect
		if (!self.Server.Connected())
			self.Server.Connect("ws://127.0.0.1:17815/remotery");

		// Always schedule another check
		window.setTimeout(Bind(AutoConnect, self), 5000);
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