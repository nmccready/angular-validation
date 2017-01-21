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
