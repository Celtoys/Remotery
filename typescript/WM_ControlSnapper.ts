
namespace WM
{
    export const enum SnapCode
    {
        None = 0,
        X    = 1,
        Y    = 2,
    }

    function SnapControl(pos: int2, snap_pos: int2, mask: int2, p_mask: int2, n_mask: int2, top_left: int2, bottom_right: int2) : int2
    {
        let b = Container.SnapBorderSize;
        let out_mask = new int2(0);

        // Distance from input position to opposing corners of the control
        let d_tl = int2.Abs(int2.Sub(pos, top_left));
        let d_br = int2.Abs(int2.Sub(pos, bottom_right));

        // If any distances are within the snap border, move the snap position to them
        if (mask.x != 0)
        {
            if (d_tl.x < b)
            {
                snap_pos.x = top_left.x - p_mask.x;
                out_mask.x = -1;
            }
            if (d_br.x < b)
            {
                snap_pos.x = bottom_right.x + n_mask.x;
                out_mask.x = 1;
            }
        }
        if (mask.y != 0)
        {
            if (d_tl.y < b)
            {
                snap_pos.y = top_left.y - p_mask.y;
                out_mask.y = -1;
            }
            if (d_br.y < b)
            {
                snap_pos.y = bottom_right.y + n_mask.y;
                out_mask.y = 1;
            }
        }

        return out_mask;
    }

    export function FindSnapControls(container: Container, pos: int2, mask: int2, excluding: Control[], out_controls: [Control, int2][] = null) : [SnapCode, int2]
    {
        // Selects between control edge and a border-distance outside the control edge
        let b = Container.SnapBorderSize;
        let p_mask = int2.Mul(int2.Max0(mask), new int2(b - 1));
        let n_mask = int2.Mul(int2.Min0(mask), new int2(-b + 1));

        // Start off with no snap adjustment
        let snap_pos = pos.Copy();

        // Snap to sibling container bounds
        let snap_code = SnapCode.None;
        for (let control of container.Controls)
        {
            if (!(control instanceof Container))
                continue;
            if (excluding.indexOf(control) != -1)
                continue;

            var top_left = control.TopLeft;
            var bottom_right = control.BottomRight;

            let out_mask = SnapControl(
                pos,
                snap_pos,
                mask,
                p_mask,
                n_mask,
                control.TopLeft,
                control.BottomRight);
            
            snap_code |= out_mask.x != 0 ? SnapCode.X : 0;
            snap_code |= out_mask.y != 0 ? SnapCode.Y : 0;

            // Collect sibling controls if asked to
            if (out_controls && (out_mask.x != 0 || out_mask.y != 0))
                out_controls.push([control, out_mask]);
        }

        // Snap to parent container bounds
        let parent_size = container.ControlParentNode.Size;
        let out_mask = SnapControl(
            pos,
            snap_pos,
            mask,
            p_mask,
            n_mask,
            new int2(b),
            int2.Sub(parent_size, new int2(b)));

        snap_code |= out_mask.x != 0 ? SnapCode.X : 0;
        snap_code |= out_mask.y != 0 ? SnapCode.Y : 0;

        return [ snap_code, snap_pos ];
    }
}
