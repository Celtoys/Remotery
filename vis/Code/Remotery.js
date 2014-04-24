
//
// TODO: Window resizing needs finer-grain control
// TODO: Take into account where user has moved the windows
// TODO: Controls need automatic resizing within their parent windows
//


ThreadFrame = (function()
{
	function ThreadFrame(message)
	{
		// Persist the required message data
		this.NbSamples = message.nb_samples;
		this.SampleDigest = message.sample_digest;
		this.Samples = message.samples;

		// Calculate the frame start/end times
		this.StartTime_us = 0;
		this.EndTime_us = 0;
		var nb_root_samples = this.Samples.length;
		if (nb_root_samples > 0)
		{
			var last_sample = this.Samples[nb_root_samples - 1];
			this.StartTime_us = this.Samples[0].cpu_us_start;
			this.EndTime_us = last_sample.cpu_us_start + last_sample.cpu_us_length;
		}

		this.Length_us = this.EndTime_us - this.StartTime_us;
	}


	return ThreadFrame;
})();

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

		this.NbSampleWindows = 0;
		this.SampleWindows = { };
		this.FrameHistory = { };

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
		// Lookup the thread these samples are for
		var name = message.thread_name;
		if (!(name in self.SampleWindows))
		{
			self.SampleWindows[name] = new SampleWindow(self.WindowManager, name, self.NbSampleWindows);
			self.SampleWindows[name].WindowResized(window.innerWidth, window.innerHeight, self.TimelineWindow.Window, self.Console.Window);
			self.FrameHistory[name] = [ ];
			self.NbSampleWindows++;
		}

		// Set on the window
		self.SampleWindows[name].OnSamples(socket, message.nb_samples, message.sample_digest, message.samples);

		var thread_frame = new ThreadFrame(message);
		self.FrameHistory[name].push(thread_frame);

		self.TimelineWindow.OnSamples(name, self.FrameHistory[name]);
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