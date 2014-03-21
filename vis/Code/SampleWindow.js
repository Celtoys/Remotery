
SampleWindow = (function()
{
	function SampleWindow(wm, server)
	{
		this.Window = wm.AddWindow("Samples", 100, 100, 100, 100);
		this.Window.ShowNoAnim();

		this.Grid = this.Window.AddControlNew(new WM.Grid(0, 0, 380, 480));
		this.RootRow = this.Grid.Rows.Add({ "Name": "Samples" }, "GridGroup", "GridGroup");

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
		var row = self.RootRow;
		row.Rows.Clear();

		AddSamples(row, message.samples, "");
	}


	function AddSamples(parent_row, samples, indent)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			var row = parent_row.Rows.Add({ "Name": indent + sample.name, "Control": new WM.Label() });
			row.CellData.Control.SetText(sample.cpu_us_length);

			AddSamples(parent_row, sample.children, indent + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");
		}
	}


	return SampleWindow;
})();