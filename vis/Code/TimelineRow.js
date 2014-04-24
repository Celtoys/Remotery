

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

		// Frame index to start at when looking for first visible sample
		this.StartFrameIndex = 0;

		this.FrameHistory = null;
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
		// Allow null frame history to use existing ones
		// Keep track of frame history for redraw events
		if (frame_history != null)
			this.FrameHistory = frame_history;
		if (this.FrameHistory == null)
			return;

		// Clear previous visible list
		this.VisibleFrames = [ ];
		if (this.FrameHistory.length == 0)
			return;

		// First do a back-track in case the time range moves negatively
		var start_frame_index = this.StartFrameIndex;
		while (start_frame_index > 0)
		{
			var frame = this.FrameHistory[start_frame_index];
			if (time_range.Start_us > frame.StartTime_us)
				break;
			start_frame_index--;
		}

		// Then search from this point for the first visible frame
		while (start_frame_index < this.FrameHistory.length)
		{
			var frame = this.FrameHistory[start_frame_index];
			if (frame.EndTime_us > time_range.Start_us)
				break;
			start_frame_index++;
		}

		// Gather all frames up to the end point
		this.StartFrameIndex = start_frame_index;
		for (var i = start_frame_index; i < this.FrameHistory.length; i++)
		{
			var frame = this.FrameHistory[i];
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
