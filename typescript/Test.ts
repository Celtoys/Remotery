
//
// TODO:
//
// * Show windows with animation?
// * Make root window that's embedded in the browser.
// * When adding a control, give option to add as shown/hidden.
// * Move all WindowManager functionality into Window and apply it to Controls.
//  

function TestAll()
{
    let c0 = new WM.Container(new int2(10, 10), new int2(1000, 800));
    c0.Show();

    //c0.ZIndex

    //c0.AnchorWidthToParent(10);
    //c0.AnchorHeightToParent(10);

    //c0.AnchorLeftToParent(20);

    let w0 = new WM.Window("Test Window", new int2(300, 300), new int2(200, 200));
    w0.Title = "Changed Title";
    c0.Add(w0);

    let w1 = new WM.Window("Blah", new int2(10, 10), new int2(200, 200));
    //w1.AnchorWidthToParent(10);
    //w1.AnchorHeightToParent(10);
    w0.Add(w1);

    let w2 = new WM.Window("Derp", new int2(400, 400), new int2(200, 200));
    c0.Add(w2);

    let w3 = new WM.Window("BlahNext", new int2(40, 40), new int2(200, 200));
    //w3.AnchorLeftToParent(w1);
    //w3.AnchorRightToParent(30);
    w0.Add(w3);
}