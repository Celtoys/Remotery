
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

    class Rect
    {
        // Only for DebugLog
        Title: string;

        // Source control for copying simulation back
        Control: Control;

        Left: number;
        Right: number;

        RestSizeStrength: number;
        SizeStrength: number;

        // Number of controls between this one and the side of the container
        SideDistance: number;
    }

    class SizeConstraint
    {
        Rect: Rect;
        Size: number;
    }

    class ContainerConstraint
    {
        Rect: Rect;
        Side: Side;
        Position: number;
    }

    class BufferConstraint
    {
        Rect0: Rect;
        Side0: Side;
        Rect1: Rect;
        Side1: Side;    // TODO: Remove
    }

    class SnapConstraint
    {
        LeftRect: Rect;
        RightRect: Rect;
    }

    // TODO: Need to unify snapped controls into one constraint instead of multiple
    class Sizer
    {
        ContainerRestSize: number;
        ContainerSize: number;

        Rects: Rect[] = [];

        ContainerConstraints: ContainerConstraint[] = [];
        BufferConstraints: BufferConstraint[] = [];
        SizeConstraints: SizeConstraint[] = [];
        SnapConstraints: SnapConstraint[] = [];

        Clear()
        {
            this.Rects = [];
            this.ContainerConstraints = [];
            this.BufferConstraints = [];
            this.SizeConstraints = [];
            this.SnapConstraints = [];
        }

        Build(container: Container, control_graph: ControlGraph)
        {
            this.ContainerRestSize = container.ControlParentNode.Size.x;

            // Clear previous constraints
            this.Clear();

            // Build the rect list
            this.BuildRects(container);

            // Build constraints
            let left_controls: number[] = [];
            let right_controls: number[] = [];
            this.BuildContainerConstraints(container, control_graph, left_controls, right_controls);
            this.BuildBufferConstraints(container, control_graph);
            this.BuildSnapConstraints(container, control_graph);

            this.SetInitialSizeStrengths(container, control_graph, left_controls, right_controls);
        }

        ChangeSize(new_size: number, control_graph: ControlGraph)
        {
            // Update container constraints with new size
            this.ContainerSize = new_size;
            let half_delta_size = (this.ContainerRestSize - new_size) / 2;
            let left_offset = half_delta_size + Container.SnapBorderSize;
            let right_offset = this.ContainerRestSize - left_offset;
            for (let constraint of this.ContainerConstraints)
            {
                if (constraint.Side == Side.Left)
                    constraint.Position = left_offset;
                else
                    constraint.Position = right_offset;
            }

            // Relax
            for (let i = 0; i < 50; i++)
            {
                this.ApplySizeConstraints();
                this.ApplyMinimumSizeConstraints();
                this.ApplyBufferConstraints();
                this.ApplyContainerConstraints();

                // HERE
                this.ReevaluateSizeStrengths(control_graph);
            }

            // TODO: Finish with a snap! Can that be made into a constraint?
            // Problem is that multiple controls may be out of line
            this.ApplySnapConstraints();

            // Copy simulation back to the controls
            for (let rect of this.Rects)
            {
                rect.Control.Position = new int2(rect.Left - half_delta_size, rect.Control.Position.y);
                rect.Control.Size = new int2(rect.Right - rect.Left, rect.Control.Size.y);
            }
        }

        private BuildRects(container: Container)
        {
            for (let control of container.Controls)
            {
                // Anything that's not a control (e.g. a Ruler) still needs an entry in the array, even if it's empty
                if (!(control instanceof Container))
                {
                    this.Rects.push(null);
                    continue;
                }

                // Set initial parameters
                let rect = new Rect();
                rect.Control = control;
                rect.Left = control.TopLeft.x;
                rect.Right = control.BottomRight.x;
                rect.SizeStrength = 1;
                rect.RestSizeStrength = 1;
                rect.SideDistance = 10000;  // Set to a high number so a single < can be used to both compare and test for validity
                this.Rects.push(rect);

                if (control instanceof Window)
                    rect.Title = (<Window>control).Title;

                // Add a size constraint for each rect
                let size_constraint = new SizeConstraint();
                size_constraint.Rect = rect;
                size_constraint.Size = rect.Right - rect.Left;
                this.SizeConstraints.push(size_constraint);
            }
        }

        private ApplySizeConstraints()
        {
            // TODO: Grow left/right away from the container constraints?
            //       Instead of using a left/right index, do it based on distance from center of container

            for (let constraint of this.SizeConstraints)
            {
                let rect = constraint.Rect;
                let size = rect.Right - rect.Left;
                let center = (rect.Left + rect.Right) * 0.5;
                let half_delta_size = (constraint.Size - size) * 0.5;
                let half_border_size = size * 0.5 + half_delta_size * rect.SizeStrength;
                rect.Left = center - half_border_size;
                rect.Right = center + half_border_size;
            }
        }

        private ApplyMinimumSizeConstraints()
        {
            for (let constraint of this.SizeConstraints)
            {
                let rect = constraint.Rect;

                if (rect.Right - rect.Left < 20)
                {
                    let center = (rect.Left + rect.Right) * 0.5;
                    rect.Left = center - 10;
                    rect.Right = center + 10;
                }
            }
        }

        private BuildContainerConstraints(container: Container, control_graph: ControlGraph, left_controls: number[], right_controls: number[])
        {
            for (let i = 0; i < container.Controls.length; i++)
            {
                let left_ref_info = control_graph.RefInfos[i * 4 + Side.Left];
                let right_ref_info = control_graph.RefInfos[i * 4 + Side.Right];

                // Looking for controls that reference the external container on left/right sides
                if (left_ref_info.References(container))
                {
                    let constraint = new ContainerConstraint();
                    constraint.Rect = this.Rects[i];
                    constraint.Side = Side.Left;
                    constraint.Position = 0;
                    this.ContainerConstraints.push(constraint);

                    // Track left controls for strength setting
                    left_controls.push(i);
                }
                if (right_ref_info.References(container))
                {
                    let constraint = new ContainerConstraint();
                    constraint.Rect = this.Rects[i];
                    constraint.Side = Side.Right;
                    constraint.Position = this.ContainerRestSize;
                    this.ContainerConstraints.push(constraint);

                    // Track right controls for strength setting
                    right_controls.push(i);
                }
            }
        }

        private ApplyContainerConstraints()
        {
            for (let constraint of this.ContainerConstraints)
            {
                if (constraint.Side == Side.Left)
                    constraint.Rect.Left = constraint.Position;
                else
                    constraint.Rect.Right = constraint.Position;
            }
        }

        private BuildBufferConstraints(container: Container, control_graph: ControlGraph)
        {
            for (let ref of control_graph.Refs)
            {
                // Only want horizontal refs
                if (ref.Side != Side.Left && ref.Side != Side.Right)
                    continue;

                // There are two refs for each connection; ensure only one of them is used
                if (ref.FromIndex < ref.ToIndex)
                {
                    let constraint = new BufferConstraint();
                    constraint.Rect0 = this.Rects[ref.FromIndex];
                    constraint.Side0 = ref.Side;
                    constraint.Rect1 = this.Rects[ref.ToIndex];
                    constraint.Side1 = ref.Side ^ 1;
                    this.BufferConstraints.push(constraint);
                }
            }
        }

        private ApplyBufferConstraints()
        {
            for (let constraint of this.BufferConstraints)
            {
                if (constraint.Side0 == Side.Left)
                {
                    let rect0 = constraint.Rect0;
                    let rect1 = constraint.Rect1;
                    let left = rect1.Right;
                    let right = rect0.Left;
                    let center = (left + right) * 0.5;
                    let size = right - left;
                    let half_delta_size = (Container.SnapBorderSize - size) * 0.5;
                    let half_new_size = size * 0.5 + half_delta_size * 0.5;
                    rect0.Left = center + half_new_size;
                    rect1.Right = center - half_new_size;
                }
                else
                {
                    let rect0 = constraint.Rect0;
                    let rect1 = constraint.Rect1;
                    let left = rect0.Right;
                    let right = rect1.Left;
                    let center = (left + right) * 0.5;
                    let size = right - left;
                    let half_delta_size = (Container.SnapBorderSize - size) * 0.5;
                    let half_new_size = size * 0.5 + half_delta_size * 0.5;
                    rect1.Left = center + half_new_size;
                    rect0.Right = center - half_new_size;
                }
            }
        }

        private BuildSnapConstraints(container: Container, control_graph: ControlGraph)
        {
            for (let ref of control_graph.Refs)
            {
                if (ref.Side == Side.Right && ref.To != container)
                {
                    let constraint = new SnapConstraint();
                    constraint.LeftRect = this.Rects[ref.FromIndex];
                    constraint.RightRect = this.Rects[ref.ToIndex];
                    this.SnapConstraints.push(constraint);
                }
            }
        }

        private ApplySnapConstraints()
        {
            for (let constraint of this.SnapConstraints)
            {
                constraint.RightRect.Left = constraint.LeftRect.Right + Container.SnapBorderSize;
            }
        }

        private SetInitialSizeStrengths(container: Container, control_graph: ControlGraph, left_controls: number[], right_controls: number[])
        {
            let weak_strength = 0.01;
            let strong_strength = 0.1;

            let side_distance = 0;
            while (left_controls.length && right_controls.length)
            {
                // Mark side distances and set strong strengths before walking further
                for (let index of left_controls)
                {
                    let rect = this.Rects[index];
                    rect.SideDistance = side_distance;
                    rect.SizeStrength = strong_strength;
                }
                for (let index of right_controls)
                {
                    let rect = this.Rects[index];
                    rect.SideDistance = side_distance;
                    rect.SizeStrength = strong_strength;
                }

                let next_left_controls: number[] = [];
                let next_right_controls: number[] = [];

                // Make one graph step right for the left controls, setting strengths
                for (let index of left_controls)
                {
                    let rect = this.Rects[index];
                    let ref_info = control_graph.RefInfos[index * 4 + Side.Right];

                    for (let i = 0; i < ref_info.NbRefs; i++)
                    {
                        let ref = ref_info.GetControlRef(i);
                        let rect_to = this.Rects[ref.ToIndex];

                        // If we've hit the container this is a control that is anchored on both sides
                        if (ref.To == container)
                        {
                            // Set it to weak so that it's always collapsable
                            rect.SizeStrength = weak_strength;
                            continue;
                        }

                        // If we bump up against a rect of equal distance, their anchor point is the graph's middle
                        if (rect.SideDistance == rect_to.SideDistance)
                        {
                            // Mark both sides as weak to make the equally collapsable
                            rect.SizeStrength = weak_strength;
                            rect_to.SizeStrength = weak_strength;
                            continue;
                        }

                        // If the other side has a smaller distance then this is a center control
                        if (rect.SideDistance > rect_to.SideDistance)
                        {
                            // Only the control should be marked for collapse
                            rect.SizeStrength = weak_strength;
                            continue;
                        }

                        // Walk to the right
                        if (next_left_controls.indexOf(ref.ToIndex) == -1)
                            next_left_controls.push(ref.ToIndex);
                    }
                }

                // Make on graph step left for the right controls, not setting strengths
                for (let index of right_controls)
                {
                    let ref_info = control_graph.RefInfos[index * 4 + Side.Left];
                    for (let i = 0; i < ref_info.NbRefs; i++)
                    {
                        let ref = ref_info.GetControlRef(i);
                        let rect_to = this.Rects[ref.ToIndex];

                        // Strengths are already set from the left controls so abort walk when coming up
                        // against a left control
                        if (ref.To == container || rect_to.SideDistance != 10000)
                            continue;
                        
                        // Walk to the left
                        if (next_right_controls.indexOf(ref.ToIndex) == -1)
                            next_right_controls.push(ref.ToIndex);
                    }
                }

                left_controls = next_left_controls;
                right_controls = next_right_controls;
                side_distance++;
            }

            // Record initial size strength for restoration
            for (let rect of this.Rects)
                rect.RestSizeStrength = rect.SizeStrength;
        }

        ReevaluateSizeStrengths(control_graph: ControlGraph)
        {
            for (let index = 0; index < this.Rects.length; index++)
            {
                let rect = this.Rects[index];
                rect.SizeStrength = rect.RestSizeStrength;

                let left_ref_info = control_graph.RefInfos[index * 4 + Side.Left];
                for (let i = 0; i < left_ref_info.NbRefs; i++)
                {
                    let ref = left_ref_info.GetControlRef(i);
                    if (ref.ToIndex != -1)
                    {
                        let rect_to = this.Rects[ref.ToIndex];
                        let size = rect_to.Right - rect_to.Left;
                        if (size <= 20)
                        {
                            rect.SizeStrength = 0.01;
                            break;
                        }
                    }
                }

                let right_ref_info = control_graph.RefInfos[index * 4 + Side.Right];
                for (let i = 0; i < right_ref_info.NbRefs; i++)
                {
                    let ref = right_ref_info.GetControlRef(i);
                    if (ref.ToIndex != -1)
                    {
                        let rect_to = this.Rects[ref.ToIndex];
                        let size = rect_to.Right - rect_to.Left;
                        if (size <= 20)
                        {
                            rect.SizeStrength = 0.01;
                            break;
                        }
                    }
                }
            }
        }

        DebugLog()
        {
            for (let rect of this.Rects)
            {
                if (rect)
                    console.log("Rect: ", rect.Title, rect.Left, "->", rect.Right, "...", rect.SideDistance, "/", rect.SizeStrength);
                else
                    console.log("Null Rect");
            }

            for (let constraint of this.SizeConstraints)
            {
                console.log("Size Constraint: ", constraint.Rect.Title, "@", constraint.Size);
            }

            for (let constraint of this.ContainerConstraints)
            {
                console.log("Container Constraint: ", constraint.Rect.Title, Side[constraint.Side], "@", constraint.Position);
            }

            for (let constraint of this.BufferConstraints)
            {
                console.log("Buffer Constraint: ", constraint.Rect0.Title, "->", constraint.Rect1.Title, "on", Side[constraint.Side0], "/", Side[constraint.Side1]);
            }
        }
    };

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

        private SizeGraph: ControlGraph;
        private Sizer: Sizer;

        // List of controls that are auto-anchored to a container edge during sizing
        private AnchorControls: [Control, int2, number][];

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


        // ----- WM.Control Overrides --------------------------------------------------------


        /*Show() : void
        {
            super.Show();

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
        
        private OnBeginMove = (event: MouseEvent) =>
        {
            // Prepare for drag
            let mouse_pos = DOM.Event.GetMousePosition(event);
            this.DragMouseStartPosition = mouse_pos;
            this.DragWindowStartPosition = this.Position.Copy();

            let parent_container = this.ParentContainer;
            if (parent_container)
            {
                // Display last snap configuration on initial click
                let snap_tl = parent_container.GetSnapControls(this.TopLeft, new int2(-1, -1), [ this ], null, 0);
                let snap_br = parent_container.GetSnapControls(this.BottomRight, new int2(1, 1), [ this ], null, 0);
                this.UpdateTLSnapRulers(snap_tl[0]);
                this.UpdateBRSnapRulers(snap_br[0]);
            }

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
                let snap_tl = parent_container.GetSnapControls(this.TopLeft, new int2(-1, -1), [ this ], null, 0);
                if (snap_tl[0] != SnapCode.None)
                    this.Position = snap_tl[1];

                let snap_br = parent_container.GetSnapControls(this.BottomRight, new int2(1, 1), [ this ], null, 0);
                if (snap_br[0] != SnapCode.None)
                    this.Position = int2.Sub(snap_br[1], this.Size);

                this.UpdateTLSnapRulers(snap_tl[0]);
                this.UpdateBRSnapRulers(snap_br[0]);
            }
            
            // ####
            this.ParentContainer.UpdateControlSizes();

            // TODO: OnMove handler

            DOM.Event.StopDefaultAction(event);
        }
        private OnEndMove = () =>
        {
            this.RemoveSnapRulers();

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

        private TakeConnectedAnchorControls(aabb_0: AABB, anchor_controls: [Control, int2, number][])
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
            let anchor_controls: [Control, int2, number][] = [ ];

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

        private GatherAnchorControls(mask: int2, gather_sibling_anchors: boolean)
        {
            // Reset list just in case end event isn't received
            this.AnchorControls = [];

            // TODO: If child handling becomes a separate issue, can remove this boolean
            let parent_container = this.ParentContainer;
            if (gather_sibling_anchors && parent_container)
            {
                // Gather auto-anchor controls from siblings on side resizers only
                if ((mask.x != 0) != (mask.y != 0))
                {
                    if (mask.x > 0 || mask.y > 0)
                    {
                        let snap = parent_container.GetSnapControls(this.BottomRight, mask, [ this ], this.AnchorControls, 1);
                        this.UpdateBRSnapRulers(snap[0]);
                    }
                    if (mask.x < 0 || mask.y < 0)
                    {
                        let snap = parent_container.GetSnapControls(this.TopLeft, mask, [ this ], this.AnchorControls, 1);
                        this.UpdateTLSnapRulers(snap[0]);
                    }
                }

                // We don't want windows at disjoint locations getting dragged into
                // the auto anchor so only allow those connected by existing snap
                // boundaries
                this.MakeAnchorControlIsland();
            }

            // Gather auto-anchor controls for children on bottom and right resizers
            /*let this_br = int2.Sub(this.ControlParentNode.Size, int2.One);
            if (mask.x > 0 || mask.y > 0)
                this.GetSnapControls(this_br, mask, [ ], this.AnchorControls, 1);
            
            // Gather auto-anchor controls for children on top and left resizers, inverting
            // the mouse offset so that child sizing moves away from mouse movement to counter
            // this window increasing in size
            if (mask.x < 0 || mask.y < 0)
                this.GetSnapControls(this_br, mask, [ ], this.AnchorControls, -1);*/
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
            this.SizeGraph = new ControlGraph();
            this.SizeGraph.Build(this);

            this.Sizer = new Sizer();
            this.Sizer.Build(this, this.SizeGraph);
            this.Sizer.DebugLog();

            this.SizerMoved = false;

            if (master_control)
            {
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
                this.OnSizeDelegate = (event: MouseEvent) => { this.OnSize(event, mask, 1, null); };
                this.OnEndSizeDelegate = (event: MouseEvent) => { this.OnEndSize(event, mask); };
                $(document).MouseMoveEvent.Subscribe(this.OnSizeDelegate);
                $(document).MouseUpEvent.Subscribe(this.OnEndSizeDelegate);

                DOM.Event.StopDefaultAction(event);
            }
        }
        
        private OnSize = (event: MouseEvent, mask: int2, offset_scale: number, master_offset: int2) =>
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
                    let snap = parent_container.GetSnapControls(this.BottomRight, mask, exclude_controls, null, 0);
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
                    let snap = parent_container.GetSnapControls(this.TopLeft, mask, exclude_controls, null, 0);
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

            if (this.SizeGraph)
            {
                this.Sizer.ChangeSize(this.ControlParentNode.Size.x, this.SizeGraph);
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
                    window.OnSize(event, control[1], control[2], offset);
            }

            // The cursor will exceed the bounds of the resize element under sizing so
            // force it to whatever it needs to be here
            this.SetResizeCursor($(document.body), mask);

            // ####
            this.ParentContainer.UpdateControlSizes();

            DOM.Event.StopDefaultAction(event);
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
        }
    }
}
