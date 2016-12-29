
// TODO: If window is made embedded, remove window sizing nodes

namespace WM
{
    export class Window extends Container
    {
        static TemplateHTML = `
            <div class='Window'>
                <div class='WindowTitleBar'>
                    <div class='WindowTitleBarText notextsel' style='float:left'>Window Title Bar</div>
                    <div class='WindowTitleBarClose notextsel' style='float:right'>O</div>
                </div>
                <div class='WindowBody'></div>
                <div class='WindowSizeLeft'></div>
                <div class='WindowSizeRight'></div>
                <div class='WindowSizeTop'></div>
                <div class='WindowSizeBottom'></div>
            </div>`

        // Internal nodes
        private TitleBarNode: DOM.Node;
        private TitleBarTextNode: DOM.Node;
        private TitleBarCloseNode: DOM.Node;
        private BodyNode: DOM.Node;
        private SizeLeftNode: DOM.Node;
        private SizeRightNode: DOM.Node;
        private SizeTopNode: DOM.Node;
        private SizeBottomNode: DOM.Node;

        // Size as specified in CSS
        private SideBarSize: number;

        // Transient parameters for mouse move events
        private DragMouseStartPosition: int2;
        private DragWindowStartPosition: int2;
        private DragWindowStartSize: int2;
        private MouseOffset: int2;

        // List of controls that are auto-anchored to a container edge during sizing
        private AnchorControls: [Control, int2, number][];

        // Transient delegates for mouse size events
        private OnSizeDelegate: EventListener;
        private OnEndSizeDelegate: EventListener;

        constructor(title: string, position: int2, size: int2)
        {
            // Create root node
            super(position, size, new DOM.Node(Window.TemplateHTML));

            // Locate internal nodes
		    this.TitleBarNode = this.Node.Find(".WindowTitleBar");
		    this.TitleBarTextNode = this.Node.Find(".WindowTitleBarText");
		    this.TitleBarCloseNode = this.Node.Find(".WindowTitleBarClose");
		    this.BodyNode = this.Node.Find(".WindowBody");
            this.SizeLeftNode = this.Node.Find(".WindowSizeLeft");
            this.SizeRightNode = this.Node.Find(".WindowSizeRight");
            this.SizeTopNode = this.Node.Find(".WindowSizeTop");
            this.SizeBottomNode = this.Node.Find(".WindowSizeBottom");

            // Query CSS properties
            let body_styles = window.getComputedStyle(document.body);
            let side_bar_size = body_styles.getPropertyValue('--SideBarSize');
            this.SideBarSize = parseInt(side_bar_size);

            // Apply the title bar text
            this.Title = title;

            // Window move handler
            this.TitleBarNode.MouseDownEvent.Subscribe(this.OnBeginMove);

            // Cursor change handlers as the mouse moves over sizers
            this.SizeLeftNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeRightNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeTopNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeBottomNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);

            // Window sizing handlers
            this.SizeLeftNode.MouseDownEvent.Subscribe((event: MouseEvent) => { this.OnBeginSize(event, null, true); });
            this.SizeRightNode.MouseDownEvent.Subscribe((event: MouseEvent) => { this.OnBeginSize(event, null, true); });
            this.SizeTopNode.MouseDownEvent.Subscribe((event: MouseEvent) => { this.OnBeginSize(event, null, true); });
            this.SizeBottomNode.MouseDownEvent.Subscribe((event: MouseEvent) => { this.OnBeginSize(event, null, true); });
        }

        // Uncached window title text so that any old HTML can be used
        get Title() : string
        {
            return this.TitleBarTextNode.Element.innerHTML;
        }
        set Title(title: string)
        {
            this.TitleBarTextNode.Element.innerHTML = title;
        }

        // Add all controls to the body of the window
        get ControlParentNode() : DOM.Node
        {
            return this.BodyNode;
        }

        set ZIndex(z_index: number)
        {
            this.Node.ZIndex = z_index;
            this.SizeLeftNode.ZIndex = z_index + 1;
            this.SizeRightNode.ZIndex = z_index + 1;
            this.SizeTopNode.ZIndex = z_index + 1;
            this.SizeBottomNode.ZIndex = z_index + 1;
        }

        // --- Window movement --------------------------------------------------------------------
        
