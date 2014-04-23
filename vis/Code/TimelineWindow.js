
//
// TODO: Use WebGL and instancing for quicker renders
//


PixelTimeRange = (function()
{
	function PixelTimeRange(start_us, span_us, span_px)
	{
		this.Span_px = span_px;
		this.Set(start_us, span_us);
	}


	PixelTimeRange.prototype.Set = function(start_us, span_us)
	{
		this.Start_us = start_us;
		this.Span_us = span_us;
		this.End_us = this.Start_us + span_us;
		this.usPerPixel = this.Span_px / this.Span_us;
	}


	PixelTimeRange.prototype.SetStart = function(start_us)
	{
		this.Start_us = start_us;
		this.End_us = start_us + this.Span_us;
	}


	PixelTimeRange.prototype.SetEnd = function(end_us)
	{
		this.End_us = end_us;
		this.Start_us = end_us - this.Span_us;
	}


	PixelTimeRange.prototype.SetPixelSpan = function(span_px)
	{
		this.Span_px = span_px;
		this.usPerPixel = this.Span_px / this.Span_us;
	}


	PixelTimeRange.prototype.PixelOffset = function(time_us)
	{
		return Math.floor((time_us - this.Start_us) * this.usPerPixel);
	}


	PixelTimeRange.prototype.PixelSize = function(time_us)
	{
		return time_us * this.usPerPixel;
	}


	return PixelTimeRange;
})();


TimelineRow = (function()
{
	var row_template = "								\
		<div class='TimelineRow'>						\
			<div class='TimelineRowLabel'></div>		\
			<canvas class='TimelineRowCanvas'></canvas>		\
		</div>";

	function TimelineRow(name, width, parent_node)
	{
		this.Name = name;

		// Create the row HTML and add to the parent
		this.ContainerNode = DOM.Node.CreateHTML(row_template);
		this.Node = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowData");
		this.LabelNode = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowLabel");
		this.LabelNode.innerHTML = name;
		this.CanvasNode = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowCanvas");
		parent_node.appendChild(this.ContainerNode);

		// Setup the canvas
		this.Ctx = this.CanvasNode.getContext("2d");
		this.SetSize(width);
		this.Clear();

		this.VisibleFrames = [ ];
	}


	TimelineRow.prototype.SetSize = function(width)
	{
		// Must ALWAYS set the width/height properties together. Setting one on its own has weird side-effects.
		this.CanvasNode.width = width;
		this.CanvasNode.height = 18;
	}


	TimelineRow.prototype.Clear = function()
	{
		// Outer box is background colour, inner box shows the boundary between thread rows
		this.Ctx.fillStyle = "#2C2C2C"
		this.Ctx.fillRect(0, 0, this.CanvasNode.width, this.CanvasNode.height);
		this.Ctx.fillStyle = "#666"
		var b = 1;
		this.Ctx.fillRect(b, b * 2, this.CanvasNode.width - b * 3, this.CanvasNode.height - b);
	}


	TimelineRow.prototype.SetVisibleFrames = function(frame_history, time_range)
	{
		// TODO: Record last nearest index

		// Clear previous visible list
		this.VisibleFrames = [ ];

		// Search for first visible frame
		var start_frame_index = 0;
		for (var i = 0; i < frame_history.length; i++)
		{
			var frame = frame_history[i];
			if (frame.EndTime_us > time_range.Start_us)
				break;
			start_frame_index++;
		}

		// Gather all frames up to the end point
		for (var i = start_frame_index; i < frame_history.length; i++)
		{
			var frame = frame_history[i];
			if (frame.StartTime_us > time_range.End_us)
				break;
			this.VisibleFrames.push(frame);
		}
	}


	TimelineRow.prototype.Draw = function(time_range)
	{
		this.Clear();

		// Draw all root samples in the visible frame set
		for (var i in this.VisibleFrames)
		{
			var frame = this.VisibleFrames[i];

			for (var j in frame.Samples)
				DrawSample(this, time_range, frame.Samples[j]);
		}
	}


	function DrawSample(self, time_range, sample)
	{
		// Determine location of the sample
		var offset_x = time_range.PixelOffset(sample.cpu_us_start);
		var size_x = time_range.PixelSize(sample.cpu_us_length);

		// Clip to padded range
		size_x = Math.min(offset_x + size_x, self.CanvasNode.width - 5) - offset_x;
		offset_x = Math.max(offset_x, 4);

		self.Ctx.fillStyle = "#BBB";
		self.Ctx.fillRect(offset_x, 5, size_x, 10);
	}

	return TimelineRow;
})();


