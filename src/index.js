/*
 * Copyright (c) 2017 American Express Travel Related Services Company, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
/* eslint-disable no-underscore-dangle */
const kebabCase = require('lodash/kebabCase');
const merge = require('lodash/merge');
const path = require('path');
const Chalk = require('chalk').constructor;
const { diffImageToSnapshot } = require('./diff-snapshot');

const SNAPSHOTS_DIR = '__image_snapshots__';

function updateSnapshotState(oldSnapshotState, newSnapshotState) {
  return merge({}, oldSnapshotState, newSnapshotState);
}

function configureToMatchImageSnapshot({
  customDiffConfig: commonCustomDiffConfig = {},
  noColors: commonNoColors = false,
  failureThreshold: commonFailureThreshold = 0,
  failureThresholdType: commonFailureThresholdType = 'pixel',
  verticalDiffArrange: commonVerticalDiffArrange = null,
} = {}) {
  return function toMatchImageSnapshot(received, {
    customSnapshotIdentifier = '',
    customSnapshotsDir,
    customDiffConfig = {},
    noColors = commonNoColors,
    failureThreshold = commonFailureThreshold,
    failureThresholdType = commonFailureThresholdType,
    verticalDiffArrange = commonVerticalDiffArrange,
  } = {}) {
    const { testPath, currentTestName, isNot } = this;
    const chalk = new Chalk({ enabled: !noColors });

    let { snapshotState } = this;
    if (isNot) { throw new Error('Jest: `.not` cannot be used with `.toMatchImageSnapshot()`.'); }

    updateSnapshotState(snapshotState, { _counters: snapshotState._counters.set(currentTestName, (snapshotState._counters.get(currentTestName) || 0) + 1) }); // eslint-disable-line max-len
    const snapshotIdentifier = customSnapshotIdentifier || kebabCase(`${path.basename(testPath)}-${currentTestName}-${snapshotState._counters.get(currentTestName)}`);

    const result = diffImageToSnapshot({
      receivedImageBuffer: received,
      snapshotIdentifier,
      snapshotsDir: customSnapshotsDir || path.join(path.dirname(testPath), SNAPSHOTS_DIR),
      updateSnapshot: snapshotState._updateSnapshot === 'all',
      customDiffConfig: Object.assign({}, commonCustomDiffConfig, customDiffConfig),
      failureThreshold,
      failureThresholdType,
      verticalDiffArrange,
    });

    let pass = true;
    /*
      istanbul ignore next
      `message` is implementation detail. Actual behavior is tested in integration.spec.js
    */
    let message = () => '';

    if (result.updated) {
      // once transition away from jasmine is done this will be a lot more elegant and pure
      // https://github.com/facebook/jest/pull/3668
      snapshotState = updateSnapshotState(snapshotState, { updated: snapshotState.updated += 1 });
    } else if (result.added) {
      snapshotState = updateSnapshotState(snapshotState, { added: snapshotState.added += 1 });
    } else {
      ({ pass } = result);

      if (!pass) {
        const differencePercentage = result.diffRatio * 100;

        message = () => `Expected image to match or be a close match to snapshot but was ${differencePercentage}% different from snapshot (${result.diffPixelCount} differing pixels).\n`
                  + `${chalk.bold.red('See diff for details:')} ${chalk.red(result.diffOutputPath)}`;
      }
    }

    return {
      message,
      pass,
    };
  };
}

module.exports = {
  toMatchImageSnapshot: configureToMatchImageSnapshot(),
  configureToMatchImageSnapshot,
};
