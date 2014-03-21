
namespace("WM");


WM.GridRows = (function()
{
	function GridRows()
	{
		// Array of rows in the order they were added
		this.Rows = [ ];
	}


	GridRows.prototype.Add = function(parent, cell_data, row_classes, cell_classes)
	{
		var row = new WM.GridRow(parent, cell_data, row_classes, cell_classes);
		this.Rows.push(row);
		return row;
	}


	GridRows.prototype.GetByName = function(name)
	{
		for (var i in this.Rows)
		{
			var row = this.Rows[i];
			if (row.CellData.Name == name)
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
	var template_html = "<div class='GridRow'></div>";


	//
	// 'cell_data' is an object with a variable number of fields. If a field is text, a column is created and the
	// text is assigned. 
	//
	function GridRow(parent, cell_data, row_classes, cell_classes)
	{
		// TODO: NEEEDS ID?

		// Setup data
		this.Parent = parent;
		this.IsOpen = true;
		this.AnimHandle = null;
		this.Rows = new WM.GridRows();
		this.CellData = cell_data;
		this.CellNodes = { };

		// Create the main row node
		this.Node = DOM.Node.CreateHTML(template_html);
		if (row_classes)
			DOM.Node.AddClass(this.Node, row_classes);

		// Embed a pointer to the row in the root node so that it can be clicked
		this.Node.GridRow = this;

		// Create nodes for each required cell
		for (var attr in this.CellData)
		{
			if (this.CellData.hasOwnProperty(attr))
			{
				var data = this.CellData[attr];

				// Create a node for the cell and add any custom classes
				var node = DOM.Node.AppendHTML(this.Node, "<div class='GridRowCell'></div>");
				this.CellNodes[attr] = node;
				if (cell_classes)
					DOM.Node.AddClass(node, cell_classes);

				// If this is a Window Control, add its node to the cell
				if (data instanceof Object && "Node" in data && DOM.Node.IsNode(data.Node))
				{
					data.ParentNode = node;
					node.appendChild(data.Node);
				}

				else
				{
					// Otherwise just assign the data as text
					node.innerHTML = data;
				}
			}
		}

		// Add the body node for any children
		DOM.Node.AppendClearFloat(this.Node);
		this.BodyNode = DOM.Node.AppendHTML(this.Node, "<div class='GridRowBody'></div>");

		// Add the row to the parent
		this.Parent.BodyNode.appendChild(this.Node);
	}


	GridRow.prototype.AddRow = function(name, control)
	{
		return this.Rows.Add(this, { "Name": name, "Control": control });
	}


	GridRow.prototype.GetRowByName = function(name)
	{
		return this.Rows.GetByName(name);
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
		return this.Rows.Add(this, {"Name": name }, "GridGroup", "GridGroup");
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
