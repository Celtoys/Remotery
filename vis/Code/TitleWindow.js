
TitleWindow = (function()
{
	function TitleWindow(wm, server)
	{
		this.Window = wm.AddWindow("Remotery", 10, 10, 100, 100);
		this.PingContainer = this.Window.AddControlNew(new WM.Container(5, 5, 10, 20));
		DOM.Node.AddClass(this.PingContainer.Node, "PingContainer");
		this.Window.ShowNoAnim();

		server.AddMessageHandler("PING", Bind(OnPing, this));
	}


	TitleWindow.prototype.WindowResized = function(width, height)
	{
		this.Window.SetSize(width - 2 * 10, 50);
	}


	function OnPing(self, server)
	{
		DOM.Node.AddClass(self.PingContainer.Node, "PingContainerActive");

		window.setTimeout(Bind(function(self)
		{
			DOM.Node.RemoveClass(self.PingContainer.Node, "PingContainerActive");
		}, self), 500);
	}


	return TitleWindow;
})();