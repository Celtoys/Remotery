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
                return parseInt(this.Element.style.zIndex);
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
                _this.BringToTop();
            };
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
                this.OnParentResize();
            }
        };
        Control.prototype.Hide = function () {
            if (this.Node.Parent != null) {
                this.Node.Detach();
                this._Visible = false;
            }
        };
        Control.prototype.BringToTop = function () {
            if (this._ParentContainer)
                this._ParentContainer.SetTopControl(this);
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
        Container.prototype.SetTopControl = function (control) {
            var top_index = this.Controls.indexOf(control);
            if (top_index != -1) {
                this.Controls.splice(top_index, 1);
                this.Controls.push(control);
                for (var i = 0; i < this.Controls.length; i++) {
                    var control_1 = this.Controls[i];
                    if (!control_1.Visible)
                        continue;
                    var z = (i + 1) * 10;
                    control_1.ZIndex = z;
                }
            }
        };
        Container.prototype.WillControlSnap = function (pos, mask, top_left, bottom_right) {
            var d_tl = int2.Abs(int2.Sub(pos, top_left));
            var d_br = int2.Abs(int2.Sub(pos, bottom_right));
            var out_mask = new int2(0, 0);
            var b = Container.SnapBorderSize;
            if (mask.x != 0) {
                if (d_tl.x < b)
                    out_mask.x = -1;
                if (d_br.x < b)
                    out_mask.x = 1;
            }
            if (mask.y != 0) {
                if (d_tl.y < b)
                    out_mask.y = -1;
                if (d_br.y < b)
                    out_mask.y = 1;
            }
            if (out_mask.x != 0 || out_mask.y != 0)
                return out_mask;
            return null;
        };
        Container.prototype.GetSnapControls = function (pos, mask, excluding, controls, offset_scale) {
            var b = Container.SnapBorderSize;
            var snapped = false;
            for (var _i = 0, _a = this.Controls; _i < _a.length; _i++) {
                var control = _a[_i];
                if (control == excluding)
                    continue;
                if (!(control instanceof Container))
                    continue;
                var top_left = control.TopLeft;
                var bottom_right = control.BottomRight;
                var out_mask = this.WillControlSnap(pos, mask, top_left, bottom_right);
                if (out_mask != null)
                    controls.push([control, out_mask, offset_scale]);
            }
        };
        Container.prototype.SnapControl = function (pos, snap_pos, mask, p_mask, n_mask, top_left, bottom_right) {
            var b = Container.SnapBorderSize;
            var snap_code = 0;
            var d_tl = int2.Abs(int2.Sub(pos, top_left));
            var d_br = int2.Abs(int2.Sub(pos, bottom_right));
            if (mask.x != 0) {
                if (d_tl.x < b) {
                    snap_pos.x = top_left.x - p_mask.x;
                    snap_code |= 1;
                }
                if (d_br.x < b) {
                    snap_pos.x = bottom_right.x + n_mask.x;
                    snap_code |= 1;
                }
            }
            if (mask.y != 0) {
                if (d_tl.y < b) {
                    snap_pos.y = top_left.y - p_mask.y;
                    snap_code |= 2;
                }
                if (d_br.y < b) {
                    snap_pos.y = bottom_right.y + n_mask.y;
                    snap_code |= 2;
                }
            }
            return snap_code;
        };
        Container.prototype.GetSnapEdge = function (pos, mask, excluding) {
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
                snap_code |= this.SnapControl(pos, snap_pos, mask, p_mask, n_mask, control.TopLeft, control.BottomRight);
            }
            var parent_size = this.ControlParentNode.Size;
            snap_code |= this.SnapControl(pos, snap_pos, mask, p_mask, n_mask, new int2(b), int2.Sub(parent_size, new int2(b)));
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
    var Window = (function (_super) {
        __extends(Window, _super);
        function Window(title, position, size) {
            var _this = this;
            _super.call(this, position, size, new DOM.Node(Window.TemplateHTML));
            this.OnBeginMove = function (event) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                _this.DragMouseStartPosition = mouse_pos;
                _this.DragWindowStartPosition = _this.Position.Copy();
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
                    var snap_tl = parent_container.GetSnapEdge(_this.TopLeft, new int2(-1, -1), [_this]);
                    if (snap_tl[0] != 0)
                        _this.Position = snap_tl[1];
                    var snap_br = parent_container.GetSnapEdge(_this.BottomRight, new int2(1, 1), [_this]);
                    if (snap_br[0] != 0)
                        _this.Position = int2.Sub(snap_br[1], _this.Size);
                }
                _this.ParentContainer.UpdateControlSizes();
                DOM.Event.StopDefaultAction(event);
            };
            this.OnEndMove = function () {
                $(document).MouseMoveEvent.Unsubscribe(_this.OnMove);
                $(document).MouseUpEvent.Unsubscribe(_this.OnEndMove);
                DOM.Event.StopDefaultAction(event);
            };
            this.OnMoveOverSize = function (event) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                var mask = _this.GetSizeMask(mouse_pos);
                _this.SetResizeCursor($(event.target), mask);
            };
            this.OnBeginSize = function (event, in_mask, gather_sibling_anchors) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                _this.DragMouseStartPosition = mouse_pos;
                _this.DragWindowStartPosition = _this.Position.Copy();
                _this.DragWindowStartSize = _this.Size.Copy();
                var mask = in_mask || _this.GetSizeMask(mouse_pos);
                _this.GatherAnchorControls(mask, gather_sibling_anchors);
                for (var _i = 0, _a = _this.AnchorControls; _i < _a.length; _i++) {
                    var control = _a[_i];
                    var window_1 = control[0];
                    if (window_1 != null)
                        window_1.OnBeginSize(event, control[1], false);
                }
                _this.OnSizeDelegate = function (event) { _this.OnSize(event, mask, 1); };
                _this.OnEndSizeDelegate = function (event) { _this.OnEndSize(event, mask); };
                $(document).MouseMoveEvent.Subscribe(_this.OnSizeDelegate);
                $(document).MouseUpEvent.Subscribe(_this.OnEndSizeDelegate);
                DOM.Event.StopDefaultAction(event);
            };
            this.OnSize = function (event, mask, offset_scale) {
                var mouse_pos = DOM.Event.GetMousePosition(event);
                var offset = int2.Sub(mouse_pos, _this.DragMouseStartPosition);
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
                        var snap = parent_container.GetSnapEdge(_this.BottomRight, mask, exclude_controls);
                        if (snap[0] != 0)
                            _this.BottomRight = snap[1];
                        _this.UpdateSnapRuler((snap[0] & 1) != 0, _this.BottomRight.x + 1);
                    }
                    if (mask.x < 0 || mask.y < 0) {
                        var snap = parent_container.GetSnapEdge(_this.TopLeft, mask, exclude_controls);
                        if (snap[0] != 0)
                            _this.TopLeft = snap[1];
                        _this.UpdateSnapRuler((snap[0] & 1) != 0, _this.TopLeft.x - 3);
                    }
                }
                var min_window_size = new int2(50);
                _this.Size = int2.Max(_this.Size, min_window_size);
                _this.Position = int2.Min(_this.Position, int2.Sub(int2.Add(_this.DragWindowStartPosition, _this.DragWindowStartSize), min_window_size));
                for (var _b = 0, _c = _this.AnchorControls; _b < _c.length; _b++) {
                    var control = _c[_b];
                    var window_2 = control[0];
                    if (window_2 != null)
                        window_2.OnSize(event, control[1], control[2]);
                }
                _this.SetResizeCursor($(document.body), mask);
                _this.ParentContainer.UpdateControlSizes();
                DOM.Event.StopDefaultAction(event);
            };
            this.OnEndSize = function (event, mask) {
                _this.AnchorControls = [];
                _this.RestoreCursor($(document.body));
                _this.RemoveSnapRuler();
                $(document).MouseMoveEvent.Unsubscribe(_this.OnSizeDelegate);
                $(document).MouseUpEvent.Unsubscribe(_this.OnEndSizeDelegate);
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
        Window.prototype.SetSnapRuler = function (position) {
            if (this.SnapRuler == null) {
                this.SnapRuler = new WM.Ruler(1, position);
                this.SnapRuler.Node.Colour = "#FFF";
                if (this.ParentContainer)
                    this.ParentContainer.Add(this.SnapRuler);
            }
            else {
                this.SnapRuler.SetPosition(position);
            }
        };
        Window.prototype.RemoveSnapRuler = function () {
            if (this.SnapRuler != null) {
                if (this.ParentContainer)
                    this.ParentContainer.Remove(this.SnapRuler);
                this.SnapRuler = null;
            }
        };
        Window.prototype.UpdateSnapRuler = function (show, position) {
            if (show)
                this.SetSnapRuler(position);
            else
                this.RemoveSnapRuler();
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
                    if (mask.x > 0 || mask.y > 0)
                        parent_container.GetSnapControls(this.BottomRight, mask, this, this.AnchorControls, 1);
                    if (mask.x < 0 || mask.y < 0)
                        parent_container.GetSnapControls(this.TopLeft, mask, this, this.AnchorControls, 1);
                }
                this.MakeAnchorControlIsland();
            }
            var this_br = int2.Sub(this.ControlParentNode.Size, int2.One);
            if (mask.x > 0 || mask.y > 0)
                this.GetSnapControls(this_br, mask, null, this.AnchorControls, 1);
            if (mask.x < 0 || mask.y < 0)
                this.GetSnapControls(this_br, mask, null, this.AnchorControls, -1);
        };
        Window.TemplateHTML = "\n            <div class='Window'>\n                <div class='WindowTitleBar'>\n                    <div class='WindowTitleBarText notextsel' style='float:left'>Window Title Bar</div>\n                    <div class='WindowTitleBarClose notextsel' style='float:right'>O</div>\n                </div>\n                <div class='WindowBody'></div>\n                <div class='WindowSizeLeft'></div>\n                <div class='WindowSizeRight'></div>\n                <div class='WindowSizeTop'></div>\n                <div class='WindowSizeBottom'></div>\n            </div>";
        return Window;
    }(WM.Container));
    WM.Window = Window;
})(WM || (WM = {}));
function TestAll() {
    var Container = new WM.Container(new int2(10, 10), new int2(1000, 800));
    Container.Show();
    var WindowA = new WM.Window("Window A", new int2(10, 10), new int2(200, 200));
    WindowA.Title = "Window A Changed";
    Container.Add(WindowA);
    WindowA.Add(new WM.Window("SubWindow A", new int2(10, 10), new int2(200, 200)));
    WindowA.Add(new WM.Window("SubWindow B", new int2(40, 40), new int2(200, 200)));
    Container.Add(new WM.Window("Window B", new int2(220, 10), new int2(200, 200)));
    Container.Add(new WM.Window("Window C", new int2(430, 10), new int2(200, 200)));
    Container.Add(new WM.Window("Window D", new int2(640, 10), new int2(200, 200)));
    Container.Add(new WM.Window("Window E", new int2(10, 220), new int2(200, 200)));
    Container.Add(new WM.Window("Window F", new int2(220, 220), new int2(200, 200)));
    Container.Add(new WM.Window("Window G", new int2(430, 220), new int2(200, 200)));
    Container.Add(new WM.Window("Window H", new int2(640, 220), new int2(200, 200)));
}
//# sourceMappingURL=remotery.js.map