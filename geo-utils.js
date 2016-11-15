module.exports.range = function (n) {
  return [...Array(n).keys()];
}

Array.prototype.clear = function () {
  return this.splice(0, this.length);
}
