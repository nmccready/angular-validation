(function() {
  angular
    .module('validation.utils')
    .service('validationPromiseUtils', ['$q', function($q) {

      function isPromise(arg) {
        return arg.constructor === Object && typeof arg.then === 'function';
      }

      function doPromise(arg, promiseFunc) {
        var d = $q.defer();
        d[promiseFunc](arg);
        return d.promise;
      }

      function resolve(arg) {
        return doPromise(arg, 'resolve');
      }

      function reject(arg) {
        return doPromise(arg, 'reject');
      }

      function toPromise(arg) {
        return $q.when(arg);
      }

      return {
        resolve: resolve,
        reject: reject,
        toPromise: toPromise,
        isPromise: isPromise
      };
    }]);
}).call(this);