TimelineWindow = (function()
{
	var BORDER = 10;

	var box_template = "<div class='TimelineBox'></div>";


	function TimelineWindow(wm, server)
	{
		// Ordered list of thread rows on the timeline
		this.ThreadRows = [ ];

		// Create window and containers
		this.Window = wm.AddWindow("Timeline", 10, 20, 100, 100);
		this.Window.ShowNoAnim();
		this.TimelineContainer = this.Window.AddControlNew(new WM.Container(10, 10, 800, 160));
		DOM.Node.AddClass(this.TimelineContainer.Node, "TimelineContainer");

		// Setup pause button
		this.Paused = false;
		this.PauseButton = this.Window.AddControlNew(new WM.Button("Pause", 10, 5, { toggle: true }));
		this.PauseButton.SetOnClick(Bind(OnPausePressed, this));

		// Set time range AFTER the window has been created, as it uses the window to determine pixel coverage
		this.TimeRange = new PixelTimeRange(0, 2 * 1000 * 1000, RowWidth(this));
	}


	TimelineWindow.prototype.WindowResized = function(width, height, top_window)
	{
		// Resize window
		var top = top_window.Position[1] + top_window.Size[1] + 10;
		this.Window.SetPosition(10, top);
		this.Window.SetSize(width - 2 * 10, 120);

		// Resize controls
		var parent_size = this.Window.Size;
		this.TimelineContainer.SetPosition(BORDER, 30);
		this.TimelineContainer.SetSize(parent_size[0] - 2 * BORDER, 60);

		// Resize rows
		var row_width = RowWidth(this);
		for (var i in this.ThreadRows)
		{
			var row = this.ThreadRows[i];
			row.SetSize(row_width);
			row.Clear();
		}

		// Adjust time range to new width
		this.TimeRange.SetPixelSpan(row_width);
	}


	TimelineWindow.prototype.OnSamples = function(thread_name, frame_history)
	{
		if (this.Paused)
			return;
		
		// Shift the timeline to the last entry on this thread
		var last_frame = frame_history[frame_history.length - 1];
		this.TimeRange.SetEnd(last_frame.EndTime_us);

		// Search for the index of this thread
		var thread_index = -1;
		for (var i in this.ThreadRows)
		{
			if (this.ThreadRows[i].Name == thread_name)
			{
				thread_index = i;
				break;
			}
		}

		// If this thread has not been seen before, add a new row to the list and re-sort
		if (thread_index == -1)
		{
			var row = new TimelineRow(thread_name, RowWidth(this), this.TimelineContainer.Node);
			this.ThreadRows.push(row);
			this.ThreadRows.sort(function(a, b) { return b.Name.localeCompare(a.Name); });

			// Search again for this new index
			for (var i in this.ThreadRows)
			{
				if (this.ThreadRows[i].Name == thread_name)
				{
					thread_index = i;
					break;
				}
			}			
		}

		// Update visible frames for this row and redraw
		var thread_row = this.ThreadRows[thread_index];
		thread_row.SetVisibleFrames(frame_history, this.TimeRange);
		thread_row.Draw(this.TimeRange);
	}


	function RowWidth(self)
	{
		// Subtract sizing of the label
		// TODO: Use computed size
		return self.TimelineContainer.Size[0] - 87;
	}


	function OnPausePressed(self)
	{
		self.Paused = self.PauseButton.IsPressed();
		if (self.Paused)
			self.PauseButton.SetText("Paused");
		else
			self.PauseButton.SetText("Pause");
	}


	return TimelineWindow;
})();