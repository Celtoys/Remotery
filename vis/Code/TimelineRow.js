

TimelineRow = (function()
{
	var row_template = function(){/*
		<div class='TimelineRow'>
			<div class='TimelineRowCheck'>
				<input class='TimelineRowCheckbox' type='checkbox' />
			</div>
			<div class='TimelineRowLabel'></div>
			<canvas class='TimelineRowCanvas'></canvas>
		</div>
*/}.toString().split(/\n/).slice(1, -1).join("\n");

	function TimelineRow(name, width, parent_node, frame_history, check_handler)
	{
		this.Name = name;

		// Create the row HTML and add to the parent
		this.ContainerNode = DOM.Node.CreateHTML(row_template);
		this.Node = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowData");
		this.LabelNode = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowLabel");
		this.LabelNode.innerHTML = name;
		this.CheckboxNode = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowCheckbox");
		this.CanvasNode = DOM.Node.FindWithClass(this.ContainerNode, "TimelineRowCanvas");
		parent_node.appendChild(this.ContainerNode);

		// All sample view windows visible by default
		this.CheckboxNode.checked = true;
		DOM.Event.AddHandler(this.CheckboxNode, "change", function(evt) { check_handler(name, evt); });

		// Setup the canvas
		this.Ctx = this.CanvasNode.getContext("2d");
		this.SetSize(width);
		this.Clear();

		// Frame index to start at when looking for first visible sample
		this.StartFrameIndex = 0;

		this.FrameHistory = frame_history;
		this.VisibleFrames = [ ];

		// Sample the mouse is currently hovering over
		this.HoverSample = null;

		// Currently selected sample
		this.SelectedSample = null;
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


	TimelineRow.prototype.SetVisibleFrames = function(time_range)
	{
		// Clear previous visible list
		this.VisibleFrames = [ ];
		if (this.FrameHistory.length == 0)
			return;

		// The frame history can be reset outside this class
		// This also catches the overflow to the end of the frame list below when a thread stops sending samples
		var max_frame = Math.max(this.FrameHistory.length - 1, 0);
		var start_frame_index = Math.min(this.StartFrameIndex, max_frame);

		// First do a back-track in case the time range moves negatively
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


	TimelineRow.prototype.UpdateHoverSample = function(mouse_state, time_range, x_offset)
	{
		var hover = GetSampleAtPosition(this, mouse_state, time_range, x_offset);
		if (hover)
			this.SetHoverSample(hover[1], time_range);
		return hover;
	}


	TimelineRow.prototype.UpdateSelectedSample = function(mouse_state, time_range, x_offset)
	{
		var select = GetSampleAtPosition(this, mouse_state, time_range, x_offset);
		if (select)
			this.SetSelectedSample(select[1], time_range);
		return select;
	}


	TimelineRow.prototype.SetHoverSample = function(sample, time_range)
	{
		if (sample != this.HoverSample)
		{
			// Discard old highlight
			// TODO: When zoomed right out, tiny samples are anti-aliased and this becomes inaccurate
			var old_sample = this.HoverSample;
			this.HoverSample = null;
			DrawSample(this, time_range, old_sample);

			// Add new highlight
			this.HoverSample = sample;
			DrawSample(this, time_range, sample);
		}
	}


	TimelineRow.prototype.SetSelectedSample = function(sample, time_range)
	{
		if (sample != this.SelectedSample)
		{
			// Discard old highlight
			// TODO: When zoomed right out, tiny samples are anti-aliased and this becomes inaccurate
			var old_sample = this.SelectedSample;
			this.SelectedSample = null;
			DrawSample(this, time_range, old_sample);

			// Add new highlight
			this.SelectedSample = sample;
			DrawSample(this, time_range, sample);
		}
	}


	function GetSampleAtPosition(self, mouse_state, time_range, x_offset)
	{
		// Get the time the mouse is over
		var x = mouse_state.Position[0] - x_offset;
		var time_us = time_range.Start_us + x / time_range.usPerPixel;
		
		// Search for the first frame to intersect this time
		for (var i in self.VisibleFrames)
		{
			var frame = self.VisibleFrames[i];
			if (time_us >= frame.StartTime_us && time_us < frame.EndTime_us)
			{
				// Search for the sample that intersects this time
				for (var j in frame.Samples)
				{
					var sample = frame.Samples[j];
					if (time_us >= sample.us_start && time_us < sample.us_start + sample.us_length)
						return [ frame, sample ];
				}
			}
		}

		return null;
	}


	function DrawSample(self, time_range, sample)
	{
		if (sample == null)
			return;

		// Determine location of the sample
		var offset_x = time_range.PixelOffset(sample.us_start);
		var size_x = time_range.PixelSize(sample.us_length);

		// Clip to padded range
		size_x = Math.min(offset_x + size_x, self.CanvasNode.width - 5) - offset_x;
		offset_x = Math.max(offset_x, 4);

		var offset_y = 5;
		var size_y = 10;

		// Normal rendering
		var ctx = self.Ctx;
		ctx.fillStyle = "#BBB";
		ctx.fillRect(offset_x, offset_y, size_x, size_y);

		var b = (sample == self.HoverSample) ? 255 : 0;
		var r = (sample == self.SelectedSample) ? 255 : 0;

		// Highlight rendering
		if (b + r > 0)
		{
			ctx.beginPath();
			ctx.rect(offset_x + 0.5, offset_y + 0.5, size_x - 1, size_y - 1);
			ctx.lineWidth = 1;
			ctx.strokeStyle = "rgb(" + r + ", 0, " + b + ")";
			ctx.stroke();
		}
	}


	return TimelineRow;
})();
