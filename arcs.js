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
  }

  draw(vectorSource) {
    vectorSource.addFeature(new ol.Feature(new ol.geom.LineString(this.coordinatesPart1)));
    vectorSource.addFeature(new ol.Feature(new ol.geom.LineString(this.coordinatesPart2)));
  }

  findIntersection(other) {
    console.log("Segments coordinates: ");
    console.log([this.a, this.b, other.a, other.b]);
    console.log([this.cartesianA, this.cartesianB, other.cartesianA, other.cartesianB]);

    const n1 = vf.crossProduct(this.cartesianA, this.cartesianB);
    const n2 = vf.crossProduct(other.cartesianA, other.cartesianB);
    console.log("Normales: ");
    console.log([n1, n2]);

    const n = vf.normalizeVector(vf.crossProduct(n1, n2));
    console.log("Normale: ");
    console.log(n);

    const s1 = - Math.sign(vf.scalarProduct(vf.crossProduct(this.cartesianA, n1), n));
    const s2 = Math.sign(vf.scalarProduct(vf.crossProduct(this.cartesianB, n1), n));
    const s3 = - Math.sign(vf.scalarProduct(vf.crossProduct(other.cartesianA, n2), n));
    const s4 = Math.sign(vf.scalarProduct(vf.crossProduct(other.cartesianB, n2), n));

    console.log([s1, s2, s3, s4]);
    const sign = s1 + s2 + s3 + s4;
    if (sign === 4) {
      return vf.convertCartesianToLongLat(n).map((x) => x * 180 / Math.PI);
    } else if (sign === -4) {
      return vf.convertCartesianToLongLat(vf.reverseVector(n)).map((x) => x * 180 / Math.PI);
    } else {
      return null;
    }
  }

  /*
   * Принимает координаты концов отрезка в EPSG:4326, возвращает координаты точек геодезического отрезка в EPSG:3857
   * Возвращаемые координаты делятся на два списка, один из которых может быть пустым
    * */
  _computeCoordinates(longLatA, longLatB) {
    const MaxLong = 178;
    const MaxLat = 85.05113;

    const circleDistance = this._computeCircleDistance(longLatA, longLatB);
    const dotCount = 400;
    const delta = 1 / (dotCount - 1);

    const part1 = [];
    const part2 = [];
    var border = false;
    var prevPoint = null;

    utils.range(dotCount).forEach((i) => {
      const p = this._intermediatePoint(i * delta, circleDistance, longLatA, longLatB);

      console.log(p[0]);

      // граничный случай 1: линия продолжается по параллели, выходящей с одной стороны карты, и продолжающейся с другой
      // устранение горизонтальной линии, отрисовывающейся через всю карту одним вызовом LineString
      // координаты делятся на два списка, каждый из которых отрисовывается по отдельности

      if (prevPoint != null &&
          (p[0] > MaxLong || p[0] < -MaxLong) &&
          (p[0] >= - (prevPoint[0] + 2) && p[0] <= - (prevPoint[0] - 2))
      ) {
        border = true;
      }

      // граничный случай 2: когда геодезический отрезок проходит через полюс (полюса не отображаются на картах по стандарту EPSG:3857),
      // по верхнему или нижнему краю карты может отрисовываться горизонтальная линия, соединяющая точки выхода за границы карты
      // проблема решается фильтрацией точек, долгота которых лежит за пределами допустимой

      if (p[1] >= -MaxLat && p[1] <= MaxLat) {
        if (!border) {
          part1.push(ol.proj.transform(p, 'EPSG:4326', 'EPSG:3857'));
        } else {
          part2.push(ol.proj.transform(p, 'EPSG:4326', 'EPSG:3857'));
        }
      }

      prevPoint = p;
    });

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
