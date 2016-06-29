
SampleWindow = (function()
{
	function SampleWindow(wm, name)
	{
		this.Name = name;

		// Sample digest for checking if grid needs to be repopulated
		this.NbSamples = 0;
		this.SampleDigest = null;

		this.Window = wm.AddWindow(name, 100, 100, 100, 100);
		this.Visible = true;

		// This initially be set but true but it would currently require the sample window to disable
		// it when it gets added to a tab. Not sure how best to fix that right now.
		// TODO: Fix.
		this.AllowUpdate = false;

		// Create a grid that's indexed by the unique sample ID
		this.Grid = this.Window.AddControl(new WM.Grid(0, 0, 380, 400));
		this.Grid.AnchorWidthToParent(20);
		this.Grid.AnchorHeightToParent(20);
		this.RootRow = this.Grid.Rows.Add({ "Name": "Samples" }, "GridGroup", { "Name": "GridGroup" });
		this.RootRow.Rows.AddIndex("_ID");
	}


	SampleWindow.prototype.SetPosition = function(x, y)
	{
		this.Window.SetPosition(x, y);
	}


	SampleWindow.prototype.SetSize = function(width, height)
	{
		this.Window.SetSize(width, height);
		this.Grid.SetSize(width - 20, height - 20);
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


	SampleWindow.prototype.SetAllowUpdate = function(allow_update)
	{
		this.AllowUpdate = allow_update;
	}


	SampleWindow.prototype.OnSamples = function(nb_samples, sample_digest, samples)
	{
		if (!this.Visible || !this.AllowUpdate)
			return;

		// Recreate all the HTML if the number of samples gets bigger
		if (nb_samples > this.NbSamples)
		{
			GrowGrid(this.RootRow, nb_samples);
			this.NbSamples = nb_samples;
		}

		// If the content of the samples changes from previous update, update them all
		if (this.SampleDigest != sample_digest)
		{
			this.RootRow.Rows.ClearIndex("_ID");
			var index = UpdateSamples(this.RootRow, samples, 0, "");
			this.SampleDigest = sample_digest;

			// Clear out any left-over rows
			for (var i = index; i < this.RootRow.Rows.Rows.length; i++)
			{
				var row = this.RootRow.Rows.Rows[i];
				DOM.Node.Hide(row.Node);
			}
		}

		else if (this.Visible)
		{
			// Otherwise just update the existing sample times
			UpdateSampleTimes(this.RootRow, samples);
		}
	}


	function GrowGrid(parent_row, nb_samples)
	{
		parent_row.Rows.Clear();

		for (var i = 0; i < nb_samples; i++)
		{
			var cell_data =
			{
				_ID: i,
				Name: "",
				Control: new WM.Label()
			};

			var cell_classes =
			{
				Name: "SampleNameCell",
			};

			parent_row.Rows.Add(cell_data, null, cell_classes);
		}
	}


	function UpdateSamples(parent_row, samples, index, indent)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			// Match row allocation in GrowGrid
			var row = parent_row.Rows.Rows[index++];

			// Sample row may have been hidden previously
			DOM.Node.Show(row.Node);
			
			// Assign unique ID so that the common fast path of updating sample times only
			// can lookup target samples in the grid
			row.CellData._ID = sample.id;
			parent_row.Rows.AddRowToIndex("_ID", sample.id, row);

			// Set sample name and colour
			var name_node = row.CellNodes["Name"];
			name_node.innerHTML = indent + sample.name;
			DOM.Node.SetColour(name_node, sample.colour);

			row.CellData.Control.SetText(sample.us_length);

			index = UpdateSamples(parent_row, sample.children, index, indent + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");
		}

		return index;
	}


	function UpdateSampleTimes(parent_row, samples)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			var row = parent_row.Rows.GetBy("_ID", sample.id);
			if (row)
				row.CellData.Control.SetText(sample.us_length);

			UpdateSampleTimes(parent_row, sample.children);
		}
	}


	return SampleWindow;
})();