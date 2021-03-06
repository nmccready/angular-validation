(function() {
  angular.module('validation', ['validation.utils', 'validation.provider', 'validation.directive']);
  angular.module('validation.directive', ['validation.utils', 'validation.provider', ]);
  angular.module('validation.provider', ['validation.utils']);
  angular.module('validation.utils', []);
}).call(this);

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

(function() {
  angular
    .module('validation.provider')
    .provider('$validation', Provider);

  function Provider() {
    var $injector;
    var $scope;
    var $http;
    var $q;
    var $timeout;
    var $log;
    var _this = this;

    /**
     * Setup the provider
     * @param injector
     */
    var setup = function(injector) {
      $injector = injector;
      $scope = $injector.get('$rootScope');
      $http = $injector.get('$http');
      $q = $injector.get('$q');
      $timeout = $injector.get('$timeout');
      $log = $injector.get('$log');
    };

    /**
     * Define validation type RegExp
     * @type {{}}
     */
    var expression = {};

    /**
     * default valid method
     * @type {{}}
     */
    var validMethod = null;

    /**
     * default error, success message
     * @type {{}}
     */
    var defaultMsg = {};

    /**
     * Allow user to set a custom Expression, do remember set the default message using setDefaultMsg
     * @param obj
     * @returns {*}
     */
    this.setExpression = function(obj) {
      angular.extend(expression, obj);
      return _this;
    };

    /**
     * Get the Expression
     * @param exprs
     * @returns {*}
     */
    this.getExpression = function(exprs) {
      return expression[exprs];
    };

    /**
     * Allow user to set default message
     * @param obj
     * @returns {*}
     */
    this.setDefaultMsg = function(obj) {
      angular.extend(defaultMsg, obj);
      return _this;
    };

    /**
     * Get the Default Message
     * @param msg
     * @returns {*}
     */
    this.getDefaultMsg = function(msg) {
      return defaultMsg[msg];
    };

    /**
     * allow user to set the global valid method
     * @param v
     * @returns {*}
     */
    this.setValidMethod = function(v) {
      validMethod = v;
    };

    /**
     * Get the valid method
     * @returns {*}
     */
    this.getValidMethod = function() {
      return validMethod;
    };

    /**
     * Override the errorHTML function
     * @param func
     * @returns {*}
     */
    this.setErrorHTML = function(func) {
      if (func.constructor !== Function) {
        return;
      }
      _this.getErrorHTML = func;
      return _this;
    };

    /**
     * Invalid message HTML, here's the default
     * @param message
     * @returns {string}
     */
    this.getErrorHTML = function(message) {
      return '<p class="validation-invalid">' + message + '</p>';
    };

    /**
     * Override the successHTML function
     * @param func
     * @returns {*}
     */
    this.setSuccessHTML = function(func) {
      if (func.constructor !== Function) {
        return;
      }
      _this.getSuccessHTML = func;
      return _this;
    };

    /**
     * Valid message HTML, here's the default
     * @param message
     * @returns {string}
     */
    this.getSuccessHTML = function(message) {
      return '<p class="validation-valid">' + message + '</p>';
    };

    /**
     * Whether show the validation success message
     * You can easily change this to false in your config
     * example: $validationProvider.showSuccessMessage = false;
     * @type {boolean}
     */
    this.showSuccessMessage = true;

    /**
     * Whether show the validation error message
     * You can easily change this to false in your config
     * example: $validationProvider.showErrorMessage = false;
     * @type {boolean}
     */
    this.showErrorMessage = true;

    /**
     * Check form valid, return true
     * checkValid(Form): Check the specific form(Form) valid from angular `$valid`
     * @param form
     * @returns {boolean}
     */
    this.checkValid = function(form) {
      return !!(form && form.$valid);
    };

    /**
     * Validate the form when click submit, when `validMethod = submit`
     * @param form
     * @returns {promise|*}
     */
    this.validate = function(form) {
      var deferred = $q.defer();
      var idx = 0;
      var promises = [];

      function execValidation(func) {
        if (func)
          promises.push(func(idx++));
      }

      if (form === undefined) {
        $log.error('This is not a regular Form name scope');
        deferred.reject('This is not a regular Form name scope');
        return deferred.promise;
      }

      // Big divergence from main fork as we use execValidation with out broadcasts to protect the timing
      // is checked for validity below
      if (form.validationId) { // single
        if (form.$angularValidators)
          execValidation(form.$angularValidators[form.$name + '-' + form.validationId]);
      } else if (form.constructor === Array) { // multiple
        for (var k in form) {
          if (!form[k].$angularValidators)
            continue;
          execValidation(form[k].$angularValidators[form[k].$name + '-' + form[k].validationId]);
        }
      } else {
        for (var i in form) { // whole scope
          if (i[0] !== '$' && form[i].hasOwnProperty('$dirty')) {
            if (!form[i].$angularValidators)
              continue;
            execValidation(form[i].$angularValidators[i + '-' + form[i].validationId]);
          }
        }
      }

      deferred.promise.success = function(fn) {
        deferred.promise.then(function(value) {
          fn(value);
        });
        return deferred.promise;
      };

      deferred.promise.error = function(fn) {
        deferred.promise.then(null, function(value) {
          fn(value);
        });
        return deferred.promise;
      };

      // Divergence from main fork where $timeout was removed infavor of promises to have valid timing
      $q.all(promises).then(function() {
        if (_this.checkValid(form)) {
          deferred.resolve('success');
        } else {
          deferred.reject('error');
        }
      });

      return deferred.promise;
    };

    /**
     * Do this function if validation valid
     * @param element
     */
    this.validCallback = null;

    /**
     * Do this function if validation invalid
     * @param element
     */
    this.invalidCallback = null;

    /**
     * reset the specific form
     * @param form
     */
    this.reset = function(form) {
      if (form === undefined) {
        $log.error('This is not a regular Form name scope');
        return;
      }

      if (form.validationId) {
        $scope.$broadcast(form.$name + 'reset-' + form.validationId);
      } else if (form.constructor === Array) {
        for (var k in form) {
          $scope.$broadcast(form[k].$name + 'reset-' + form[k].validationId);
        }
      } else {
        for (var i in form) {
          if (i[0] !== '$' && form[i].hasOwnProperty('$dirty')) {
            $scope.$broadcast(i + 'reset-' + form[i].validationId);
          }
        }
      }
    };

    /**
     * $get
     * @returns {{setErrorHTML: *, getErrorHTML: Function, setSuccessHTML: *, getSuccessHTML: Function, setExpression: *, getExpression: Function, setDefaultMsg: *, getDefaultMsg: Function, checkValid: Function, validate: Function, reset: Function}}
     */
    this.$get = ['$injector', function($injector) {
      setup($injector);
      return {
        setValidMethod: this.setValidMethod,
        getValidMethod: this.getValidMethod,
        setErrorHTML: this.setErrorHTML,
        getErrorHTML: this.getErrorHTML,
        setSuccessHTML: this.setSuccessHTML,
        getSuccessHTML: this.getSuccessHTML,
        setExpression: this.setExpression,
        getExpression: this.getExpression,
        setDefaultMsg: this.setDefaultMsg,
        getDefaultMsg: this.getDefaultMsg,
        showSuccessMessage: this.showSuccessMessage,
        showErrorMessage: this.showErrorMessage,
        checkValid: this.checkValid,
        validate: this.validate,
        validCallback: this.validCallback,
        invalidCallback: this.invalidCallback,
        reset: this.reset
      };
    }];
  }
}).call(this);

