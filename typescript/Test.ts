
//
// TODO:
//
// * Show windows with animation?
// * Make root window that's embedded in the browser.
// * When adding a control, give option to add as shown/hidden.
// * Move all WindowManager functionality into Window and apply it to Controls.
//  

function TestAll() : WM.Container
{
    let Container = new WM.Container(new int2(10, 10), new int2(1000, 800));
    Container.Show();

    let WindowA = new WM.Window("Window A", new int2(10, 10), new int2(200, 200));
    WindowA.Title = "Window A Changed";
    Container.Add(WindowA);

    WindowA.Add(new WM.Window("SubWindow 0 A", new int2(10, 10), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 B", new int2(20, 20), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 C", new int2(30, 30), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 D", new int2(40, 40), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 E", new int2(50, 50), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 F", new int2(60, 60), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 G", new int2(70, 70), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 H", new int2(80, 80), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 I", new int2(90, 90), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 J", new int2(100, 100), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 K", new int2(110, 110), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 L", new int2(120, 120), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 M", new int2(130, 130), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 N", new int2(140, 140), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow 0 O", new int2(150, 150), new int2(200, 200)));

    Container.Add(new WM.Window("Window B", new int2(220, 10), new int2(200, 200)));
    Container.Add(new WM.Window("Window C", new int2(430, 10), new int2(200, 200)));
    Container.Add(new WM.Window("Window D", new int2(640, 10), new int2(200, 200)));
    Container.Add(new WM.Window("Window E", new int2(10, 220), new int2(200, 200)));
    Container.Add(new WM.Window("Window F", new int2(220, 220), new int2(200, 200)));
    Container.Add(new WM.Window("Window G", new int2(430, 220), new int2(200, 200)));
    Container.Add(new WM.Window("Window H", new int2(640, 220), new int2(200, 200)));

    let WindowI = new WM.Window("Window I", new int2(500, 400), new int2(300, 300));
    Container.Add(WindowI);
    WindowI.Add(new WM.Window("SubWindow 1 A", new int2(10, 10), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 B", new int2(20, 20), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 C", new int2(30, 30), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 D", new int2(40, 40), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 E", new int2(50, 50), new int2(289, 289)));

    return Container;
}