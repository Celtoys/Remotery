var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var int2 = (function () {
    function int2(x, y) {
        if (x === void 0) { x = 0; }
        if (y === void 0) { y = x; }
        this.x = x;
        this.y = y;
    }
    int2.prototype.Copy = function () {
        return new int2(this.x, this.y);
    };
    int2.Add = function (a, b) {
        return new int2(a.x + b.x, a.y + b.y);
    };
    int2.Sub = function (a, b) {
        return new int2(a.x - b.x, a.y - b.y);
    };
    int2.Mul = function (a, b) {
        return new int2(a.x * b.x, a.y * b.y);
    };
    int2.Min = function (a, b) {
        return new int2(Math.min(a.x, b.x), Math.min(a.y, b.y));
    };
    int2.Max = function (a, b) {
        return new int2(Math.max(a.x, b.x), Math.max(a.y, b.y));
    };
    int2.Min0 = function (a) {
        return new int2(Math.min(a.x, 0), Math.min(a.y, 0));
    };
    int2.Max0 = function (a) {
        return new int2(Math.max(a.x, 0), Math.max(a.y, 0));
    };
    int2.Neg = function (a) {
        return new int2(-a.x, -a.y);
    };
    int2.Abs = function (a) {
        return new int2(Math.abs(a.x), Math.abs(a.y));
    };
    int2.Equal = function (a, b) {
        if (a == null || b == null)
            return false;
        return a.x == b.x && a.y == b.y;
    };
    int2.Zero = new int2(0, 0);
    int2.One = new int2(1, 1);
    return int2;
}());
var AABB = (function () {
    function AABB(min, max) {
        this.min = min;
        this.max = max;
    }
    AABB.prototype.Expand = function (e) {
        var ev = new int2(e);
        this.min = int2.Sub(this.min, ev);
        this.max = int2.Add(this.max, ev);
    };
    AABB.Intersect = function (a, b) {
        return a.min.x < b.max.x && a.min.y < b.max.y && b.min.x < a.max.x && b.min.y < a.max.y;
    };
    return AABB;
}());
var DOMEvent = (function () {
    function DOMEvent(trigger, event_name) {
        this.Trigger = trigger;
        this.EventName = event_name;
    }
    DOMEvent.prototype.Subscribe = function (listener) {
        this.Trigger.addEventListener(this.EventName, listener, false);
    };
    DOMEvent.prototype.Unsubscribe = function (listener) {
        this.Trigger.removeEventListener(this.EventName, listener, false);
    };
    return DOMEvent;
}());
var DOM;
(function (DOM) {
    var Event;
    (function (Event) {
        function Get(event) {
            return window.event || event;
        }
        Event.Get = Get;
        function StopPropagation(event) {
            if (event) {
                event.cancelBubble = true;
                if (event.stopPropagation)
                    event.stopPropagation();
            }
        }
        Event.StopPropagation = StopPropagation;
        function StopDefaultAction(event) {
            if (event && event.preventDefault)
                event.preventDefault();
            else if (window.event && window.event.returnValue)
                window.event.returnValue = false;
        }
        Event.StopDefaultAction = StopDefaultAction;
        function GetMousePosition(event) {
            var e = Get(event);
            var p = new int2();
            if (e.pageX || e.pageY) {
                p.x = e.pageX;
                p.y = e.pageY;
            }
            else if (event.clientX || event.clientY) {
                p.x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                p.y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            }
            return p;
        }
        Event.GetMousePosition = GetMousePosition;
    })(Event = DOM.Event || (DOM.Event = {}));
    {
    }
})(DOM || (DOM = {}));
var DOM;
(function (DOM) {
    var Node = (function () {
        function Node(parameter, index) {
            if (index === undefined)
                index = 0;
            if (parameter instanceof Element) {
                this.Element = parameter;
            }
            else if (parameter instanceof Document) {
                this.Element = parameter.documentElement;
            }
            else if (parameter instanceof EventTarget) {
                this.Element = parameter;
            }
            else if (typeof parameter === "string") {
                if (parameter[0] == "#")
                    this.Element = document.getElementById(parameter.slice(1));
                else if (parameter[0] == ".")
                    this.Element = document.getElementsByClassName(parameter.slice(1))[index];
                else
                    this.SetHTML(parameter);
            }
        }
        Object.defineProperty(Node.prototype, "Position", {
            get: function () {
                var pos = new int2();
                for (var node = this.Element; node != null; node = node.offsetParent) {
                    pos.x += node.offsetLeft;
                    pos.y += node.offsetTop;
                }
                return pos;
            },
            set: function (position) {
                this.Element.style.left = position.x.toString();
                this.Element.style.top = position.y.toString();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "Size", {
            get: function () {
                return new int2(this.Element.offsetWidth, this.Element.offsetHeight);
            },
            set: function (size) {
                this.Element.style.width = size.x.toString();
                this.Element.style.height = size.y.toString();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "ZIndex", {
            get: function () {
                if (this.Element.style.zIndex.length)
                    return parseInt(this.Element.style.zIndex);
                return null;
            },
            set: function (z_index) {
                this.Element.style.zIndex = z_index.toString();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "Opacity", {
            set: function (value) {
                this.Element.style.opacity = value.toString();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "Colour", {
            set: function (colour) {
                this.Element.style.color = colour;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "Cursor", {
            set: function (cursor) {
                this.Element.style.cursor = cursor;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "Parent", {
            get: function () {
                if (this.Element.parentElement)
                    return new Node(this.Element.parentElement);
                return null;
            },
            enumerable: true,
            configurable: true
        });
        Node.prototype.HasClass = function (class_name) {
            var regexp = new RegExp("\\b" + class_name + "\\b");
            return regexp.test(this.Element.className);
        };
        Node.prototype.RemoveClass = function (class_name) {
            var regexp = new RegExp("\\b" + class_name + "\\b");
            this.Element.className = this.Element.className.replace(regexp, "");
        };
        Node.prototype.AddClass = function (class_name) {
            if (!this.HasClass(class_name))
                this.Element.className += " " + class_name;
        };
        Node.prototype.Find = function (filter, index) {
            var filter_type = filter[0];
            filter = filter.slice(1);
            if (index === undefined)
                index = 0;
            if (filter[0] == "#") {
                return $(Node.FindById(this.Element, filter, index));
            }
            else if (filter_type == ".") {
                var elements = this.Element.getElementsByClassName(filter);
                if (elements.length) {
                    return $(elements[index]);
                }
            }
            return null;
        };
        Node.FindById = function (parent_node, id, index) {
            var matches_left = index;
            for (var i = 0; i < parent_node.children.length; i++) {
                var element = parent_node.children[i];
                if (element.id == id) {
                    if (index === undefined || matches_left-- == 0)
                        return element;
                }
                element = Node.FindById(element, id, index);
                if (element != null)
                    return element;
            }
            return null;
        };
        Node.prototype.Append = function (node) {
            this.Element.appendChild(node.Element);
        };
        Node.prototype.Detach = function () {
            if (this.Element.parentNode)
                this.Element.parentNode.removeChild(this.Element);
        };
        Node.prototype.SetHTML = function (html) {
            var div = document.createElement("div");
            div.innerHTML = html;
            var child = div.firstChild;
            if (child != null && child.nodeType == 3)
                child = child.nextSibling;
            this.Element = child;
            this.Detach();
        };
        Node.prototype.Contains = function (node) {
            while (node.Element != null && node.Element != this.Element)
                node = node.Parent;
            return node != null;
        };
        Object.defineProperty(Node.prototype, "MouseDownEvent", {
            get: function () {
                this._MouseDownEvent = this._MouseDownEvent || new DOMEvent(this.Element, "mousedown");
                return this._MouseDownEvent;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "MouseUpEvent", {
            get: function () {
                this._MouseUpEvent = this._MouseUpEvent || new DOMEvent(this.Element, "mouseup");
                return this._MouseUpEvent;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "MouseMoveEvent", {
            get: function () {
                this._MouseMoveEvent = this._MouseMoveEvent || new DOMEvent(this.Element, "mousemove");
                return this._MouseMoveEvent;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "ResizeEvent", {
            get: function () {
                this._ResizeEvent = this._ResizeEvent || new DOMEvent(window, "resize");
                return this._ResizeEvent;
            },
            enumerable: true,
            configurable: true
        });
        return Node;
    }());
    DOM.Node = Node;
    ;
})(DOM || (DOM = {}));
function $(parameter, index) {
    return new DOM.Node(parameter, index);
}
var WM;
(function (WM) {
    function Wang_HashU32(key) {
        key += ~(key << 15);
        key ^= (key >> 10);
        key += (key << 3);
        key ^= (key >> 6);
        key += ~(key << 11);
        key ^= (key >> 16);
        return key;
    }
    function HashCombine_U32(hash_a, hash_b) {
        var random_bits = 0x9E3779B9;
        hash_a ^= hash_b + random_bits + (hash_a << 6) + (hash_a >> 2);
        return hash_a;
    }
    function GenerateID(position, size) {
        var a = HashCombine_U32(Wang_HashU32(position.x), Wang_HashU32(position.y));
        var b = HashCombine_U32(Wang_HashU32(size.x), Wang_HashU32(size.y));
        return HashCombine_U32(a, b);
    }
    var Control = (function () {
        function Control(node, position, size) {
            var _this = this;
            this._Position = new int2(0);
            this._Size = new int2(0);
            this._BottomRight = new int2(0);
            this._Visible = false;
            this.OnParentResize = function () {
            };
            this.OnMouseDown = function (event) {
                _this.SendToTop();
            };
            this.ID = GenerateID(position, size);
            this.Node = node;
            this.Position = position;
            this.Size = size;
            this.Node.MouseDownEvent.Subscribe(this.OnMouseDown);
        }
        Object.defineProperty(Control.prototype, "Position", {
            get: function () {
                return this._Position;
            },
            set: function (position) {
                this._Position = position;
                this.Node.Position = position;
                this._BottomRight = int2.Add(this._Position, this._Size);
            },
            enumerable: true,
            configurable: true
        });
        Control.prototype.SetSize = function (size) {
            this._Size = size;
            this.Node.Size = size;
            this._BottomRight = int2.Add(this._Position, this._Size);
        };
        Object.defineProperty(Control.prototype, "Size", {
            get: function () {
                return this._Size;
            },
            set: function (size) {
                this.SetSize(size);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Control.prototype, "TopLeft", {
            get: function () {
                return this._Position;
            },
            set: function (tl) {
                var old_br = this._BottomRight.Copy();
                this.Position = tl;
                this.Size = int2.Sub(old_br, this.Position);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Control.prototype, "BottomRight", {
            get: function () {
                return this._BottomRight;
            },
            set: function (br) {
                this.SetSize(int2.Sub(br, this._Position));
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Control.prototype, "Visible", {
            get: function () {
                return this._Visible;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Control.prototype, "ZIndex", {
            get: function () {
                return this.Node.ZIndex;
            },
            set: function (z_index) {
                this.Node.ZIndex = z_index;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Control.prototype, "ParentContainer", {
            get: function () {
                return this._ParentContainer;
            },
            set: function (parent_container) {
                if (this._ParentContainer == null)
                    $(document.body).ResizeEvent.Unsubscribe(this.OnParentResize);
                this._ParentContainer = parent_container;
                if (this._ParentContainer == null)
                    $(document.body).ResizeEvent.Subscribe(this.OnParentResize);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Control.prototype, "ParentNode", {
            get: function () {
                var parent_container = this.ParentContainer;
                if (parent_container == null)
                    return $(document.body);
                return parent_container.ControlParentNode;
            },
            enumerable: true,
            configurable: true
        });
        Control.prototype.Show = function () {
            if (this.Node.Parent == null) {
                this.ParentNode.Append(this.Node);
                this._Visible = true;
            }
        };
        Control.prototype.Hide = function () {
            if (this.Node.Parent != null) {
                this.Node.Detach();
                this._Visible = false;
            }
        };
        Control.prototype.SendToTop = function () {
            if (this._ParentContainer)
                this._ParentContainer.SetTopControl(this);
        };
        Control.prototype.SendToBottom = function () {
            if (this._ParentContainer)
                this._ParentContainer.SetBottomControl(this);
        };
        return Control;
    }());
    WM.Control = Control;
})(WM || (WM = {}));
var WM;
(function (WM) {
    (function (RulerOrient) {
        RulerOrient[RulerOrient["Horizontal"] = 0] = "Horizontal";
        RulerOrient[RulerOrient["Vertical"] = 1] = "Vertical";
    })(WM.RulerOrient || (WM.RulerOrient = {}));
    var RulerOrient = WM.RulerOrient;
    var Ruler = (function (_super) {
        __extends(Ruler, _super);
        function Ruler(orient, position) {
            _super.call(this, new DOM.Node(Ruler.TemplateHTML), Ruler.Position2D(orient, position), Ruler.Size2D(orient));
            this._Orient = orient;
        }
        Ruler.Position2D = function (orient, position) {
            return orient == 0 ?
                new int2(0, position) :
                new int2(position, 0);
        };
        Ruler.Size2D = function (orient) {
            return orient == 0 ?
                new int2(Ruler.Size, 0) :
                new int2(0, Ruler.Size);
        };
        Ruler.prototype.SetPosition = function (position) {
            this.Position = Ruler.Position2D(this._Orient, position);
        };
        Ruler.TemplateHTML = "<div class='Ruler'></div>";
        Ruler.Size = 10000;
        return Ruler;
    }(WM.Control));
    WM.Ruler = Ruler;
})(WM || (WM = {}));
var WM;
(function (WM) {
    (function (SnapCode) {
        SnapCode[SnapCode["None"] = 0] = "None";
        SnapCode[SnapCode["X"] = 1] = "X";
        SnapCode[SnapCode["Y"] = 2] = "Y";
    })(WM.SnapCode || (WM.SnapCode = {}));
    var SnapCode = WM.SnapCode;
    var Container = (function (_super) {
        __extends(Container, _super);
        function Container(position, size, node) {
            _super.call(this, node ? node : new DOM.Node(Container.TemplateHTML), position, size);
            this.Controls = [];
        }
        Container.prototype.Add = function (control) {
            this.Controls.push(control);
            control.ParentContainer = this;
            control.Show();
            return control;
        };
        Container.prototype.Remove = function (control) {
            control.Hide();
            var index = this.Controls.indexOf(control);
            this.Controls.splice(index, 1);
            control.ParentContainer = null;
        };
        Container.prototype.UpdateZIndices = function () {
            for (var i = 0; i < this.Controls.length; i++) {
                var control = this.Controls[i];
                if (!control.Visible)
                    continue;
                var z = (i + 1) * 10;
                control.ZIndex = z;
            }
        };
        Container.prototype.SetTopControl = function (control) {
            var index = this.Controls.indexOf(control);
            if (index != -1) {
                this.Controls.splice(index, 1);
                this.Controls.push(control);
                this.UpdateZIndices();
            }
        };
        Container.prototype.SetBottomControl = function (control) {
            var index = this.Controls.indexOf(control);
            if (index != -1) {
                this.Controls.splice(index, 1);
                this.Controls.unshift(control);
                this.UpdateZIndices();
            }
        };
        Container.prototype.SnapControl = function (pos, snap_pos, mask, p_mask, n_mask, top_left, bottom_right) {
            var b = Container.SnapBorderSize;
            var out_mask = new int2(0);
            var d_tl = int2.Abs(int2.Sub(pos, top_left));
            var d_br = int2.Abs(int2.Sub(pos, bottom_right));
            if (mask.x != 0) {
                if (d_tl.x < b) {
                    snap_pos.x = top_left.x - p_mask.x;
                    out_mask.x = -1;
                }
                if (d_br.x < b) {
                    snap_pos.x = bottom_right.x + n_mask.x;
                    out_mask.x = 1;
                }
            }
            if (mask.y != 0) {
                if (d_tl.y < b) {
                    snap_pos.y = top_left.y - p_mask.y;
                    out_mask.y = -1;
                }
                if (d_br.y < b) {
                    snap_pos.y = bottom_right.y + n_mask.y;
                    out_mask.y = 1;
                }
            }
            return out_mask;
        };
        Container.prototype.GetSnapControls = function (pos, mask, excluding, out_controls, offset_scale) {
            var b = Container.SnapBorderSize;
            var p_mask = int2.Mul(int2.Max0(mask), new int2(b - 1));
            var n_mask = int2.Mul(int2.Min0(mask), new int2(-b + 1));
            var snap_pos = pos.Copy();
            var snap_code = 0;
            for (var _i = 0, _a = this.Controls; _i < _a.length; _i++) {
                var control = _a[_i];
                if (!(control instanceof Container))
                    continue;
                if (excluding.indexOf(control) != -1)
                    continue;
                var top_left = control.TopLeft;
                var bottom_right = control.BottomRight;
                var out_mask_1 = this.SnapControl(pos, snap_pos, mask, p_mask, n_mask, control.TopLeft, control.BottomRight);
                snap_code |= out_mask_1.x != 0 ? 1 : 0;
                snap_code |= out_mask_1.y != 0 ? 2 : 0;
                if (out_controls && (out_mask_1.x != 0 || out_mask_1.y != 0))
                    out_controls.push([control, out_mask_1, offset_scale]);
            }
            var parent_size = this.ControlParentNode.Size;
            var out_mask = this.SnapControl(pos, snap_pos, mask, p_mask, n_mask, new int2(b), int2.Sub(parent_size, new int2(b)));
            snap_code |= out_mask.x != 0 ? 1 : 0;
            snap_code |= out_mask.y != 0 ? 2 : 0;
            return [snap_code, snap_pos];
        };
        Object.defineProperty(Container.prototype, "ControlParentNode", {
            get: function () {
                return this.Node;
            },
            enumerable: true,
            configurable: true
        });
        Container.prototype.SetSize = function (size) {
            _super.prototype.SetSize.call(this, size);
            this.UpdateControlSizes();
        };
        Container.prototype.UpdateControlSizes = function () {
            if (this.Controls) {
                for (var _i = 0, _a = this.Controls; _i < _a.length; _i++) {
                    var control = _a[_i];
                    control.OnParentResize();
                }
            }
        };
        Container.TemplateHTML = "<div class='Container'></div>";
        Container.SnapBorderSize = 5;
        return Container;
    }(WM.Control));
    WM.Container = Container;
})(WM || (WM = {}));
var WM;
(function (WM) {
    var ControlRef = (function () {
        function ControlRef(from_index, from, side, to_index, to) {
            this.FromIndex = from_index;
            this.From = from;
            this.Side = side;
            this.ToIndex = to_index;
            this.To = to;
        }
        Object.defineProperty(ControlRef.prototype, "SortIndex", {
            get: function () {
                return this.FromIndex * 4 + this.Side;
            },
            enumerable: true,
            configurable: true
        });
        return ControlRef;
    }());
    WM.ControlRef = ControlRef;
    var ControlRefInfo = (function () {
        function ControlRefInfo(parent_graph, control, side) {
            this.ParentGraph = parent_graph;
            this.Control = control;
            this.Side = side;
            this.StartRef = -1;
            this.NbRefs = 0;
        }
        ControlRefInfo.prototype.References = function (control) {
            for (var i = 0; i < this.NbRefs; i++) {
                if (this.ParentGraph.Refs[this.StartRef + i].To == control)
                    return true;
            }
            return false;
        };
        ControlRefInfo.prototype.GetControlRef = function (index) {
            if (index < this.NbRefs)
                return this.ParentGraph.Refs[this.StartRef + index];
            return null;
        };
        ControlRefInfo.prototype.GetSide = function (side) {
            if (this.NbRefs == 0)
                return null;
            var ref = this.ParentGraph.Refs[this.StartRef];
            return this.ParentGraph.RefInfos[ref.FromIndex * 4 + side];
        };
        return ControlRefInfo;
    }());
    WM.ControlRefInfo = ControlRefInfo;
    var ControlGraph = (function () {
        function ControlGraph() {
            this.Refs = [];
            this.RefInfos = [];
        }
        ControlGraph.prototype.Build = function (container) {
            this.Refs = [];
            this.RefInfos = [];
            var control_visited = [];
            for (var i = 0; i < container.Controls.length; i++)
                control_visited.push(false);
            for (var i = 0; i < container.Controls.length; i++) {
                if (control_visited[i])
                    continue;
                var control = container.Controls[i];
                if (!(control instanceof WM.Container))
                    continue;
                this.BuildRefs(control, container, control_visited);
            }
            this.Refs.sort(function (a, b) {
                return a.SortIndex - b.SortIndex;
            });
            for (var i = 0; i < container.Controls.length * 4; i++) {
                var control = container.Controls[i >> 2];
                this.RefInfos.push(new ControlRefInfo(this, control, i & 3));
            }
            var last_sort_index = -1;
            for (var i = 0; i < this.Refs.length; i++) {
                var ref = this.Refs[i];
                var sort_index = ref.SortIndex;
                var ref_info = this.RefInfos[sort_index];
                if (last_sort_index != sort_index) {
                    ref_info.StartRef = i;
                    last_sort_index = sort_index;
                }
                ref_info.NbRefs++;
            }
        };
        ControlGraph.prototype.BuildRefs = function (root_control, container, control_visited) {
            var to_visit_controls = [root_control];
            for (var _i = 0, to_visit_controls_1 = to_visit_controls; _i < to_visit_controls_1.length; _i++) {
                var control_0 = to_visit_controls_1[_i];
                var control_0_index = container.Controls.indexOf(control_0);
                if (control_visited[control_0_index])
                    continue;
                control_visited[control_0_index] = true;
                var tl_0 = control_0.TopLeft;
                var br_0 = control_0.BottomRight;
                var b = WM.Container.SnapBorderSize;
                var s = container.Size;
                if (tl_0.x <= b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, WM.Side.Left, -1, container));
                if (tl_0.y <= b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, WM.Side.Top, -1, container));
                if (br_0.x >= s.x - b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, WM.Side.Right, -1, container));
                if (br_0.y >= s.y - b)
                    this.Refs.push(new ControlRef(control_0_index, control_0, WM.Side.Bottom, -1, container));
                for (var _a = 0, _b = container.Controls; _a < _b.length; _a++) {
                    var control_1 = _b[_a];
                    var control_1_index = container.Controls.indexOf(control_1);
                    if (control_visited[control_1_index])
                        continue;
                    if (!(control_1 instanceof WM.Container))
                        continue;
                    var tl_1 = control_1.TopLeft;
                    var br_1 = control_1.BottomRight;
                    var side_0 = WM.Side.None;
                    var side_1 = WM.Side.None;
                    if (tl_1.y - br_0.y < 0 && tl_0.y - br_1.y < 0) {
                        if (Math.abs(tl_0.x - br_1.x) < b) {
                            side_0 = WM.Side.Left;
                            side_1 = WM.Side.Right;
                        }
                        if (Math.abs(br_0.x - tl_1.x) < b) {
                            side_0 = WM.Side.Right;
                            side_1 = WM.Side.Left;
                        }
                    }
                    if (tl_1.x - br_0.x < 0 && tl_0.x - br_1.x < 0) {
                        if (Math.abs(tl_0.y - br_1.y) < b) {
                            side_0 = WM.Side.Top;
                            side_1 = WM.Side.Bottom;
                        }
                        if (Math.abs(br_0.y - tl_1.y) < b) {
                            side_0 = WM.Side.Bottom;
                            side_1 = WM.Side.Top;
                        }
                    }
                    if (side_0 != WM.Side.None) {
                        this.Refs.push(new ControlRef(control_0_index, control_0, side_0, control_1_index, control_1));
                        this.Refs.push(new ControlRef(control_1_index, control_1, side_1, control_0_index, control_0));
                        to_visit_controls.push(control_1);
                    }
                }
            }
        };
        ControlGraph.prototype.DebugLog = function () {
            console.log("\n--- DebugLog --------------------------------");
            var x = WM.Side[WM.Side.Top];
            for (var _i = 0, _a = this.RefInfos; _i < _a.length; _i++) {
                var ref_info = _a[_i];
                if (!(ref_info.Control instanceof WM.Container))
                    continue;
                if (ref_info.NbRefs == 0)
                    continue;
                var names = "";
                for (var i = 0; i < ref_info.NbRefs; i++) {
                    var window_1 = this.Refs[ref_info.StartRef + i].To;
                    names += window_1.Title + ", ";
                }
                console.log(ref_info.Control.Title, WM.Side[ref_info.Side] + ": ", names);
            }
        };
        return ControlGraph;
    }());
    WM.ControlGraph = ControlGraph;
})(WM || (WM = {}));
var WM;
(function (WM) {
    var Rect = (function () {
        function Rect() {
        }
        return Rect;
    }());
    var SizeConstraint = (function () {
        function SizeConstraint() {
        }
        return SizeConstraint;
    }());
    var ContainerConstraint = (function () {
        function ContainerConstraint() {
        }
        return ContainerConstraint;
    }());
    var BufferConstraint = (function () {
        function BufferConstraint() {
        }
        return BufferConstraint;
    }());
    var SnapConstraint = (function () {
        function SnapConstraint() {
        }
        return SnapConstraint;
    }());
    var ControlSizer = (function () {
        function ControlSizer() {
            this.Rects = [];
            this.ContainerConstraints = [];
            this.BufferConstraints = [];
            this.SizeConstraints = [];
            this.SnapConstraints = [];
        }
        ControlSizer.prototype.Clear = function () {
            this.Rects = [];
            this.ContainerConstraints = [];
            this.BufferConstraints = [];
            this.SizeConstraints = [];
            this.SnapConstraints = [];
        };
        ControlSizer.prototype.Build = function (container, control_graph) {
            this.ContainerRestSize = container.ControlParentNode.Size.x;
            this.Clear();
            this.BuildRects(container);
            var left_controls = [];
            var right_controls = [];
            this.BuildContainerConstraints(container, control_graph, left_controls, right_controls);
            this.BuildBufferConstraints(container, control_graph);
            this.BuildSnapConstraints(container, control_graph);
            this.SetInitialSizeStrengths(container, control_graph, left_controls, right_controls);
        };
        ControlSizer.prototype.ChangeSize = function (new_size, control_graph) {
            this.ContainerSize = new_size;
            var half_delta_size = (this.ContainerRestSize - new_size) / 2;
            var left_offset = half_delta_size + WM.Container.SnapBorderSize;
            var right_offset = this.ContainerRestSize - left_offset;
            for (var _i = 0, _a = this.ContainerConstraints; _i < _a.length; _i++) {
                var constraint = _a[_i];
                if (constraint.Side == WM.Side.Left)
                    constraint.Position = left_offset;
                else
                    constraint.Position = right_offset;
            }
            for (var i = 0; i < 50; i++) {
                this.ApplySizeConstraints();
                this.ApplyMinimumSizeConstraints();
                this.ApplyBufferConstraints();
                this.ApplyContainerConstraints();
                this.ReevaluateSizeStrengths(control_graph);
            }
            this.ApplySnapConstraints();
            for (var _b = 0, _c = this.Rects; _b < _c.length; _b++) {
                var rect = _c[_b];
                rect.Control.Position = new int2(rect.Left - half_delta_size, rect.Control.Position.y);
                rect.Control.Size = new int2(rect.Right - rect.Left, rect.Control.Size.y);
            }
        };
        ControlSizer.prototype.BuildRects = function (container) {
            for (var _i = 0, _a = container.Controls; _i < _a.length; _i++) {
                var control = _a[_i];
                if (!(control instanceof WM.Container)) {
                    this.Rects.push(null);
                    continue;
                }
                var rect = new Rect();
                rect.Control = control;
                rect.Left = control.TopLeft.x;
                rect.Right = control.BottomRight.x;
                rect.SizeStrength = 1;
                rect.RestSizeStrength = 1;
                rect.SideDistance = 10000;
                this.Rects.push(rect);
                if (control instanceof WM.Window)
                    rect.Title = control.Title;
                var size_constraint = new SizeConstraint();
                size_constraint.Rect = rect;
                size_constraint.Size = rect.Right - rect.Left;
                this.SizeConstraints.push(size_constraint);
            }
        };
        ControlSizer.prototype.ApplySizeConstraints = function () {
            for (var _i = 0, _a = this.SizeConstraints; _i < _a.length; _i++) {
                var constraint = _a[_i];
                var rect = constraint.Rect;
                var size = rect.Right - rect.Left;
                var center = (rect.Left + rect.Right) * 0.5;
                var half_delta_size = (constraint.Size - size) * 0.5;
                var half_border_size = size * 0.5 + half_delta_size * rect.SizeStrength;
                rect.Left = center - half_border_size;
                rect.Right = center + half_border_size;
            }
        };
        ControlSizer.prototype.ApplyMinimumSizeConstraints = function () {
            for (var _i = 0, _a = this.SizeConstraints; _i < _a.length; _i++) {
                var constraint = _a[_i];
                var rect = constraint.Rect;
                if (rect.Right - rect.Left < 20) {
                    var center = (rect.Left + rect.Right) * 0.5;
                    rect.Left = center - 10;
                    rect.Right = center + 10;
                }
            }
        };
        ControlSizer.prototype.BuildContainerConstraints = function (container, control_graph, left_controls, right_controls) {
            for (var i = 0; i < container.Controls.length; i++) {
                var left_ref_info = control_graph.RefInfos[i * 4 + WM.Side.Left];
                var right_ref_info = control_graph.RefInfos[i * 4 + WM.Side.Right];
                if (left_ref_info.References(container)) {
                    var constraint = new ContainerConstraint();
                    constraint.Rect = this.Rects[i];
                    constraint.Side = WM.Side.Left;
                    constraint.Position = 0;
                    this.ContainerConstraints.push(constraint);
                    left_controls.push(i);
                }
                if (right_ref_info.References(container)) {
                    var constraint = new ContainerConstraint();
                    constraint.Rect = this.Rects[i];
                    constraint.Side = WM.Side.Right;
                    constraint.Position = this.ContainerRestSize;
                    this.ContainerConstraints.push(constraint);
                    right_controls.push(i);
                }
            }
        };
        ControlSizer.prototype.ApplyContainerConstraints = function () {
            for (var _i = 0, _a = this.ContainerConstraints; _i < _a.length; _i++) {
                var constraint = _a[_i];
                if (constraint.Side == WM.Side.Left)
                    constraint.Rect.Left = constraint.Position;
                else
                    constraint.Rect.Right = constraint.Position;
            }
        };
        ControlSizer.prototype.BuildBufferConstraints = function (container, control_graph) {
            for (var _i = 0, _a = control_graph.Refs; _i < _a.length; _i++) {
                var ref = _a[_i];
                if (ref.Side != WM.Side.Left && ref.Side != WM.Side.Right)
                    continue;
                if (ref.FromIndex < ref.ToIndex) {
                    var constraint = new BufferConstraint();
                    constraint.Rect0 = this.Rects[ref.FromIndex];
                    constraint.Side0 = ref.Side;
                    constraint.Rect1 = this.Rects[ref.ToIndex];
                    constraint.Side1 = ref.Side ^ 1;
                    this.BufferConstraints.push(constraint);
                }
            }
        };
        ControlSizer.prototype.ApplyBufferConstraints = function () {
            for (var _i = 0, _a = this.BufferConstraints; _i < _a.length; _i++) {
                var constraint = _a[_i];
                if (constraint.Side0 == WM.Side.Left) {
                    var rect0 = constraint.Rect0;
                    var rect1 = constraint.Rect1;
                    var left = rect1.Right;
                    var right = rect0.Left;
                    var center = (left + right) * 0.5;
                    var size = right - left;
                    var half_delta_size = (WM.Container.SnapBorderSize - size) * 0.5;
                    var half_new_size = size * 0.5 + half_delta_size * 0.5;
                    rect0.Left = center + half_new_size;
                    rect1.Right = center - half_new_size;
                }
                else {
                    var rect0 = constraint.Rect0;
                    var rect1 = constraint.Rect1;
                    var left = rect0.Right;
                    var right = rect1.Left;
                    var center = (left + right) * 0.5;
                    var size = right - left;
                    var half_delta_size = (WM.Container.SnapBorderSize - size) * 0.5;
                    var half_new_size = size * 0.5 + half_delta_size * 0.5;
                    rect1.Left = center + half_new_size;
                    rect0.Right = center - half_new_size;
                }
            }
        };
        ControlSizer.prototype.BuildSnapConstraints = function (container, control_graph) {
            for (var _i = 0, _a = control_graph.Refs; _i < _a.length; _i++) {
                var ref = _a[_i];
                if (ref.Side == WM.Side.Right && ref.To != container) {
                    var constraint = new SnapConstraint();
                    constraint.LeftRect = this.Rects[ref.FromIndex];
                    constraint.RightRect = this.Rects[ref.ToIndex];
                    this.SnapConstraints.push(constraint);
                }
            }
        };
        ControlSizer.prototype.ApplySnapConstraints = function () {
            for (var _i = 0, _a = this.SnapConstraints; _i < _a.length; _i++) {
                var constraint = _a[_i];
                constraint.RightRect.Left = constraint.LeftRect.Right + WM.Container.SnapBorderSize;
            }
        };
        ControlSizer.prototype.SetInitialSizeStrengths = function (container, control_graph, left_controls, right_controls) {
            var weak_strength = 0.01;
            var strong_strength = 0.1;
            var side_distance = 0;
            while (left_controls.length && right_controls.length) {
                for (var _i = 0, left_controls_1 = left_controls; _i < left_controls_1.length; _i++) {
                    var index = left_controls_1[_i];
                    var rect = this.Rects[index];
                    rect.SideDistance = side_distance;
                    rect.SizeStrength = strong_strength;
                }
                for (var _a = 0, right_controls_1 = right_controls; _a < right_controls_1.length; _a++) {
                    var index = right_controls_1[_a];
                    var rect = this.Rects[index];
                    rect.SideDistance = side_distance;
                    rect.SizeStrength = strong_strength;
                }
                var next_left_controls = [];
                var next_right_controls = [];
                for (var _b = 0, left_controls_2 = left_controls; _b < left_controls_2.length; _b++) {
                    var index = left_controls_2[_b];
                    var rect = this.Rects[index];
                    var ref_info = control_graph.RefInfos[index * 4 + WM.Side.Right];
                    for (var i = 0; i < ref_info.NbRefs; i++) {
                        var ref = ref_info.GetControlRef(i);
                        var rect_to = this.Rects[ref.ToIndex];
                        if (ref.To == container) {
                            rect.SizeStrength = weak_strength;
                            continue;
                        }
                        if (rect.SideDistance == rect_to.SideDistance) {
                            rect.SizeStrength = weak_strength;
                            rect_to.SizeStrength = weak_strength;
                            continue;
                        }
                        if (rect.SideDistance > rect_to.SideDistance) {
                            rect.SizeStrength = weak_strength;
                            continue;
                        }
                        if (next_left_controls.indexOf(ref.ToIndex) == -1)
                            next_left_controls.push(ref.ToIndex);
                    }
                }
                for (var _c = 0, right_controls_2 = right_controls; _c < right_controls_2.length; _c++) {
                    var index = right_controls_2[_c];
                    var ref_info = control_graph.RefInfos[index * 4 + WM.Side.Left];
                    for (var i = 0; i < ref_info.NbRefs; i++) {
                        var ref = ref_info.GetControlRef(i);
                        var rect_to = this.Rects[ref.ToIndex];
                        if (ref.To == container || rect_to.SideDistance != 10000)
                            continue;
                        if (next_right_controls.indexOf(ref.ToIndex) == -1)
                            next_right_controls.push(ref.ToIndex);
                    }
                }
                left_controls = next_left_controls;
                right_controls = next_right_controls;
                side_distance++;
            }
            for (var _d = 0, _e = this.Rects; _d < _e.length; _d++) {
                var rect = _e[_d];
                rect.RestSizeStrength = rect.SizeStrength;
            }
        };
        ControlSizer.prototype.ReevaluateSizeStrengths = function (control_graph) {
            for (var index = 0; index < this.Rects.length; index++) {
                var rect = this.Rects[index];
                rect.SizeStrength = rect.RestSizeStrength;
                var left_ref_info = control_graph.RefInfos[index * 4 + WM.Side.Left];
                for (var i = 0; i < left_ref_info.NbRefs; i++) {
                    var ref = left_ref_info.GetControlRef(i);
                    if (ref.ToIndex != -1) {
                        var rect_to = this.Rects[ref.ToIndex];
                        var size = rect_to.Right - rect_to.Left;
                        if (size <= 20) {
                            rect.SizeStrength = 0.01;
                            break;
                        }
                    }
                }
                var right_ref_info = control_graph.RefInfos[index * 4 + WM.Side.Right];
                for (var i = 0; i < right_ref_info.NbRefs; i++) {
                    var ref = right_ref_info.GetControlRef(i);
                    if (ref.ToIndex != -1) {
                        var rect_to = this.Rects[ref.ToIndex];
                        var size = rect_to.Right - rect_to.Left;
                        if (size <= 20) {
                            rect.SizeStrength = 0.01;
                            break;
                        }
                    }
                }
            }
        };
        ControlSizer.prototype.DebugLog = function () {
            for (var _i = 0, _a = this.Rects; _i < _a.length; _i++) {
                var rect = _a[_i];
                if (rect)
                    console.log("Rect: ", rect.Title, rect.Left, "->", rect.Right, "...", rect.SideDistance, "/", rect.SizeStrength);
                else
                    console.log("Null Rect");
            }
            for (var _b = 0, _c = this.SizeConstraints; _b < _c.length; _b++) {
                var constraint = _c[_b];
                console.log("Size Constraint: ", constraint.Rect.Title, "@", constraint.Size);
            }
            for (var _d = 0, _e = this.ContainerConstraints; _d < _e.length; _d++) {
                var constraint = _e[_d];
                console.log("Container Constraint: ", constraint.Rect.Title, WM.Side[constraint.Side], "@", constraint.Position);
            }
            for (var _f = 0, _g = this.BufferConstraints; _f < _g.length; _f++) {
                var constraint = _g[_f];
                console.log("Buffer Constraint: ", constraint.Rect0.Title, "->", constraint.Rect1.Title, "on", WM.Side[constraint.Side0], "/", WM.Side[constraint.Side1]);
            }
        };
        return ControlSizer;
    }());
    WM.ControlSizer = ControlSizer;
    ;
})(WM || (WM = {}));
var WM;
(function (WM) {
    (function (Side) {
        Side[Side["Left"] = 0] = "Left";
        Side[Side["Right"] = 1] = "Right";
        Side[Side["Top"] = 2] = "Top";
        Side[Side["Bottom"] = 3] = "Bottom";
        Side[Side["None"] = 4] = "None";
    })(WM.Side || (WM.Side = {}));
    var Side = WM.Side;
    var Window = (function (_super) {
        __extends(Window, _super);
        function Window(title, position, size) {
            var _this = this;
            _super.call(this, position, size, new DOM.Node(Window.TemplateHTML));
            this.SnapRulers = [null, null, null, null];
            this.SizerMoved = false;
            this.OnBeginMove = function (event) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                _this.DragMouseStartPosition = mouse_pos;
                _this.DragWindowStartPosition = _this.Position.Copy();
                var parent_container = _this.ParentContainer;
                if (parent_container) {
                    var snap_tl = parent_container.GetSnapControls(_this.TopLeft, new int2(-1, -1), [_this], null, 0);
                    var snap_br = parent_container.GetSnapControls(_this.BottomRight, new int2(1, 1), [_this], null, 0);
                    _this.UpdateTLSnapRulers(snap_tl[0]);
                    _this.UpdateBRSnapRulers(snap_br[0]);
                }
                $(document).MouseMoveEvent.Subscribe(_this.OnMove);
                $(document).MouseUpEvent.Subscribe(_this.OnEndMove);
                DOM.Event.StopDefaultAction(event);
            };
            this.OnMove = function (event) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                var offset = int2.Sub(mouse_pos, _this.DragMouseStartPosition);
                _this.Position = int2.Add(_this.DragWindowStartPosition, offset);
                var parent_container = _this.ParentContainer;
                if (parent_container != null) {
                    var snap_tl = parent_container.GetSnapControls(_this.TopLeft, new int2(-1, -1), [_this], null, 0);
                    if (snap_tl[0] != 0)
                        _this.Position = snap_tl[1];
                    var snap_br = parent_container.GetSnapControls(_this.BottomRight, new int2(1, 1), [_this], null, 0);
                    if (snap_br[0] != 0)
                        _this.Position = int2.Sub(snap_br[1], _this.Size);
                    _this.UpdateTLSnapRulers(snap_tl[0]);
                    _this.UpdateBRSnapRulers(snap_br[0]);
                }
                _this.ParentContainer.UpdateControlSizes();
                DOM.Event.StopDefaultAction(event);
            };
            this.OnEndMove = function () {
                _this.RemoveSnapRulers();
                $(document).MouseMoveEvent.Unsubscribe(_this.OnMove);
                $(document).MouseUpEvent.Unsubscribe(_this.OnEndMove);
                DOM.Event.StopDefaultAction(event);
            };
            this.OnMoveOverSize = function (event) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                var mask = _this.GetSizeMask(mouse_pos);
                _this.SetResizeCursor($(event.target), mask);
            };
            this.OnBeginSize = function (event, in_mask, master_control) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                _this.DragMouseStartPosition = mouse_pos;
                _this.DragWindowStartPosition = _this.Position.Copy();
                _this.DragWindowStartSize = _this.Size.Copy();
                var mask = in_mask || _this.GetSizeMask(mouse_pos);
                _this.GatherAnchorControls(mask, master_control);
                for (var _i = 0, _a = _this.AnchorControls; _i < _a.length; _i++) {
                    var control = _a[_i];
                    var window_2 = control[0];
                    if (window_2 != null)
                        window_2.OnBeginSize(event, control[1], false);
                }
                _this.SizeGraph = new WM.ControlGraph();
                _this.SizeGraph.Build(_this);
                _this.ControlSizer = new WM.ControlSizer();
                _this.ControlSizer.Build(_this, _this.SizeGraph);
                _this.ControlSizer.DebugLog();
                _this.SizerMoved = false;
                if (master_control) {
                    setTimeout(function () {
                        if (_this.SizerMoved == false) {
                            _this.AnchorControls = [];
                            _this.RemoveSnapRulers();
                        }
                    }, 1000);
                    _this.OnSizeDelegate = function (event) { _this.OnSize(event, mask, 1, null); };
                    _this.OnEndSizeDelegate = function (event) { _this.OnEndSize(event, mask); };
                    $(document).MouseMoveEvent.Subscribe(_this.OnSizeDelegate);
                    $(document).MouseUpEvent.Subscribe(_this.OnEndSizeDelegate);
                    DOM.Event.StopDefaultAction(event);
                }
            };
            this.OnSize = function (event, mask, offset_scale, master_offset) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                var offset = master_offset || int2.Sub(mouse_pos, _this.DragMouseStartPosition);
                if (_this.SizerMoved == false && offset.x == 0 && offset.y == 0) {
                    DOM.Event.StopDefaultAction(event);
                    return;
                }
                _this.SizerMoved = true;
                offset = int2.Mul(offset, new int2(offset_scale));
                _this.Size = int2.Add(_this.DragWindowStartSize, int2.Mul(offset, mask));
                var position_mask = int2.Min0(mask);
                _this.Position = int2.Sub(_this.DragWindowStartPosition, int2.Mul(offset, position_mask));
                var exclude_controls = [_this];
                for (var _i = 0, _a = _this.AnchorControls; _i < _a.length; _i++) {
                    var anchor = _a[_i];
                    exclude_controls.push(anchor[0]);
                }
                var parent_container = _this.ParentContainer;
                if (parent_container != null) {
                    if (mask.x > 0 || mask.y > 0) {
                        var snap = parent_container.GetSnapControls(_this.BottomRight, mask, exclude_controls, null, 0);
                        if (snap[0] != 0) {
                            offset = int2.Add(offset, int2.Sub(snap[1], _this.BottomRight));
                            _this.BottomRight = snap[1];
                        }
                        if (master_offset == null)
                            _this.UpdateBRSnapRulers(snap[0]);
                    }
                    if (mask.x < 0 || mask.y < 0) {
                        var snap = parent_container.GetSnapControls(_this.TopLeft, mask, exclude_controls, null, 0);
                        if (snap[0] != 0) {
                            offset = int2.Add(offset, int2.Sub(snap[1], _this.TopLeft));
                            _this.TopLeft = snap[1];
                        }
                        if (master_offset == null)
                            _this.UpdateTLSnapRulers(snap[0]);
                    }
                }
                if (_this.SizeGraph) {
                    _this.ControlSizer.ChangeSize(_this.ControlParentNode.Size.x, _this.SizeGraph);
                }
                var min_window_size = new int2(50);
                _this.Size = int2.Max(_this.Size, min_window_size);
                _this.Position = int2.Min(_this.Position, int2.Sub(int2.Add(_this.DragWindowStartPosition, _this.DragWindowStartSize), min_window_size));
                for (var _b = 0, _c = _this.AnchorControls; _b < _c.length; _b++) {
                    var control = _c[_b];
                    var window_3 = control[0];
                    if (window_3 != null)
                        window_3.OnSize(event, control[1], control[2], offset);
                }
                _this.SetResizeCursor($(document.body), mask);
                _this.ParentContainer.UpdateControlSizes();
                DOM.Event.StopDefaultAction(event);
            };
            this.OnEndSize = function (event, mask) {
                for (var _i = 0, _a = _this.AnchorControls; _i < _a.length; _i++) {
                    var control = _a[_i];
                    var window_4 = control[0];
                    if (window_4 != null)
                        window_4.OnEndSize(event, mask);
                }
                _this.AnchorControls = [];
                _this.RestoreCursor($(document.body));
                _this.RemoveSnapRulers();
                $(document).MouseMoveEvent.Unsubscribe(_this.OnSizeDelegate);
                _this.OnSizeDelegate = null;
                $(document).MouseUpEvent.Unsubscribe(_this.OnEndSizeDelegate);
                _this.OnEndSizeDelegate = null;
                DOM.Event.StopDefaultAction(event);
            };
            this.TitleBarNode = this.Node.Find(".WindowTitleBar");
            this.TitleBarTextNode = this.Node.Find(".WindowTitleBarText");
            this.TitleBarCloseNode = this.Node.Find(".WindowTitleBarClose");
            this.BodyNode = this.Node.Find(".WindowBody");
            this.SizeLeftNode = this.Node.Find(".WindowSizeLeft");
            this.SizeRightNode = this.Node.Find(".WindowSizeRight");
            this.SizeTopNode = this.Node.Find(".WindowSizeTop");
            this.SizeBottomNode = this.Node.Find(".WindowSizeBottom");
            var body_styles = window.getComputedStyle(document.body);
            var side_bar_size = body_styles.getPropertyValue('--SideBarSize');
            this.SideBarSize = parseInt(side_bar_size);
            this.Title = title;
            this.TitleBarNode.MouseDownEvent.Subscribe(this.OnBeginMove);
            this.SizeLeftNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeRightNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeTopNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeBottomNode.MouseMoveEvent.Subscribe(this.OnMoveOverSize);
            this.SizeLeftNode.MouseDownEvent.Subscribe(function (event) { _this.OnBeginSize(event, null, true); });
            this.SizeRightNode.MouseDownEvent.Subscribe(function (event) { _this.OnBeginSize(event, null, true); });
            this.SizeTopNode.MouseDownEvent.Subscribe(function (event) { _this.OnBeginSize(event, null, true); });
            this.SizeBottomNode.MouseDownEvent.Subscribe(function (event) { _this.OnBeginSize(event, null, true); });
        }
        Object.defineProperty(Window.prototype, "Title", {
            get: function () {
                return this.TitleBarTextNode.Element.innerHTML;
            },
            set: function (title) {
                this.TitleBarTextNode.Element.innerHTML = title;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Window.prototype, "ControlParentNode", {
            get: function () {
                return this.BodyNode;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Window.prototype, "ZIndex", {
            get: function () {
                return this.Node.ZIndex;
            },
            set: function (z_index) {
                this.Node.ZIndex = z_index;
                this.SizeLeftNode.ZIndex = z_index + 1;
                this.SizeRightNode.ZIndex = z_index + 1;
                this.SizeTopNode.ZIndex = z_index + 1;
                this.SizeBottomNode.ZIndex = z_index + 1;
            },
            enumerable: true,
            configurable: true
        });
        Window.prototype.SetSnapRuler = function (side, position) {
            if (this.SnapRulers[side] == null) {
                var orient = (side == Side.Left || side == Side.Right) ? 1 : 0;
                this.SnapRulers[side] = new WM.Ruler(orient, position);
                this.SnapRulers[side].Node.Colour = "#FFF";
                if (this.ParentContainer)
                    this.ParentContainer.Add(this.SnapRulers[side]);
                this.SnapRulers[side].SendToBottom();
            }
            else {
                this.SnapRulers[side].SetPosition(position);
            }
        };
        Window.prototype.RemoveSnapRuler = function (side) {
            if (this.SnapRulers[side] != null) {
                if (this.ParentContainer)
                    this.ParentContainer.Remove(this.SnapRulers[side]);
                this.SnapRulers[side] = null;
            }
        };
        Window.prototype.RemoveSnapRulers = function () {
            this.RemoveSnapRuler(Side.Left);
            this.RemoveSnapRuler(Side.Right);
            this.RemoveSnapRuler(Side.Top);
            this.RemoveSnapRuler(Side.Bottom);
        };
        Window.prototype.UpdateSnapRuler = function (side, show, position) {
            if (show)
                this.SetSnapRuler(side, position);
            else
                this.RemoveSnapRuler(side);
        };
        Window.prototype.UpdateTLSnapRulers = function (snap_code) {
            this.UpdateSnapRuler(Side.Top, (snap_code & 2) != 0, this.TopLeft.y - 3);
            this.UpdateSnapRuler(Side.Left, (snap_code & 1) != 0, this.TopLeft.x - 3);
        };
        Window.prototype.UpdateBRSnapRulers = function (snap_code) {
            this.UpdateSnapRuler(Side.Bottom, (snap_code & 2) != 0, this.BottomRight.y + 1);
            this.UpdateSnapRuler(Side.Right, (snap_code & 1) != 0, this.BottomRight.x + 1);
        };
        Window.prototype.GetSizeMask = function (mouse_pos) {
            if (this.ParentNode)
                mouse_pos = int2.Sub(mouse_pos, this.ParentNode.Position);
            var offset_top_left = int2.Sub(mouse_pos, this.TopLeft);
            var offset_bottom_right = int2.Sub(this.BottomRight, mouse_pos);
            var mask = new int2(0);
            if (offset_bottom_right.x < this.SideBarSize && offset_bottom_right.x >= 0)
                mask.x = 1;
            if (offset_top_left.x < this.SideBarSize && offset_top_left.x >= 0)
                mask.x = -1;
            if (offset_bottom_right.y < this.SideBarSize && offset_bottom_right.y >= 0)
                mask.y = 1;
            if (offset_top_left.y < this.SideBarSize && offset_top_left.y >= 0)
                mask.y = -1;
            return mask;
        };
        Window.prototype.SetResizeCursor = function (node, size_mask) {
            var cursor = "";
            if (size_mask.y > 0)
                cursor += "s";
            if (size_mask.y < 0)
                cursor += "n";
            if (size_mask.x > 0)
                cursor += "e";
            if (size_mask.x < 0)
                cursor += "w";
            if (cursor.length > 0)
                cursor += "-resize";
            node.Cursor = cursor;
        };
        Window.prototype.RestoreCursor = function (node) {
            node.Cursor = "auto";
        };
        Window.prototype.MakeControlAABB = function (control) {
            var aabb = new AABB(control.TopLeft, control.BottomRight);
            aabb.Expand(WM.Container.SnapBorderSize);
            return aabb;
        };
        Window.prototype.TakeConnectedAnchorControls = function (aabb_0, anchor_controls) {
            for (var i = 0; i < this.AnchorControls.length;) {
                var anchor_control = this.AnchorControls[i];
                var aabb_1 = this.MakeControlAABB(anchor_control[0]);
                if (AABB.Intersect(aabb_0, aabb_1)) {
                    anchor_controls.push(anchor_control);
                    this.AnchorControls[i] = this.AnchorControls[this.AnchorControls.length - 1];
                    this.AnchorControls.length--;
                }
                else {
                    i++;
                }
            }
        };
        Window.prototype.MakeAnchorControlIsland = function () {
            var anchor_controls = [];
            var aabb_0 = this.MakeControlAABB(this);
            this.TakeConnectedAnchorControls(aabb_0, anchor_controls);
            for (var _i = 0, anchor_controls_1 = anchor_controls; _i < anchor_controls_1.length; _i++) {
                var anchor_control = anchor_controls_1[_i];
                var aabb_0_1 = this.MakeControlAABB(anchor_control[0]);
                this.TakeConnectedAnchorControls(aabb_0_1, anchor_controls);
            }
            this.AnchorControls = anchor_controls;
        };
        Window.prototype.GatherAnchorControls = function (mask, gather_sibling_anchors) {
            this.AnchorControls = [];
            var parent_container = this.ParentContainer;
            if (gather_sibling_anchors && parent_container) {
                if ((mask.x != 0) != (mask.y != 0)) {
                    if (mask.x > 0 || mask.y > 0) {
                        var snap = parent_container.GetSnapControls(this.BottomRight, mask, [this], this.AnchorControls, 1);
                        this.UpdateBRSnapRulers(snap[0]);
                    }
                    if (mask.x < 0 || mask.y < 0) {
                        var snap = parent_container.GetSnapControls(this.TopLeft, mask, [this], this.AnchorControls, 1);
                        this.UpdateTLSnapRulers(snap[0]);
                    }
                }
                this.MakeAnchorControlIsland();
            }
        };
        Window.TemplateHTML = "\n            <div class='Window'>\n                <div class='WindowTitleBar'>\n                    <div class='WindowTitleBarText notextsel' style='float:left'>Window Title Bar</div>\n                    <div class='WindowTitleBarClose notextsel' style='float:right'>O</div>\n                </div>\n                <div class='WindowBody'></div>\n                <div class='WindowSizeLeft'></div>\n                <div class='WindowSizeRight'></div>\n                <div class='WindowSizeTop'></div>\n                <div class='WindowSizeBottom'></div>\n            </div>";
        return Window;
    }(WM.Container));
    WM.Window = Window;
})(WM || (WM = {}));
var WM;
(function (WM) {
    var SavedControl = (function () {
        function SavedControl() {
        }
        return SavedControl;
    }());
    var SavedContainer = (function (_super) {
        __extends(SavedContainer, _super);
        function SavedContainer() {
            _super.apply(this, arguments);
            this.Controls = [];
        }
        return SavedContainer;
    }(SavedControl));
    var SavedWindow = (function (_super) {
        __extends(SavedWindow, _super);
        function SavedWindow() {
            _super.apply(this, arguments);
        }
        return SavedWindow;
    }(SavedContainer));
    function BuildSavedContainerList(container, saved_container) {
        for (var _i = 0, _a = container.Controls; _i < _a.length; _i++) {
            var control = _a[_i];
            if (control instanceof WM.Window)
                saved_container.Controls.push(BuildSavedWindow(control));
            else if (control instanceof WM.Container)
                saved_container.Controls.push(BuildSavedContainer(control));
        }
    }
    function BuildSavedControl(control, saved_control) {
        saved_control.ID = control.ID;
        saved_control.Position = control.Position;
        saved_control.Size = control.Size;
        saved_control.ZIndex = control.ZIndex;
    }
    function BuildSavedContainer(container) {
        var saved_container = new SavedContainer();
        BuildSavedControl(container, saved_container);
        BuildSavedContainerList(container, saved_container);
        return saved_container;
    }
    function BuildSavedWindow(window) {
        var saved_window = new SavedWindow();
        BuildSavedControl(window, saved_window);
        saved_window.Title = window.Title;
        BuildSavedContainerList(window, saved_window);
        return saved_window;
    }
    function SaveContainer(container) {
        var saved_container = BuildSavedContainer(container);
        return JSON.stringify(saved_container);
    }
    WM.SaveContainer = SaveContainer;
    function ApplyContainerList(container, saved_container) {
        if (saved_container.Controls === undefined)
            return;
        for (var i = 0; i < saved_container.Controls.length; i++) {
            var child_saved_control = saved_container.Controls[i];
            for (var j = 0; j < container.Controls.length; j++) {
                var child_control = container.Controls[j];
                if (child_control.ID == child_saved_control.ID) {
                    if (child_control instanceof WM.Window)
                        ApplyWindow(child_control, child_saved_control);
                    else if (child_control instanceof WM.Container)
                        ApplyContainer(child_control, child_saved_control);
                    break;
                }
            }
        }
    }
    function ApplyControl(control, saved_control) {
        if (saved_control.Position !== undefined)
            control.Position = new int2(saved_control.Position.x, saved_control.Position.y);
        if (saved_control.Size !== undefined)
            control.Size = new int2(saved_control.Size.x, saved_control.Size.y);
        if (saved_control.ZIndex !== undefined && saved_control.ZIndex != null)
            control.ZIndex = saved_control.ZIndex;
    }
    function ApplyWindow(window, saved_window) {
        ApplyControl(window, saved_window);
        if (saved_window.Title !== undefined)
            window.Title = saved_window.Title;
        ApplyContainerList(window, saved_window);
    }
    function ApplyContainer(container, saved_container) {
        ApplyControl(container, saved_container);
        ApplyContainerList(container, saved_container);
    }
    function LoadContainer(container, input) {
        var saved_container = JSON.parse(input);
        ApplyContainer(container, saved_container);
    }
    WM.LoadContainer = LoadContainer;
})(WM || (WM = {}));
function TestAll() {
    var Container = new WM.Container(new int2(10, 10), new int2(1000, 800));
    Container.Show();
    var WindowA = new WM.Window("Window A", new int2(10, 10), new int2(200, 200));
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
    var WindowI = new WM.Window("Window I", new int2(500, 400), new int2(300, 300));
    Container.Add(WindowI);
    WindowI.Add(new WM.Window("SubWindow 1 A", new int2(10, 10), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 B", new int2(20, 20), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 C", new int2(30, 30), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 D", new int2(40, 40), new int2(289, 289)));
    WindowI.Add(new WM.Window("SubWindow 1 E", new int2(50, 50), new int2(289, 289)));
    return Container;
}
//# sourceMappingURL=remotery.js.map