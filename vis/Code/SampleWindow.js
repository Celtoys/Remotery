
SampleWindow = (function()
{
	function SampleWindow(wm, server)
	{
		// Sample digest for checking if grid needs to be repopulated
		this.NbSamples = 0;
		this.SampleDigest = null;

		this.Window = wm.AddWindow("Samples", 100, 100, 100, 100);
		this.Window.ShowNoAnim();

		// Create a grid that's indexed by the unique sample ID
		this.Grid = this.Window.AddControlNew(new WM.Grid(0, 0, 380, 480));
		this.RootRow = this.Grid.Rows.Add({ "Name": "Samples" }, "GridGroup", "GridGroup");
		this.RootRow.Rows.AddIndex("_ID");

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
		if (self.NbSamples != message.nb_samples || self.SampleDigest != message.sample_digest)
		{
			// If the sample content changes, rebuild the grid
			self.NbSamples = message.nb_samples;
			self.SampleDigest = message.sample_digest;
			self.RootRow.Rows.Clear();
			AddSamples(self.RootRow, message.samples, "");
		}

		else
		{
			// Otherwise just update the existing sample data
			UpdateSamples(self.RootRow, message.samples);
		}
	}


	function AddSamples(parent_row, samples, indent)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			var cell_data =
			{
				_ID: sample.id,
				Name: indent + sample.name,
				Control: new WM.Label()
			};

			var row = parent_row.Rows.Add(cell_data);
			row.CellData.Control.SetText(sample.cpu_us_length);

			AddSamples(parent_row, sample.children, indent + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");
		}
	}


	function UpdateSamples(parent_row, samples)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			var row = parent_row.Rows.GetBy("_ID", sample.id);
			if (row)
				row.CellData.Control.SetText(sample.cpu_us_length);

			UpdateSamples(parent_row, sample.children);
		}
	}


	return SampleWindow;
})();