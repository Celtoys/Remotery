
namespace("WM");


WM.Tab = (function()
{
	var html = multiline(function(){/*
		<div class='Tab notextsel'></div>
	*/});


	function Tab(name, wnd)
	{
		// Create node
		this.Node = DOM.Node.CreateHTML(html);
		this.SetName(name);
		this.Window = wnd;
		this.OnSelectHandler = null;
		this.OnUnselectHandler = null;

		if (wnd != null)
		{
			// Enable embedded styles for window
			wnd.Embed();

			// Take ownership of the window by removing it from its current parent node
			wnd.Node.parentNode.removeChild(wnd.Node);
		}
	}


	Tab.prototype.SetName = function(name)
	{
		this.Name = name;
		this.Node.innerHTML = name;
	}


	Tab.prototype.SetWindowSize = function(w, h)
	{
		if (this.Window != null)
		{
			// Windows must occupy tab completely
			this.Window.SetPosition(0, 0);
			this.Window.SetSize(w - 1, h - 1);
		}
	}


	Tab.prototype.SetOnSelect = function(handler)
	{
		this.OnSelectHandler = handler;
	}


	Tab.prototype.SetOnUnselect = function(handler)
	{
		this.OnUnselectHandler = handler;
	}


	Tab.prototype.Select = function(parent_node)
	{
		if (this.Window != null)
		{
			// Add window node
			parent_node.appendChild(this.Window.Node);
		}

		// Match the parent's size
		var contents_size = DOM.Node.GetSize(parent_node);
		this.SetWindowSize(contents_size[0], contents_size[1]);

		DOM.Node.AddClass(this.Node, "TabSel");

		if (this.OnSelectHandler)
			this.OnSelectHandler(this);
	}


	Tab.prototype.Unselect = function()
	{
		if (this.Window != null)
		{
			this.Window.Node.parentNode.removeChild(this.Window.Node);
		}

		DOM.Node.RemoveClass(this.Node, "TabSel");

		if (this.OnUnselectHandler)
			this.OnUnselectHandler(this);
	}


	return Tab;
})();


WM.TabContainer = (function()
{
	var html = "								\
		<div class='TabContainer notextsel'>	\
			<div class='Tabs'></div>			\
			<div class='TabContents'></div>		\
		</div>									\
	";


	function TabContainer(x, y, width, height)
	{
		// Create node
		this.Node = DOM.Node.CreateHTML(html);
		this.TabsNode = DOM.Node.FindWithClass(this.Node, "Tabs");
		this.TabContentsNode = DOM.Node.FindWithClass(this.Node, "TabContents");

		this.ButtonLeft = this.AddControl(new WM.Button("<img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAMCAYAAACwXJejAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAH1JREFUKFNjoAj8//8/HYj1oFxUAJRgBuJJQAwCCVBhBAAKcgPxRrA0BKAqAgqIA/EpsBQCIBQBOepAfB8sjApQFPVCxDAAiiIeIN4CFkYFGG4C+WoqWAoBUBXBAFCiBIj/gpXgUgQCQMkQIP4OxPFQIewAqMAAiMUYGBgYAEqhwV6D0/KaAAAAAElFTkSuQmCC' />", 10, 10));
		this.ButtonRight = this.AddControl(new WM.Button("<img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAMCAYAAACwXJejAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAH1JREFUKFNjIBr8//9fD4jToVzsAKggAYhBYBIQM0OFUQFQAqYIBDYCMTdUCgGAgsiKQOAUEItDpSEAKICuCATuA7E6VAlORSDQC1WCU9EWIOaBKsGqaCoQo/oSKABT9BeIS6DCqAAoEQ/E34E4BCqECYCSYkBsAOWiAQYGAL3NwV5YYo1+AAAAAElFTkSuQmCC' />", 30, 10));

		this.SetPosition(x, y);
		this.SetSize(width, height);

		this.WidthAnchor = null;
		this.HeightAnchor = null;

		this.Tabs = [ ];
		this.SelectedTab = null;

		DOM.Event.AddHandler(this.Node, "click", Bind(OnTabClick, this));
		this.ButtonLeft.SetOnHoldClick(Bind(OnButtonLeftClick, this), 300, 25);
		this.ButtonRight.SetOnHoldClick(Bind(OnButtonRightClick, this), 300, 25);
	}


	TabContainer.prototype.SetPosition = function(x, y)
	{
		this.Position = [ x, y ];
		DOM.Node.SetPosition(this.Node, this.Position);
	}


	TabContainer.prototype.SetSize = function(w, h)
	{
		this.Size = [ w, h ];
		DOM.Node.SetSize(this.Node, this.Size);

		this.ButtonLeft.SetPosition(w - 40, 1);
		this.ButtonRight.SetPosition(w - 20, 1);

		// Resize window of selected tab
		if (this.SelectedTab != null)
		{
			var contents_size = DOM.Node.GetSize(this.TabContentsNode);
			this.SelectedTab.SetWindowSize(contents_size[0], contents_size[1]);
		}
	}


	TabContainer.prototype.AnchorWidthToParent = function(d)
	{
		this.WidthAnchor = d;
	}
	TabContainer.prototype.AnchorHeightToParent = function(d)
	{
		this.HeightAnchor = d;
	}


	TabContainer.prototype.AddTab = function(name, wnd, on_select, on_unselect)
	{
		// Create the tab, add to the node and keep track of it
		var tab = new WM.Tab(name, wnd);
		this.TabsNode.appendChild(tab.Node);
		this.Tabs.push(tab);

		// Set initial handlers so that first container SelectTab gets correct callback
		if (on_select)
			tab.SetOnSelect(on_select);
		if (on_unselect)
			tab.SetOnUnselect(on_unselect);

		// Select the first added tab
		if (this.Tabs.length == 1)
			this.SelectTab(tab);

		return tab;
	}


	TabContainer.prototype.FindTabByName = function(name)
	{
		// Linear search for tab by name
		for (var i = 0; i < this.Tabs.length; i++)
		{
			var tab = this.Tabs[i];
			if (tab.Name == name)
				return tab;
		}
		return null;
	}


	TabContainer.prototype.FindTabByNode = function(node)
	{
		// Linear search for tab by HTML element
		for (var i = 0; i < this.Tabs.length; i++)
		{
			var tab = this.Tabs[i];
			if (tab.Node == node)
				return tab;
		}
		return null;
	}


	TabContainer.prototype.SelectTab = function(tab)
	{
		// Unselect current tab before selecting the new one

		if (this.SelectedTab != null)
		{
			this.SelectedTab.Unselect();
		}

		// Select the specified tab
		tab.Select(this.TabContentsNode);
		this.SelectedTab = tab;
	}


	TabContainer.prototype.AddControl = function(control)
	{
		control.ParentNode = this.BodyNode;
		this.Node.appendChild(control.Node);
		return control;
	}


	function OnTabClick(self, evt)
	{
		var node = DOM.Event.GetNode(evt);
		var tab = self.FindTabByNode(node);
		if (tab != null)
		{
			self.SelectTab(tab);
			DOM.Event.StopDefaultAction(evt);
		}
	}


	function OnButtonLeftClick(self, button)
	{
		self.TabsNode.scrollLeft -= 10;
	}


	function OnButtonRightClick(self, button)
	{
		self.TabsNode.scrollLeft += 10;
	}


	return TabContainer;
})();