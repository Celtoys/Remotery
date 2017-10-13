
TitleWindow = (function()
{
	function TitleWindow(wm, settings, server, connection_address, save_handler, load_handler)
	{
		this.Settings = settings;
		this.save_handler = save_handler;
		this.load_handler = load_handler;

		this.Window = wm.AddWindow("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remotery", 10, 10, 100, 100);
		this.Window.ShowNoAnim();

		this.PingContainer = this.Window.AddControlNew(new WM.Container(4, -13, 10, 10));
		DOM.Node.AddClass(this.PingContainer.Node, "PingContainer");

		this.EditBox = this.Window.AddControlNew(new WM.EditBox(10, 5, 300, 18, "Connection Address", connection_address));

		// Setup pause button
		this.PauseButton = this.Window.AddControlNew(new WM.Button("Pause", 5, 5, { toggle: true }));
		this.PauseButton.SetOnClick(Bind(OnPausePressed, this));

		this.SaveButton = this.Window.AddControlNew(new WM.Button("Save", 5, 15, { toggle: false }));
		this.SaveButton.SetOnClick(Bind(OnSavePressed, this));

		this.LoadButton = this.Window.AddControlNew(new WM.Button("Load", 5, 25, { toggle: false }));
		this.LoadButton.SetOnClick(Bind(OnLoadPressed, this));

		server.AddMessageHandler("PING", Bind(OnPing, this));
	}


	TitleWindow.prototype.SetConnectionAddressChanged = function(handler)
	{
		this.EditBox.SetChangeHandler(handler);
	}


	TitleWindow.prototype.WindowResized = function(width, height)
	{
		this.Window.SetSize(width - 2 * 10, 50);
		this.PauseButton.SetPosition(width - 80, 5);
		this.SaveButton.SetPosition(width - 120, 5);
		this.LoadButton.SetPosition(width - 160, 5);
	}


	function OnPausePressed(self)
	{
		self.Settings.IsPaused = self.PauseButton.IsPressed();
		if (self.Settings.IsPaused)
			self.PauseButton.SetText("Paused");
		else
			self.PauseButton.SetText("Pause");
	}

	function OnFileSelected(self, event)
	{
	   if (window.FileReader == null)
        {
        	console.log("FileReader not supported on this browser")
        	return 
        }

        var oFReader = new FileReader();
        var input = event.target;
        var file = input.files.item(0);

        oFReader.onloadend = function (event) 
        {
            //document.getElementById("uploadTextValue").value = oFREvent.target.result; 
            //document.getElementById("obj").data = oFREvent.target.result;
            if (self.load_handler)
				self.load_handler(event.target.result)
        };

        if (file)
        {
	    	oFReader.readAsArrayBuffer(file);
		}
		else
		{
			console.log(" File is not a file" + file + " file "+ input.files[0])
		}
	}

	function OnLoadPressed(self)
	{
		// creating input on-the-fly
        var input = document.createElement("input");
        input.setAttribute('type', 'file');
        // add onchange handler if you wish to get the file :)
        input.addEventListener('change', Bind(OnFileSelected, self));
        input.click(); // opening dialog
	}

	function OnSavePressed(self)
	{

		if (self.save_handler)
			self.save_handler()
	}


	function OnPing(self, server)
	{
		// Set the ping container as active and take it off half a second later
		DOM.Node.AddClass(self.PingContainer.Node, "PingContainerActive");
		window.setTimeout(Bind(function(self)
		{
			DOM.Node.RemoveClass(self.PingContainer.Node, "PingContainerActive");
		}, self), 500);
	}


	return TitleWindow;
})();