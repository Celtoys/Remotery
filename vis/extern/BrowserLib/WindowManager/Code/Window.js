
// TODO: Lots of private functions here that are exposed as the API

namespace("WM");


WM.Window = (function()
{
	var template_html = multiline(function(){/*																								\
		<div class='Window'>
			<div class='WindowTitleBar'>
				<div class='WindowTitleBarText notextsel' style='float:left'>Window Title Bar</div>
				<div class='WindowTitleBarClose notextsel' style='float:right'>O</div>
			</div>
			<div class='WindowBody'></div>
			<div class='WindowSizeX'></div>
			<div class='WindowSizeY'></div>
			<div class='WindowSizeXY'></div>
		</div>
	*/});


	function Window(manager, title, x, y, width, height, parent_node)
	{
		this.Manager = manager;
		this.ParentNode = parent_node || document.body;
		this.OnMove = null;
		this.Visible = false;
		this.AnimatedShow = false;
		this.Controls = [ ];

		// Clone the window template and locate key nodes within it
		this.Node = DOM.Node.CreateHTML(template_html);
		this.TitleBarNode = DOM.Node.FindWithClass(this.Node, "WindowTitleBar");
		this.TitleBarTextNode = DOM.Node.FindWithClass(this.Node, "WindowTitleBarText");
		this.TitleBarCloseNode = DOM.Node.FindWithClass(this.Node, "WindowTitleBarClose");
		this.BodyNode = DOM.Node.FindWithClass(this.Node, "WindowBody");
		this.SizeXNode = DOM.Node.FindWithClass(this.Node, "WindowSizeX");
		this.SizeYNode = DOM.Node.FindWithClass(this.Node, "WindowSizeY");
		this.SizeXYNode = DOM.Node.FindWithClass(this.Node, "WindowSizeXY");

		// Setup the position and dimensions of the window
		this.SetPosition(x, y);
		this.SetSize(width, height);

		// Set the title text
		this.TitleBarTextNode.innerHTML = title;

		// Hook up event handlers
		DOM.Event.AddHandler(this.Node, "mousedown", Bind(this, "SetTop"));
		DOM.Event.AddHandler(this.TitleBarNode, "mousedown", Bind(this, "BeginMove"));
		DOM.Event.AddHandler(this.SizeXNode, "mousedown", Bind(this, "BeginSizeX"));
		DOM.Event.AddHandler(this.SizeYNode, "mousedown", Bind(this, "BeginSizeY"));
		DOM.Event.AddHandler(this.SizeXYNode, "mousedown", Bind(this, "BeginSizeXY"));
		DOM.Event.AddHandler(this.TitleBarCloseNode, "mousedown", Bind(this, "Hide"));

		// Create delegates for removable handlers
		this.MoveDelegate = Bind(this, "Move");
		this.EndMoveDelegate = Bind(this, "EndMove");
		this.SizeXDelegate = Bind(this, "SizeX");
		this.EndSizeXDelegate = Bind(this, "EndSizeX");
		this.SizeYDelegate = Bind(this, "SizeY");
		this.EndSizeYDelegate = Bind(this, "EndSizeY");
		this.SizeXYDelegate = Bind(this, "SizeXY");
		this.EndSizeXYDelegate = Bind(this, "EndSizeXY");
	}


	Window.prototype.SetOnMove = function(on_move)
	{
		this.OnMove = on_move;
	}


	Window.prototype.Show = function()
	{
		if (this.Node.parentNode != this.ParentNode)
		{
			this.ShowNoAnim();
			Anim.Animate(Bind(this, "OpenAnimation"), 0, 1, 1);
		}
	}


	Window.prototype.ShowNoAnim = function()
	{
		// Add to the document
		this.ParentNode.appendChild(this.Node);
		this.AnimatedShow = false;
		this.Visible = true;

		// Controls may have been added with the window in an initial hiddent state
		// Update to new window size
		this.UpdateControlSizes(this.Size[0], this.Size[1]);
	}


	Window.prototype.Hide = function()
	{
		if (this.Node.parentNode == this.ParentNode)
		{
			if (this.AnimatedShow)
			{
				// Trigger animation that ends with removing the window from the document
				Anim.Animate(
					Bind(this, "CloseAnimation"),
					0, 1, 0.25,
					Bind(this, "HideNoAnim"));
			}
			else
			{
				this.HideNoAnim();
			}
		}
	}

	
	Window.prototype.HideNoAnim = function()
	{
		// Remove node
		this.ParentNode.removeChild(this.Node);
		this.Visible = false;
	}


	Window.prototype.SetTop = function()
	{
		this.Manager.SetTopWindow(this);
	}



	Window.prototype.SetTitle = function(title)
	{
		this.TitleBarTextNode.innerHTML = title;
	}


	Window.prototype.AddControl = function(control)
	{
		control.ParentNode = this.BodyNode;
		this.BodyNode.appendChild(control.Node);
		this.Controls.push(control);

		// Trigger SetSize on the child controller so that any anchors are updated
		// TODO: Only do this for the control being added
		this.SetSize(this.Size[0], this.Size[1]);

		return control;
	}


	Window.prototype.Scale = function(t)
	{
		// Calculate window bounds centre/extents
		var ext_x = this.Size[0] / 2;
		var ext_y = this.Size[1] / 2;
		var mid_x = this.Position[0] + ext_x;
		var mid_y = this.Position[1] + ext_y;

		// Scale from the mid-point
		var size = [ this.Size[0] * t, this.Size[1] * t ];
		DOM.Node.SetPosition(this.Node, [ mid_x - ext_x * t, mid_y - ext_y * t ]);
		DOM.Node.SetSize(this.Node, size);

		// Update controls as the window scales
		this.UpdateControlSizes(size[0], size[1]);
	}


	Window.prototype.OpenAnimation = function(val)
	{
		// Power ease in
		var t = 1 - Math.pow(1 - val, 8);
		this.Scale(t);
		DOM.Node.SetOpacity(this.Node, 1 - Math.pow(1 - val, 8));
		this.AnimatedShow = true;
	}


	Window.prototype.CloseAnimation = function(val)
	{
		// Power ease out
		var t = 1 - Math.pow(val, 4);
		this.Scale(t);
		DOM.Node.SetOpacity(this.Node, t);
	}


	Window.prototype.NotifyChange = function()
	{
		if (this.OnMove)
		{
			var pos = DOM.Node.GetPosition(this.Node);
			this.OnMove(this, pos);
		}
	}


	Window.prototype.BeginMove = function(evt)
	{
		// Calculate offset of the window from the mouse down position
		var mouse_pos = DOM.Event.GetMousePosition(evt);
		this.Offset = [ mouse_pos[0] - this.Position[0], mouse_pos[1] - this.Position[1] ];

		// Dynamically add handlers for movement and release
		DOM.Event.AddHandler(document, "mousemove", this.MoveDelegate);
		DOM.Event.AddHandler(document, "mouseup", this.EndMoveDelegate);

		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.BeginSizeX = function(evt)
	{
		// Calculate offset of the window from the mouse down position
		var mouse_pos = DOM.Event.GetMousePosition(evt);
		this.OffsetX = mouse_pos[0] - (this.Position[0] + this.Size[0]);

		// Dynamically add handlers for movement and release
		DOM.Event.AddHandler(document, "mousemove", this.SizeXDelegate);
		DOM.Event.AddHandler(document, "mouseup", this.EndSizeXDelegate);

		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.BeginSizeY = function(evt)
	{
		// Calculate offset of the window from the mouse down position
		var mouse_pos = DOM.Event.GetMousePosition(evt);
		this.OffsetY = mouse_pos[1] - (this.Position[1] + this.Size[1]);

		// Dynamically add handlers for movement and release
		DOM.Event.AddHandler(document, "mousemove", this.SizeYDelegate);
		DOM.Event.AddHandler(document, "mouseup", this.EndSizeYDelegate);

		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.BeginSizeXY = function(evt)
	{
		this.BeginSizeX(evt);
		this.BeginSizeY(evt);
	}


	Window.prototype.Move = function(evt)
	{
		// Use the offset at the beginning of movement to drag the window around
		var mouse_pos = DOM.Event.GetMousePosition(evt);
		var offset = this.Offset;
		var pos = [ mouse_pos[0] - offset[0], mouse_pos[1] - offset[1] ];
		this.SetPosition(pos[0], pos[1]);

		if (this.OnMove)
			this.OnMove(this, pos);

		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.SizeX = function(evt)
	{
		// Use the offset at the beginning of the size to drag the edge around
		var mouse_pos = DOM.Event.GetMousePosition(evt);
		var pos_x = mouse_pos[0] - this.OffsetX;
		var size_x = Math.max(50, pos_x - this.Position[0]);
		this.SetSize(size_x, this.Size[1]);
		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.SizeY = function(evt)
	{
		// Use the offset at the beginning of the size to drag the edge around
		var mouse_pos = DOM.Event.GetMousePosition(evt);
		var pos_y = mouse_pos[1] - this.OffsetY;
		var size_y = Math.max(50, pos_y - this.Position[1]);
		this.SetSize(this.Size[0], size_y);
		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.SizeXY = function(evt)
	{
		this.SizeX(evt);
		this.SizeY(evt);
	}


	Window.prototype.EndMove = function(evt)
	{
		// Remove handlers added during mouse down
		DOM.Event.RemoveHandler(document, "mousemove", this.MoveDelegate);
		DOM.Event.RemoveHandler(document, "mouseup", this.EndMoveDelegate);
		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.EndSizeX = function(evt)
	{
		// Remove handlers added during mouse down
		DOM.Event.RemoveHandler(document, "mousemove", this.SizeXDelegate);
		DOM.Event.RemoveHandler(document, "mouseup", this.EndSizeXDelegate);
		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.EndSizeY = function(evt)
	{
		// Remove handlers added during mouse down
		DOM.Event.RemoveHandler(document, "mousemove", this.SizeYDelegate);
		DOM.Event.RemoveHandler(document, "mouseup", this.EndSizeYDelegate);
		DOM.Event.StopDefaultAction(evt);
	}


	Window.prototype.EndSizeXY = function(evt)
	{
		this.EndSizeX(evt);
		this.EndSizeY(evt);
	}


	Window.prototype.SetPosition = function(x, y)
	{
		this.Position = [ x, y ];
		DOM.Node.SetPosition(this.Node, this.Position);
	}


	Window.prototype.SetSize = function(w, h)
	{
		this.Size = [ w, h ];
		DOM.Node.SetSize(this.Node, this.Size);

		this.UpdateControlSizes(w, h);
	}


	Window.prototype.UpdateControlSizes = function(w, h)
	{
		for (var i in this.Controls)
		{
			var control = this.Controls[i];

			if (control.hasOwnProperty("WidthAnchor") && control.WidthAnchor != null)
			{
				var new_size_x = w - control.Position[0] - control.WidthAnchor;
				control.SetSize(new_size_x, control.Size[1]);
			}

			if (control.hasOwnProperty("HeightAnchor") && control.HeightAnchor != null)
			{
				var new_size_y = h - control.Position[1] - control.HeightAnchor;
				control.SetSize(control.Size[0], new_size_y);
			}
		}
	}


	Window.prototype.SetZIndex = function(z)
	{
		this.Node.style.zIndex = z;
		this.SizeXNode.style.zIndex = z + 1;
		this.SizeYNode.style.zIndex = z + 1;
		this.SizeXYNode.style.zIndex = z + 1;
	}


	Window.prototype.GetZIndex = function()
	{
		return parseInt(this.Node.style.zIndex);
	}


	Window.prototype.Embed = function()
	{
		DOM.Node.AddClass(this.Node, "Embed");
		DOM.Node.AddClass(this.TitleBarNode, "Embed");
		DOM.Node.AddClass(this.BodyNode, "Embed");
		DOM.Node.AddClass(this.SizeXNode, "Embed");
		DOM.Node.AddClass(this.SizeYNode, "Embed");
		DOM.Node.AddClass(this.SizeXYNode, "Embed");
	}


	Window.prototype.Unembed = function()
	{
		DOM.Node.RemoveClass(this.Node, "Embed");
		DOM.Node.RemoveClass(this.TitleBarNode, "Embed");
		DOM.Node.RemoveClass(this.BodyNode, "Embed");
		DOM.Node.RemoveClass(this.SizeXNode, "Embed");
		DOM.Node.RemoveClass(this.SizeYNode, "Embed");
		DOM.Node.RemoveClass(this.SizeXYNode, "Embed");
	}

	return Window;
})();