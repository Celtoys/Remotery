
namespace WM
{
    class Span
    {
        // Only for DebugLog
        Title: string;

        // Source control for copying simulation back
        Control: Control;

        Min: number;
        Max: number;

        RestSizeStrength: number;
        SizeStrength: number;

        // Number of controls between this one and the side of the container
        SideDistance: number;
    }

    class SizeConstraint
    {
        Span: Span;
        Size: number;
    }

    class ContainerConstraint
    {
        Span: Span;
        Side: Side;
        Position: number;
    }

    class BufferConstraint
    {
        Span0: Span;
        Span1: Span;
        Side: Side;
    }

    class SnapConstraint
    {
        MinSpan: Span;
        MaxSpan: Span;
    }

    // TODO: Need to unify snapped controls into one constraint instead of multiple
    export class ControlSizer
    {
        // Allow the sizer to work independently on horizontal/vertical axes
        MinSide: Side;
        MaxSide: Side;

        ContainerRestSize: number;
        ContainerSize: number;

        Spans: Span[] = [];

        ContainerConstraints: ContainerConstraint[] = [];
        BufferConstraints: BufferConstraint[] = [];
        SizeConstraints: SizeConstraint[] = [];
        SnapConstraints: SnapConstraint[] = [];

        Clear()
        {
            this.Spans = [];
            this.ContainerConstraints = [];
            this.BufferConstraints = [];
            this.SizeConstraints = [];
            this.SnapConstraints = [];
        }

        Build(base_side: Side, container: Container, control_graph: ControlGraph)
        {
            this.MinSide = base_side;
            this.MaxSide = base_side + 1;

            if (base_side == Side.Left)
                this.ContainerRestSize = container.ControlParentNode.Size.x;
            else
                this.ContainerRestSize = container.ControlParentNode.Size.y;

            // Clear previous constraints
            this.Clear();

            // Build the span list
            this.BuildSpans(container);

            // Build constraints
            let min_controls: number[] = [];
            let max_controls: number[] = [];
            this.BuildContainerConstraints(container, control_graph, min_controls, max_controls);
            this.BuildBufferConstraints(container, control_graph);
            this.BuildSnapConstraints(container, control_graph);

            this.SetInitialSizeStrengths(container, control_graph, min_controls, max_controls);
        }

        ChangeSize(new_size: number, control_graph: ControlGraph)
        {
            // Update container constraints with new size
            this.ContainerSize = new_size;
            let half_delta_size = (this.ContainerRestSize - new_size) / 2;
            let min_offset = half_delta_size + Container.SnapBorderSize;
            let max_offset = this.ContainerRestSize - min_offset;
            for (let constraint of this.ContainerConstraints)
            {
                if (constraint.Side == this.MinSide)
                    constraint.Position = min_offset;
                else
                    constraint.Position = max_offset;
            }

            // Relax
            for (let i = 0; i < 50; i++)
            {
                this.ApplySizeConstraints();
                this.ApplyMinimumSizeConstraints();
                this.ApplyBufferConstraints();

                // Do this here before non-spring constraints
                this.IntegerRoundSpans();

                this.ApplyContainerConstraints();

                // HERE
                this.ReevaluateSizeStrengths(control_graph);
            }

            // TODO: Finish with a snap! Can that be made into a constraint?
            // Problem is that multiple controls may be out of line
            this.ApplySnapConstraints();
            this.ApplyContainerConstraints();
            
            // Copy simulation back to the controls
            for (let span of this.Spans)
            {
                if (this.MinSide == Side.Left)
                {
                    span.Control.Position = new int2(span.Min - half_delta_size, span.Control.Position.y);
                    span.Control.Size = new int2(span.Max - span.Min, span.Control.Size.y);
                }
                else
                {
                    span.Control.Position = new int2(span.Control.Position.x, span.Min - half_delta_size);
                    span.Control.Size = new int2(span.Control.Size.x, span.Max - span.Min);
                }
            }
        }

        private BuildSpans(container: Container)
        {
            for (let control of container.Controls)
            {
                // Anything that's not a control (e.g. a Ruler) still needs an entry in the array, even if it's empty
                if (!(control instanceof Container))
                {
                    this.Spans.push(null);
                    continue;
                }

                // Set initial parameters
                let span = new Span();
                span.Control = control;
                if (this.MinSide == Side.Left)
                {
                    span.Min = control.TopLeft.x;
                    span.Max = control.BottomRight.x;
                }
                else
                {
                    span.Min = control.TopLeft.y;
                    span.Max = control.BottomRight.y;
                }
                span.SizeStrength = 1;
                span.RestSizeStrength = 1;
                span.SideDistance = 10000;  // Set to a high number so a single < can be used to both compare and test for validity
                this.Spans.push(span);

                if (control instanceof Window)
                    span.Title = (<Window>control).Title;

                // Add a size constraint for each span
                let size_constraint = new SizeConstraint();
                size_constraint.Span = span;
                size_constraint.Size = span.Max - span.Min;
                this.SizeConstraints.push(size_constraint);
            }
        }

