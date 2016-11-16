const utils = require('./geo-utils');
const vf = require('./vector_features');
const ol = require('openlayers');
const Arc = require('./arcs');

class Polygon {
  constructor() {
    this._points = [];
    this._arcs = [];
    this._closed = false;

    this._createTempLine();
  }

  /*
   * Принимает координаты точки в виде долготы и широты
    * */
  addPoint(coords) {
    if (this._points.length > 0) {
      this._arcs.push(new Arc(this._points.slice(-1)[0], coords));
    }

    this._points.push(coords);
  }

  close() {
    if (this._points.length < 3) {
      return;
    }

    this._arcs.push(new Arc(this._points[0], this._points.slice(-1)[0]));
    this._closed = true;
  }

  isClosed() {
    return this._closed;
  }

  draw(vectorSource) {
    if (this._arcs.length === 0) {
      return;
    }
    console.log('draw');
    this._arcs.forEach((a) => a.draw(vectorSource));

    if (!this._tempLineAdded) {
      vectorSource.addFeature(this._tempLine);
      this._tempLineAdded = true;
    }

    if (this._closed || this._arcs.length === 1) {
      this._tempLine.setGeometry();
    } else {
      const p1 = ol.proj.transform(this._points[0], 'EPSG:4326', 'EPSG:3857');
      const p2 = ol.proj.transform(this._points.slice(-1)[0], 'EPSG:4326', 'EPSG:3857');

      this._tempLine.setGeometry(new ol.geom.LineString([p1, p2]));
    }
  }

  checkDotInside(coords) {

  }

  _createTempLine() {
    this._tempLineAdded = false;
    this._tempLine = new ol.Feature({name: 'TempLine'});
    this._tempLine.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        lineDash: [4, 4]
      })
    }));
  }
}

module.exports = Polygon;
