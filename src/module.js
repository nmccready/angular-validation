(function() {
  angular.module('validation', ['validation.utils', 'validation.provider', 'validation.directive']);
  angular.module('validation.directive', ['validation.utils', 'validation.provider', ]);
  angular.module('validation.provider', ['validation.utils']);
  angular.module('validation.utils', []);
}).call(this);