        private OnBeginMove = (event: MouseEvent) =>
        {
            // Prepare for drag
            let mouse_pos = DOM.Event.GetMousePosition(event);
            this.DragMouseStartPosition = mouse_pos;
            this.DragWindowStartPosition = this.Position.Copy();

            // Dynamically add handlers for movement and release
            $(document).MouseMoveEvent.Subscribe(this.OnMove);
            $(document).MouseUpEvent.Subscribe(this.OnEndMove);

            DOM.Event.StopDefaultAction(event);
        }
        private OnMove = (event: MouseEvent) =>
        {
    		// Use the offset at the beginning of movement to drag the window around
            let mouse_pos = DOM.Event.GetMousePosition(event);
            let offset = int2.Sub(mouse_pos, this.DragMouseStartPosition);
            this.Position = int2.Add(this.DragWindowStartPosition, offset);

            // Snap position of the window to the edges of neighbouring windows
            let parent_container = this.ParentContainer;
            if (parent_container != null)
            {
                let snap_pos_tl = parent_container.GetSnapEdge(this.TopLeft, new int2(-1, -1), [ this ]);
                if (snap_pos_tl != null)
                    this.Position = snap_pos_tl;

                let snap_pos_br = parent_container.GetSnapEdge(this.BottomRight, new int2(1, 1), [ this ]);
                if (snap_pos_br != null)
                    this.Position = int2.Sub(snap_pos_br, this.Size);
            }
            
            // ####
            this.ParentContainer.UpdateControlSizes();

            // TODO: OnMove handler

            DOM.Event.StopDefaultAction(event);
        }
        private OnEndMove = () =>
        {
    		// Remove handlers added during mouse down
            $(document).MouseMoveEvent.Unsubscribe(this.OnMove);
            $(document).MouseUpEvent.Unsubscribe(this.OnEndMove);
            DOM.Event.StopDefaultAction(event);
        }

        // --- Window sizing ---------------------------------------------------------------------

        private GetSizeMask(mouse_pos: int2) : int2
        {
            // Subtract absolute parent node position from the mouse position
            if (this.ParentNode)
                mouse_pos = int2.Sub(mouse_pos, this.ParentNode.Position);

            // Use the DOM Node dimensions as they include visible borders/margins
            let offset_top_left = int2.Sub(mouse_pos, this.TopLeft); 
            let offset_bottom_right = int2.Sub(this.BottomRight, mouse_pos);

            // -1/1 for left/right top/bottom
            let mask = new int2(0);
            if (offset_bottom_right.x < this.SideBarSize && offset_bottom_right.x >= 0)
                mask.x = 1;
            if (offset_top_left.x < this.SideBarSize && offset_top_left.x >= 0)
                mask.x = -1; 
            if (offset_bottom_right.y < this.SideBarSize && offset_bottom_right.y >= 0)
                mask.y = 1;
            if (offset_top_left.y < this.SideBarSize && offset_top_left.y >= 0)
                mask.y = -1;

            return mask;
        }

        private OnMoveOverSize = (event: MouseEvent) =>
        {
	    	let mouse_pos = DOM.Event.GetMousePosition(event);

            // Dynamically decide on the mouse cursor
            let mask = this.GetSizeMask(mouse_pos);
            let cursor = "";
            if (mask.y > 0)
                cursor += "s";
            if (mask.y < 0)
                cursor += "n";
            if (mask.x > 0)
                cursor += "e";
            if (mask.x < 0)
                cursor += "w";
            cursor += "-resize";

            $(event.srcElement).Cursor = cursor;
        }

