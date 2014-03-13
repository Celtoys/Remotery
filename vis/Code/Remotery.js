
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

		// Create all windows
		this.Console = new Console(this.WindowManager);

		this.Server = new WebSocketConnection(this.Console);
		this.Server.Connect("ws://127.0.0.1:17815/remotery");

		// Hook up resize event handler
		DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
		OnResizeWindow(this);

		this.Console.Log("Remotery Created");
	}


	function OnResizeWindow(self)
	{
		// Resize windows
		self.Console.WindowResized(window.innerWidth, window.innerHeight);
	}


	return Remotery;
})();