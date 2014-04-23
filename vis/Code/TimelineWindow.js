
TimelineRow = (function()
{
	var row_template = "								\
		<div class='TimelineRow'>						\
			<div class='TimelineRowLabel'></div>		\
			<div class='TimelineRowDataContainer'>		\
				<div class='TimelineRowData'></div>		\
			</div>										\
		</div>";

	function TimelineRow(name, parent_node)
	{
		this.Name = name;

		// Create the row HTML and add to the parent
		this.ContainerNode = DOM.Node.CreateHTML(row_template);
		this.Node = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowData");
		this.LabelNode = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowLabel");
		this.LabelNode.innerHTML = name;
		parent_node.appendChild(this.ContainerNode);
	}

	return TimelineRow;
})();


TimelineWindow = (function()
{
	var BORDER = 10;

	var box_template = "<div class='TimelineBox'></div>";


	function TimelineWindow(wm, server)
	{
		// The visible time range - only modify with SetTimeRange
		this.TimeStart_us = 0;
		this.TimeSpan_us = 0;
		this.TimeEnd_us = 0;
		this.usPerPixel = 0;

		this.MinTime_us = 0;

		// Ordered list of known thread names for consistent placement on the timeline
		this.ThreadNames = [ ];
		this.ThreadRows = [ ];

		// Create window and containers
		this.Window = wm.AddWindow("Timeline", 10, 10, 100, 100);
		this.Window.ShowNoAnim();
		this.TimelineContainer = this.Window.AddControlNew(new WM.Container(10, 10, 800, 160));
		DOM.Node.AddClass(this.TimelineContainer.Node, "TimelineContainer");

		// Set time range AFTER the window has been created, as it uses the window to determine pixel coverage
		SetTimeRange(this, 0, 2 * 1000 * 1000);
	}


	TimelineWindow.prototype.WindowResized = function(width, height, top_window)
	{
		// Resize window
		var top = top_window.Position[1] + top_window.Size[1] + 10;
		this.Window.SetPosition(10, top);
		this.Window.SetSize(width - 2 * 10, 100);

		// Resize controls
		var parent_size = this.Window.Size;
		this.TimelineContainer.SetPosition(BORDER, BORDER);
		this.TimelineContainer.SetSize(parent_size[0] - 2 * BORDER, parent_size[1] - 4 * BORDER);

		// Adjust time range to new width
		SetTimeRange(this, this.TimeStart_us, this.TimeSpan_us);
	}


	TimelineWindow.prototype.OnSamples = function(message)
	{
		// Search for the index of this thread
		var name = message.thread_name;
		var thread_index = -1;
		for (var i in this.ThreadRows)
		{
			if (this.ThreadRows[i].Name == name)
			{
				thread_index = i;
				break;
			}
		}

		// If this thread has not been seen before, add a new row to the list and re-sort
		if (thread_index == -1)
		{
			var row = new TimelineRow(name, this.TimelineContainer.Node);
			this.ThreadRows.push(row);
			this.ThreadRows.sort(function(a, b) { return b.localeCompare(a); });

			// Search again for this new index
			for (var i in this.ThreadRows)
			{
				if (this.ThreadRows[i].Name == name)
				{
					thread_index = i;
					break;
				}
			}			
		}

		// For now, iterate all top-level samples
		for (var i in message.samples)
		{
			var sample = message.samples[i];
			AddSample(this, sample, this.ThreadRows[thread_index]);
		}
	}


	function SetTimeRange(self, start, span)
	{
		self.TimeStart_us = start;
		self.TimeSpan_us = span;
		self.TimeEnd_us = self.TimeStart_us + span;
		self.usPerPixel = ContainerWidth(self) / self.TimeSpan_us;
	}


	function GetTimePixelOffset(self, time_us)
	{
		return Math.floor((time_us - self.TimeStart_us) * self.usPerPixel);
	}


	function AddSample(self, sample, thread_row)
	{
		// Keep track of the first sample received
		if (self.MinTime_us == 0)
		{
			self.MinTime_us = sample.cpu_us_start;
			SetTimeRange(self, self.MinTime_us, self.TimeSpan_us);
		}

		// Determine location of the sample
		var offset_x = GetTimePixelOffset(self, sample.cpu_us_start);
		var offset_y = 2;
		var size_x = sample.cpu_us_length * self.usPerPixel;

		// Add a node to represent the sample
		if (offset_x < ContainerWidth(self))
		{
			var node = DOM.Node.CreateHTML(box_template);
			DOM.Node.SetPosition(node, [ offset_x, offset_y ] );
			DOM.Node.SetSize(node, [ size_x, 10 ] );
			thread_row.Node.appendChild(node);
		}
	}


	function ContainerWidth(self)
	{
		// 2px border on left/right of timeline rows
		return self.TimelineContainer.Size[0] - 4;
	}


	return TimelineWindow;
})();