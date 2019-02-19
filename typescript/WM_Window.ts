
// TODO: If window is made embedded, remove window sizing nodes

namespace WM
{
    export enum Side
    {
        Left,
        Right,
        Top,
        Bottom,
        None,
    }

    export class Window extends Container
    {
        static TemplateHTML = `
            <div class='Window'>
                <div class='WindowTitleBar'>
                    <div class='WindowTitleBarText notextsel' style='float:left'>Window Title Bar</div>
                    <div class='WindowTitleBarClose notextsel' style='float:right'>O</div>
                </div>
                <div class='WindowBody'>
                    <div class='WindowBodyDebug'></div>
                </div>
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
        private DebugNode: DOM.Node;
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

        private ActiveTouchID: number;

        // List of controls that are auto-anchored to a container edge during sizing
        private AnchorControls: [Control, int2][];

        // Transient snap rulers for each side
        private SnapRulers: Ruler[] = [ null, null, null, null ];

        // Used to track whether a sizer is being held as opposed to moved
        private SizerMoved: boolean = false;

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
            this.DebugNode = this.Node.Find(".WindowBodyDebug");
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
            this.TitleBarNode.MouseDownEvent.Subscribe(this.OnMouseStart);
            this.TitleBarNode.TouchStartEvent.Subscribe(this.OnTouchStart);

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

            this.UpdateDebugText();
        }


        // ----- WM.Control Overrides --------------------------------------------------------


        /*Show() : void
        {
            super.Show();

            // Build control graph for all controls in this container
            this.ControlGraph.Build(this);

            // Auto-anchor to nearby controls on each show
            // This catches initial adding of controls to a new window and
            // any size changes while the window is invisible
            let parent_container = this.ParentContainer;
            if (parent_container)
            {
                console.log("SHOW ", this.Title);

                let snap_tl = parent_container.GetSnapControls(this.TopLeft, new int2(-1, -1), [ this ], null, 0);
                if (snap_tl[0] != SnapCode.None)
                {
                    console.log("Snapped!");
                    this.Position = snap_tl[1];
                }

                let snap_br = parent_container.GetSnapControls(this.BottomRight, new int2(1, 1), [ this ], null, 0);
                if (snap_br[0] != SnapCode.None)
                {
                    console.log("Snapped!");
                    this.Position = int2.Sub(snap_br[1], this.Size);
                }
            }
        }*/


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

            this.UpdateDebugText();
        }
        get ZIndex() : number
        {
            return this.Node.ZIndex;
        }

        private SetSnapRuler(side: Side, position: number)
        {
            if (this.SnapRulers[side] == null)
            {
                // Create on-demand
                let orient = (side == Side.Left || side == Side.Right) ? RulerOrient.Vertical : RulerOrient.Horizontal;
                this.SnapRulers[side] = new Ruler(orient, position);
                this.SnapRulers[side].Node.Colour = "#FFF";

                // Add to the same parent container as the window for clipping
                if (this.ParentContainer)
                    this.ParentContainer.Add(this.SnapRulers[side]);
                
                // Display under all siblings
                this.SnapRulers[side].SendToBottom();
            }
            else
            {
                this.SnapRulers[side].SetPosition(position);
            }
        }

        private RemoveSnapRuler(side: Side)
        {
            if (this.SnapRulers[side] != null)
            {
                // Remove from the container and clear the remaining reference
                if (this.ParentContainer)
                    this.ParentContainer.Remove(this.SnapRulers[side]);
                this.SnapRulers[side] = null;
            }
        }

        private RemoveSnapRulers()
        {
            this.RemoveSnapRuler(Side.Left);
            this.RemoveSnapRuler(Side.Right);
            this.RemoveSnapRuler(Side.Top);
            this.RemoveSnapRuler(Side.Bottom);
        }

        private UpdateSnapRuler(side: Side, show: boolean, position: number)
        {
            if (show)
                this.SetSnapRuler(side, position);
            else
                this.RemoveSnapRuler(side);
        }

        private UpdateTLSnapRulers(snap_code: SnapCode)
        {
            this.UpdateSnapRuler(Side.Top, (snap_code & SnapCode.Y) != 0, this.TopLeft.y - 3);
            this.UpdateSnapRuler(Side.Left, (snap_code & SnapCode.X) != 0, this.TopLeft.x - 3);
        }

        private UpdateBRSnapRulers(snap_code: SnapCode)
        {
            this.UpdateSnapRuler(Side.Bottom, (snap_code & SnapCode.Y) != 0, this.BottomRight.y + 1);
            this.UpdateSnapRuler(Side.Right, (snap_code & SnapCode.X) != 0, this.BottomRight.x + 1);
        } 

        // --- Window movement --------------------------------------------------------------------
        
        private OnBeginMove(event: Event, mouse_pos: int2)
        {
            // Prepare for drag
            this.DragMouseStartPosition = mouse_pos;
            this.DragWindowStartPosition = this.Position.Copy();

            let parent_container = this.ParentContainer;
            if (parent_container)
            {
                // Display last snap configuration on initial click
                let snap_tl = FindSnapControls(parent_container, this.TopLeft, new int2(-1, -1), [ this ]);
                let snap_br = FindSnapControls(parent_container, this.BottomRight, new int2(1, 1), [ this ]);
                this.UpdateTLSnapRulers(snap_tl[0]);
                this.UpdateBRSnapRulers(snap_br[0]);
            }

            DOM.Event.StopDefaultAction(event);

            this.UpdateDebugText();
        }
        private OnMouseStart = (event: MouseEvent) =>
        {
            let mouse_pos = DOM.Event.GetMousePosition(event);
            this.OnBeginMove(event, mouse_pos);

            // Dynamically add handlers for movement and release
            $(document).MouseMoveEvent.Subscribe(this.OnMouseMove);
            $(document).MouseUpEvent.Subscribe(this.OnMouseEnd);
        }
        private OnTouchStart = (event: TouchEvent) =>
        {
            // Use position of the first touch in the list
            let touch = event.changedTouches[0];
            this.ActiveTouchID = touch.identifier;
            let touch_pos = new int2(touch.pageX, touch.pageY);
            this.OnBeginMove(event, touch_pos);

            // Dynamically add handlers for movement and release
            $(document).TouchMoveEvent.Subscribe(this.OnTouchMove);
            $(document).TouchEndEvent.Subscribe(this.OnTouchEnd);
        }

        private OnMove(event: Event, mouse_pos: int2)
        {
            // Use the offset at the beginning of movement to drag the window around
            let offset = int2.Sub(mouse_pos, this.DragMouseStartPosition);
            this.Position = int2.Add(this.DragWindowStartPosition, offset);

            // Snap position of the window to the edges of neighbouring windows
            let parent_container = this.ParentContainer;
            if (parent_container != null)
            {
                let snap_tl = FindSnapControls(parent_container, this.TopLeft, new int2(-1, -1), [ this ]);
                if (snap_tl[0] != SnapCode.None)
                    this.Position = snap_tl[1];

                let snap_br = FindSnapControls(parent_container, this.BottomRight, new int2(1, 1), [ this ]);
                if (snap_br[0] != SnapCode.None)
                    this.Position = int2.Sub(snap_br[1], this.Size);

                this.UpdateTLSnapRulers(snap_tl[0]);
                this.UpdateBRSnapRulers(snap_br[0]);
            }
                        
            // TODO: OnMove handler

            DOM.Event.StopDefaultAction(event);

            this.UpdateDebugText();
        }
        private OnMouseMove = (event: MouseEvent) =>
        {
            let mouse_pos = DOM.Event.GetMousePosition(event);
            this.OnMove(event, mouse_pos);
        }
        private OnTouchMove = (event: TouchEvent) =>
        {
            // Find the currently active touch to update movement
            for (let i = 0; i < event.changedTouches.length; i++)
            {
                let touch = event.changedTouches[i];
                if (touch.identifier == this.ActiveTouchID)
                {
                    let touch_pos = new int2(touch.pageX, touch.pageY);
                    this.OnMove(event, touch_pos);
                    break;
                }
            }
        }

        private OnEndMove(event: Event)
        {
            this.RemoveSnapRulers();
            DOM.Event.StopDefaultAction(event);
            this.UpdateDebugText();
        }
        private OnMouseEnd = (event: Event) =>
        {
            this.OnEndMove(event);

            // Remove handlers added during mouse down
            $(document).MouseMoveEvent.Unsubscribe(this.OnMouseMove);
            $(document).MouseUpEvent.Unsubscribe(this.OnMouseEnd);
        }
        private OnTouchEnd = (event: Event) =>
        {
            this.OnEndMove(event);

            // Remove handlers added during touch down
            $(document).TouchMoveEvent.Unsubscribe(this.OnTouchMove);
            $(document).TouchEndEvent.Unsubscribe(this.OnTouchEnd);
        }

        // --- Window sizing ---------------------------------------------------------------------

        private GetSizeMask(mouse_pos: int2) : int2
        {
            // Subtract absolute parent node position from the mouse position
            if (this.ParentNode)
                mouse_pos = int2.Sub(mouse_pos, this.ParentNode.AbsolutePosition);

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

        private SetResizeCursor(node: DOM.Node, size_mask: int2)
        {
            // Combine resize directions
            let cursor = "";
            if (size_mask.y > 0)
                cursor += "s";
            if (size_mask.y < 0)
                cursor += "n";
            if (size_mask.x > 0)
                cursor += "e";
            if (size_mask.x < 0)
                cursor += "w";
            
            // Concat resize ident
            if (cursor.length > 0)
                cursor += "-resize";

            node.Cursor = cursor;
        }

        private RestoreCursor(node: DOM.Node)
        {
            node.Cursor = "auto";
        }

        private OnMoveOverSize = (event: MouseEvent) =>
        {
            // Dynamically decide on the mouse cursor
            let mouse_pos = DOM.Event.GetMousePosition(event);
            let mask = this.GetSizeMask(mouse_pos);
            this.SetResizeCursor($(event.target), mask);
        }

        private MakeControlAABB(control: Control)
        {
            // Expand control AABB by snap region to check for snap intersections
            let aabb = new AABB(control.TopLeft, control.BottomRight);
            aabb.Expand(Container.SnapBorderSize);
            return aabb;
        }

        private TakeConnectedAnchorControls(aabb_0: AABB, anchor_controls: [Control, int2][])
        {
            // Search what's left of the anchor controls list for intersecting controls
            for (let i = 0; i < this.AnchorControls.length; )
            {
                let anchor_control = this.AnchorControls[i];
                let aabb_1 = this.MakeControlAABB(anchor_control[0]);

                if (AABB.Intersect(aabb_0, aabb_1))
                {
                    // Add to the list of connected controls
                    anchor_controls.push(anchor_control);

                    // Swap the control with the back of the array and reduce array count
                    // Faster than a splice for removal (unless the VM detects this)
                    this.AnchorControls[i] = this.AnchorControls[this.AnchorControls.length - 1];
                    this.AnchorControls.length--;
                }
                else
                {
                    // Only advance when there's no swap as we want to evaluate each
                    // new control swapped in
                    i++;
                }
            }
        }

        private MakeAnchorControlIsland()
        {
            // TODO: Intersection test doesn't work for overlap test!
            let anchor_controls: [Control, int2][] = [ ];

            // First find all controls connected to this one
            let aabb_0 = this.MakeControlAABB(this);
            this.TakeConnectedAnchorControls(aabb_0, anchor_controls);

            // Then find all controls connected to each of them
            for (let anchor_control of anchor_controls)
            {
                let aabb_0 = this.MakeControlAABB(anchor_control[0]);
                this.TakeConnectedAnchorControls(aabb_0, anchor_controls);
            }

            // Replace the anchor control list with only connected controls
            this.AnchorControls = anchor_controls;
        }

        private GatherAnchorControls(mask: int2, gather_sibling_controls: boolean)
        {
            // Reset list just in case end event isn't received
            this.AnchorControls = [];

            let parent_container = this.ParentContainer;
            if (parent_container)
            {
                // Rebuild the connectivity graph for the parent
                let control_graph = parent_container.ControlGraph;
                control_graph.Build(parent_container);

                // Iterate all references on all sides
                let control_index = parent_container.Controls.indexOf(this);
                for (let side = 0; side < 4; side++)
                {
                    let ref_info = control_graph.RefInfos[control_index * 4 + side];
                    for (let ref_index = 0; ref_index < ref_info.NbRefs; ref_index++)
                    {
                        let ref = ref_info.GetControlRef(ref_index);
                    }
                }
            }

            if (parent_container && gather_sibling_controls)
            {
                // Gather auto-anchor controls from siblings on side resizers only
                if ((mask.x != 0) != (mask.y != 0))
                {
                    if (mask.x > 0 || mask.y > 0)
                        WM.FindSnapControls(parent_container, this.BottomRight, mask, [ this ], this.AnchorControls);
                    if (mask.x < 0 || mask.y < 0)
                        WM.FindSnapControls(parent_container, this.TopLeft, mask, [ this ], this.AnchorControls);
                }

                // We don't want windows at disjoint locations getting dragged into
                // the auto anchor so only allow those connected by existing snap
                // boundaries
                this.MakeAnchorControlIsland();
            }
        }

        private OnBeginSize = (event: MouseEvent, in_mask: int2, master_control: boolean) =>
        {
            let mouse_pos = DOM.Event.GetMousePosition(event);

            // Prepare for drag
            this.DragMouseStartPosition = mouse_pos;
            this.DragWindowStartPosition = this.Position.Copy();
            this.DragWindowStartSize = this.Size.Copy();

            let mask = in_mask || this.GetSizeMask(mouse_pos);

            // Start resizing gathered auto-anchors
            this.GatherAnchorControls(mask, master_control);
            for (let control of this.AnchorControls)
            {
                let window = control[0] as Window;
                if (window != null)
                    window.OnBeginSize(event, control[1], false);
            }

            // Build a control graph for the children
            // TODO: Do this always; it has to be recursive
            // TODO: Only Build
            // TODO: Move all this into Container
            this.ControlGraph.Build(this);
            this.ControlSizerX.Build(Side.Left, this, this.ControlGraph);
            this.ControlSizerY.Build(Side.Top, this, this.ControlGraph);

            this.SizerMoved = false;

            if (master_control)
            {
                // Display initial snap rulers
                if (mask.x > 0 || mask.y > 0)
                {
                    let snap = FindSnapControls(this.ParentContainer, this.BottomRight, mask, [ this ]);
                    this.UpdateBRSnapRulers(snap[0]);
                }
                if (mask.x < 0 || mask.y < 0)
                {
                    let snap = FindSnapControls(this.ParentContainer, this.TopLeft, mask, [ this ]);
                    this.UpdateTLSnapRulers(snap[0]);
                }

                // If the sizer is held and not moved for a period, release all anchored controls
                // so that it can be independently moved
                setTimeout( () => 
                {
                    if (this.SizerMoved == false)
                    {
                        this.AnchorControls = [ ];
                        this.RemoveSnapRulers();
                    }
                }, 1000);

                // Dynamically add handlers for movement and release
                this.OnSizeDelegate = (event: MouseEvent) => { this.OnSize(event, mask, null); };
                this.OnEndSizeDelegate = (event: MouseEvent) => { this.OnEndSize(event, mask); };
                $(document).MouseMoveEvent.Subscribe(this.OnSizeDelegate);
                $(document).MouseUpEvent.Subscribe(this.OnEndSizeDelegate);

                DOM.Event.StopDefaultAction(event);
            }

            this.UpdateDebugText();
        }
        
        private OnSize = (event: MouseEvent, mask: int2, master_offset: int2) =>
        {
            // Use the offset from the mouse start position to drag the edge around
            let mouse_pos = DOM.Event.GetMousePosition(event);
            let offset = master_offset || int2.Sub(mouse_pos, this.DragMouseStartPosition);

            // Chrome issues multiple redundant OnSize events even if the mouse is held still
            // Ignore those by checking for no initial mouse movement
            if (this.SizerMoved == false && offset.x == 0 && offset.y == 0)
            {
                DOM.Event.StopDefaultAction(event);
                return;
            }
            this.SizerMoved = true;

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
                    let snap = FindSnapControls(parent_container, this.BottomRight, mask, exclude_controls);
                    if (snap[0] != SnapCode.None)
                    {
                        // Adjust offset to allow anchored controls to match the snap motions
                        offset = int2.Add(offset, int2.Sub(snap[1], this.BottomRight));

                        this.BottomRight = snap[1];
                    }

                    // Only display ruler for master control
                    if (master_offset == null)
                        this.UpdateBRSnapRulers(snap[0]);
                }
                if (mask.x < 0 || mask.y < 0)
                {
                    let snap = FindSnapControls(parent_container, this.TopLeft, mask, exclude_controls);
                    if (snap[0] != SnapCode.None)
                    {
                        // Adjust offset to allow anchored controls to match the snap motions
                        offset = int2.Add(offset, int2.Sub(snap[1], this.TopLeft));

                        this.TopLeft = snap[1];
                    }

                    // Only display ruler for master control
                    if (master_offset == null)
                        this.UpdateTLSnapRulers(snap[0]);
                }
            }

            if (this.ControlGraph)
            {
                this.ControlSizerX.ChangeSize(this.ControlParentNode.Size.x, this.ControlGraph);
                this.ControlSizerY.ChangeSize(this.ControlParentNode.Size.y, this.ControlGraph);
            }

            // Clamp window size to a minimum
            let min_window_size = new int2(50);
            this.Size = int2.Max(this.Size, min_window_size);
            this.Position = int2.Min(this.Position, int2.Sub(int2.Add(this.DragWindowStartPosition, this.DragWindowStartSize), min_window_size));

            // Resize all anchored controls
            for (let control of this.AnchorControls)
            {
                let window = control[0] as Window;
                if (window != null)
                    window.OnSize(event, control[1], offset);
            }

            // The cursor will exceed the bounds of the resize element under sizing so
            // force it to whatever it needs to be here
            this.SetResizeCursor($(document.body), mask);

            DOM.Event.StopDefaultAction(event);

            this.UpdateDebugText();
        }
        private OnEndSize = (event: MouseEvent, mask: int2) =>
        {
            // End all anchored controls
            for (let control of this.AnchorControls)
            {
                let window = control[0] as Window;
                if (window != null)
                    window.OnEndSize(event, mask);
            }

            // Clear anchor references so they don't hang around if a window is deleted
            this.AnchorControls = [];

            // Set cursor back to auto
            this.RestoreCursor($(document.body));

            this.RemoveSnapRulers();

            // Remove handlers added during mouse down
            $(document).MouseMoveEvent.Unsubscribe(this.OnSizeDelegate);
            this.OnSizeDelegate = null;
            $(document).MouseUpEvent.Unsubscribe(this.OnEndSizeDelegate);
            this.OnEndSizeDelegate = null;
            DOM.Event.StopDefaultAction(event);

            this.UpdateDebugText();
        }

        private UpdateDebugText()
        {
            let text = "";
            text += this.BottomRight.x;
            this.DebugNode.SetText(text);
        }
    }
}
