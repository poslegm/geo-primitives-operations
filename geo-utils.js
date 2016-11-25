module.exports.range = function (n) {
  return [...Array(n).keys()];
}

Array.prototype.clear = function () {
  return this.splice(0, this.length);
}
Array.prototype.removeFirst = function () {
  this.splice(0, 1);
}
/*
 * Удаляет элемент из массива с уникальными объектами, сравнимыми через ===
  * */
Array.prototype.removeFromArray = function (x, equal) {
  for (var i = 0; i < this.length; i++) {
    if (equal(this[i], x)) {
      this.splice(i, 1);
      return;
    }
  }
}

module.exports.addToListsDict = function (dict, key, value) {
  if (dict[key] === undefined) {
    dict[key] = [value];
  } else {
    dict[key].push(value);
  }
}
