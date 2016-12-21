const utils = require('./geo-utils');
const vf = require('./vector_features');
const ol = require('openlayers');

class Arc {
  /*
   * Принимает координаты концов отрезка в виде долготы и широты
    * */
  constructor(a, b) {
    this.cartesianA = vf.convertLongLatToCartesian(a.map((x) => x * Math.PI / 180));
    this.cartesianB = vf.convertLongLatToCartesian(b.map((x) => x * Math.PI / 180));
    [this.coordinatesPart1, this.coordinatesPart2] = this._computeCoordinates(a, b);
    this.a = a;
    this.b = b;
  }

  draw(vectorSource, lineColor="blue") {
    const f1 = new ol.Feature(new ol.geom.LineString(this.coordinatesPart1));
    const f2 = new ol.Feature(new ol.geom.LineString(this.coordinatesPart2));

    f1.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: lineColor,
        width: lineColor === "blue" ? 1 : 2
      })
    }));
    f2.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: lineColor,
        width: lineColor === "blue" ? 1 : 2
      })
    }));

    vectorSource.addFeature(f1);
    vectorSource.addFeature(f2);
  }

  findIntersection(other) {
    const n1 = vf.crossProduct(this.cartesianA, this.cartesianB);
    const n2 = vf.crossProduct(other.cartesianA, other.cartesianB);

    const n = vf.normalizeVector(vf.crossProduct(n1, n2));

    const s1 = - Math.sign(vf.scalarProduct(vf.crossProduct(this.cartesianA, n1), n));
    const s2 = Math.sign(vf.scalarProduct(vf.crossProduct(this.cartesianB, n1), n));
    const s3 = - Math.sign(vf.scalarProduct(vf.crossProduct(other.cartesianA, n2), n));
    const s4 = Math.sign(vf.scalarProduct(vf.crossProduct(other.cartesianB, n2), n));

    const sign = s1 + s2 + s3 + s4;
    if (sign === 4) {
      return vf.convertCartesianToLongLat(n).map((x) => x * 180 / Math.PI);
    } else if (sign === -4) {
      return vf.convertCartesianToLongLat(vf.reverseVector(n)).map((x) => x * 180 / Math.PI);
    } else {
      return null;
    }
  }

  getMiddlePoint() {
    const middlePointIndex = Math.floor((this.coordinatesPart1.length + this.coordinatesPart2.length) / 2);

    if (this.coordinatesPart2.length > this.coordinatesPart1.length) {
      return ol.proj.transform(this.coordinatesPart2[middlePointIndex - this.coordinatesPart1.length], 'EPSG:3857', 'EPSG:4326');
    } else {
      return ol.proj.transform(this.coordinatesPart1[middlePointIndex], 'EPSG:3857', 'EPSG:4326');
    }
  }

  toString() {
    return this.a + "/" + this.b;
  }
  /*
   * Принимает координаты концов отрезка в EPSG:4326, возвращает координаты точек геодезического отрезка в EPSG:3857
   * Возвращаемые координаты делятся на два списка, один из которых может быть пустым
    * */
  _computeCoordinates(longLatA, longLatB) {
    const offset = 30;
    const MaxLong = 180 - offset;

    const circleDistance = this._computeCircleDistance(longLatA, longLatB);
    const dotCount = 500;
    const delta = 1 / (dotCount - 1);

    const part1 = [];
    const part2 = [];
    var border = false;
    var prevPoint = null;

    utils.range(dotCount).forEach((i) => {
      const p = this._intermediatePoint(i * delta, circleDistance, longLatA, longLatB);

      // граничный случай: линия продолжается по параллели, выходящей с одной стороны карты, и продолжающейся с другой
      // устранение горизонтальной линии, отрисовывающейся через всю карту одним вызовом LineString
      // координаты делятся на два списка, каждый из которых отрисовывается по отдельности

      if (prevPoint != null && ((p[0] > MaxLong && prevPoint[0] < -MaxLong) || (p[0] < -MaxLong && prevPoint[0] > MaxLong))) {
        border = true;
        var dfRatio = (180 - prevPoint[0]) / (p[0] - prevPoint[0]);
        var dfY = dfRatio * p[1] + (1 - dfRatio) * prevPoint[1];
        console.log(dfY);
        part1.push(ol.proj.transform([prevPoint[0] > -MaxLong ? 180 : -180, dfY], 'EPSG:4326', 'EPSG:3857'));
        part2.push(ol.proj.transform([prevPoint[0] > -MaxLong ? -180 : 180, dfY], 'EPSG:4326', 'EPSG:3857'));
      }

      if (!border) {
        part1.push(ol.proj.transform(p, 'EPSG:4326', 'EPSG:3857'));
      } else {
        part2.push(ol.proj.transform(p, 'EPSG:4326', 'EPSG:3857'));
      }

      prevPoint = p;
    });

    console.log(part1);
    console.log(part2);

    return [part1, part2];
  }

  /*
   * Вычисляет долготу и широту промежуточной точки i на отрезке a, b (координаты в виде долготы и широты) на отрезке с углом дуги d
   * */
  _intermediatePoint(i, d, a, b) {
    const A = Math.sin((1 - i) * d) / Math.sin(d);
    const B = Math.sin(i * d) / Math.sin(d);

    const [x1, y1, z1] = this.cartesianA;
    const [x2, y2, z2] = this.cartesianB;

    const x = A * x1 + B * x2;
    const y = A * y1 + B * y2;
    const z = A * z1 + B * z2;

    const longLat = vf.convertCartesianToLongLat([x, y, z]).map((x) => x * 180 / Math.PI);

    return longLat;
  }

  /*
   * Принимает координаты концов отрезка в виде долготы и широты, возвращает угол дуги на большом круге
    * */
  _computeCircleDistance(a, b) {
    const [long1, lat1] = a;
    const [long2, lat2] = b;
    return 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((long1 - long2) / 2), 2)
    ));
  }
}

module.exports = Arc;
