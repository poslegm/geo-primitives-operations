const utils = require('./geo-utils');

module.exports.normalizeVector = function (coords) {
  const length = Math.sqrt(coords.reduce((a, b) => a + b * b, 0));
  return coords.map((a) => a / length);
}

module.exports.convertLongLatToCartesian = function (coords) {
  const [long, lat] = coords;
  const x = Math.cos(lat) * Math.cos(long);
  const y = Math.cos(lat) * Math.sin(long);
  const z = Math.sin(lat);
  return [x, y, z];
}

module.exports.convertCartesianToLongLat = function (coords) {
  const [x, y, z] = coords;
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const long = Math.atan2(y, x);
  return [long, lat];
}

module.exports.crossProduct = function (a, b) {
  const res = [];
  res.push(a[1] * b[2] - a[2] * b[1]);
  res.push(a[2] * b[0] - a[0] * b[2]);
  res.push(a[0] * b[1] - a[1] * b[0]);
  return res;
}

module.exports.scalarProduct = function (a, b) {
  if (a.length !== b.length) {
    return -1;
  }

  const sum = utils.range(a.length).map((i) => a[i] * b[i]);
  return sum.reduce((a, b) => a + b, 0);
}

module.exports.reverseVector = function (a) {
  return a.map((x) => -x);
}