        private OnBeginSize = (event: MouseEvent, in_mask: int2, gather_sibling_anchors: boolean) =>
        {
	    	let mouse_pos = DOM.Event.GetMousePosition(event);

            // Prepare for drag
            this.DragMouseStartPosition = mouse_pos;
            this.DragWindowStartPosition = this.Position.Copy();
            this.DragWindowStartSize = this.Size.Copy();

            let mask = in_mask || this.GetSizeMask(mouse_pos);

            // Reset list just in case end event isn't received
            this.AnchorControls = [];

            if (gather_sibling_anchors)
            {
                // Gather auto-anchor controls from siblings on side resizers only
                if ((mask.x != 0) != (mask.y != 0))
                {
                    let parent_container = this.ParentContainer;
                    if (parent_container != null)
                    {
                        if (mask.x > 0 || mask.y > 0)
                            parent_container.GetSnapControls(this.BottomRight, mask, this, this.AnchorControls, 1);
                        if (mask.x < 0 || mask.y < 0)
                            parent_container.GetSnapControls(this.TopLeft, mask, this, this.AnchorControls, 1);
                    }
                }
            }

            // Gather auto-anchor controls for children on bottom and right resizers
            let this_br = int2.Sub(this.ControlParentNode.Size, int2.One);
            if (mask.x > 0 || mask.y > 0)
                this.GetSnapControls(this_br, mask, null, this.AnchorControls, 1);
            
            // Gather auto-anchor controls for children on top and left resizers, inverting
            // the mouse offset so that child sizing moves away from mouse movement to counter
            // this window increasing in size
            if (mask.x < 0 || mask.y < 0)
                this.GetSnapControls(this_br, mask, null, this.AnchorControls, -1);

            // Start resizing gathered auto-anchors
            for (let control of this.AnchorControls)
            {
                let window = control[0] as Window;
                if (window != null)
                    window.OnBeginSize(event, control[1], false);
            }

    		// Dynamically add handlers for movement and release
            this.OnSizeDelegate = (event: MouseEvent) => { this.OnSize(event, mask, 1); };
            this.OnEndSizeDelegate = (event: MouseEvent) => { this.OnEndSize(event, mask); };
            $(document).MouseMoveEvent.Subscribe(this.OnSizeDelegate);
            $(document).MouseUpEvent.Subscribe(this.OnEndSizeDelegate);

    		DOM.Event.StopDefaultAction(event);
        }
        private OnSize = (event: MouseEvent, mask: int2, offset_scale: number) =>
        {
            // Use the offset from the mouse start position to drag the edge around
	    	let mouse_pos = DOM.Event.GetMousePosition(event);
            let offset = int2.Sub(mouse_pos, this.DragMouseStartPosition);

            // Scale offset to invert or not
            offset = int2.Mul(offset, new int2(offset_scale));

            // Size goes left/right with mask
            this.Size = int2.Add(this.DragWindowStartSize, int2.Mul(offset, mask));

            // Position stays put or drifts right with mask
            let position_mask = int2.Min0(mask);
            this.Position = int2.Sub(this.DragWindowStartPosition, int2.Mul(offset, position_mask));

            // Build up a list of controls to exclude from snapping
            // Don't snap anchor controls as they'll already be dragged around with this size event
            let exclude_controls: [Control] = [ this ];
            for (let anchor of this.AnchorControls)
                exclude_controls.push(anchor[0]);

            // Snap edges to neighbouring edges in the parent container
            let parent_container = this.ParentContainer;
            if (parent_container != null)
            {
                if (mask.x > 0 || mask.y > 0)
                {
                    let snap_pos = parent_container.GetSnapEdge(this.BottomRight, mask, exclude_controls);
                    if (snap_pos != null)
                        this.BottomRight = snap_pos;
                }
                if (mask.x < 0 || mask.y < 0)
                {
                    let snap_pos = parent_container.GetSnapEdge(this.TopLeft, mask, exclude_controls);
                    if (snap_pos != null)
                        this.TopLeft = snap_pos;
                }
            }

            // Clamp window size to a minimum
            let min_window_size = new int2(50);
            this.Size = int2.Max(this.Size, min_window_size);
            this.Position = int2.Min(this.Position, int2.Sub(int2.Add(this.DragWindowStartPosition, this.DragWindowStartSize), min_window_size));

            // Resize all 
            for (let control of this.AnchorControls)
            {
                let window = control[0] as Window;
                if (window != null)
                    window.OnSize(event, control[1], control[2]);
            }

            // ####
            this.ParentContainer.UpdateControlSizes();

            DOM.Event.StopDefaultAction(event);
        }
        private OnEndSize = (event: MouseEvent, mask: int2) =>
        {
            // Clear anchor references so they don't hang around if a window is deleted
            this.AnchorControls = [];

    		// Remove handlers added during mouse down
            $(document).MouseMoveEvent.Unsubscribe(this.OnSizeDelegate);
            $(document).MouseUpEvent.Unsubscribe(this.OnEndSizeDelegate);
            DOM.Event.StopDefaultAction(event);            
        }
    }
}