(function() {
  angular
    .module('validation.directive')
    .directive('validationReset', Reset);

  function Reset($injector) {
    var $validationProvider = $injector.get('$validation');
    var $timeout = $injector.get('$timeout');
    var $parse = $injector.get('$parse');
    return {
      link: function postLink(scope, element, attrs) {
        var form = $parse(attrs.validationReset)(scope);
        $timeout(function() {
          element.on('click', function(e) {
            e.preventDefault();
            $validationProvider.reset(form);
          });
        });
      }
    };
  }
  Reset.$inject = ['$injector'];
}).call(this);

(function() {
  angular
    .module('validation.directive')
    .directive('validationSubmit', Submit);

  function Submit($injector) {
    var $validationProvider = $injector.get('$validation');
    var $timeout = $injector.get('$timeout');
    var $parse = $injector.get('$parse');
    return {
      priority: 1, // execute before ng-click (0)
      require: '?ngClick',
      link: function postLink(scope, element, attrs) {
        var form = $parse(attrs.validationSubmit)(scope);
        $timeout(function() {
          // Disable ng-click event propagation
          element.off('click');
          element.on('click', function(e) {
            e.preventDefault();
            $validationProvider.validate(form)
              .success(function() {
                $parse(attrs.ngClick)(scope);
              });
          });
        });
      }
    };
  }
  Submit.$inject = ['$injector'];
}).call(this);

