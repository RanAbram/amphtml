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
import {Layout} from '../../../src/layout';
import {getIframe} from '../../../src/3p-frame';
import {removeElement} from '../../../src/dom';
import {listenFor} from '../../../src/iframe-helper';
import {CSS} from '../../../build/amp-mathml-0.1.css';

export class AmpMathml extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private {?HTMLIFrameElement} */
    this.iframe_ = null;
  }

  preconnectCallback() {
    this.preconnect.url('https://cdnjs.cloudflare.com');
  }

  layoutCallback() {
    const iframe = getIframe(this.win, this.element, 'mathml');
    this.applyFillContent(iframe);
    // Triggered by context.updateDimensions() inside the iframe.
    listenFor(iframe, 'embed-size', data => {
      if (!this.element.hasAttribute('inline')) {
        // Don't change the width if not inlined.
        data['width'] = undefined;
      }
      this.element.getResources()./*OK*/changeSize(
          this.element, data['height'], data['width']);
    }, /* opt_is3P */true);
    this.element.appendChild(iframe);
    this.iframe_ = iframe;
    return this.loadPromise(iframe);
  }

  unlayoutCallback() {
    if (this.iframe_) {
      removeElement(this.iframe_);
      this.iframe_ = null;
    }
    return true;
  }

  /** @override */
  isLayoutSupported(layout) {
    return layout == Layout.CONTAINER;
  }

}


AMP.extension('amp-mathml', '0.1', AMP => {
  AMP.registerElement('amp-mathml', AmpMathml, CSS);
});