        private ApplySizeConstraints()
        {
            for (let constraint of this.SizeConstraints)
            {
                let span = constraint.Span;
                let size = span.Max - span.Min;
                let center = (span.Min + span.Max) * 0.5;
                let half_delta_size = (constraint.Size - size) * 0.5;
                let half_border_size = size * 0.5 + half_delta_size * span.SizeStrength;
                span.Min = center - half_border_size;
                span.Max = center + half_border_size;
            }
        }

        private ApplyMinimumSizeConstraints()
        {
            for (let constraint of this.SizeConstraints)
            {
                let span = constraint.Span;

                if (span.Max - span.Min < 20)
                {
                    let center = (span.Min + span.Max) * 0.5;
                    span.Min = center - 10;
                    span.Max = center + 10;
                }
            }
        }

        private BuildContainerConstraints(container: Container, control_graph: ControlGraph, min_controls: number[], max_controls: number[])
        {
            for (let i = 0; i < container.Controls.length; i++)
            {
                let min_ref_info = control_graph.RefInfos[i * 4 + this.MinSide];
                let max_ref_info = control_graph.RefInfos[i * 4 + this.MaxSide];

                // Looking for controls that reference the external container on min/max sides
                if (min_ref_info.References(container))
                {
                    let constraint = new ContainerConstraint();
                    constraint.Span = this.Spans[i];
                    constraint.Side = this.MinSide;
                    constraint.Position = 0;
                    this.ContainerConstraints.push(constraint);

                    // Track min controls for strength setting
                    min_controls.push(i);
                }
                if (max_ref_info.References(container))
                {
                    let constraint = new ContainerConstraint();
                    constraint.Span = this.Spans[i];
                    constraint.Side = this.MaxSide;
                    constraint.Position = this.ContainerRestSize;
                    this.ContainerConstraints.push(constraint);

                    // Track max controls for strength setting
                    max_controls.push(i);
                }
            }
        }

        private ApplyContainerConstraints()
        {
            for (let constraint of this.ContainerConstraints)
            {
                if (constraint.Side == this.MinSide)
                    constraint.Span.Min = constraint.Position;
                else
                    constraint.Span.Max = constraint.Position;
            }
        }

        private BuildBufferConstraints(container: Container, control_graph: ControlGraph)
        {
            for (let ref of control_graph.Refs)
            {
                // Only want sides on the configured axis
                if (ref.Side != this.MinSide && ref.Side != this.MaxSide)
                    continue;

                // There are two refs for each connection; ensure only one of them is used
                if (ref.FromIndex < ref.ToIndex)
                {
                    let constraint = new BufferConstraint();
                    constraint.Span0 = this.Spans[ref.FromIndex];
                    constraint.Side = ref.Side;
                    constraint.Span1 = this.Spans[ref.ToIndex];
                    this.BufferConstraints.push(constraint);
                }
            }
        }

        private ApplyBufferConstraints()
        {
            for (let constraint of this.BufferConstraints)
            {
                if (constraint.Side == this.MinSide)
                {
                    let span0 = constraint.Span0;
                    let span1 = constraint.Span1;
                    let min = span1.Max;
                    let max = span0.Min;
                    let center = (min + max) * 0.5;
                    let size = max - min;
                    let half_delta_size = (Container.SnapBorderSize - size) * 0.5;
                    let half_new_size = size * 0.5 + half_delta_size * 0.5;
                    span0.Min = center + half_new_size;
                    span1.Max = center - half_new_size;
                }
                else
                {
                    let span0 = constraint.Span0;
                    let span1 = constraint.Span1;
                    let min = span0.Max;
                    let max = span1.Min;
                    let center = (min + max) * 0.5;
                    let size = max - min;
                    let half_delta_size = (Container.SnapBorderSize - size) * 0.5;
                    let half_new_size = size * 0.5 + half_delta_size * 0.5;
                    span1.Min = center + half_new_size;
                    span0.Max = center - half_new_size;
                }
            }
        }

        private BuildSnapConstraints(container: Container, control_graph: ControlGraph)
        {
            for (let ref of control_graph.Refs)
            {
                if (ref.Side == this.MaxSide && ref.To != container)
                {
                    let constraint = new SnapConstraint();
                    constraint.MinSpan = this.Spans[ref.FromIndex];
                    constraint.MaxSpan = this.Spans[ref.ToIndex];
                    this.SnapConstraints.push(constraint);
                }
            }
        }

        private IntegerRoundSpans()
        {
            for (let span of this.Spans)
            {
                span.Min = Math.round(span.Min);
                span.Max = Math.round(span.Max);
            }
        }

        private ApplySnapConstraints()
        {
            for (let constraint of this.SnapConstraints)
            {
                constraint.MaxSpan.Min = constraint.MinSpan.Max + Container.SnapBorderSize - 1;
            }

            // TODO: Snap to container
        }

