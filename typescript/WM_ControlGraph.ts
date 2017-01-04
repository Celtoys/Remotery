
namespace WM
{
    export class ControlRef
    {
        // Primary sort key, to be combined with Side
        FromIndex: number;

        // Cached control reference to save needing to lookup in the parent
        From: Control;

        // Which side of the control the reference is on
        Side: Side;

        // Control this references
        To: Control;


        constructor(from_index: number, from: Control, side: Side, to: Control)
        {
            this.FromIndex = from_index;
            this.From = from;
            this.Side = side;
            this.To = to;
        }

        get SortIndex() : number
        {
            return this.FromIndex * 4 + this.Side;
        }
    }


    export class ControlRefInfo
    {
        // Storing this allows the class to query graph properties without the extra parameter
        ParentGraph: ControlGraph;

        // Cached control reference to save needing to lookup in the parent
        Control: Control;

        // Side specified for debug
        Side: Side;

        // Links in the control ref array
        StartRef: number;
        NbRefs: number;

        constructor(parent_graph: ControlGraph, control: Control, side: Side)
        {
            this.ParentGraph = parent_graph;
            this.Control = control;
            this.Side = side;
            this.StartRef = -1;
            this.NbRefs = 0;
        }

        References(control: Control) : boolean
        {
            for (let i = 0; i < this.NbRefs; i++)
            {
                if (this.ParentGraph.Refs[this.StartRef + i].To == control)
                    return true;
            }

            return false;
        }
    }


    export class ControlGraph
    {
        Refs: ControlRef[] = [];

        RefInfos: ControlRefInfo[] = [];

        Build(container: Container)
        {
            // Clear existing references
            this.Refs = [ ];
            this.RefInfos = [ ];

            // Mark all controls as unvisited
            let control_visited: boolean[] = [];
            for (let i = 0; i < container.Controls.length; i++)
                control_visited.push(false);

            for (let i = 0; i < container.Controls.length; i++)
            {
                if (control_visited[i])
                    continue;

                let control = container.Controls[i];

                // TODO: Exempt Rulers but allow Buttons? Or, exempt any control from auto snap/anchor?
                if (!(control instanceof Container))
                    continue;

                this.BuildRefs(control, container, control_visited);
            }

            // Sort control references, packing controls/sides next to each other
            this.Refs.sort((a: ControlRef, b: ControlRef) : number =>
            {
                return a.SortIndex - b.SortIndex;
            });

            // Initialise the control ref info array
            for (let i = 0; i < container.Controls.length * 4; i++)
            {
                let control = container.Controls[i >> 2];
                this.RefInfos.push(new ControlRefInfo(this, control, i & 3));
            }

            // Tell each control where its reference list starts and ends
            let last_sort_index = -1;
            for (let i = 0; i < this.Refs.length; i++)
            {
                let ref = this.Refs[i];
                let sort_index = ref.SortIndex;
                let ref_info = this.RefInfos[sort_index];

                if (last_sort_index != sort_index)
                {
                    ref_info.StartRef = i;
                    last_sort_index = sort_index;
                }

                ref_info.NbRefs++;
            }
        }

        private BuildRefs(root_control: Control, container: Container, control_visited: boolean[])
        {
            // First control to visit is the root control
            let to_visit_controls: Control[] = [ root_control ];

            // Loop through any controls left to visit
            for (let control_0 of to_visit_controls)
            {
                // It's possible for the same container to be pushed onto the to-visit list more than once
                let control_0_index = container.Controls.indexOf(control_0);
                if (control_visited[control_0_index])
                    continue;
                control_visited[control_0_index] = true;

                let tl_0 = control_0.TopLeft;
                let br_0 = control_0.BottomRight;

                // Add references to the parent container
                let b = Container.SnapBorderSize;
                let s = container.Size;
                if (tl_0.x <= b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, Side.Left, container));
                if (tl_0.y <= b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, Side.Top, container));
                if (br_0.x >= s.x - b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, Side.Right, container));
                if (br_0.y >= s.y - b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, Side.Bottom, container));

                // Check candidate controls for auto-anchor intersection
                for (let control_1 of container.Controls)
                {
                    // If a control has been previous visited, no need to add forward links as back
                    // links would have been added when it was visited
                    let control_1_index = container.Controls.indexOf(control_1);
                    if (control_visited[control_1_index])
                        continue;

                    // TODO: Exempt Rulers but allow Buttons? Or, exempt any control from auto snap/anchor?
                    if (!(control_1 instanceof Container))
                        continue;

                    let tl_1 = control_1.TopLeft;
                    let br_1 = control_1.BottomRight;

                    let side_0 = Side.None;
                    let side_1 = Side.None;

                    // Check for vertical separating axis
                    if (tl_1.y - br_0.y < 0 && tl_0.y - br_1.y < 0)
                    {
                        // Check left/right edge intersection
                        if (Math.abs(tl_0.x - br_1.x) < b)
                        {
                            side_0 = Side.Left;
                            side_1 = Side.Right;
                        }
                        if (Math.abs(br_0.x - tl_1.x) < b)
                        {
                            side_0 = Side.Right;
                            side_1 = Side.Left;
                        }
                    }

                    // Check for horizontal separating axis
                    if (tl_1.x - br_0.x < 0 && tl_0.x - br_1.x < 0)
                    {
                        // Check top/bottom edge intersection
                        if (Math.abs(tl_0.y - br_1.y) < b)
                        {
                            side_0 = Side.Top;
                            side_1 = Side.Bottom;
                        }
                        if (Math.abs(br_0.y - tl_1.y) < b)
                        {
                            side_0 = Side.Bottom;
                            side_1 = Side.Top;
                        }
                    }

                    // Generate references for any intersection
                    if (side_0 != Side.None)
                    {
                        this.Refs.push(new ControlRef(control_0_index, control_0, side_0, control_1));
                        this.Refs.push(new ControlRef(control_1_index, control_1, side_1, control_0));
                        to_visit_controls.push(control_1);
                    }
                }
            }
        }

        DebugLog()
        {
            console.log("\n--- DebugLog --------------------------------");

            let x = Side[Side.Top];
            for (let ref_info of this.RefInfos)
            {
                if (!(ref_info.Control instanceof Container))
                    continue;
                if (ref_info.NbRefs == 0)
                    continue;
                
                let names = "";
                for (let i = 0; i < ref_info.NbRefs; i++)
                {
                    let window = this.Refs[ref_info.StartRef + i].To as Window;
                    names += window.Title + ", ";
                }

                console.log((<Window>ref_info.Control).Title, Side[ref_info.Side] + ": ", names);
            }

            /*for (let ref of this.Refs)
            {
                console.log((<Window>ref.From).Title, ref.Side, (<Window>ref.To).Title);
            }*/            
        }
    }
}