(function() {
  angular
    .module('validation.directive')
    .directive('validator', Validator);

  function Validator($injector) {
    var $validationProvider = $injector.get('$validation');
    var $q = $injector.get('$q');
    var $timeout = $injector.get('$timeout');
    var $parse = $injector.get('$parse');
    var $rootScope = $injector.get('$rootScope');
    var $log = $injector.get('$log');
    var promiseUtils = $injector.get('validationPromiseUtils');

    /**
     * Do this function if validation valid
     * @param element
     * @param validMessage
     * @param validation
     * @param callback
     * @param ctrl
     * @returns {}
     */
    var validFunc = function(element, validMessage, validation, scope, ctrl, attrs) {
      var messageToShow = validMessage || $validationProvider.getDefaultMsg(validation).success;
      var validCallback = $parse('success');
      var messageElem;

      if (attrs.messageId) messageElem = angular.element(document.querySelector('#' + attrs.messageId));
      else messageElem = element.next();

      if (element.attr('no-validation-message')) {
        messageElem.css('display', 'none');
      } else if ($validationProvider.showSuccessMessage && messageToShow) {
        messageElem.html($validationProvider.getSuccessHTML(messageToShow));
        messageElem.css('display', '');
      } else {
        messageElem.css('display', 'none');
        messageElem.html('');
      }

      ctrl.$setValidity(ctrl.$name, true);
      if (validCallback) validCallback({
        message: messageToShow
      });
      if ($validationProvider.validCallback) $validationProvider.validCallback(element);

      return true;
    };


    /**
     * Do this function if validation invalid
     * @param element
     * @param validMessage
     * @param validation
     * @param callback
     * @param ctrl
     * @returns {}
     */
    var invalidFunc = function(element, validMessage, validation, scope, ctrl, attrs) {
      var messageToShow = validMessage || $validationProvider.getDefaultMsg(validation).error;
      var invalidCallback = $parse('error');
      var messageElem;

      if (attrs.messageId) messageElem = angular.element(document.querySelector('#' + attrs.messageId));
      else messageElem = element.next();

      if (element.attr('no-validation-message')) {
        messageElem.css('display', 'none');
      } else if ($validationProvider.showErrorMessage && messageToShow) {
        messageElem.html($validationProvider.getErrorHTML(messageToShow));
        messageElem.css('display', '');
      } else {
        messageElem.css('display', 'none');
      }

      ctrl.$setValidity(ctrl.$name, false);
      if (invalidCallback) invalidCallback({
        message: messageToShow
      });
      if ($validationProvider.invalidCallback) $validationProvider.invalidCallback(element);

      return false;
    };


    /**
     * collect elements for focus
     * @type {Object}
     ***private variable
     */
    var focusElements = {};


    /**
     * Check Validation with Function or RegExp
     * @param scope
     * @param element
     * @param attrs
     * @param ctrl
     * @param validation
     * @param value
     * @returns {}
     */
    var checkValidation = function(scope, element, attrs, ctrl, validation, value, override) {
      var validators = validation.slice(0);
      var validatorExpr = validators[0].trim();
      var paramIndex = validatorExpr.indexOf('=');
      var validator = paramIndex === -1 ? validatorExpr : validatorExpr.substr(0, paramIndex);
      var validatorParam = paramIndex === -1 ? null : validatorExpr.substr(paramIndex + 1);
      var leftValidation = validators.slice(1);
      var successMessage = validator + 'SuccessMessage';
      var errorMessage = validator + 'ErrorMessage';
      var expression = $validationProvider.getExpression(validator);
      var overideDefined = override !== undefined && override !== null;
      var valid = {
        success: function() {
          validFunc(element, attrs[successMessage], validator, scope, ctrl, attrs);
          if (leftValidation.length && !overideDefined) {
            return checkValidation(scope, element, attrs, ctrl, leftValidation, value);
          } else {
            return true;
          }
        },
        error: function() {
          return invalidFunc(element, attrs[errorMessage], validator, scope, ctrl, attrs);
        }
      };

      if (overideDefined)
        return override ? valid.success() : valid.error();

      if (expression === undefined) {
        $log.error('You are using undefined validator "%s"', validator);
        if (leftValidation.length) return checkValidation(scope, element, attrs, ctrl, leftValidation, value);
        else return;
      }
      // Check with Function
      if (expression.constructor === Function) {
        return $q.all([$validationProvider.getExpression(validator)(value, scope, element, attrs, validatorParam)])
          .then(function(data) {
            if (data && data.length > 0 && data[0]) return valid.success();
            else return valid.error();
          }, function() {
            return valid.error();
          });
      }

      // Check with RegExp
      else if (expression.constructor === RegExp) {
        // Only apply the test if the value is neither undefined or null
        if (value !== undefined && value !== null) return $validationProvider.getExpression(validator).test(value) ? valid.success() : valid.error();
        else return valid.error();
      } else return valid.error();
    };


    /**
     * generate unique guid
     */
    var s4 = function() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    var guid = function() {
      return (s4() + s4() + s4() + s4());
    };


    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(scope, element, attrs, ctrl) {

        if (!ctrl.$angularValidators)
          ctrl.$angularValidators = {};

        scope.$on('$destroy', function() {
          if (!ctrl.$angularValidators)
            return;
          delete ctrl.$angularValidators[ctrl.$name + 'submit-' + uid];
        });
        /**
         * watch
         * @type {watch}
         *
         * Use to collect scope.$watch method
         *
         * use watch() to destroy the $watch method
         */
        var watch = function() {};

        /**
         * validator
         * @type {Array}
         *
         * Convert user input String to Array
         */
        var validation = attrs.validator.split(',');

        /**
         * guid use
         */
        var uid = ctrl.validationId = guid();

        /**
         * to have avalue to rollback to
         */
        var originalViewValue = null;
        /**
         * Set initial validity to undefined if no boolean value is transmitted
         */
        var initialValidity;
        if (typeof scope.initialValidity === 'boolean') {
          initialValidity = scope.initialValidity;
        }

        /**
         * Default Valid/Invalid Message
         */
        if (!attrs.messageId) element.after('<span></span>');

        /**
         * Set custom initial validity
         * Usage: <input initial-validity="true" ... >
         */
        ctrl.$setValidity(ctrl.$name, initialValidity);

        /**
         * Reset the validation for specific form
         */
        scope.$on(ctrl.$name + 'reset-' + uid, function() {
          /**
           * clear scope.$watch here
           * when reset status
           * clear the $watch method to prevent
           * $watch again while reset the form
           */
          watch();

          $timeout(function() {
            ctrl.$setViewValue(originalViewValue);
            ctrl.$setPristine();
            ctrl.$setValidity(ctrl.$name, undefined);
            ctrl.$render();
            if (attrs.messageId) angular.element(document.querySelector('#' + attrs.messageId)).html('');
            else element.next().html('');
            if ($validationProvider.validCallback) $validationProvider.validCallback(element);
          });
        });

        /**
         * Check validator
         */


        var validMethod = (angular.isUndefined(attrs.validMethod)) ? $validationProvider.getValidMethod() : attrs.validMethod;

        /**
         * Click submit form, check the validity when submit
         *
         * TODO: Refactor to hash object to call individual functions this way we can get access to the promises
         */
        ctrl.$angularValidators[ctrl.$name + '-' + uid] = function(index, override) {
          $rootScope.$broadcast(ctrl.$name + '-' + uid, index); // broadcast for easy testing
          var value = ctrl.$viewValue;
          var isValid = false;

          isValid = checkValidation(scope, element, attrs, ctrl, validation, value, override);

          if (validMethod === 'submit') {
            // clear previous scope.$watch
            watch();
            watch = scope.$watch(function() {
              return scope.$eval(attrs.ngModel);
            }, function(value, oldValue) {
              // don't watch when init
              if (value === oldValue) {
                return;
              }

              // scope.$watch will translate '' to undefined
              // undefined/null will pass the required submit /^.+/
              // cause some error in this validation
              if (value === undefined || value === null) {
                value = '';
              }

              isValid = checkValidation(scope, element, attrs, ctrl, validation, value);
            });
          }

          var setFocus = function(isValid) {
            if (isValid) {
              delete focusElements[index];
            } else {
              focusElements[index] = element[0];

              $timeout(function() {
                focusElements[Math.min.apply(null, Object.keys(focusElements))].focus();
              }, 0);
            }
          };

          promiseUtils.toPromise(isValid)
            .then(function(result) {
              setFocus(result);
              return result;
            });

          return isValid;
        };

        /**
         * Validate blur method
         */
        if (validMethod === 'blur') {
          element.bind('blur', function() {
            var value = scope.$eval(attrs.ngModel);
            scope.$apply(function() {
              checkValidation(scope, element, attrs, ctrl, validation, value);
            });
          });

          return;
        }

        /**
         * Validate submit & submit-only method
         */
        if (validMethod === 'submit' || validMethod === 'submit-only') {
          return;
        }

        /**
         * Validate watch method
         * This is the default method
         */
        scope.$watch(function() {
          return scope.$eval(attrs.ngModel);
        }, function(value) {
          /**
           * dirty, pristine, viewValue control here
           */
          if (ctrl.$pristine && ctrl.$viewValue) {
            // has value when initial
            originalViewValue = ctrl.$viewValue || '';
            ctrl.$setViewValue(ctrl.$viewValue);
          } else if (ctrl.$pristine) {
            // Don't validate form when the input is clean(pristine)
            if (attrs.messageId) angular.element(document.querySelector('#' + attrs.messageId)).html('');
            else element.next().html('');
            return;
          }
          checkValidation(scope, element, attrs, ctrl, validation, value);
        });

        $timeout(function() {
          /**
           * Don't showup the validation Message
           */
          attrs.$observe('noValidationMessage', function(value) {
            var el;
            if (attrs.messageId) el = angular.element(document.querySelector('#' + attrs.messageId));
            else el = element.next();
            if (value === 'true' || value === true) el.css('display', 'none');
            else if (value === 'false' || value === false) el.css('display', 'block');
          });
        });
      }
    };
  }
  Validator.$inject = ['$injector'];
}).call(this);
