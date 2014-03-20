
SampleWindow = (function()
{
	function SampleWindow(wm, server)
	{
		this.Window = wm.AddWindow("Samples", 100, 100, 100, 100);
		this.Window.ShowNoAnim();

		this.Grid = this.Window.AddControlNew(new WM.Grid(0, 0, 380, 480));
		this.RootRow = this.Grid.AddGroup("Samples");

		server.AddMessageHandler("SAMPLES", Bind(OnSamples, this));
	}


	SampleWindow.prototype.WindowResized = function(width, height, top_window, bottom_window)
	{
		var top = top_window.Position[1] + top_window.Size[1] + 10;
		this.Window.SetPosition(10, top_window.Position[1] + top_window.Size[1] + 10);
		this.Window.SetSize(400, bottom_window.Position[1] - 10 - top);
	}


	function OnSamples(self, socket, message)
	{
		self.RootRow.ClearRows();

		AddSamples(self.RootRow, message.samples);
	}


	function AddSamples(parent_row, samples)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			var row = parent_row.AddRow(sample.name, new WM.Label());
			row.Control.SetText(sample.cpu_us_length);

			AddSamples(row, sample.children);
		}
	}


	return SampleWindow;
})();