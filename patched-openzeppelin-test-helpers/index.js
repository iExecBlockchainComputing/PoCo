const ozTestHelper = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

// const ozExpectRevert = ozTestHelper.expectRevert;

// const patchedExpectRevert = async function (...args) {
//   return ozExpectRevert(...args);
// };

// Object.entries(ozExpectRevert).forEach(([key, val]) => {
//   patchedExpectRevert[key] = val;
// });

// patchedExpectRevert.unspecified = async function (promise) {
//   console.warn(
//     `Using patched 'exceptRevert.unspecified', error message will not be checked by @openzeppelin/test-helpers`
//   );
//   try {
//     await promise;
//   } catch (error) {
//     console.info(`got error: ${error}`);
//     return;
//   }
//   expect.fail("Expected an exception but none was received");
// };

// const patchedTestHelper = {
//   ...ozTestHelper,
//   expectRevert: patchedExpectRevert,
// };

// console.log(
//   "using patched-openzeppelin-test-helpers based on @openzeppelin/test-helpers with patched 'exceptRevert.unspecified'"
// );

module.exports = ozTestHelper;
