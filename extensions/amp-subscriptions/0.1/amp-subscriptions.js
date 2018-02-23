/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CSS} from '../../../build/amp-subscriptions-0.1.css';
import {EntitlementStore} from './entitlement-store';
import {Entitlements} from '../../../third_party/subscriptions-project/apis';
import {LocalSubscriptionPlatform} from './local-subscription-platform';
import {PageConfig, PageConfigResolver} from '../../../third_party/subscriptions-project/config';
import {Renderer} from './renderer';
import {SubscriptionPlatform} from './subscription-platform';
import {dev, user} from '../../../src/log';
import {installStylesForDoc} from '../../../src/style-installer';
import {tryParseJson} from '../../../src/json';

/** @const */
const TAG = 'amp-subscriptions';

export class SubscriptionService {
  /**
   * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    const configElement = ampdoc.getElementById(TAG);

    /** @const @private */
    this.ampdoc_ = ampdoc;

    // Install styles.
    installStylesForDoc(ampdoc, CSS, () => {}, false, TAG);

    /** @private @const {!Renderer} */
    this.renderer_ = new Renderer(ampdoc);

    /** @private {?PageConfig} */
    this.pageConfig_ = null;

    /** @private {?JsonObject} */
    this.serviceConfig_ = null;

    /** @private @const {!Array<!SubscriptionPlatform>} */
    this.subscriptionPlatforms_ = [];

    /** @private {?EntitlementStore} */
    this.entitlementStore_ = null;

    /** @const @private {!Element} */
    this.configElement_ = user().assertElement(configElement);
  }

  /**
   * @private
   * @return {!Promise}
   */
  initialize_() {
    const pageConfigResolver = new PageConfigResolver(this.ampdoc_.win);

    return Promise.all([
      this.getServiceConfig_(),
      pageConfigResolver.resolveConfig(),
    ]).then(promiseValues => {
      /** @type {!JsonObject} */
      this.serviceConfig_ = dev().assert(promiseValues[0]);
      /** @type {!PageConfig} */
      this.pageConfig_ = dev().assert(promiseValues[1]);

      user().assert(this.serviceConfig_['services'],
          'Services not configured in service config');

      this.serviceConfig_['services'].forEach(service => {
        this.initializeSubscriptionPlatforms_(service, this.pageConfig_);
      });
    });
  }

  /**
   * @param {!JsonObject} serviceConfig
   * @param {!PageConfig} pageConfig
   * @private
   */
  initializeSubscriptionPlatforms_(serviceConfig, pageConfig) {
    if ((serviceConfig['serviceId'] || 'local') == 'local') {
      this.subscriptionPlatforms_.push(
          new LocalSubscriptionPlatform(
              this.ampdoc_,
              serviceConfig,
              pageConfig
          )
      );
    }
  }

  /**
   * @private
   * @returns {!Promise<!JsonObject>}
   */
  getServiceConfig_() {
    return new Promise((resolve, reject) => {
      const rawContent = tryParseJson(this.configElement_.textContent, e => {
        reject('Failed to parse "amp-subscriptions" JSON: ' + e);
      });
      resolve(rawContent);
    });
  }

  /**
   * This method registers an auto initialized subcription platform with this service.
   *
   * @param {string} serviceId
   * @param {!SubscriptionPlatform} subscriptionPlatform
   */
  registerService(serviceId, subscriptionPlatform) {

    this.subscriptionPlatforms_.push(subscriptionPlatform);

    this.fetchEntitlements_(subscriptionPlatform);
  }

  /**
   * @param {boolean} grantState
   * @private
   */
  processGrantState_(grantState) {
    this.renderer_.toggleLoading(false);
    this.renderer_.setGrantState(grantState);

    if (grantState === false) {
      // TODO(@prateekbh): Show UI that no eligible entitlement found
      return;
    }

  }

  /**
   * @param {!Entitlements} entitlements
   * @private
   */
  resolveEntitlementsToStore_(entitlements) {
    this.entitlementStore_.resolveEntitlement(entitlements.service,
        entitlements);
  }

  /**
   *
   * @param {!SubscriptionPlatform} subscriptionPlatform
   */
  fetchEntitlements_(subscriptionPlatform) {
    subscriptionPlatform.getEntitlements().then(entitlements =>
      this.resolveEntitlementsToStore_(entitlements));
  }

  /** @private */
  start_() {
    this.initialize_().then(() => {
      this.renderer_.toggleLoading(true);

      const serviceIds = this.serviceConfig_['services'].map(service =>
        service['serviceId']);

      this.entitlementStore_ = new EntitlementStore(serviceIds);

      this.subscriptionPlatforms_.forEach(subscriptionPlatform => {
        this.fetchEntitlements_(subscriptionPlatform);
      });

      this.entitlementStore_.getGrantStatus()
          .then(grantState => {this.processGrantState_(grantState);});
    });
  }
}


/** @package @VisibleForTesting */
export function getPlatformClassForTesting() {
  return SubscriptionPlatform;
}

/**
 * TODO(dvoytenko): remove once compiler type checking is fixed for third_party.
 * @package @VisibleForTesting
 */
export function getPageConfigClassForTesting() {
  return PageConfig;
}

/**
 * TODO(dvoytenko): remove once compiler type checking is fixed for third_party.
 * @package @VisibleForTesting
 */
export function getEntitlementsClassForTesting() {
  return Entitlements;
}


// Register the extension services.
AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc(TAG, function(ampdoc) {
    return new SubscriptionService(ampdoc).start_();
  });
});
