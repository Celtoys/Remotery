
SampleRoot = (function()
{
	function SampleRoot(grid, name)
	{
		this.NbSamples = 0;
		this.SampleDigest = null;

		// Create a set of rows indexed by the unique sample ID
		this.RootRow = grid.Rows.Add({ "Name": name }, "GridGroup", { "Name": "GridGroup" });
		this.RootRow.Rows.AddIndex("_ID");
	}


	SampleRoot.prototype.OnSamples = function(nb_samples, sample_digest, samples)
	{
		// Recreate all the HTML if the number of samples gets bigger
		if (nb_samples > this.NbSamples)
			SetNbSamples(this, nb_samples);

		// If the content of the samples changes from previous update, update them all
		if (this.SampleDigest != sample_digest)
		{
			this.RootRow.Rows.ClearIndex("_ID");
			var index = UpdateSamples(this, samples, 0, "");
			this.SampleDigest = sample_digest;

			// Clear out any left-over rows
			for (var i = index; i < this.RootRow.Rows.Rows.length; i++)
			{
				var row = this.RootRow.Rows.Rows[i];
				DOM.Node.Hide(row.Node);
			}
		}

		else
		{
			// Otherwise just update the existing sample times
			UpdateSampleTimes(this, samples);
		}
	}


	function SetNbSamples(self, nb_samples)
	{
		self.RootRow.Rows.Clear();

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

			self.RootRow.Rows.Add(cell_data, null, cell_classes);
		}

		self.NbSamples = nb_samples;
	}


	function UpdateSamples(self, samples, index, indent)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			// Match row allocation in GrowGrid
			var row = self.RootRow.Rows.Rows[index++];

			// Sample row may have been hidden previously
			DOM.Node.Show(row.Node);
			
			// Assign unique ID so that the common fast path of updating sample times only
			// can lookup target samples in the grid
			row.CellData._ID = sample.id;
			self.RootRow.Rows.AddRowToIndex("_ID", sample.id, row);

			// Set sample name and colour
			var name_node = row.CellNodes["Name"];
			name_node.innerHTML = indent + sample.name;
			DOM.Node.SetColour(name_node, sample.colour);

			row.CellData.Control.SetText(sample.us_length);

			index = UpdateSamples(self, sample.children, index, indent + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");
		}

		return index;
	}


	function UpdateSampleTimes(self, samples)
	{
		for (var i in samples)
		{
			var sample = samples[i];

			var row = self.RootRow.Rows.GetBy("_ID", sample.id);
			if (row)
				row.CellData.Control.SetText(sample.us_length);

			UpdateSampleTimes(self, sample.children);
		}
	}


	return SampleRoot;
})();


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

		// A dictionary of grouped samples
		this.SampleRoots = { };

		// Create a grid that's indexed by the unique sample ID
		this.Grid = this.Window.AddControl(new WM.Grid(0, 0, 380, 400));
		this.Grid.AnchorWidthToParent(20);
		this.Grid.AnchorHeightToParent(20);
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
		if (nb_samples == 0)
			return;

		// TODO: Handle Select in Timeline
		// TODO: Discard old sample roots after timeout
		// TODO: Revisit whether a "GridGroup" CSS per sample root is the right choice

		// Add roots on demand
		var root_name = samples[0].name;
		if (!(root_name in this.SampleRoots))
		{
			var sample_root = new SampleRoot(this.Grid, root_name);
			this.SampleRoots[root_name] = sample_root;
		}

		// Dispatch to sample root
		var sample_root = this.SampleRoots[root_name];
		sample_root.OnSamples(nb_samples, sample_digest, samples);
	}


	return SampleWindow;
})();