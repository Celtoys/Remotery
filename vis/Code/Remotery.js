
//
// TODO: Window resizing needs finer-grain control
// TODO: Take into account where user has moved the windows
// TODO: Controls need automatic resizing within their parent windows
//


Settings = (function()
{
    function Settings()
    {
        this.IsPaused = false;
        this.SyncTimelines = true;
    }

    return Settings;

})();


Remotery = (function()
{
    // crack the url and get the parameter we want
    var getUrlParameter = function getUrlParameter( search_param)
    {
        var page_url = decodeURIComponent( window.location.search.substring(1) ),
                        url_vars = page_url.split('&'),
                        param_name,
                        i;

        for (i = 0; i < url_vars.length; i++)
        {
            param_name = url_vars[i].split('=');

            if (param_name[0] === search_param)
            {
                return param_name[1] === undefined ? true : param_name[1];
            }
        }
    };

    function Remotery()
    {
        this.WindowManager = new WM.WindowManager();
        this.Settings = new Settings();

        // "addr" param is ip:port and will override the local store version if passed in the URL
        var addr = getUrlParameter( "addr" );
        if ( addr != null )
            this.ConnectionAddress = "ws://" + addr + "/rmt";
        else
            this.ConnectionAddress = LocalStore.Get("App", "Global", "ConnectionAddress", "ws://127.0.0.1:17815/rmt");

        this.got_first_connection = false;

        this.Servers = [];

        this.glCanvas = new GLCanvas(100, 100);
        this.glCanvas.SetOnDraw((gl, seconds) => this.OnGLCanvasDraw(gl, seconds));

        // Create the console up front as everything reports to it
        this.Console = new Console(this.WindowManager);

        // Create required windows
        this.TitleWindow = new TitleWindow(this.WindowManager, this.Settings, this.ConnectionAddress);
        this.TitleWindow.SetConnectionAddressChanged(Bind(OnAddressChanged, this));
        this.SampleTimelineWindow = new TimelineWindow(this.WindowManager, "Sample Timeline", this.Settings, Bind(OnTimelineCheck, this), this.glCanvas);
        this.SampleTimelineWindow.SetOnHover(Bind(OnSampleHover, this));
        this.SampleTimelineWindow.SetOnSelected(Bind(OnSampleSelected, this));
        this.ProcessorTimelineWindow = new TimelineWindow(this.WindowManager, "Processor Timeline", this.Settings, null, this.glCanvas);

        this.SampleTimelineWindow.SetOnMoved(Bind(OnTimelineMoved, this));
        this.ProcessorTimelineWindow.SetOnMoved(Bind(OnTimelineMoved, this));

        this.TraceDrop = new TraceDrop(this);

        this.nbGridWindows = 0;
        this.gridWindows = { };
        this.FrameHistory = { };
        this.ProcessorFrameHistory = { };
        this.PropertyFrameHistory = [ ];
        this.SelectedFrames = { };

        // Kick-off the auto-connect loop
        AutoConnect(this);

        // Hook up resize event handler
        DOM.Event.AddHandler(window, "resize", Bind(OnResizeWindow, this));
        OnResizeWindow(this);
    }


    Remotery.prototype.Clear = function()
    {
        // Clear timelines
        this.SampleTimelineWindow.Clear();
        this.ProcessorTimelineWindow.Clear();

        // Close and clear all sample windows
        for (var i in this.gridWindows)
        {
            const grid_window = this.gridWindows[i];
            grid_window.Close();
        }
        this.nbGridWindows = 0;
        this.gridWindows = { };
        this.propertyGridWindows = [];

        for (let server_id = 0; server_id < this.Servers.length; ++server_id) {
            const window_name = "__rmt__global__properties" + (this.Servers.length > 1 ? "_" + server_id : "") + "__";
            const window_display_name = "Global Properties" + (this.Servers.length > 1 ? " " + server_id : "");
            this.propertyGridWindows.push(this.AddGridWindow(window_name, window_display_name, new GridConfigProperties()));
        }

        // Clear runtime data
        this.FrameHistory = { };
        this.ProcessorFrameHistory = { };
        this.PropertyFrameHistory = [ ];
        this.SelectedFrames = { };
        this.glCanvas.ClearTextResources();

        // Resize everything to fit new layout
        OnResizeWindow(this);
    }

    function DrawWindowMask(gl, program, window_node)
    {
        gl.useProgram(program);

        // Using depth as a mask
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // Viewport constants
        glSetUniform(gl, program, "inViewport.width", gl.canvas.width);
        glSetUniform(gl, program, "inViewport.height", gl.canvas.height);

        // Window dimensions
        const rect = window_node.getBoundingClientRect();
        glSetUniform(gl, program, "minX", rect.left);
        glSetUniform(gl, program, "minY", rect.top);
        glSetUniform(gl, program, "maxX", rect.left + rect.width);
        glSetUniform(gl, program, "maxY", rect.top + rect.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    Remotery.prototype.OnGLCanvasDraw = function(gl, seconds)
    {
        this.glCanvas.textBuffer.UploadData();

        // Draw windows in their z-order, front-to-back
        // Depth test is enabled, rejecting equal z, and windows render transparent
        // Draw window content first, then draw the invisible window mask
        // Any windows that come after another window will not draw where the previous window already masked out depth
        for (let window of this.WindowManager.Windows)
        {
            // Some windows might not have WebGL drawing on them; they need to occlude as well
            DrawWindowMask(gl, this.glCanvas.windowProgram, window.Node);

            if (window.userData != null)
            {
                window.userData.Draw();
            }
        }
    }

    function AutoConnect(self)
    {
        const connection_addresses = expandTop(self.ConnectionAddress);
        const servers_length = self.Servers.length;

        for (let server_id = servers_length; server_id < connection_addresses.length; ++server_id) {
            connection_address = connection_addresses[server_id];
            let server = new WebSocketConnection();
            server.AddConnectHandler(Bind(OnConnect, self, server_id));
            server.AddDisconnectHandler(Bind(OnDisconnect, self, server_id));
            // Setup log requests from the server
            server.SetConsole(self.Console);
            server.AddMessageHandler("LOGM", Bind(self.Console.OnLog.bind(self.Console), server));
            server.AddMessageHandler("PING", Bind(self.TitleWindow.OnPing.bind(self.TitleWindow), server_id, connection_addresses.length));
            server.AddMessageHandler("SSST", Bind(OnSamplesStart, self, server_id));
            server.AddMessageHandler("SMPL", Bind(OnSamples, self, server_id));
            server.AddMessageHandler("SSMP", Bind(OnSampleName, self, server_id));
            server.AddMessageHandler("PRTH", Bind(OnProcessorThreads, self, server_id));
            server.AddMessageHandler("PSNP", Bind(OnPropertySnapshots, self, server_id));
            self.Servers.push(server);
        }

        for (let server_id = 0; server_id < connection_addresses.length; ++server_id) {
            // Only attempt to connect if there isn't already a connection or an attempt to connect
            if (!self.Servers[server_id].Connected() && !self.Servers[server_id].Connecting())
            {
                self.Servers[server_id].Connect(connection_addresses[server_id]);
            }
        }

        self.Servers.length = connection_addresses.length;

        if (self.Servers.length > 0) {
            self.Console.SetServer(self.Servers[0]);
        }

        // Always schedule another check
        window.setTimeout(Bind(AutoConnect, self), 2000);
    }


    function OnConnect(self, server_id)
    {
        self.Servers[server_id].Send("GSST");

        if (!self.got_first_connection) {
            // Connection address has been validated
            LocalStore.Set("App", "Global", "ConnectionAddress", self.ConnectionAddress);

            self.Clear();

            // Ensure the viewer is ready for realtime updates
            self.TitleWindow.Unpause();

            self.got_first_connection = true;
        }
    }

    function OnDisconnect(self, server_id)
    {
        if (self.Servers.every((server) => !server.Connected())) {
            // Pause so the user can inspect the trace
            self.TitleWindow.Pause();

            self.got_first_connection = false;
        }
    }


    function OnAddressChanged(self, node)
    {
        // Update and disconnect, relying on auto-connect to reconnect
        self.ConnectionAddress = node.value;
        this.got_first_connection = true;

        for (const server of self.Servers) {
            server.Disconnect();
        }

        // Give input focus away
        return false;
    }


    Remotery.prototype.AddGridWindow = function(name, display_name, config)
    {
        const grid_window = new GridWindow(this.WindowManager, display_name, this.nbGridWindows, this.glCanvas, config);
        this.gridWindows[name] = grid_window;
        this.gridWindows[name].WindowResized(this.SampleTimelineWindow.Window, this.Console.Window);
        this.nbGridWindows++;
        MoveGridWindows(this);
        return grid_window;
    }


    function DecodeSampleHeader(self, data_view_reader, length)
    {
        // Message-specific header
        let message = { };
        message.messageStart = data_view_reader.Offset;
        message.thread_name = data_view_reader.GetString();
        message.nb_samples = data_view_reader.GetUInt32();
        message.partial_tree = data_view_reader.GetUInt32();

        // Align sample reading to 32-bit boundary
        const align = ((4 - (data_view_reader.Offset & 3)) & 3);
        data_view_reader.Offset += align;
        message.samplesStart = data_view_reader.Offset;
        message.samplesLength = length - (message.samplesStart - message.messageStart);

        return message;
    }


    function SetNanosecondsAsMilliseconds(samples_view, offset)
    {
        samples_view.setFloat32(offset, samples_view.getFloat64(offset, true) / 1000.0, true);
    }


    function SetUint32AsFloat32(samples_view, offset)
    {
        samples_view.setFloat32(offset, samples_view.getUint32(offset, true), true);
    }


    function ProcessSampleTree(self, server_id, sample_data, message)
    {
        const empty_text_entry = {
            offset: 0,
            length: 1,
        };

        const samples_length = message.nb_samples * g_nbBytesPerSample;
        const samples_view = new DataView(sample_data, message.samplesStart, samples_length);
        message.sampleDataView = samples_view;

        for (let offset = 0; offset < samples_length; offset += g_nbBytesPerSample)
        {
            // Get name hash and lookup in name map
            const name_hash = samples_view.getUint32(offset, true);
            const [ name_exists, name ] = self.glCanvas.nameMap.Get(server_id, name_hash);

            // If the name doesn't exist in the map yet, request it from the server
            if (!name_exists)
            {
                if (self.Servers[server_id].Connected())
                {
                    self.Servers[server_id].Send("GSMP" + name_hash);
                }
            }

            // Add sample name text buffer location
            const text_entry = name.textEntry != null ? name.textEntry : empty_text_entry;
            samples_view.setFloat32(offset + g_sampleOffsetBytes_NameOffset, text_entry.offset, true);
            samples_view.setFloat32(offset + g_sampleOffsetBytes_NameLength, text_entry.length, true);

            // Time in milliseconds
            SetNanosecondsAsMilliseconds(samples_view, offset + g_sampleOffsetBytes_Start);
            SetNanosecondsAsMilliseconds(samples_view, offset + g_sampleOffsetBytes_Length);
            SetNanosecondsAsMilliseconds(samples_view, offset + g_sampleOffsetBytes_Self);
            SetNanosecondsAsMilliseconds(samples_view, offset + g_sampleOffsetBytes_GpuToCpu);

            // Convert call count/recursion integers to float
            SetUint32AsFloat32(samples_view, offset + g_sampleOffsetBytes_Calls);
            SetUint32AsFloat32(samples_view, offset + g_sampleOffsetBytes_Recurse);
        }

        // Convert to floats for GPU
        message.sampleFloats = new Float32Array(sample_data, message.samplesStart, message.nb_samples * g_nbFloatsPerSample);
    }


    function OnSamplesStart(self, server_id, socket, data_view_reader)
    {
        self.Servers[server_id].counter_start = data_view_reader.GetUInt64();
    }


    function UpdateTimelineOffsets(self, timeline_window)
    {
        const counter_start_min = Math.min.apply(null, self.Servers.map(function(server) { return server.counter_start; }));
        for (let i = 0; i < self.Servers.length; ++i) {
            const counter_offset = self.Servers[i].counter_start - counter_start_min;
            timeline_window.SetCounterOffset(i, counter_offset);
        }
    }


    function OnSamples(self, server_id, socket, data_view_reader, length)
    {
        // Discard any new samples while paused and connected
        // Otherwise this stops a paused Remotery from loading new samples from disk
        if (self.Settings.IsPaused && self.Servers[server_id].Connected())
            return;

        // Binary decode incoming sample data
        var message = DecodeSampleHeader(self, data_view_reader, length);
        if (message.nb_samples == 0)
        {
            return;
        }
        var name = (self.Servers.length > 1 ? server_id + "_" : "") + message.thread_name;
        ProcessSampleTree(self, server_id, data_view_reader.DataView.buffer, message);

        // Add to frame history for this thread
        var thread_frame = new ThreadFrame(message);
        if (!(name in self.FrameHistory))
        {
            self.FrameHistory[name] = [ ];
        }
        var frame_history = self.FrameHistory[name];
        if (frame_history.length > 0 && frame_history[frame_history.length - 1].PartialTree)
        {
            // Always overwrite partial trees with new information
            frame_history[frame_history.length - 1] = thread_frame;
        }
        else
        {
            frame_history.push(thread_frame);
        }

        // Discard old frames to keep memory-use constant
        var max_nb_frames = 10000;
        var extra_frames = frame_history.length - max_nb_frames;
        if (extra_frames > 0)
            frame_history.splice(0, extra_frames);

        // Create sample windows on-demand
        if (!(name in self.gridWindows))
        {
            self.AddGridWindow(name, name, new GridConfigSamples());
        }

        // Set on the window and timeline if connected as this implies a trace is being loaded, which we want to speed up
        if (self.Servers[server_id].Connected())
        {
            self.gridWindows[name].UpdateEntries(message.nb_samples, message.sampleFloats);

            self.SampleTimelineWindow.OnSamples(server_id, name, frame_history);
            UpdateTimelineOffsets(self, self.SampleTimelineWindow);
        }
    }


    function OnSampleName(self, server_id, socket, data_view_reader)
    {
        // Add any names sent by the server to the local map
        let name_hash = data_view_reader.GetUInt32();
        let name_string = data_view_reader.GetString();
        self.glCanvas.nameMap.Set(server_id, name_hash, name_string);
    }


    function OnProcessorThreads(self, server_id, socket, data_view_reader)
    {
        // Discard any new samples while paused and connected
        // Otherwise this stops a paused Remotery from loading new samples from disk
        if (self.Settings.IsPaused && self.Servers[server_id].Connected())
            return;

        let nb_processors = data_view_reader.GetUInt32();
        let message_index = data_view_reader.GetUInt64();

        const empty_text_entry = {
            offset: 0,
            length: 1,
        };

        // Decode each processor
        for (let i = 0; i < nb_processors; i++)
        {
            let thread_id = data_view_reader.GetUInt32();
            let thread_name_hash = data_view_reader.GetUInt32();
            let sample_time = data_view_reader.GetUInt64();

            // Add frame history for this processor
            let processor_name = (self.Servers.length > 1 ? server_id + " " : "") + "Processor " + i.toString();
            if (!(processor_name in self.ProcessorFrameHistory))
            {
                self.ProcessorFrameHistory[processor_name] = [ ];
            }
            let frame_history = self.ProcessorFrameHistory[processor_name];

            if (thread_id == 0xFFFFFFFF)
            {
                continue;
            }

            // Try to merge this frame's samples with the previous frame if the are the same thread
            if (frame_history.length > 0)
            {
                let last_thread_frame = frame_history[frame_history.length - 1];
                if (last_thread_frame.threadId == thread_id && last_thread_frame.messageIndex == message_index - 1)
                {
                    // Update last frame message index so that the next frame can check for continuity
                    last_thread_frame.messageIndex = message_index;

                    // Sum time elapsed on the previous frame
                    const us_length = sample_time - last_thread_frame.usLastStart;
                    last_thread_frame.usLastStart = sample_time;
                    last_thread_frame.EndTime_us += us_length;
                    const last_length = last_thread_frame.sampleDataView.getFloat32(g_sampleOffsetBytes_Length, true);
                    last_thread_frame.sampleDataView.setFloat32(g_sampleOffsetBytes_Length, last_length + us_length / 1000.0, true);

                    continue;
                }
            }

            // Discard old frames to keep memory-use constant
            var max_nb_frames = 10000;
            var extra_frames = frame_history.length - max_nb_frames;
            if (extra_frames > 0)
            {
                frame_history.splice(0, extra_frames);
            }

            // Lookup the thread name
            let [ name_exists, thread_name ] = self.glCanvas.nameMap.Get(server_id, thread_name_hash);

            // If the name doesn't exist in the map yet, request it from the server
            if (!name_exists)
            {
                if (self.Servers[server_id].Connected())
                {
                    self.Servers[server_id].Send("GSMP" + thread_name_hash);
                }
            }

            // We are co-opting the sample rendering functionality of the timeline window to display processor threads as
            // thread samples. Fabricate a thread frame message, packing the processor info into one root sample.
            // TODO(don): Abstract the timeline window for pure range display as this is quite inefficient.
            let thread_message = { };
            thread_message.nb_samples = 1;
            thread_message.sampleData = new ArrayBuffer(g_nbBytesPerSample);
            thread_message.sampleDataView = new DataView(thread_message.sampleData);
            const sample_data_view = thread_message.sampleDataView;

            // Set the name
            const text_entry = thread_name.textEntry != null ? thread_name.textEntry : empty_text_entry;
            sample_data_view.setFloat32(g_sampleOffsetBytes_NameOffset, text_entry.offset, true);
            sample_data_view.setFloat32(g_sampleOffsetBytes_NameLength, text_entry.length, true);

            // Make a pastel-y colour from the thread name hash
            const hash = thread_name.hash;
            sample_data_view.setUint8(g_sampleOffsetBytes_Colour + 0, 127 + (hash & 255) / 2);
            sample_data_view.setUint8(g_sampleOffsetBytes_Colour + 1, 127 + ((hash >> 4) & 255) / 2);
            sample_data_view.setUint8(g_sampleOffsetBytes_Colour + 2, 127 + ((hash >> 8) & 255) / 2);

            // Set the time
            sample_data_view.setFloat32(g_sampleOffsetBytes_Start, sample_time / 1000.0, true);
            sample_data_view.setFloat32(g_sampleOffsetBytes_Length, 0.25, true);

            thread_message.sampleFloats = new Float32Array(thread_message.sampleData, 0, thread_message.nb_samples * g_nbFloatsPerSample);

            // Create a thread frame and annotate with data required to merge processor samples
            let thread_frame = new ThreadFrame(thread_message);
            thread_frame.serverId = server_id;
            thread_frame.threadId = thread_id;
            thread_frame.messageIndex = message_index;
            thread_frame.usLastStart = sample_time;
            frame_history.push(thread_frame);

            if (self.Servers[server_id].Connected())
            {
                self.ProcessorTimelineWindow.OnSamples(server_id, processor_name, frame_history);
                UpdateTimelineOffsets(self, self.ProcessorTimelineWindow);
            }
        }
    }


    function UInt64ToFloat32(view, offset)
    {
        // Read as a double to match Buffer_WriteU64
        const v = view.getFloat64(offset, true);

        // TODO(don): Potentially massive data loss!
        view.setFloat32(offset, v, true);
    }


    function SInt64ToFloat32(view, offset)
    {
        // Read as a double to match Buffer_WriteU64
        const v = view.getFloat64(offset, true);

        // TODO(don): Potentially massive data loss!
        view.setFloat32(offset, v, true);
    }


    function DecodeSnapshotHeader(self, data_view_reader, length)
    {
        // Message-specific header
        let message = { };
        message.messageStart = data_view_reader.Offset;
        message.nbSnapshots = data_view_reader.GetUInt32();
        message.propertyFrame = data_view_reader.GetUInt32();
        message.snapshotsStart = data_view_reader.Offset;
        message.snapshotsLength = length - (message.snapshotsStart - message.messageStart);
        return message;
    }


    function ProcessSnapshots(self, server_id, snapshot_data, message)
    {
        if (self.Settings.IsPaused)
        {
            return null;
        }

        const empty_text_entry = {
            offset: 0,
            length: 1,
        };

        const snapshots_length = message.nbSnapshots * g_nbBytesPerSnapshot;
        const snapshots_view = new DataView(snapshot_data, message.snapshotsStart, snapshots_length);

        for (let offset = 0; offset < snapshots_length; offset += g_nbBytesPerSnapshot)
        {
            // Get name hash and lookup in name map
            const name_hash = snapshots_view.getUint32(offset, true);
            const [ name_exists, name ] = self.glCanvas.nameMap.Get(server_id, name_hash);

            // If the name doesn't exist in the map yet, request it from the server
            if (!name_exists)
            {
                if (self.Servers[server_id].Connected())
                {
                    self.Servers[server_id].Send("GSMP" + name_hash);
                }
            }

            // Add snapshot name text buffer location
            const text_entry = name.textEntry != null ? name.textEntry : empty_text_entry;
            snapshots_view.setFloat32(offset + 0, text_entry.offset, true);
            snapshots_view.setFloat32(offset + 4, text_entry.length, true);

            // Heat colour style falloff to quickly identify modified properties
            let r = 255, g = 255, b = 255;
            const prev_value_frame = snapshots_view.getUint32(offset + 32, true);
            const frame_delta = message.propertyFrame - prev_value_frame;
            if (frame_delta < 64)
            {
                g = Math.min(Math.min(frame_delta, 32) * 8, 255);
                b = Math.min(frame_delta * 4, 255);
            }
            snapshots_view.setUint8(offset + 8, r);
            snapshots_view.setUint8(offset + 9, g);
            snapshots_view.setUint8(offset + 10, b);

            const snapshot_type = snapshots_view.getUint32(offset + 12, true);
            switch (snapshot_type)
            {
                case 1:
                case 2:
                case 3:
                case 4:
                case 7:
                    snapshots_view.setFloat32(offset + 16, snapshots_view.getFloat64(offset + 16, true), true);
                    snapshots_view.setFloat32(offset + 24, snapshots_view.getFloat64(offset + 24, true), true);
                    break;

                // Unpack 64-bit integers stored full precision in the logs and view them to the best of our current abilities
                case 5:
                    SInt64ToFloat32(snapshots_view, offset + 16);
                    SInt64ToFloat32(snapshots_view, offset + 24);
                    break;
                case 6:
                    UInt64ToFloat32(snapshots_view, offset + 16);
                    UInt64ToFloat32(snapshots_view, offset + 24);
                    break;
            }
        }

        // Convert to floats for GPU
        return new Float32Array(snapshot_data, message.snapshotsStart, message.nbSnapshots * g_nbFloatsPerSnapshot);
    }


    function OnPropertySnapshots(self, server_id, socket, data_view_reader, length)
    {
        // Discard any new snapshots while paused and connected
        // Otherwise this stops a paused Remotery from loading new samples from disk
        if (self.Settings.IsPaused && self.Servers[server_id].Connected())
            return;

        // Binary decode incoming snapshot data
        const message = DecodeSnapshotHeader(self, data_view_reader, length);
        message.snapshotFloats = ProcessSnapshots(self, server_id, data_view_reader.DataView.buffer, message);

        // Add to frame history
        const thread_frame = new PropertySnapshotFrame(message);
        const frame_history = self.PropertyFrameHistory;
        frame_history.push(thread_frame);

        // Discard old frames to keep memory-use constant
        var max_nb_frames = 10000;
        var extra_frames = frame_history.length - max_nb_frames;
        if (extra_frames > 0)
            frame_history.splice(0, extra_frames);

        // Set on the window if connected as this implies a trace is being loaded, which we want to speed up
        if (self.Servers[server_id].Connected())
        {
            self.propertyGridWindows[server_id].UpdateEntries(message.nbSnapshots, message.snapshotFloats);
        }
    }

    function OnTimelineCheck(self, name, evt)
    {
        // Show/hide the equivalent sample window and move all the others to occupy any left-over space
        var target = DOM.Event.GetNode(evt);
        self.gridWindows[name].SetVisible(target.checked);
        MoveGridWindows(self);
    }


    function MoveGridWindows(self)
    {
        // Stack all windows next to each other
        let xpos = 0;
        for (let i in self.gridWindows)
        {
            const grid_window = self.gridWindows[i];
            if (grid_window.visible)
            {
                grid_window.SetXPos(xpos++, self.SampleTimelineWindow.Window, self.Console.Window);
            }
        }
    }


    function OnSampleHover(self, thread_name, hover)
    {
        if (!self.Settings.IsPaused)
        {
            return;
        }

        // Search for the grid window for the thread being hovered over
        for (let window_thread_name in self.gridWindows)
        {
            if (window_thread_name == thread_name)
            {
                const grid_window = self.gridWindows[thread_name];

                // Populate with the sample under hover
                if (hover != null)
                {
                    const frame = hover[0];
                    grid_window.UpdateEntries(frame.NbSamples, frame.sampleFloats);
                }

                // When there's no hover, go back to the selected frame
                else if (self.SelectedFrames[thread_name])
                {
                    const frame = self.SelectedFrames[thread_name];
                    grid_window.UpdateEntries(frame.NbSamples, frame.sampleFloats);
                }

                // Otherwise display the last sample in the frame
                else
                {
                    const frames = self.FrameHistory[thread_name];
                    const frame = frames[frames.length - 1];
                    grid_window.UpdateEntries(frame.NbSamples, frame.sampleFloats);
                }

                break;
            }
        }
    }


    function OnSampleSelected(self, thread_name, select)
    {
        // Lookup sample window
        if (thread_name in self.gridWindows)
        {
            const grid_window = self.gridWindows[thread_name];

            // Set the grid window to the selected frame if valid
            if (select)
            {
                const frame = select[0];
                self.SelectedFrames[thread_name] = frame;
                grid_window.UpdateEntries(frame.NbSamples, frame.sampleFloats);
            }

            // Otherwise deselect
            else
            {
                const frames = self.FrameHistory[thread_name];
                const frame = frames[frames.length - 1];
                self.SelectedFrames[thread_name] = null;
                grid_window.UpdateEntries(frame.NbSamples, frame.sampleFloats);
                self.SampleTimelineWindow.Deselect(thread_name);
            }
        }
    }


    function OnResizeWindow(self)
    {
        var w = window.innerWidth;
        var h = window.innerHeight;

        // Resize windows
        self.Console.WindowResized(w, h);
        self.TitleWindow.WindowResized(w, h);
        self.SampleTimelineWindow.WindowResized(10, w / 2 - 5, self.TitleWindow.Window);
        self.ProcessorTimelineWindow.WindowResized(w / 2 + 5, w / 2 - 5, self.TitleWindow.Window);
        for (var i in self.gridWindows)
        {
            self.gridWindows[i].WindowResized(self.SampleTimelineWindow.Window, self.Console.Window);
        }
    }


    function OnTimelineMoved(self, timeline)
    {
        if (self.Settings.SyncTimelines)
        {
            let other_timeline = timeline == self.ProcessorTimelineWindow ? self.SampleTimelineWindow : self.ProcessorTimelineWindow;
            other_timeline.SetTimeRange(timeline.TimeRange.Start_us, timeline.TimeRange.Span_us);
        }
    }

    return Remotery;
})();
