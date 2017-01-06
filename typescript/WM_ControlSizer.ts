
namespace WM
{
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
    export class ControlSizer
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
}