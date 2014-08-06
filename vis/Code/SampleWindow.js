
SampleWindow = (function()
{
	function SampleWindow(wm, name, offset)
	{
		// Sample digest for checking if grid needs to be repopulated
		this.NbSamples = 0;
		this.SampleDigest = null;

		this.XPos = 10 + offset * 410;
		this.Window = wm.AddWindow(name, 100, 100, 100, 100);
		this.Window.Show();
		this.Visible = true;

		// Create a grid that's indexed by the unique sample ID
		this.Grid = this.Window.AddControlNew(new WM.Grid(0, 0, 380, 400));
		this.RootRow = this.Grid.Rows.Add({ "Name": "Samples" }, "GridGroup", { "Name": "GridGroup" });
		this.RootRow.Rows.AddIndex("_ID");
	}


	SampleWindow.prototype.SetXPos = function(xpos, top_window, bottom_window)
	{
		Anim.Animate(
			Bind(AnimatedMove, this, top_window, bottom_window),
			this.XPos, 10 + xpos * 410, 0.25);
	}


	function AnimatedMove(self, top_window, bottom_window, val)
	{
		self.XPos = val;
		self.WindowResized(top_window, bottom_window);
	}


	SampleWindow.prototype.SetVisible = function(visible)
	{
		if (visible != this.Visible)
		{
			if (visible == true)
				this.Window.Show();
			else
				this.Window.Hide();

			this.Visible = visible;
		}
	}


	SampleWindow.prototype.WindowResized = function(top_window, bottom_window)
	{
		var top = top_window.Position[1] + top_window.Size[1] + 10;
		this.Window.SetPosition(this.XPos, top_window.Position[1] + top_window.Size[1] + 10);
		this.Window.SetSize(400, bottom_window.Position[1] - 10 - top);
	}


	SampleWindow.prototype.OnSamples = function(nb_samples, sample_digest, samples)
	{
		if (this.NbSamples != nb_samples || this.SampleDigest != sample_digest)
		{
			// If the sample content changes, rebuild the grid
			this.NbSamples = nb_samples;
			this.SampleDigest = sample_digest;
			this.RootRow.Rows.Clear();

			if (this.Visible)
				AddSamples(this.RootRow, samples, "");
		}

		else if (this.Visible)
		{
			// Otherwise just update the existing sample data
			UpdateSamples(this.RootRow, samples);
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

			var cell_classes =
			{
				Name: "SampleNameCell",
			};

			var row = parent_row.Rows.Add(cell_data, null, cell_classes);
			row.CellData.Control.SetText(sample.us_length);

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
				row.CellData.Control.SetText(sample.us_length);

			UpdateSamples(parent_row, sample.children);
		}
	}


	return SampleWindow;
})();