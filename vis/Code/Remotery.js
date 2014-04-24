
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

		this.ConnectionAddress = LocalStore.Get("App", "Global", "ConnectionAddress", "ws://127.0.0.1:17815/rmt");
		this.Server = new WebSocketConnection();
		this.Server.AddConnectHandler(Bind(OnConnect, this));

		// Create the console up front as everything reports to it
		this.Console = new Console(this.WindowManager, this.Server);

		// Create required windows
		this.TitleWindow = new TitleWindow(this.WindowManager, this.Server, this.ConnectionAddress);
		this.TitleWindow.SetConnectionAddressChanged(Bind(OnAddressChanged, this));
		this.TimelineWindow = new TimelineWindow(this.WindowManager, this.Server);
		this.TimelineWindow.SetOnHover(Bind(OnSampleHover, this));
		this.TimelineWindow.SetOnSelected(Bind(OnSampleSelected, this));

		this.NbSampleWindows = 0;
		this.SampleWindows = { };
		this.FrameHistory = { };
		this.SelectedFrame = null;

		this.Server.AddMessageHandler("SAMPLES", Bind(OnSamples, this));

		// Kick-off the auto-connect loop
		AutoConnect(this);

		// Hook up resize event handler
		DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
		OnResizeWindow(this);
	}


	function AutoConnect(self)
	{
		// Only attempt to connect if there isn't already a connection or an attempt to connect
		if (!self.Server.Connected())
			self.Server.Connect(self.ConnectionAddress);

		// Always schedule another check
		window.setTimeout(Bind(AutoConnect, self), 2000);
	}


	function OnConnect(self)
	{
		// Connection address has been validated
		LocalStore.Set("App", "Global", "ConnectionAddress", self.ConnectionAddress);
	}


	function OnAddressChanged(self, node)
	{
		// Update and disconnect, relying on auto-connect to reconnect
		self.ConnectionAddress = node.value;
		self.Server.Disconnect();
	}


	function OnSamples(self, socket, message)
	{
		var name = message.thread_name;

		// Add to frame history for this thread
		var thread_frame = new ThreadFrame(message);
		if (!(name in self.FrameHistory))
			self.FrameHistory[name] = [ ];
		self.FrameHistory[name].push(thread_frame);

		if (self.TitleWindow.Paused)
			return;

		// Create sample windows on-demand
		if (!(name in self.SampleWindows))
		{
			self.SampleWindows[name] = new SampleWindow(self.WindowManager, name, self.NbSampleWindows);
			self.SampleWindows[name].WindowResized(window.innerWidth, window.innerHeight, self.TimelineWindow.Window, self.Console.Window);
			self.NbSampleWindows++;
		}

		// Set on the window and timeline
		self.SampleWindows[name].OnSamples(message.nb_samples, message.sample_digest, message.samples);
		self.TimelineWindow.OnSamples(name, self.FrameHistory[name]);
	}


	function OnSampleHover(self, thread_name, hover)
	{
		// Hover only changes sample window contents when paused
		var sample_window = self.SampleWindows[thread_name];
		if (sample_window && self.TitleWindow.Paused)
		{
			if (hover == null)
			{
				// When there's no hover, go back to the selected frame
				if (this.SelectedFrame)
					sample_window.OnSamples(this.SelectedFrame.NbSamples, this.SelectedFrame.SampleDigest, this.SelectedFrame.Samples);
			}

			else
			{
				// Populate with sample under hover
				var frame = hover[0];
				sample_window.OnSamples(frame.NbSamples, frame.SampleDigest, frame.Samples);
			}
		}
	}


	function OnSampleSelected(self, thread_name, select)
	{
		// Lookup sample window set the frame samples on it
		if (select && thread_name in self.SampleWindows)
		{
			var sample_window = self.SampleWindows[thread_name];
			this.SelectedFrame = select[0];
			sample_window.OnSamples(this.SelectedFrame.NbSamples, this.SelectedFrame.SampleDigest, this.SelectedFrame.Samples);
		}
	}


	function OnResizeWindow(self)
	{
		// Resize windows
		var w = window.innerWidth;
		var h = window.innerHeight;
		self.Console.WindowResized(w, h);
		self.TitleWindow.WindowResized(w, h);
		self.TimelineWindow.WindowResized(w, h, self.TitleWindow.Window);
		for (var i in self.SampleWindows)
			self.SampleWindows[i].WindowResized(w, h, self.TimelineWindow.Window, self.Console.Window);
	}


	return Remotery;
})();