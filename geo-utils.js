module.exports.range = function (n) {
  return [...Array(n).keys()];
}

Array.prototype.clear = function () {
  return this.splice(0, this.length);
}

module.exports.addToListsDict = function (dict, key, value) {
  if (dict[key] === undefined) {
    dict[key] = [value];
  } else {
    dict[key].push(value);
  }
}