        private SetInitialSizeStrengths(container: Container, control_graph: ControlGraph, min_controls: number[], max_controls: number[])
        {
            let weak_strength = 0.01;
            let strong_strength = 0.5;

            let side_distance = 0;
            while (min_controls.length && max_controls.length)
            {
                // Mark side distances and set strong strengths before walking further
                for (let index of min_controls)
                {
                    let span = this.Spans[index];
                    span.SideDistance = side_distance;
                    span.SizeStrength = strong_strength;
                }
                for (let index of max_controls)
                {
                    let span = this.Spans[index];
                    span.SideDistance = side_distance;
                    span.SizeStrength = strong_strength;
                }

                let next_min_controls: number[] = [];
                let next_max_controls: number[] = [];

                // Make one graph step towards max for the min controls, setting strengths
                for (let index of min_controls)
                {
                    let span = this.Spans[index];
                    let ref_info = control_graph.RefInfos[index * 4 + this.MaxSide];

                    for (let i = 0; i < ref_info.NbRefs; i++)
                    {
                        let ref = ref_info.GetControlRef(i);
                        let span_to = this.Spans[ref.ToIndex];

                        // If we've hit the container this is a control that is anchored on both sides
                        if (ref.To == container)
                        {
                            // Set it to weak so that it's always collapsable
                            span.SizeStrength = weak_strength;
                            continue;
                        }

                        // If we bump up against a span of equal distance, their anchor point is the graph's middle
                        if (span.SideDistance == span_to.SideDistance)
                        {
                            // Mark both sides as weak to make the equally collapsable
                            span.SizeStrength = weak_strength;
                            span_to.SizeStrength = weak_strength;
                            continue;
                        }

                        // If the other side has a smaller distance then this is a center control
                        if (span.SideDistance > span_to.SideDistance)
                        {
                            // Only the control should be marked for collapse
                            span.SizeStrength = weak_strength;
                            continue;
                        }

                        // Walk toward the max
                        if (next_min_controls.indexOf(ref.ToIndex) == -1)
                            next_min_controls.push(ref.ToIndex);
                    }
                }

                // Make one graph step towards min for the max controls, not setting strengths
                for (let index of max_controls)
                {
                    let ref_info = control_graph.RefInfos[index * 4 + this.MinSide];
                    for (let i = 0; i < ref_info.NbRefs; i++)
                    {
                        let ref = ref_info.GetControlRef(i);
                        let span_to = this.Spans[ref.ToIndex];

                        // Strengths are already set from the min controls so abort walk when coming up
                        // against a min control
                        if (ref.To == container || span_to.SideDistance != 10000)
                            continue;
                        
                        // Walk toward the min
                        if (next_max_controls.indexOf(ref.ToIndex) == -1)
                            next_max_controls.push(ref.ToIndex);
                    }
                }

                min_controls = next_min_controls;
                max_controls = next_max_controls;
                side_distance++;
            }

            // Record initial size strength for restoration
            for (let span of this.Spans)
                span.RestSizeStrength = span.SizeStrength;
        }

        ReevaluateSizeStrengths(control_graph: ControlGraph)
        {
            for (let index = 0; index < this.Spans.length; index++)
            {
                let span = this.Spans[index];
                span.SizeStrength = span.RestSizeStrength;

                let min_ref_info = control_graph.RefInfos[index * 4 + this.MinSide];
                for (let i = 0; i < min_ref_info.NbRefs; i++)
                {
                    let ref = min_ref_info.GetControlRef(i);
                    if (ref.ToIndex != -1)
                    {
                        let span_to = this.Spans[ref.ToIndex];
                        let size = span_to.Max - span_to.Min;
                        if (size <= 20)
                        {
                            span.SizeStrength = 0.01;
                            break;
                        }
                    }
                }

                let max_ref_info = control_graph.RefInfos[index * 4 + this.MaxSide];
                for (let i = 0; i < max_ref_info.NbRefs; i++)
                {
                    let ref = max_ref_info.GetControlRef(i);
                    if (ref.ToIndex != -1)
                    {
                        let span_to = this.Spans[ref.ToIndex];
                        let size = span_to.Max - span_to.Min;
                        if (size <= 20)
                        {
                            span.SizeStrength = 0.01;
                            break;
                        }
                    }
                }
            }
        }

        DebugLog()
        {
            for (let span of this.Spans)
            {
                if (span)
                    console.log("Span: ", span.Title, span.Min, "->", span.Max, "...", span.SideDistance, "/", span.SizeStrength);
                else
                    console.log("Null Span");
            }

            for (let constraint of this.SizeConstraints)
            {
                console.log("Size Constraint: ", constraint.Span.Title, "@", constraint.Size);
            }

            for (let constraint of this.ContainerConstraints)
            {
                console.log("Container Constraint: ", constraint.Span.Title, Side[constraint.Side], "@", constraint.Position);
            }

            for (let constraint of this.BufferConstraints)
            {
                console.log("Buffer Constraint: ", constraint.Span0.Title, "->", constraint.Span1.Title, "on", Side[constraint.Side]);
            }
        }
    };
}