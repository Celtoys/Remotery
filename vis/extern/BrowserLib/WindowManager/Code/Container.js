
namespace("WM");


WM.Container = (function()
{
	var template_html = "<div class='Container'></div>";


	function Container(x, y, w, h)
	{
		// Create a simple container node
		this.Node = DOM.Node.CreateHTML(template_html);
		DOM.Node.SetPosition(this.Node, [ x, y ]);
		DOM.Node.SetSize(this.Node, [ w, h ]);
	}


	return Container;
})();