<html>
  <head>
    <script src="jpg.js"></script>
    <script src="DataStream.js"></script>
  </head>
  <body>
    <h1>JPEG marker reader</h1>
    <h3>Select a JPEG or TIFF file</h3>
    <input type="file"><br>
    <pre></pre>
    <script>
document.querySelector('input[type="file"]').onchange = function(e) {
  var reader = new FileReader();

  var tiffByteSize = {
    1:1, 2:1, 3:2, 4:4, 5:8, 6:1, 7:1, 8:2, 9:4, 10:8, 11:4, 12:8
  };

  var tiffTag = [
    'tag', 'uint16',
    'type', 'uint16',
    'count', 'uint32',
    'value', function(ds, s) {
      var p = ds.position;
      if (s.count * tiffByteSize[s.type] > 4) {
        ds.seek(ds.readUint32());
      }
      var v = {error: 'Unknown TIFF Field'};
      switch (s.type) {
        case 1: v = ds.readUint8Array(s.count); break;
        case 2: v = ds.readString(s.count); break; 
        case 3: v = ds.readUint16Array(s.count); break; 
        case 4: v = ds.readUint32Array(s.count); break; 
        case 5: v = ds.readUint32Array(2*s.count); break; 
        case 6: v = ds.readInt8Array(s.count); break; 
        case 7: v = ds.readInt8Array(s.count); break; 
        case 8: v = ds.readInt16Array(s.count); break; 
        case 9: v = ds.readInt32Array(s.count); break; 
        case 10: v = ds.readInt32Array(2*s.count); break; 
        case 11: v = ds.readFloat32(s.count); break; 
        case 12: v = ds.readFloat64(s.count); break; 
      }
      ds.position = p + 4;
      if (v.length && s.type != 2) {
        v = Array.prototype.join.call(v);
      }
      return v;
    }
  ];

  var parseTIFF = function(u8) {
    var rv = {};
    var ds = new DataStream(u8);
    rv.endianness = ds.readString(2);
    ds.endianness = rv.endianness == 'MM' ? DataStream.BIG_ENDIAN : DataStream.LITTLE_ENDIAN;
    rv.magic = ds.readUint16();
    if (rv.magic != 42) return null;
    rv.firstOff = ds.readUint32();
    ds.seek(rv.firstOff);
    var h = [];
    rv.entries = h;
    rv.dirOffsets = [];
    while (true) {
      numEntries = ds.readUint16();
      for (var i = 0; i<numEntries; i++) {
        h.push(ds.readStruct(tiffTag));
      }
      nextOff = ds.readUint32();
      if (nextOff) {
        ds.seek(nextOff);
        rv.dirOffsets.push(nextOff);
      } else {
        break;
      }
    }
    return rv;
  };

  var jpegMarkers = {
    // Huffman coding SOFs
    0xFFC0: "SOF0", // baseline DCT
    0xFFC1: "SOF1", // extended sequential DCT
    0xFFC2: "SOF2", // progressive DCT
    0xFFC3: "SOF3", // lossless (sequential)

    0xFFC5: "SOF5", // differential sequential DCT
    0xFFC6: "SOF6", // differential progressive DCT
    0xFFC7: "SOF7", // differential lossless (sequential)

    // Arithmetic coding SOFs
    0xFFC8: "JPG", // reserved
    0xFFC9: "SOF9", // extended sequential DCT
    0xFFCA: "SOF10", // progressive DCT
    0xFFCB: "SOF11", // lossless sequential

    0xFFCD: "SOF13", // differential sequential DCT
    0xFFCE: "SOF14", // differential progressive DCT
    0xFFCF: "SOF15", // differential lossless DCT

    0xFFC4: "DHT", // Define Huffman table(s)
    0xFFCC: "DAC", // Define arithmetic coding conditioning(s)

    // Restart interval termination
    0xFFD0: "RST0",
    0xFFD1: "RST1",
    0xFFD2: "RST2",
    0xFFD3: "RST3",
    0xFFD4: "RST4",
    0xFFD5: "RST5",
    0xFFD6: "RST6",
    0xFFD7: "RST7",

    // other markers
    0xFFD8: "SOI", // start of image
    0xFFD9: "EOI", // end of image
    0xFFDA: "SOS", // start of scan
    0xFFDB: "DQT", // define quantization table(s)
    0xFFDC: "DNL", // define number of lines
    0xFFDD: "DRI", // define restart interval
    0xFFDE: "DHP", // define hierarchical progression
    0xFFDF: "EXP", // expand reference component(s)

    // APP markers
    0xFFE0: "APP0",
    0xFFE1: "APP1",
    0xFFE2: "APP2",
    0xFFE3: "APP3",
    0xFFE4: "APP4",
    0xFFE5: "APP5",
    0xFFE6: "APP6",
    0xFFE7: "APP7",
    0xFFE8: "APP8",
    0xFFE9: "APP9",
    0xFFEA: "APP10",
    0xFFEB: "APP11",
    0xFFEC: "APP12",
    0xFFED: "APP13",
    0xFFEE: "APP14",
    0xFFEF: "APP15",

    // JPEG extensions
    0xFFF0: "JPG0",
    0xFFF1: "JPG1",
    0xFFF2: "JPG2",
    0xFFF3: "JPG3",
    0xFFF4: "JPG4",
    0xFFF5: "JPG5",
    0xFFF6: "JPG6",
    0xFFF7: "JPG7",
    0xFFF8: "JPG8",
    0xFFF9: "JPG9",
    0xFFFA: "JPG10",
    0xFFFB: "JPG11",
    0xFFFC: "JPG12",
    0xFFFD: "JPG13",

    0xFFFE: "COM", // comment

    0xFF01: "TEM*" // For temporary private use in arithmetic coding
  };

  var jpegStruct = [
      'start', function(ds){ var t = ds.readUint16(); return t == 0xFFD8 ? t : null; },
      'markers', ['[]', [
        'tag', function(ds){ var t = ds.readUint16(); return t == 0xFFD9 ? null : t; },
        'tagName', function(ds, s) { return jpegMarkers[s.tag] || "Unknown"; },
        'length', 'uint16be',
        'data', {
          get: function(ds, s) {
            switch (s.tag) {
            case 0xFFE1: // EXIF
              var exif = ds.readString(6);
              if (exif == 'Exif\000\000') {
                // parse rest of Exif
                return { exif: exif, data: parseTIFF(ds.mapUint8Array(s.length - 8)) };
              } else {
                ds.position -= exif.length;
                var xmp = ds.readCString();
                if (xmp == "http://ns.adobe.com/xap/1.0/") {
                  return { xmp: xmp, data: ds.readString(s.length-2-xmp.length-1) };
                } else {
                  ds.position -= xmp.length+1;
                  return ds.mapUint8Array(s.length - 2).length;
                }
              }
              break;
            case 0xFFE0: // APP0
              if (s.length >= 7) { // probably a JFIF
                var p = ds.position;
                var jfif = ds.readCString(5);
                if (jfif == 'JFIF' || jfif == 'JFXX') {
                  var jfifStruct = [
	            'majorVersion', 'uint8',
                    'minorVersion', 'uint8',
                    'units', 'uint8',
                    'xDensity', 'uint16',
                    'yDensity', 'uint16',
                    'thumbnail', [
                      'width', 'uint8',
                      'height', 'uint8',
                      'data', ['[]', 'uint8', '*']]];
                  if (jfif == 'JFXX') {
	            jfifStruct.unshift('extensionCode', 'uint8');
                  }
                  var u8 = ds.mapUint8Array(s.length-7);
                  var rv = new DataStream(u8, null, DataStream.BIG_ENDIAN).readStruct(jfifStruct);
                  if (!rv) {
                    ds.position = p;
                    return ds.readString(s.length-2);
                  }
                  return {jfif: jfif, data: rv};
                } else {
                  ds.position -= 5;
                  return ds.readString(s.length-2);
                }
              } else {
                return ds.mapUint8Array(s.length - 2).length;
              }
              break;
            case 0xFFE2: // APP2, ICC Profile most likely
              return ds.readString(s.length-2);
            case 0xFFED: // APP13, IPTC / Photoshop IRB
              return ds.readString(s.length-2);
            case 0xFFDD: // DRI
              return s.length == 4 ? ds.readUint16() : ds.mapUint8Array(s.length-2).length;
            case 0xFFDA: // image stream
              var p = ds.position;
              var cmpCount = ds.readUint8();
              var cs = [];
              for (var i=0; i<cmpCount; i++) {
                cs.push({id: ds.readUint8(), huffmanTable: ds.readUint8()});
              }
              ds.position = p + s.length;
              p = ds.position;
              var u8 = ds.mapUint8Array(ds.byteLength-ds.position);
              for (var i=1; i<u8.length; i++) {
                if (u8[i-1] == 0xFF && u8[i] == 0xD9) {
                  break;
                }
              }
              ds.position = p;
              return {components: cs, imageData: ds.mapUint8Array(i-1).length};
              break;
            default:
              return ds.mapUint8Array(s.length - 2).length;
              break;
            }
          }
        }
      ], '*'],
      'end', function(ds){ var t = ds.readUint16(); return t == 0xFFD9 ? t : null; }
  ];

  reader.onload = function(e) {
    var ds = new DataStream(this.result);
    ds.endianness = DataStream.BIG_ENDIAN;
    var obj = ds.readStruct(jpegStruct) || parseTIFF(this.result);
    pre = document.querySelector('pre');
    if (obj) { 
      pre.textContent = JSON.stringify(obj, null, 4);
      if (obj.start) {
        var j = new JpegImage();
        j.parse(new Uint8Array(this.result));
        var c = document.createElement('canvas');
        c.width = j.width; c.height = j.height;
        var ctx = c.getContext('2d');
        var id = ctx.getImageData(0,0,j.width, j.height);
        j.copyToImageData(id);
        ctx.putImageData(id, 0,0);
        c.style.display = 'block';
        pre.appendChild(c);
      }
    } else {
      pre.textContent = "Failed to parse JPEG at "+ds.failurePosition+" :(";
    }
  };

  reader.readAsArrayBuffer(this.files[0]);
};

    </script>
  </body>
</html>
