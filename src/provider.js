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
