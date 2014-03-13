
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

		// Hook up resize event handler
		DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
		OnResizeWindow(this);

		this.Console.Log("Remotery Started");
	}


	function OnResizeWindow(self)
	{
		// Resize windows
		self.Console.WindowResized(window.innerWidth, window.innerHeight);
	}


	return Remotery;
})();