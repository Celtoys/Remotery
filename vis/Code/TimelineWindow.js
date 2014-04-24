
//
// TODO: Use WebGL and instancing for quicker renders
// TODO: Pause entire profiler: does it discard incoming samples or accept them?
//


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

		var mouse_wheel_event = (/Firefox/i.test(navigator.userAgent)) ? "DOMMouseScroll" : "mousewheel";
		DOM.Event.AddHandler(this.TimelineContainer.Node, mouse_wheel_event, Bind(OnMouseScroll, this));

		// Setup timeline dragging
		this.MouseDown = false;
		DOM.Event.AddHandler(this.TimelineContainer.Node, "mousedown", Bind(OnMouseDown, this));
		DOM.Event.AddHandler(this.TimelineContainer.Node, "mouseup", Bind(OnMouseUp, this));
		DOM.Event.AddHandler(this.TimelineContainer.Node, "mousemove", Bind(OnMouseMove, this));		

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
		}

		// Adjust time range to new width
		this.TimeRange.SetPixelSpan(row_width);
		DrawAllRows(this);
	}


	TimelineWindow.prototype.OnSamples = function(thread_name, frame_history)
	{
		if (this.Paused)
			return;

		// Shift the timeline to the last entry on this thread
		// As multiple threads come through here with different end frames, only do this for the latest
		var last_frame = frame_history[frame_history.length - 1];
		if (last_frame.EndTime_us > this.TimeRange.End_us)
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


	function RowOffset(self)
	{
		// Add sizing of the label
		// TODO: Use computed size
		return DOM.Node.GetPosition(self.TimelineContainer.Node)[0] + 87;
	}


	function RowWidth(self)
	{
		// Subtract sizing of the label
		// TODO: Use computed size
		return self.TimelineContainer.Size[0] - 87;
	}


	function DrawAllRows(self)
	{
		var time_range = self.TimeRange;
		for (var i in self.ThreadRows)
		{
			var thread_row = self.ThreadRows[i];
			thread_row.SetVisibleFrames(null, time_range);
			thread_row.Draw(time_range);
		}
	}


	function OnPausePressed(self)
	{
		self.Paused = self.PauseButton.IsPressed();
		if (self.Paused)
			self.PauseButton.SetText("Paused");
		else
			self.PauseButton.SetText("Pause");
	}


	function OnMouseScroll(self, evt)
	{
		var mouse_state = new Mouse.State(evt);
		var scale = 1.11;
			if (mouse_state.WheelDelta > 0)
				scale = 1 / scale;

		// What time is the mouse hovering over?
		var x = mouse_state.Position[0] - RowOffset(self);
		var time_us = self.TimeRange.Start_us + x / self.TimeRange.usPerPixel;

		// Calculate start time relative to the mouse hover position
		var time_start_us = self.TimeRange.Start_us - time_us;

		// Scale and offset back to the hover time
		self.TimeRange.Set(time_start_us * scale + time_us, self.TimeRange.Span_us * scale);

		DrawAllRows(self);
	}


	function OnMouseDown(self, evt)
	{
		self.MouseDown = true;
		DOM.Event.StopDefaultAction(evt);
	}


	function OnMouseUp(self, evt)
	{
		self.MouseDown = false;
	}


	function OnMouseMove(self, evt)
	{
		if (self.MouseDown)
		{
			var mouse_state = new Mouse.State(evt);

			// Get the time the mouse is over
			var x = mouse_state.Position[0] - RowOffset(self);
			var time_us = self.TimeRange.Start_us + x / self.TimeRange.usPerPixel;

			// Shift the visible time range with mouse movement
			var time_offset_us = mouse_state.PositionDelta[0] / self.TimeRange.usPerPixel;
			self.TimeRange.SetStart(self.TimeRange.Start_us - time_offset_us);

			DrawAllRows(self);
		}
	}


	return TimelineWindow;
})();