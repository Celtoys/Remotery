
namespace("WM");


WM.GridRows = (function()
{
	function GridRows()
	{
		this.Rows = [ ];
	}


	GridRows.prototype.Add = function(parent, name, control)
	{
		var row = new WM.GridRow(parent, name, control);
		this.Rows.push(row);
		return row;
	}


	GridRows.prototype.Get = function(name)
	{
		for (var i in this.Rows)
		{
			var row = this.Rows[i];
			if (row.Name == name)
				return row;
		}

		return null;
	}


	GridRows.prototype.Clear = function()
	{
		// Remove all node references from the parent
		for (var i in this.Rows)
		{
			var row = this.Rows[i];
			row.Parent.BodyNode.removeChild(row.Node);
		}

		this.Rows = [ ];
	}


	return GridRows;
})();


WM.GridRow = (function()
{
	var template_html = "							\
		<div class='GridRow'>						\
			<div class='GridRowName'></div>			\
			<div class='GridRowControl'></div>		\
			<div style='clear:both'></div>			\
			<div class='GridRowBody'></div>			\
		</div>";


	function GridRow(parent, name, control)
	{
		// Setup data
		this.Parent = parent;
		this.Name = name;
		this.IsOpen = true;
		this.AnimHandle = null;
		this.Rows = new WM.GridRows();

		// Clone the row template and locate key nodes within it
		this.Node = DOM.Node.CreateHTML(template_html);
		this.NameNode = DOM.Node.FindWithClass(this.Node, "GridRowName");
		this.ControlNode = DOM.Node.FindWithClass(this.Node, "GridRowControl");
		this.BodyNode = DOM.Node.FindWithClass(this.Node, "GridRowBody");

		// Assign the name text
		this.NameNode.innerHTML = name;

		// Initialise the control using this row as the parent
		// TODO: Window.js does the same thing in AddControlNew - this can be generalised
		this.Control = control;
		if (this.Control)
		{
			this.Control.ParentNode = this.ControlNode;
			this.ControlNode.appendChild(this.Control.Node);
		}

		// Embed a pointer to the row in the root node so that it can be clicked
		this.Node.GridRow = this;

		// Add the row to the parent
		this.Parent.BodyNode.appendChild(this.Node);
	}


	GridRow.prototype.AddRow = function(name, control)
	{
		return this.Rows.Add(this, name, control);
	}


	GridRow.prototype.GetRow = function(name)
	{
		return this.Rows.Get(name);
	}


	GridRow.prototype.ClearRows = function()
	{
		this.Rows.Clear();
	}


	GridRow.prototype.Open = function()
	{
		// Don't allow open while animating
		if (this.AnimHandle == null || this.AnimHandle.Complete)
		{
			this.IsOpen = true;

			// Kick off open animation
			var node = this.BodyNode;
			this.AnimHandle = Anim.Animate(
				function (val) { DOM.Node.SetHeight(node, val) },
				0, this.Height, 0.2);
		}
	}


	GridRow.prototype.Close = function()
	{
		// Don't allow close while animating
		if (this.AnimHandle == null || this.AnimHandle.Complete)
		{
			this.IsOpen = false;

			// Record height for the next open request
			this.Height = this.BodyNode.offsetHeight;

			// Kick off close animation
			var node = this.BodyNode;
			this.AnimHandle = Anim.Animate(
				function (val) { DOM.Node.SetHeight(node, val) },
				this.Height, 0, 0.2);
		}
	}


	GridRow.prototype.Toggle = function()
	{
		if (this.IsOpen)
			this.Close();
		else
			this.Open();
	}


	return GridRow;
})();


WM.Grid = (function()
{
	var template_html = "					\
		<div class='Grid'>					\
			<div class='GridBody'></div>	\
		</div>";


	function Grid(x, y, width, height)
	{
		this.Rows = new WM.GridRows();

		this.Node = DOM.Node.CreateHTML(template_html);
		this.BodyNode = DOM.Node.FindWithClass(this.Node, "GridBody");

		DOM.Node.SetPosition(this.Node, [ x, y ]);
		DOM.Node.SetSize(this.Node, [ width, height ]);

		DOM.Event.AddHandler(this.Node, "dblclick", OnDblClick);
	}

	
	Grid.prototype.AddGroup = function(name)
	{
		var row = this.Rows.Add(this, name);
		DOM.Node.AddClass(row.Node, "GridGroup");
		DOM.Node.AddClass(row.NameNode, "GridGroup");
		return row;
	}


	function OnDblClick(evt)
	{
		// Clicked on a header?
		var node = DOM.Event.GetNode(evt);
		if (DOM.Node.HasClass(node, "GridRowName"))
		{
			// Toggle rows open/close
			var row = node.parentNode.GridRow;
			if (row)
				row.Toggle();
		}
	}


	return Grid;
})();
