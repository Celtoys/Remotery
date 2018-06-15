
namespace WM
{
    export class PanelRef
    {
        // Primary sort key, to be combined with Side
        FromIndex: number;

        // Cached panel reference to save needing to lookup in the parent
        From: Panel;

        // Which side of the panel the reference is on
        Side: Side;

        // Panel this references
        ToIndex: number;
        To: Panel;


        constructor(from_index: number, from: Panel, side: Side, to_index: number, to: Panel)
        {
            this.FromIndex = from_index;
            this.From = from;
            this.Side = side;
            this.ToIndex = to_index;
            this.To = to;
        }

        get SortIndex() : number
        {
            return this.FromIndex * 4 + this.Side;
        }
    }


    export class PanelRefInfo
    {
        // Storing this allows the class to query graph properties without the extra parameter
        ParentGraph: PanelGraph;

        // Cached panel reference to save needing to lookup in the parent
        Panel: Panel;

        // Side specified for debug
        Side: Side;

        // Links in the panel ref array
        StartRef: number;
        NbRefs: number;

        constructor(parent_graph: PanelGraph, panel: Panel, side: Side)
        {
            this.ParentGraph = parent_graph;
            this.Panel = panel;
            this.Side = side;
            this.StartRef = -1;
            this.NbRefs = 0;
        }

        References(panel: Panel) : boolean
        {
            for (let i = 0; i < this.NbRefs; i++)
            {
                if (this.ParentGraph.Refs[this.StartRef + i].To == panel)
                    return true;
            }

            return false;
        }

        GetPanelRef(index: number) : PanelRef
        {
            if (index < this.NbRefs)
                return this.ParentGraph.Refs[this.StartRef + index];

            return null;
        }

        GetSide(side: Side) : PanelRefInfo
        {
            if (this.NbRefs == 0)
                return null;
            
            let ref = this.ParentGraph.Refs[this.StartRef];
            return this.ParentGraph.RefInfos[ref.FromIndex * 4 + side];
        }
    }


    export class PanelGraph
    {
        Refs: PanelRef[] = [];

        RefInfos: PanelRefInfo[] = [];

        Build(container: PanelContainer)
        {
            // Clear existing references
            this.Refs = [ ];
            this.RefInfos = [ ];

            // Mark all panels as unvisited
            let panel_visited: boolean[] = [];
            for (let i = 0; i < container.Panels.length; i++)
                panel_visited.push(false);

            // Build references for each panel
            for (let i = 0; i < container.Panels.length; i++)
            {
                if (panel_visited[i])
                    continue;

                let child_panel = container.Panels[i];
                if (!child_panel.Visible)
                    continue;

                // Exempt rulers from the graph
                // TODO: Add some type traits or perhaps a property that can control this instead of just limiting to rulers
                if (child_panel instanceof Ruler)
                    continue;

                this.BuildRefs(child_panel, container, panel_visited);
            }

            // Sort panel references, packing panels/sides next to each other
            this.Refs.sort((a: PanelRef, b: PanelRef) : number =>
            {
                return a.SortIndex - b.SortIndex;
            });

            // Initialise the panel ref info array
            for (let i = 0; i < container.Panels.length * 4; i++)
            {
                let child_panel = container.Panels[i >> 2];
                this.RefInfos.push(new PanelRefInfo(this, child_panel, i & 3));
            }

            // Tell each panel where its reference list starts and ends
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

        private BuildRefs(root_panel: Panel, container: PanelContainer, panel_visited: boolean[])
        {
            // First panel to visit is the root panel
            let to_visit_panels: Panel[] = [ root_panel ];

            // Loop through any panels left to visit
            for (let panel_0 of to_visit_panels)
            {
                // It's possible for the same panel to be pushed onto the to-visit list more than once
                let panel_0_index = container.Panels.indexOf(panel_0);
                if (panel_visited[panel_0_index])
                    continue;
                panel_visited[panel_0_index] = true;

                let tl_0 = panel_0.TopLeft;
                let br_0 = panel_0.BottomRight;

                // Add references to the parent panel
                let parent_panel = container.Owner;
                let b = Panel.SnapBorderSize;
                let s = parent_panel.PanelContainerNode.Size;
                if (tl_0.x <= b)
                    this.Refs.push(new PanelRef(panel_0_index, panel_0, Side.Left, -1, parent_panel));
                if (tl_0.y <= b)
                    this.Refs.push(new PanelRef(panel_0_index, panel_0, Side.Top, -1, parent_panel));
                if (br_0.x >= s.x - b)
                    this.Refs.push(new PanelRef(panel_0_index, panel_0, Side.Right, -1, parent_panel));
                if (br_0.y >= s.y - b)
                    this.Refs.push(new PanelRef(panel_0_index, panel_0, Side.Bottom, -1, parent_panel));

                // Check candidate panels for auto-anchor intersection
                for (let panel_1 of container.Panels)
                {
                    // If a panel has been previous visited, no need to add forward links as back
                    // links would have been added when it was visited
                    let panel_1_index = container.Panels.indexOf(panel_1);
                    if (panel_visited[panel_1_index])
                        continue;

                    if (!panel_1.Visible)
                        continue;
    
                    // Exempt rulers from the graph
                    // TODO: Add some type traits or perhaps a property that can control this instead of just limiting to rulers
                    if (panel_1 instanceof Ruler)
                        continue;

                    let tl_1 = panel_1.TopLeft;
                    let br_1 = panel_1.BottomRight;

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
                        this.Refs.push(new PanelRef(panel_0_index, panel_0, side_0, panel_1_index, panel_1));
                        this.Refs.push(new PanelRef(panel_1_index, panel_1, side_1, panel_0_index, panel_0));
                        to_visit_panels.push(panel_1);
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
                if (!(ref_info.Panel instanceof Panel))
                    continue;
                if (ref_info.NbRefs == 0)
                    continue;
                
                let names = "";
                for (let i = 0; i < ref_info.NbRefs; i++)
                {
                    //let window = this.Refs[ref_info.StartRef + i].To as Window;
                    //names += window.Title + ", ";
                }

                //console.log((<Window>ref_info.Control).Title, Side[ref_info.Side] + ": ", names);
            }

            /*for (let ref of this.Refs)
            {
                console.log((<Window>ref.From).Title, ref.Side, (<Window>ref.To).Title);
            }*/            
        }
    }
}
